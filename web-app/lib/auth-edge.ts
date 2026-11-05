import type { Session } from "./auth";

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function verifySessionTokenAtEdge(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!payload || !signature || !secret || new TextEncoder().encode(secret).length < 32 || secret.startsWith("replace_with")) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;

    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as Session;
    if (
      !Number.isSafeInteger(session.userId) ||
      session.userId <= 0 ||
      typeof session.userName !== "string" ||
      !session.userName.trim() ||
      session.userName.length > 50 ||
      (session.role !== "Admin" && session.role !== "Analyst") ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
