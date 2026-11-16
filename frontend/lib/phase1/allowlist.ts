/**
 * Phase 1 access rules and environment switches. Pure (no Next or Supabase imports) so the
 * middleware, route handlers and tests can all use it. No address is hard-coded: the allowlist comes
 * from PHASE1_ALLOWED_EMAILS (comma-separated).
 */

export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return Array.from(seen);
}

/** True only when `email` is on the list (case-insensitive, trimmed). Empty input or list is false. */
export function isAllowed(email: string | undefined | null, list: string[]): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || list.length === 0) return false;
  return list.includes(e);
}

export function allowedEmails(): string[] {
  return parseAllowlist(process.env.PHASE1_ALLOWED_EMAILS);
}

/** "dayyan.sheikh@x" -> "DS"; "jack@x" -> "J"; falls back to "?". */
export function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join("") || "?";
}

/**
 * PHASE1_TEST_MODE=1 swaps Supabase for an in-memory store and a cookie-based fake session. It is
 * refused (throws) on a production Vercel deployment: NODE_ENV=production AND VERCEL_ENV=production.
 * Previews and local `next start` runs are allowed.
 */
export function isTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const on = env.PHASE1_TEST_MODE === "1" || env.PHASE1_TEST_MODE === "true";
  if (!on) return false;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "production") {
    throw new Error("PHASE1_TEST_MODE is not allowed in production");
  }
  return true;
}

export const TEST_COOKIE = "phase1-test-user";

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** The public Supabase settings, or null when Phase 1 is not configured. Read at request time. */
export function supabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Only same-site /phase1 paths are valid post-login targets (no open redirect). */
export function safePhase1Next(next: string | null | undefined): string {
  if (!next || !next.startsWith("/phase1") || next.startsWith("//") || next.includes("\\")) {
    return "/phase1";
  }
  if (next.startsWith("/phase1/signin") || next.startsWith("/phase1/auth")) return "/phase1";
  return next;
}
