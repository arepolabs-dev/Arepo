/**
 * One-time passkey enrolment invites. Pure logic over an injected store, so it is unit-testable;
 * `passkey-store.ts` supplies the Supabase-backed store. Only the sha256 of a token is ever stored.
 */
import { isAllowed } from "./allowlist";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InviteRow {
  token_hash: string;
  email: string;
  expires_at: string;
  used_at: string | null;
}

export interface InviteStore {
  insert(row: { token_hash: string; email: string; expires_at: string }): Promise<void>;
  find(tokenHash: string): Promise<InviteRow | null>;
  /** Atomic: marks the invite used only if unused and unexpired; returns its email, else null. */
  claim(tokenHash: string, nowIso: string): Promise<string | null>;
  /** Undo a claim (the credential insert failed). */
  release(tokenHash: string): Promise<void>;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Creates an invite for an allowlisted email. Returns the plain token (shown once, never stored). */
export async function createInvite(
  store: InviteStore,
  email: string,
  allowlist: string[],
  nowMs: number = Date.now(),
): Promise<string> {
  const e = email.trim().toLowerCase();
  if (!isAllowed(e, allowlist)) throw new Error("That email is not in PHASE1_ALLOWED_EMAILS");
  const token = newToken();
  await store.insert({
    token_hash: await sha256Hex(token),
    email: e,
    expires_at: new Date(nowMs + INVITE_TTL_MS).toISOString(),
  });
  return token;
}

/** Non-consuming check for the enrol page: the invite's email if usable now and still allowlisted. */
export async function peekInvite(
  store: InviteStore,
  token: string,
  allowlist: string[],
  nowMs: number = Date.now(),
): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const row = await store.find(await sha256Hex(token));
  if (!row || row.used_at || Date.parse(row.expires_at) <= nowMs) return null;
  return isAllowed(row.email, allowlist) ? row.email : null;
}

/** Consumes the invite (single use). Returns the email, or null if unknown, used, expired or not allowlisted. */
export async function claimInvite(
  store: InviteStore,
  token: string,
  allowlist: string[],
  nowMs: number = Date.now(),
): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const email = await store.claim(await sha256Hex(token), new Date(nowMs).toISOString());
  if (!email) return null;
  if (!isAllowed(email, allowlist)) {
    await store.release(await sha256Hex(token));
    return null;
  }
  return email;
}
