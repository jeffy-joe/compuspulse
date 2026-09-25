import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;
let transporterKey: string | null = null;

// Reads the generic SMTP_* env vars (works with Gmail, Outlook, SendGrid, etc.)
// Falls back to Gmail's default host/port if SMTP_HOST isn't set but SMTP_USER/SMTP_PASS are,
// so a Gmail-only .env still works without needing SMTP_HOST filled in.
function getSmtpConfig() {
  const user = process.env["SMTP_USER"]?.trim();
  const pass = process.env["SMTP_PASS"]?.trim().replace(/\s+/g, ""); // strip any pasted spaces in app password
  const host = process.env["SMTP_HOST"]?.trim() || (user?.endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const port = Number(process.env["SMTP_PORT"]) || 465;
  const secureEnv = process.env["SMTP_SECURE"]?.trim().toLowerCase();
  const secure = secureEnv ? secureEnv === "true" : port === 465;
  const from = process.env["SMTP_FROM"]?.trim() || user;

  return { user, pass, host, port, secure, from };
}

export function getMailer(): nodemailer.Transporter | null {
  const { user, pass, host, port, secure } = getSmtpConfig();

  if (!user || !pass || !host) {
    return null;
  }

  const key = `${host}:${port}:${user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
    transporterKey = key;
  }
  return transporter;
}

export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  name?: string,
  purpose: "signup" | "forgot_password" = "signup"
): Promise<{ sent: boolean; devMode?: boolean }> {
  const mailer = getMailer();
  const { user, from } = getSmtpConfig();

  const isReset = purpose === "forgot_password";
  const actionText = isReset ? "Password Reset" : "Verification";

  // If SMTP is not configured yet in .env, log code to terminal for instant testing
  if (!mailer || !user) {
    console.log("------------------------------------------------------------");
    console.log("⚠️  [SMTP Dev Mode] SMTP_HOST/SMTP_USER/SMTP_PASS not set in .env");
    console.log(`📧 ${actionText} Code for ${toEmail}: >>> ${otpCode} <<<`);
    console.log("👉 To send real emails, fill in SMTP_HOST, SMTP_USER and SMTP_PASS in your .env file.");
    console.log("------------------------------------------------------------");
    return { sent: false, devMode: true };
  }

  // Format code with spaces (e.g. "2 9 8 9 0 6")
  const spacedCode = otpCode.split("").join(" ");

  const subject = isReset
    ? `[CampusPulse] Password Reset Code: ${otpCode}`
    : `[CampusPulse] Your Verification Code: ${otpCode}`;

  const bodyDescription = isReset
    ? "You requested to reset your CampusPulse account password. Please use the verification code below to set a new password."
    : "Thank you for creating an account on CampusPulse. To complete your registration and activate your account, please verify your email address.";

  const mailOptions = {
    from: `"CampusPulse" <${from}>`,
    to: toEmail,
    subject,
    text: `Hello ${name || "there"},\n\n${bodyDescription}\n\nYour 6-digit ${actionText.toLowerCase()} code is: ${otpCode}\n\nValid for 10 minutes.\n\nIf you did not request this email, you can safely ignore it.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #f1f5f9; padding: 24px 12px;">
        <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Navy Header Banner -->
          <div style="background-color: #11284b; padding: 28px 24px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px; vertical-align: middle;">🗳️</span>
              <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; vertical-align: middle;">CampusPulse</span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0; font-weight: 500;">
              Smart Campus Voting & Polling Portal
            </p>
          </div>

          <!-- Email Content Body -->
          <div style="padding: 32px 28px;">
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">
              Hello ${name || "there"},
            </h2>
            
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              ${bodyDescription}
            </p>

            <!-- Verification Code Box -->
            <div style="border: 2px dashed #0284c7; background-color: #f8fafc; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0;">
              <div style="color: #0284c7; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                YOUR 6-DIGIT ${actionText.toUpperCase()} CODE
              </div>
              
              <div style="color: #0f172a; font-size: 36px; font-weight: 800; letter-spacing: 10px; margin: 14px 0 12px 10px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;">
                ${spacedCode}
              </div>
              
              <div style="color: #64748b; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                <span>⏱️</span>
                <span>Valid for 10 minutes</span>
              </div>
            </div>

            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              If you didn't request this ${actionText.toLowerCase()} code, you can safely ignore this email.
            </p>
          </div>

        </div>
      </div>
    `,
  };

  try {
    await mailer.sendMail(mailOptions);
    console.log(`[SMTP] Sent ${actionText.toLowerCase()} code to ${toEmail}`);
    return { sent: true };
  } catch (error: any) {
    console.error("[SMTP Error] Failed to send email:", error);
    if (error?.responseCode === 535 || error?.message?.includes("Username and Password not accepted")) {
      throw new Error("SMTP Authentication failed. If using Gmail, check that SMTP_PASS is a 16-character Google App Password (not your normal Google account password).");
    }
    throw new Error(`Failed to send email via SMTP: ${error?.message || "Check SMTP credentials"}`);
  }
}

