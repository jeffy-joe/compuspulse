import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] || "campuspulse-jwt-super-secret-key-2026";
const COOKIE_NAME = "campuspulse_session";

export type SessionPayload = {
  id: string;
  email: string;
  name: string;
  role?: string;
  className?: string;
  department?: string;
  year?: string;
};

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts.shift()?.trim();
    if (name) {
      const val = parts.join("=").trim();
      list[name] = decodeURIComponent(val);
    }
  });
  return list;
}

export function getUserFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  return verifySessionToken(token);
}

export function createSessionCookie(token: string): string {
  const isProd = process.env["NODE_ENV"] === "production";
  const secure = isProd ? "; Secure" : "";
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearSessionCookie(): string {
  const isProd = process.env["NODE_ENV"] === "production";
  const secure = isProd ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure}`;
}
