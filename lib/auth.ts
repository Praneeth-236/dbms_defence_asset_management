import { createHmac, pbkdf2, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "defence_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SUPPORTED_ROLES = ["Admin", "Analyst"] as const;
export type AppRole = (typeof SUPPORTED_ROLES)[number];

export type Session = {
  userId: number;
  userName: string;
  role: AppRole;
  expiresAt: number;
};

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32 || secret.startsWith("replace_with")) {
    const error = new Error("AUTH_SESSION_SECRET is not configured") as Error & { code?: string };
    error.code = "AUTH_SESSION_CONFIG_MISSING";
    throw error;
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(session: Omit<Session, "expiresAt">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = sign(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!Number.isSafeInteger(session.userId) || session.userId <= 0 || typeof session.userName !== "string" || !session.userName.trim() || session.userName.length > 50 || !SUPPORTED_ROLES.includes(session.role)) return null;
    if (!Number.isInteger(session.expiresAt) || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return Promise.resolve(false);
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return Promise.resolve(false);

  try {
    const expected = Buffer.from(parts[3], "base64url");
    const salt = Buffer.from(parts[2], "base64url");
    if (expected.length !== 32 || salt.length < 16 || salt.length > 64) return Promise.resolve(false);
    return new Promise((resolve) => {
      pbkdf2(password, salt, iterations, expected.length, "sha256", (error, actual) => {
        resolve(!error && timingSafeEqual(actual, expected));
      });
    });
  } catch {
    return Promise.resolve(false);
  }
}

export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
}

export async function currentSession(): Promise<Session | null> {
  try {
    return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export function roleAllowed(role: string | undefined): role is AppRole {
  return role === "Admin" || role === "Analyst";
}

export function hasRole(session: Session | null, roles: AppRole[]): boolean {
  return session !== null && roles.includes(session.role);
}
