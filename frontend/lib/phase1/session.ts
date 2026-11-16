/**
 * Phase 1 session: a signed cookie holding the signed-in email. Replaces Supabase Auth sessions.
 *
 * Token = base64url(JSON {e: email, exp: unix seconds}) + "." + base64url(HMAC-SHA256(payload)).
 * Uses Web Crypto only, so the same module runs in the Edge middleware and in route handlers.
 * The allowlist is re-checked on every verify: removing an address from PHASE1_ALLOWED_EMAILS
 * ends its session at once.
 */
import { allowedEmails, isAllowed } from "./allowlist";

export const SESSION_COOKIE = "phase1-session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** The signing secret, or null when unset or too short (then nobody can sign in). */
export function sessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.PHASE1_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export async function signSession(
  email: string,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload = b64url(
    enc.encode(JSON.stringify({ e: email.trim().toLowerCase(), exp: Math.floor(nowMs / 1000) + ttlSeconds })),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/**
 * The email in a valid, unexpired, untampered token whose address is still on the allowlist; else
 * null. `allowlist` defaults to PHASE1_ALLOWED_EMAILS.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string | null,
  allowlist: string[] = allowedEmails(),
  nowMs: number = Date.now(),
): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  const sigBytes = unb64url(sig);
  if (!sigBytes) return null;
  // crypto.subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, enc.encode(payload));
  if (!ok) return null;
  const raw = unb64url(payload);
  if (!raw) return null;
  let data: { e?: unknown; exp?: unknown };
  try {
    data = JSON.parse(dec.decode(raw));
  } catch {
    return null;
  }
  if (typeof data.e !== "string" || typeof data.exp !== "number") return null;
  if (data.exp * 1000 <= nowMs) return null;
  return isAllowed(data.e, allowlist) ? data.e.trim().toLowerCase() : null;
}

/**
 * The email in a session token regardless of the allowlist (still signature- and expiry-checked).
 * Used to tell "signed in but not invited" apart from "signed out".
 */
export async function verifySessionAnyEmail(
  token: string | undefined | null,
  secret: string | null,
  nowMs: number = Date.now(),
): Promise<string | null> {
  if (!token || !secret) return null;
  const email = await verifySession(token, secret, [emailOf(token)], nowMs);
  return email;
}

function emailOf(token: string): string {
  try {
    const raw = unb64url(token.split(".")[0] ?? "");
    return raw ? String((JSON.parse(dec.decode(raw)) as { e?: unknown }).e ?? "") : "";
  } catch {
    return "";
  }
}

export function sessionCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
