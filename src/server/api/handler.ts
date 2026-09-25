import bcrypt from "bcryptjs";
import { query } from "@/server/db";
import { sendOtpEmail } from "@/server/mail/mailer";
import {
  getUserFromRequest,
  signSessionToken,
  createSessionCookie,
  clearSessionCookie,
} from "@/server/auth/session";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function handleApiRequest(request: Request, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  const method = request.method;

  // ----------------------------------------------------
  // AUTH: Sign Up (POST /api/auth/signup)
  // ----------------------------------------------------
  if (pathname === "/api/auth/signup" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const name = (body.name || "").trim();
      const password = body.password || "";
      const confirmPassword = body.confirmPassword || "";
      const department = (body.department || "").trim();
      const year = (body.year || "").trim();
      const className = (body.className || body.class_name || "").trim();

      if (!name) {
        return Response.json({ error: "Please enter your full name." }, { status: 400 });
      }

      if (!email || !email.includes("@")) {
        return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
      }

      // Check VISTAS student email format: e.g. up25g2480034@vistas.ac.in
      const vistasStudentRegex = /^[a-zA-Z0-9._%+-]+@vistas\.ac\.in$/i;
      const adminEmails = (process.env["ADMIN_EMAILS"] || "admin@vistas.ac.in")
        .toLowerCase()
        .split(",")
        .map((e) => e.trim());
      const isAdminEmail = adminEmails.includes(email);

      if (!isAdminEmail && !vistasStudentRegex.test(email)) {
        return Response.json(
          {
            error:
              "Only VISTAS student emails (e.g. up25g2480034@vistas.ac.in) are permitted to register.",
          },
          { status: 400 },
        );
      }

      if (!department) {
        return Response.json({ error: "Please select or enter your department." }, { status: 400 });
      }

      if (!year) {
        return Response.json(
          { error: "Please select or enter your year of study." },
          { status: 400 },
        );
      }

      if (!className) {
        return Response.json(
          { error: "Please enter your class / section (e.g. CSE-A)." },
          { status: 400 },
        );
      }

      if (password.length < 8) {
        return Response.json(
          { error: "Password must be at least 8 characters long." },
          { status: 400 },
        );
      }

      if (password !== confirmPassword) {
        return Response.json({ error: "Passwords do not match." }, { status: 400 });
      }

      const role = isAdminEmail ? "admin" : "student";

      // Check if verified user exists
      const existingUser = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (existingUser.rows.length > 0 && existingUser.rows[0].email_verified) {
        return Response.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 400 },
        );
      }

      const passwordHash = bcrypt.hashSync(password, 10);

      // Create or update unverified user with class, department, year, role
      if (existingUser.rows.length > 0) {
        await query(
          "UPDATE users SET name = $1, password_hash = $2, department = $3, year = $4, class_name = $5, role = $6, email_verified = false WHERE email = $7",
          [name, passwordHash, department, year, className, role, email],
        );
      } else {
        await query(
          "INSERT INTO users (email, name, password_hash, department, year, class_name, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, false)",
          [email, name, passwordHash, department, year, className, role],
        );
      }

      // Clean up previous OTPs for this email
      await query("DELETE FROM auth_otps WHERE email = $1", [email]);

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save OTP to DB including department, year, class
      await query(
        "INSERT INTO auth_otps (email, code, name, type, department, year, class_name, expires_at) VALUES ($1, $2, $3, 'signup', $4, $5, $6, $7)",
        [email, otp, name, department, year, className, expiresAt],
      );

      // Send verification email via Google SMTP
      await sendOtpEmail(email, otp, name);

      return Response.json({
        success: true,
        email,
        message: "Verification code sent to your email.",
      });
    } catch (err: any) {
      console.error("signup error:", err);
      return Response.json({ error: err?.message || "Failed to create account." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // AUTH: Sign In (POST /api/auth/signin)
  // ----------------------------------------------------
  if (pathname === "/api/auth/signin" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";

      if (!email || !password) {
        return Response.json({ error: "Email and password are required." }, { status: 400 });
      }

      const userRes = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (userRes.rows.length === 0) {
        return Response.json(
          { error: "No account found with this email. Please sign up." },
          { status: 400 },
        );
      }

      const user = userRes.rows[0];

      // Verify password if set
      if (user.password_hash) {
        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) {
          return Response.json({ error: "Incorrect password. Please try again." }, { status: 400 });
        }
      }

      // Check if user is verified! If not verified, require OTP verification first
      if (user.email_verified === false) {
        // Generate new OTP and send via Google SMTP
        await query("DELETE FROM auth_otps WHERE email = $1", [email]);
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await query(
          "INSERT INTO auth_otps (email, code, name, type, department, year, class_name, expires_at) VALUES ($1, $2, $3, 'signup', $4, $5, $6, $7)",
          [email, otp, user.name, user.department, user.year, user.class_name, expiresAt],
        );
        await sendOtpEmail(email, otp, user.name);

        return Response.json(
          {
            success: false,
            requiresVerification: true,
            email,
            error:
              "Your account is not verified yet. We have sent a 6-digit verification code to your email. Please verify to sign in.",
          },
          { status: 403 },
        );
      }

      // Strictly enforce role: ONLY admin@vistas.ac.in is admin, everyone else is a student
      const role = user.email === "admin@vistas.ac.in" ? "admin" : "student";
      if (role !== user.role) {
        await query("UPDATE users SET role = $1 WHERE id = $2", [role, user.id]);
      }

      // Issue JWT session cookie
      const token = signSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        className: user.class_name || undefined,
        department: user.department || undefined,
        year: user.year || undefined,
      });
      const cookie = createSessionCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            role,
            className: user.class_name || null,
            department: user.department || null,
            year: user.year || null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    } catch (err: any) {
      console.error("signin error:", err);
      return Response.json({ error: err?.message || "Failed to sign in." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // AUTH: Verify OTP & Activate Account (POST /api/auth/verify-otp)
  // ----------------------------------------------------
  if (pathname === "/api/auth/verify-otp" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const code = (body.code || "").trim();

      if (!email || !code) {
        return Response.json(
          { error: "Email and verification code are required." },
          { status: 400 },
        );
      }

      // Check OTP in DB
      const result = await query(
        "SELECT * FROM auth_otps WHERE email = $1 AND code = $2 AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
        [email, code],
      );

      if (result.rows.length === 0) {
        return Response.json({ error: "Invalid or expired verification code." }, { status: 400 });
      }

      const otpRecord = result.rows[0];

      // Mark user as verified, preserving department, year, and class_name
      let userRes = await query("SELECT * FROM users WHERE email = $1", [email]);
      let user = userRes.rows[0];

      const userDept = otpRecord.department || user?.department || null;
      const userYear = otpRecord.year || user?.year || null;
      const userClass = otpRecord.class_name || user?.class_name || null;

      const role = email === "admin@vistas.ac.in" ? "admin" : "student";

      if (!user) {
        const userName = otpRecord.name || email.split("@")[0] || "Student";
        const insertRes = await query(
          "INSERT INTO users (email, name, department, year, class_name, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, email, name, avatar_url, role, class_name, department, year",
          [email, userName, userDept, userYear, userClass, role],
        );
        user = insertRes.rows[0];
      } else {
        const updateRes = await query(
          "UPDATE users SET email_verified = true, department = COALESCE($2, users.department), year = COALESCE($3, users.year), class_name = COALESCE($4, users.class_name), role = $5 WHERE email = $1 RETURNING id, email, name, avatar_url, role, class_name, department, year",
          [email, userDept, userYear, userClass, role],
        );
        user = updateRes.rows[0];
      }

      // Delete used OTP
      await query("DELETE FROM auth_otps WHERE email = $1", [email]);

      // Create JWT session cookie with full student context
      const token = signSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || role,
        className: user.class_name || undefined,
        department: user.department || undefined,
        year: user.year || undefined,
      });
      const cookie = createSessionCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            role: user.role || role,
            className: user.class_name || null,
            department: user.department || null,
            year: user.year || null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    } catch (err: any) {
      console.error("verify-otp error:", err);
      return Response.json({ error: err?.message || "Failed to verify code." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // AUTH: Resend OTP (POST /api/auth/resend-otp)
  // ----------------------------------------------------
  if (pathname === "/api/auth/resend-otp" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();

      if (!email || !email.includes("@")) {
        return Response.json({ error: "Please provide a valid email address." }, { status: 400 });
      }

      const userRes = await query("SELECT name FROM users WHERE email = $1", [email]);
      const name = userRes.rows[0]?.name || "";

      await query("DELETE FROM auth_otps WHERE email = $1", [email]);

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await query(
        "INSERT INTO auth_otps (email, code, name, type, expires_at) VALUES ($1, $2, $3, 'signup', $4)",
        [email, otp, name, expiresAt],
      );

      await sendOtpEmail(email, otp, name);

      return Response.json({
        success: true,
        message: "Verification code sent to your email.",
      });
    } catch (err: any) {
      console.error("resend-otp error:", err);
      return Response.json(
        { error: err?.message || "Failed to resend verification email." },
        { status: 500 },
      );
    }
  }

  // ----------------------------------------------------
  // AUTH: Forgot Password Request (POST /api/auth/forgot-password)
  // ----------------------------------------------------
  if (pathname === "/api/auth/forgot-password" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();

      if (!email) {
        return Response.json({ error: "Please enter your email address." }, { status: 400 });
      }

      const userRes = await query("SELECT id, name FROM users WHERE email = $1", [email]);
      if (userRes.rows.length === 0) {
        // Return success message anyway for security
        return Response.json({
          success: true,
          message: "If an account exists, a reset code was sent.",
        });
      }

      const user = userRes.rows[0];
      await query("DELETE FROM auth_otps WHERE email = $1", [email]);

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await query(
        "INSERT INTO auth_otps (email, code, name, type, expires_at) VALUES ($1, $2, $3, 'forgot_password', $4)",
        [email, otp, user.name, expiresAt],
      );

      await sendOtpEmail(email, otp, user.name, "forgot_password");

      return Response.json({ success: true, message: "Password reset code sent to your email." });
    } catch (err: any) {
      return Response.json(
        { error: err?.message || "Failed to send reset code." },
        { status: 500 },
      );
    }
  }

  // ----------------------------------------------------
  // AUTH: Reset Password (POST /api/auth/reset-password)
  // ----------------------------------------------------
  if (pathname === "/api/auth/reset-password" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const code = (body.code || "").trim();
      const newPassword = body.newPassword || "";

      if (!email || !code || !newPassword) {
        return Response.json({ error: "All fields are required." }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return Response.json(
          { error: "Password must be at least 8 characters long." },
          { status: 400 },
        );
      }

      const result = await query(
        "SELECT * FROM auth_otps WHERE email = $1 AND code = $2 AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
        [email, code],
      );

      if (result.rows.length === 0) {
        return Response.json({ error: "Invalid or expired reset code." }, { status: 400 });
      }

      const passwordHash = bcrypt.hashSync(newPassword, 10);
      await query("UPDATE users SET password_hash = $1, email_verified = true WHERE email = $2", [
        passwordHash,
        email,
      ]);
      await query("DELETE FROM auth_otps WHERE email = $1", [email]);

      return Response.json({
        success: true,
        message: "Password updated successfully. You can now sign in.",
      });
    } catch (err: any) {
      return Response.json({ error: err?.message || "Failed to reset password." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // AUTH: Get Current Session (GET /api/auth/session)
  // ----------------------------------------------------
  if (pathname === "/api/auth/session" && method === "GET") {
    try {
      const user = getUserFromRequest(request);
      if (!user) {
        return Response.json({ user: null });
      }

      const dbUserRes = await query(
        "SELECT id, email, name, avatar_url, role, class_name, department, year FROM users WHERE id = $1",
        [user.id],
      );
      if (dbUserRes.rows.length === 0) {
        return Response.json({ user: null });
      }

      const dbUser = dbUserRes.rows[0];
      return Response.json({
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          avatarUrl: dbUser.avatar_url,
          role: dbUser.role || "student",
          className: dbUser.class_name || null,
          department: dbUser.department || null,
          year: dbUser.year || null,
        },
      });
    } catch (err) {
      return Response.json({ user: null });
    }
  }

  // ----------------------------------------------------
  // AUTH: Logout (POST /api/auth/logout)
  // ----------------------------------------------------
  if (pathname === "/api/auth/logout" && method === "POST") {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  }

  // ----------------------------------------------------
  // POLLS: List Polls (GET /api/polls)
  // ----------------------------------------------------
  if (pathname === "/api/polls" && method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");
      const sort = url.searchParams.get("sort") || "recent";
      const feed = url.searchParams.get("feed"); // "class" | "global" | undefined

      const sessionUser = getUserFromRequest(request);
      let dbUser: { role?: string; class_name?: string | null; year?: string | null } | null = null;
      if (sessionUser) {
        const userRow = await query("SELECT role, class_name, year FROM users WHERE id = $1", [
          sessionUser.id,
        ]);
        dbUser = userRow.rows[0] || null;
      }

      const isAdmin = dbUser?.role === "admin" || sessionUser?.email === "admin@vistas.ac.in";

      let queryText = `
        SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', po.id,
                'poll_id', po.poll_id,
                'label', po.label,
                'position', po.position,
                'votes_count', po.votes_count
              ) ORDER BY po.position
            ) FILTER (WHERE po.id IS NOT NULL),
            '[]'
          ) as poll_options
        FROM polls p
        LEFT JOIN poll_options po ON p.id = po.poll_id
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      // Enforce class and year scope:
      // Polls created by students are ONLY accessible to their exact class and year.
      if (isAdmin) {
        if (feed === "global") {
          conditions.push(`p.is_global = true`);
        } else if (feed === "class") {
          conditions.push(`p.is_global = false`);
        }
      } else if (sessionUser && dbUser) {
        if (feed === "global") {
          conditions.push(`p.is_global = true`);
        } else if (feed === "class") {
          if (dbUser.class_name && dbUser.year) {
            params.push(dbUser.class_name.trim());
            const classParam = params.length;
            params.push(dbUser.year.trim());
            const yearParam = params.length;
            params.push(sessionUser.id);
            const userParam = params.length;
            conditions.push(
              `(p.is_global = false AND ((LOWER(TRIM(p.class_name)) = LOWER(TRIM($${classParam})) AND LOWER(TRIM(p.year)) = LOWER(TRIM($${yearParam}))) OR p.creator_id = $${userParam}))`,
            );
          } else {
            params.push(sessionUser.id);
            conditions.push(`(p.is_global = false AND p.creator_id = $${params.length})`);
          }
        } else if (dbUser.class_name && dbUser.year) {
          params.push(dbUser.class_name.trim());
          const classParam = params.length;
          params.push(dbUser.year.trim());
          const yearParam = params.length;
          params.push(sessionUser.id);
          const userParam = params.length;
          // All Feed: Accessible if: Global poll OR exact matching class & year OR created by this student
          conditions.push(
            `(p.is_global = true OR (LOWER(TRIM(p.class_name)) = LOWER(TRIM($${classParam})) AND LOWER(TRIM(p.year)) = LOWER(TRIM($${yearParam}))) OR p.creator_id = $${userParam})`,
          );
        } else {
          // If student has no class or year set yet, only see global polls or own created polls
          params.push(sessionUser.id);
          conditions.push(`(p.is_global = true OR p.creator_id = $${params.length})`);
        }
      } else {
        // Unauthenticated guests only see global campus-wide polls
        conditions.push(`p.is_global = true`);
      }

      const filterClass = url.searchParams.get("className");
      if (filterClass && filterClass.trim()) {
        params.push(filterClass.trim());
        conditions.push(`LOWER(TRIM(p.class_name)) = LOWER(TRIM($${params.length}))`);
      }

      if (category === "Closed") {
        conditions.push(`p.expires_at <= now()`);
      } else {
        // "All" and specific categories only show active, unexpired polls
        conditions.push(`p.expires_at > now()`);
        if (category && category !== "All") {
          params.push(category);
          conditions.push(`p.category = $${params.length}`);
        }
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        conditions.push(`p.question ILIKE $${params.length}`);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(" AND ")}`;
      }

      queryText += ` GROUP BY p.id`;

      if (sort === "votes") {
        queryText += ` ORDER BY p.total_votes DESC`;
      } else if (sort === "ending") {
        queryText += ` ORDER BY p.expires_at ASC`;
      } else {
        queryText += ` ORDER BY p.created_at DESC`;
      }

      queryText += ` LIMIT 60`;

      const res = await query(queryText, params);
      return Response.json({ data: res.rows });
    } catch (err: any) {
      console.error("fetch polls error:", err);
      return Response.json({ error: err?.message || "Failed to fetch polls." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // POLLS: Create Poll (POST /api/polls)
  // ----------------------------------------------------
  if (pathname === "/api/polls" && method === "POST") {
    try {
      const user = getUserFromRequest(request);
      if (!user) {
        return Response.json(
          { error: "Authentication required to create a poll." },
          { status: 401 },
        );
      }

      const body = await request.json();
      const {
        question,
        options,
        category,
        durationMinutes,
        anonymousVoting,
        multipleSelection,
        isGlobal,
        className: inputClassName,
        year: inputYear,
        department: inputDepartment,
      } = body;

      const trimmedQ = (question || "").trim();
      const validOptions = (options || []).map((o: string) => o.trim()).filter(Boolean);

      if (!trimmedQ || validOptions.length < 2) {
        return Response.json({ error: "Invalid question or not enough options." }, { status: 400 });
      }

      // Fetch creator user from DB to inherit class & department information
      const dbUserRes = await query(
        "SELECT role, class_name, department, year FROM users WHERE id = $1",
        [user.id],
      );
      const dbUser = dbUserRes.rows[0] || {};
      const isAdmin = dbUser.role === "admin" || user.email === "admin@vistas.ac.in";

      let willBeGlobal = false;
      let pollClass = dbUser.class_name || null;
      let pollDept = dbUser.department || null;
      let pollYear = dbUser.year || null;

      if (isAdmin) {
        if (isGlobal) {
          willBeGlobal = true;
          pollClass = "Global";
          pollDept = "Campus-Wide";
          pollYear = "All";
        } else {
          willBeGlobal = false;
          pollClass = (inputClassName || "").trim() || null;
          pollYear = (inputYear || "").trim() || null;
          pollDept = (inputDepartment || "").trim() || "General";

          if (!pollClass || !pollYear) {
            return Response.json(
              {
                error:
                  "Please specify both the Target Class / Section (e.g. CSE-A) and Year of Study (e.g. 3rd Year) for this class poll.",
              },
              { status: 400 },
            );
          }
        }
      } else {
        if (isGlobal) {
          return Response.json(
            {
              error:
                "Only the authorized administrator (admin@vistas.ac.in) can create campus-wide global polls.",
            },
            { status: 403 },
          );
        }
        willBeGlobal = false;
        if (!pollClass || !pollYear) {
          return Response.json(
            {
              error:
                "Please set your Class / Section and Year of Study in your profile before creating a class poll.",
            },
            { status: 400 },
          );
        }
      }

      const expiresAt = new Date(Date.now() + (durationMinutes || 1440) * 60_000);
      const creatorName = anonymousVoting ? "Anonymous" : user.name;

      const pollRes = await query(
        `INSERT INTO polls (question, category, creator_id, creator_name, expires_at, anonymous_voting, multiple_selection, is_global, class_name, department, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          trimmedQ,
          category || "Campus",
          user.id,
          creatorName,
          expiresAt,
          !!anonymousVoting,
          !!multipleSelection,
          willBeGlobal,
          pollClass,
          pollDept,
          pollYear,
        ],
      );

      const pollId = pollRes.rows[0].id;

      for (let i = 0; i < validOptions.length; i++) {
        await query("INSERT INTO poll_options (poll_id, label, position) VALUES ($1, $2, $3)", [
          pollId,
          validOptions[i],
          i,
        ]);
      }

      return Response.json({ id: pollId });
    } catch (err: any) {
      console.error("create poll error:", err);
      return Response.json({ error: err?.message || "Failed to create poll." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // POLLS: Fetch User's Created Polls (GET /api/polls/my)
  // ----------------------------------------------------
  if (pathname === "/api/polls/my" && method === "GET") {
    try {
      const user = getUserFromRequest(request);
      if (!user) return Response.json({ data: [] });

      const res = await query(
        `SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', po.id,
                'poll_id', po.poll_id,
                'label', po.label,
                'position', po.position,
                'votes_count', po.votes_count
              ) ORDER BY po.position
            ) FILTER (WHERE po.id IS NOT NULL),
            '[]'
          ) as poll_options
        FROM polls p
        LEFT JOIN poll_options po ON p.id = po.poll_id
        WHERE p.creator_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
        [user.id],
      );

      return Response.json({ data: res.rows });
    } catch (err: any) {
      return Response.json(
        { error: err?.message || "Failed to fetch user polls" },
        { status: 500 },
      );
    }
  }

  // ----------------------------------------------------
  // POLLS: Single Poll (GET & DELETE /api/polls/:id)
  // ----------------------------------------------------
  const pollMatch = pathname.match(/^\/api\/polls\/([a-zA-Z0-9-]+)$/);
  if (pollMatch) {
    const pollId = pollMatch[1];

    if (method === "GET") {
      try {
        const res = await query(
          `SELECT p.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', po.id,
                  'poll_id', po.poll_id,
                  'label', po.label,
                  'position', po.position,
                  'votes_count', po.votes_count
                ) ORDER BY po.position
              ) FILTER (WHERE po.id IS NOT NULL),
              '[]'
            ) as poll_options
          FROM polls p
          LEFT JOIN poll_options po ON p.id = po.poll_id
          WHERE p.id = $1
          GROUP BY p.id`,
          [pollId],
        );

        if (res.rows.length === 0) {
          return Response.json({ error: "Poll not found" }, { status: 404 });
        }

        const poll = res.rows[0];

        // Access control: if poll is not global, only allow students of the exact same class & year
        if (!poll.is_global) {
          const sessionUser = getUserFromRequest(request);
          if (!sessionUser) {
            return Response.json(
              {
                error: `Access restricted: This poll is only accessible to students in ${poll.class_name || "their class"}${poll.year ? ` (${poll.year})` : ""}. Please sign in.`,
              },
              { status: 403 },
            );
          }

          const userRow = await query("SELECT role, class_name, year FROM users WHERE id = $1", [
            sessionUser.id,
          ]);
          const dbUser = userRow.rows[0];
          const isAdmin = dbUser?.role === "admin" || sessionUser.email === "admin@vistas.ac.in";
          const isCreator = sessionUser.id === poll.creator_id;
          const sameClassAndYear = Boolean(
            dbUser?.class_name &&
            dbUser?.year &&
            poll.class_name &&
            poll.year &&
            dbUser.class_name.trim().toLowerCase() === poll.class_name.trim().toLowerCase() &&
            dbUser.year.trim().toLowerCase() === poll.year.trim().toLowerCase(),
          );

          if (!isAdmin && !isCreator && !sameClassAndYear) {
            return Response.json(
              {
                error: `Access restricted: This poll is only available to students in ${poll.class_name}${poll.year ? ` (${poll.year})` : ""}. Other classes cannot access it.`,
              },
              { status: 403 },
            );
          }
        }

        return Response.json({ data: poll });
      } catch (err: any) {
        return Response.json({ error: err?.message || "Error fetching poll" }, { status: 500 });
      }
    }

    if (method === "DELETE") {
      try {
        const user = getUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        await query("DELETE FROM polls WHERE id = $1 AND creator_id = $2", [pollId, user.id]);
        return Response.json({ success: true });
      } catch (err: any) {
        return Response.json({ error: err?.message || "Error deleting poll" }, { status: 500 });
      }
    }
  }

  // ----------------------------------------------------
  // VOTES: Cast Vote (POST /api/polls/:id/vote)
  // ----------------------------------------------------
  const voteMatch = pathname.match(/^\/api\/polls\/([a-zA-Z0-9-]+)\/vote$/);
  if (voteMatch && method === "POST") {
    try {
      const pollId = voteMatch[1];
      const user = getUserFromRequest(request);
      if (!user) {
        return Response.json({ error: "Sign in to cast your vote." }, { status: 401 });
      }

      const body = await request.json();
      const optionIds: string[] = body.optionIds || [];

      if (optionIds.length === 0) {
        return Response.json({ error: "Please select at least one option." }, { status: 400 });
      }

      // Check if poll exists and is open
      const pollRes = await query("SELECT * FROM polls WHERE id = $1", [pollId]);
      if (pollRes.rows.length === 0) {
        return Response.json({ error: "Poll not found." }, { status: 404 });
      }

      const poll = pollRes.rows[0];
      if (new Date(poll.expires_at).getTime() <= Date.now()) {
        return Response.json({ error: "This poll has closed." }, { status: 400 });
      }

      // Access control: If not global, must belong to same class and year
      if (!poll.is_global) {
        const userRow = await query("SELECT role, class_name, year FROM users WHERE id = $1", [
          user.id,
        ]);
        const dbUser = userRow.rows[0];
        const isAdmin = dbUser?.role === "admin" || user.email === "admin@vistas.ac.in";
        const isCreator = user.id === poll.creator_id;
        const sameClassAndYear = Boolean(
          dbUser?.class_name &&
          dbUser?.year &&
          poll.class_name &&
          poll.year &&
          dbUser.class_name.trim().toLowerCase() === poll.class_name.trim().toLowerCase() &&
          dbUser.year.trim().toLowerCase() === poll.year.trim().toLowerCase(),
        );

        if (!isAdmin && !isCreator && !sameClassAndYear) {
          return Response.json(
            {
              error: `Voting restricted: This poll is only open to students in ${poll.class_name}${poll.year ? ` (${poll.year})` : ""}.`,
            },
            { status: 403 },
          );
        }
      }

      // Check if already voted
      const existingVote = await query("SELECT id FROM votes WHERE poll_id = $1 AND user_id = $2", [
        pollId,
        user.id,
      ]);
      if (existingVote.rows.length > 0) {
        return Response.json({ error: "You've already voted in this poll." }, { status: 400 });
      }

      // Insert votes and increment vote count
      for (const optId of optionIds) {
        await query("INSERT INTO votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)", [
          pollId,
          optId,
          user.id,
        ]);
        await query("UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = $1", [optId]);
      }

      await query("UPDATE polls SET total_votes = total_votes + 1 WHERE id = $1", [pollId]);

      return Response.json({ success: true });
    } catch (err: any) {
      console.error("cast vote error:", err);
      return Response.json({ error: err?.message || "Failed to vote." }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // VOTES: Fetch User's Votes (POST /api/votes/my)
  // ----------------------------------------------------
  if (pathname === "/api/votes/my" && method === "POST") {
    try {
      const user = getUserFromRequest(request);
      if (!user) return Response.json({ data: {} });

      const body = await request.json();
      const pollIds: string[] = body.pollIds || [];
      if (pollIds.length === 0) return Response.json({ data: {} });

      const res = await query(
        "SELECT poll_id, option_id FROM votes WHERE user_id = $1 AND poll_id = ANY($2)",
        [user.id, pollIds],
      );

      const map: Record<string, string[]> = {};
      for (const row of res.rows) {
        (map[row.poll_id] ??= []).push(row.option_id);
      }

      return Response.json({ data: map });
    } catch (err: any) {
      return Response.json({ data: {} });
    }
  }

  // ----------------------------------------------------
  // PROFILE: Update Details & Get Stats (GET & POST /api/profile)
  // ----------------------------------------------------
  if (pathname === "/api/profile" && method === "GET") {
    try {
      const user = getUserFromRequest(request);
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      const [dbUserRes, pollsRes, votesRes] = await Promise.all([
        query(
          "SELECT id, email, name, avatar_url, role, class_name, department, year, created_at FROM users WHERE id = $1",
          [user.id],
        ),
        query("SELECT COUNT(*) as count FROM polls WHERE creator_id = $1", [user.id]),
        query("SELECT COUNT(*) as count FROM votes WHERE user_id = $1", [user.id]),
      ]);

      const dbUser = dbUserRes.rows[0];
      if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

      return Response.json({
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          avatarUrl: dbUser.avatar_url,
          role: dbUser.role || "student",
          className: dbUser.class_name || null,
          department: dbUser.department || null,
          year: dbUser.year || null,
          createdAt: dbUser.created_at,
        },
        polls: parseInt(pollsRes.rows[0]?.count || "0", 10),
        votes: parseInt(votesRes.rows[0]?.count || "0", 10),
      });
    } catch (err: any) {
      return Response.json({ error: err?.message || "Failed to load profile" }, { status: 500 });
    }
  }

  if (pathname === "/api/profile" && method === "POST") {
    try {
      const user = getUserFromRequest(request);
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      const body = await request.json();
      const name = (body.name || "").trim();
      const department = (body.department || "").trim();
      const year = (body.year || "").trim();
      const className = (body.className || "").trim();

      if (!name) return Response.json({ error: "Full name cannot be empty" }, { status: 400 });
      if (!department)
        return Response.json({ error: "Department cannot be empty" }, { status: 400 });
      if (!year) return Response.json({ error: "Year of study cannot be empty" }, { status: 400 });
      if (!className)
        return Response.json({ error: "Class / Section cannot be empty" }, { status: 400 });

      const updateRes = await query(
        "UPDATE users SET name = $1, department = $2, year = $3, class_name = $4 WHERE id = $5 RETURNING id, email, name, avatar_url, role, class_name, department, year",
        [name, department, year, className, user.id],
      );
      const updatedUser = updateRes.rows[0];

      // Re-sign token with updated info preserving role and new class
      const token = signSessionToken({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role || "student",
        className: updatedUser.class_name || undefined,
        department: updatedUser.department || undefined,
        year: updatedUser.year || undefined,
      });
      const cookie = createSessionCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            avatarUrl: updatedUser.avatar_url,
            role: updatedUser.role || "student",
            className: updatedUser.class_name || null,
            department: updatedUser.department || null,
            year: updatedUser.year || null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    } catch (err: any) {
      return Response.json({ error: err?.message || "Failed to update profile" }, { status: 500 });
    }
  }

  // ----------------------------------------------------
  // ADMIN: Dedicated Login (POST /api/admin/login)
  // ----------------------------------------------------
  if (pathname === "/api/admin/login" && method === "POST") {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";

      // Strictly enforce email "admin@vistas.ac.in" and password "admin@987"
      if (email !== "admin@vistas.ac.in" || password !== "admin@987") {
        return Response.json(
          { error: "Invalid administrator credentials. Access restricted." },
          { status: 401 },
        );
      }

      const userRes = await query(
        "SELECT id, email, name, avatar_url, role, class_name, department, year, password_hash FROM users WHERE email = $1",
        ["admin@vistas.ac.in"],
      );
      if (userRes.rows.length === 0) {
        return Response.json({ error: "Administrator account not found." }, { status: 404 });
      }

      const user = userRes.rows[0];

      // Issue JWT session cookie for administrator
      const token = signSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: "admin",
        className: user.class_name || undefined,
        department: user.department || undefined,
        year: user.year || undefined,
      });
      const cookie = createSessionCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            role: "admin",
            className: user.class_name || null,
            department: user.department || null,
            year: user.year || null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    } catch (err: any) {
      return Response.json(
        { error: err?.message || "Admin authentication failed." },
        { status: 500 },
      );
    }
  }

  // ----------------------------------------------------
  // ADMIN: Overview & Stats (GET /api/admin/stats)
  // ----------------------------------------------------
  if (pathname === "/api/admin/stats" && method === "GET") {
    try {
      const user = getUserFromRequest(request);
      if (!user || user.email !== "admin@vistas.ac.in") {
        return Response.json(
          { error: "Unauthorized: Administrator access required" },
          { status: 401 },
        );
      }

      const userRow = await query("SELECT role FROM users WHERE id = $1", [user.id]);
      if (userRow.rows[0]?.role !== "admin") {
        return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }

      const [globalPollsRes, classPollsRes, totalVotesRes, totalUsersRes] = await Promise.all([
        query("SELECT COUNT(*) as count FROM polls WHERE is_global = true"),
        query("SELECT COUNT(*) as count FROM polls WHERE is_global = false"),
        query("SELECT COUNT(*) as count FROM votes"),
        query("SELECT COUNT(*) as count FROM users"),
      ]);

      return Response.json({
        globalPollsCount: parseInt(globalPollsRes.rows[0]?.count || "0", 10),
        classPollsCount: parseInt(classPollsRes.rows[0]?.count || "0", 10),
        totalVotes: parseInt(totalVotesRes.rows[0]?.count || "0", 10),
        totalUsers: parseInt(totalUsersRes.rows[0]?.count || "0", 10),
      });
    } catch (err: any) {
      return Response.json(
        { error: err?.message || "Failed to load admin stats" },
        { status: 500 },
      );
    }
  }

  // ----------------------------------------------------
  // ADMIN: List Classes (GET /api/admin/classes)
  // ----------------------------------------------------
  if (pathname === "/api/admin/classes" && method === "GET") {
    try {
      const user = getUserFromRequest(request);
      if (!user || user.email !== "admin@vistas.ac.in") {
        return Response.json(
          { error: "Unauthorized: Administrator access required" },
          { status: 401 },
        );
      }

      const res = await query(`
        SELECT DISTINCT class_name, year, department
        FROM (
          SELECT class_name, year, department FROM users WHERE class_name IS NOT NULL AND TRIM(class_name) != '' AND LOWER(TRIM(class_name)) != 'global'
          UNION
          SELECT class_name, year, department FROM polls WHERE class_name IS NOT NULL AND TRIM(class_name) != '' AND LOWER(TRIM(class_name)) != 'global'
        ) AS combined_classes
        ORDER BY class_name ASC, year ASC
      `);

      return Response.json({
        classes: res.rows.map((r) => ({
          className: r.class_name,
          year: r.year,
          department: r.department,
        })),
      });
    } catch (err: any) {
      return Response.json(
        { error: err?.message || "Failed to load classes" },
        { status: 500 },
      );
    }
  }

  return null;
}
