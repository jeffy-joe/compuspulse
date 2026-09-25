import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { ArrowRight, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { VISTAS_CLASSES } from "@/lib/polls";

type Search = { redirect?: string | undefined; mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect:
      typeof search["redirect"] === "string" && search["redirect"].startsWith("/")
        ? (search["redirect"] as string)
        : undefined,
    mode: search["mode"] === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Authentication — CampusPulse" },
      {
        name: "description",
        content:
          "Sign in or create a CampusPulse account with Google SMTP email verification to vote and create polls.",
      },
      { property: "og:title", content: "CampusPulse — Sign In & Register" },
      {
        property: "og:description",
        content: "CampusPulse account portal with Google SMTP email verification.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup" | "verify" | "forgot" | "reset";

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, signUp, signIn, verifyOtp, resendOtp, forgotPassword, resetPassword } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>(search.mode === "signup" ? "signup" : "signin");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [className, setClassName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const destination = search.redirect ?? "/home";

  useEffect(() => {
    if (!loading && user) navigate({ to: destination, replace: true });
  }, [loading, user, destination, navigate]);

  // Resend OTP cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handler: Sign Up
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanDept = department.trim();
    const cleanYear = year.trim();
    const cleanClass = className.trim();

    if (!cleanName) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    // Verify VISTAS student email format e.g. up25g2480034@vistas.ac.in
    const vistasStudentRegex = /^[a-zA-Z0-9._%+-]+@vistas\.ac\.in$/i;
    if (!vistasStudentRegex.test(cleanEmail)) {
      toast.error(
        "Only VISTAS student email addresses (e.g. up25g2480034@vistas.ac.in) are permitted.",
      );
      return;
    }

    if (!cleanDept) {
      toast.error("Please enter your department.");
      return;
    }
    if (!cleanYear) {
      toast.error("Please select or enter your year of study.");
      return;
    }
    if (!cleanClass) {
      toast.error("Please enter your class / section (e.g. CSE-A).");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await signUp({
        name: cleanName,
        email: cleanEmail,
        password,
        confirmPassword,
        department: cleanDept,
        year: cleanYear,
        className: cleanClass,
      });
      toast.success("Verification code sent! Please check your email inbox.");
      setMode("verify");
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Handler: Sign In
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    setBusy(true);
    try {
      await signIn({ email: cleanEmail, password });
      toast.success("Signed in successfully!");
      navigate({ to: destination, replace: true });
    } catch (err: unknown) {
      const errObj = err as { message?: string; requiresVerification?: boolean };
      if (errObj?.requiresVerification) {
        toast.warning(errObj.message || "Please verify your email before logging in.");
        setMode("verify");
        setResendCooldown(60);
      } else {
        toast.error(errObj?.message || "Invalid email or password.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Handler: Verify OTP (Google SMTP)
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }

    setBusy(true);
    try {
      await verifyOtp(cleanEmail, cleanOtp);
      toast.success("Account verified successfully! Welcome to CampusPulse.");
      navigate({ to: destination, replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid or expired verification code.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Handler: Resend OTP
  async function handleResendOtp() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setBusy(true);
    try {
      await resendOtp(cleanEmail);
      toast.success("Verification code resent! Please check your email inbox.");
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend verification code.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Handler: Forgot Password Request
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter your email address.");
      return;
    }

    setBusy(true);
    try {
      const res = await forgotPassword(cleanEmail);
      toast.success(res.message || "Reset code sent to your email!");
      setMode("reset");
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset code.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Handler: Reset Password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit reset code.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    setBusy(true);
    try {
      const res = await resetPassword(cleanEmail, cleanOtp, newPassword);
      toast.success(res.message || "Password updated successfully. You can now sign in.");
      setPassword("");
      setMode("signin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* ============================================================ */}
          {/* 1. SIGN UP VIEW (Matches Screenshot 1)                       */}
          {/* ============================================================ */}
          {mode === "signup" && (
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Join CampusPulse
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create an account to start asking your campus.
              </p>

              <form onSubmit={handleSignUp} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aditi Sharma"
                    maxLength={80}
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Student Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="upnumber@vistas.ac.in"
                    maxLength={255}
                    autoComplete="email"
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Must end with @vistas.ac.in</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-sm font-medium">
                    Department
                  </Label>
                  <Input
                    id="department"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science, Mechanical, Commerce"
                    maxLength={100}
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="year" className="text-sm font-medium">
                      Year of Study
                    </Label>
                    <select
                      id="year"
                      required
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <option value="" disabled>Select year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="className" className="text-sm font-medium">
                      Class / Course
                    </Label>
                    <select
                      id="className"
                      required
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <option value="" disabled>Select class</option>
                      {VISTAS_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    minLength={8}
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity mt-2"
                >
                  {busy ? "Creating account..." : "Create account"}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-3">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. SIGN IN VIEW (Matches Screenshot 2)                       */}
          {/* ============================================================ */}
          {mode === "signin" && (
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to vote and follow your polls.
              </p>

              <form onSubmit={handleSignIn} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="upnumber@vistas.ac.in"
                    maxLength={255}
                    autoComplete="email"
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" className="text-sm font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity mt-2"
                >
                  {busy ? "Signing in..." : "Sign in"}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-3">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. GOOGLE SMTP OTP VERIFICATION VIEW (After Sign Up / Check) */}
          {/* ============================================================ */}
          {mode === "verify" && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-5">
                <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Google SMTP Verification
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Verify your account
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We've sent a 6-digit code to{" "}
                  <span className="font-semibold text-foreground">{email}</span>. Please enter it
                  below to activate your account.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm font-medium">
                    6-Digit Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="h-13 text-center text-2xl font-bold tracking-[0.4em]"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Code expires in 10 minutes.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={busy || otpCode.length < 6}
                  className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {busy ? "Verifying..." : "Verify & Activate Account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => {
                      setMode("signup");
                      setOtpCode("");
                    }}
                  >
                    ← Back to sign up
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline"
                    onClick={handleResendOtp}
                    disabled={busy || resendCooldown > 0}
                  >
                    <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. FORGOT PASSWORD VIEW                                      */}
          {/* ============================================================ */}
          {mode === "forgot" && (
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Reset your password
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your email address to receive a 6-digit password reset code.
              </p>

              <form onSubmit={handleForgotPassword} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="upnumber@vistas.ac.in"
                    className="h-11 rounded-lg border-input bg-card text-sm"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity mt-2"
                >
                  {busy ? "Sending code..." : "Send Reset Code"}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-3">
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. RESET PASSWORD VIEW                                       */}
          {/* ============================================================ */}
          {mode === "reset" && (
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Enter new password
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
              </p>

              <form onSubmit={handleResetPassword} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-otp" className="text-sm font-medium">
                    6-Digit Reset Code
                  </Label>
                  <Input
                    id="reset-otp"
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="h-11 text-center font-bold tracking-widest text-lg"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-sm font-medium">
                    New Password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="h-11 rounded-lg border-input bg-card text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy || otpCode.length < 6}
                  className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity mt-2"
                >
                  {busy ? "Updating password..." : "Update Password & Sign In"}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-3">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    ← Back to sign in
                  </button>
                </p>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
