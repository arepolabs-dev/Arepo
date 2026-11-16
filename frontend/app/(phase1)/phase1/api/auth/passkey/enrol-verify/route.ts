import { NextResponse, type NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { allowedEmails } from "@/lib/phase1/allowlist";
import { claimInvite, sha256Hex } from "@/lib/phase1/invite";
import { CHALLENGE_COOKIE, storeCredential, verifyEnrol } from "@/lib/phase1/passkey";
import {
  fail,
  requireConfig,
  sameOrigin,
  setSessionCookie,
  takeChallengeCookie,
} from "@/lib/phase1/passkey-http";
import { challengeStore, inviteStore, passkeyStore } from "@/lib/phase1/passkey-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cfg = requireConfig();
  if (cfg instanceof NextResponse) return cfg;
  if (!sameOrigin(request, cfg.rp.origins)) return fail(403, "Bad origin");
  let body: { token?: string; response?: RegistrationResponseJSON };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request");
  }
  if (!body.response || typeof body.token !== "string") return fail(400, "Bad request");

  const invites = inviteStore();
  try {
    const v = await verifyEnrol(cfg.rp, challengeStore(), takeChallengeCookie(request), body.response);
    // The token in the body must be the one this challenge was issued for.
    if ((await sha256Hex(body.token)) !== v.inviteHash) return fail(403, "Enrolment failed");
    const email = await claimInvite(invites, body.token, allowedEmails());
    if (!email || email !== v.email) return fail(403, "This invite link is not valid or has expired");
    try {
      await storeCredential(passkeyStore(), email, v.credential);
    } catch (e) {
      await invites.release(v.inviteHash);
      throw e;
    }
    const res = NextResponse.json({ ok: true });
    await setSessionCookie(res, email, cfg.secret);
    res.cookies.delete(CHALLENGE_COOKIE);
    return res;
  } catch (e) {
    console.error("phase1 passkey enrol-verify:", e instanceof Error ? e.message : e);
    return fail(400, "Enrolment failed");
  }
}
