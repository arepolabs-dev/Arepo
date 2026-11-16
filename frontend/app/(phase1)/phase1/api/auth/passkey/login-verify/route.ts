import { NextResponse, type NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { allowedEmails } from "@/lib/phase1/allowlist";
import { CHALLENGE_COOKIE, finishLogin } from "@/lib/phase1/passkey";
import {
  fail,
  requireConfig,
  sameOrigin,
  setSessionCookie,
  takeChallengeCookie,
} from "@/lib/phase1/passkey-http";
import { challengeStore, passkeyStore } from "@/lib/phase1/passkey-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cfg = requireConfig();
  if (cfg instanceof NextResponse) return cfg;
  if (!sameOrigin(request, cfg.rp.origins)) return fail(403, "Bad origin");
  let body: { response?: AuthenticationResponseJSON };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request");
  }
  if (!body.response || typeof body.response.id !== "string") return fail(400, "Bad request");
  try {
    const email = await finishLogin(
      cfg.rp,
      challengeStore(),
      passkeyStore(),
      allowedEmails(),
      takeChallengeCookie(request),
      body.response,
    );
    const res = NextResponse.json({ ok: true });
    await setSessionCookie(res, email, cfg.secret);
    res.cookies.delete(CHALLENGE_COOKIE);
    return res;
  } catch (e) {
    console.error("phase1 passkey login-verify:", e instanceof Error ? e.message : e);
    // One generic answer: no hint whether the key, the challenge or the allowlist failed.
    return fail(401, "Sign-in failed");
  }
}
