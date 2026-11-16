/** Small helpers shared by the passkey route handlers. */
import { NextResponse, type NextRequest } from "next/server";
import { isTestMode } from "./allowlist";
import { CHALLENGE_COOKIE, CHALLENGE_TTL_MS, rpConfig, type RpConfig } from "./passkey";
import { SESSION_COOKIE, sessionCookieOptions, sessionSecret, signSession } from "./session";

export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** The RP config, or an error response when passkeys are not available on this deployment. */
export function requireConfig(): { rp: RpConfig; secret: string } | NextResponse {
  if (isTestMode()) return fail(503, "Passkeys are not available in test mode");
  const rp = rpConfig();
  const secret = sessionSecret();
  if (!rp || !secret) return fail(503, "Phase 1 is not configured");
  return { rp, secret };
}

export function setChallengeCookie(res: NextResponse, id: string) {
  res.cookies.set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/phase1/api/auth",
    maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
  });
}

export function takeChallengeCookie(req: NextRequest): string {
  return req.cookies.get(CHALLENGE_COOKIE)?.value ?? "";
}

export async function setSessionCookie(res: NextResponse, email: string, secret: string) {
  res.cookies.set(SESSION_COOKIE, await signSession(email, secret), sessionCookieOptions());
}

/** Same-origin check for the POST routes (belt and braces on top of SameSite=Lax). */
export function sameOrigin(req: NextRequest, origins: string[]): boolean {
  const o = req.headers.get("origin");
  return !!o && origins.includes(o.replace(/\/$/, ""));
}
