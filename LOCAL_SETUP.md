# CampusPulse — Local Development Setup Guide

This guide explains how to run CampusPulse on your computer with **Google SMTP Email Authentication** and **Neon PostgreSQL Database**.

---

## 1. Prerequisites

| Tool | Why you need it | Download |
|------|-----------------|----------|
| **Node.js** (v20 or later) | Runs the server and React frontend | https://nodejs.org |
| **npm** or **Bun** | Package manager | Built into Node / https://bun.sh |
| **VS Code** | Code editor | https://code.visualstudio.com |

---

## 2. Install Dependencies

In your project directory, open your terminal and run:

```bash
npm install
```

*(or `bun install` if using Bun)*

---

## 3. Configure Google SMTP & Database (`.env`)

In the root of the project, open the `.env` file. It contains:

```env
DATABASE_URL=postgresql://neondb_owner:npg_a4WQhzC3bLUR@ep-snowy-smoke-ayjkiwr4-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=campuspulse-production-jwt-secret-neon-2026-xyz
PORT=8080

# Google SMTP Credentials:
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### How to get your Google SMTP App Password (in 30 seconds):
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Enable **2-Step Verification** (if not already enabled).
3. Search or visit: **[Google App Passwords](https://myaccount.google.com/apppasswords)**.
4. Give your app a name (e.g. `CampusPulse`) and click **Create**.
5. Google will generate a **16-character password** (e.g. `abcd efgh ijkl mnop`).
6. Copy that 16-character password into `GMAIL_APP_PASSWORD` in `.env`.
7. Enter your Gmail address in `GMAIL_USER`.

> **Note for Local Testing:** If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are not configured yet, CampusPulse will run in **Dev Mode** and print the 6-digit verification codes directly to the server terminal, so you can test sign-in immediately.

---

## 4. Start the Dev Server

Run:

```bash
npm run dev
```

Open **http://localhost:8080** in your browser.

---

## 5. How Google SMTP Sign In / Sign Up Works

1. Visit **http://localhost:8080/auth** (or click **Sign in**).
2. Enter your email address and optional name.
3. Click **Send Verification Code**.
4. CampusPulse connects to **Google SMTP** (`smtp.gmail.com:465`) and sends a 6-digit code to your inbox.
5. Enter the 6-digit code on the screen and click **Verify & Continue**.
6. You are signed in securely! No password or Google OAuth / social popup needed.

---

## 6. Build for Production

```bash
npm run build
```

Then preview the production build with:

```bash
npm run preview
```

