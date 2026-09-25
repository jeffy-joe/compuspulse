# CampusPulse

A full-stack campus polling and voting platform with **Google SMTP Email Authentication** and **PostgreSQL**.

- 📬 **Google SMTP Login & Sign In:** Secure, passwordless 6-digit email OTP verification via Google SMTP (no Google OAuth or social login needed).
- 🗳️ **Create & Vote on Polls:** Real-time poll results, single and multiple choice, expiration timer, anonymous options.
- 🔒 **Secure Sessions:** HTTP-only JWT cookies and PostgreSQL persistent storage.

## Quick Start

1. Install dependencies:
   ```sh
   npm install
   ```
2. Configure `.env` with your `DATABASE_URL` and Google SMTP credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
3. Start the dev server:
   ```sh
   npm run dev
   ```
4. Open http://localhost:8080.

See `LOCAL_SETUP.md` for the full guide on generating your Google SMTP App Password.

