import { NextResponse, type NextRequest } from "next/server";
import { allowedEmails } from "@/lib/phase1/allowlist";
import { peekInvite, sha256Hex } from "@/lib/phase1/invite";
import { beginEnrol } from "@/lib/phase1/passkey";
import { fail, requireConfig, sameOrigin, setChallengeCookie } from "@/lib/phase1/passkey-http";
import { challengeStore, inviteStore, passkeyStore } from "@/lib/phase1/passkey-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cfg = requireConfig();
  if (cfg instanceof NextResponse) return cfg;
  if (!sameOrigin(request, cfg.rp.origins)) return fail(403, "Bad origin");
  let token = "";
  try {
    token = String(((await request.json()) as { token?: unknown }).token ?? "");
  } catch {
    return fail(400, "Bad request");
  }
  try {
    const email = await peekInvite(inviteStore(), token, allowedEmails());
    if (!email) return fail(403, "This invite link is not valid or has expired");
    const { options, challengeId } = await beginEnrol(
      cfg.rp,
      challengeStore(),
      passkeyStore(),
      email,
      await sha256Hex(token),
    );
    const res = NextResponse.json(options);
    setChallengeCookie(res, challengeId);
    return res;
  } catch (e) {
    console.error("phase1 passkey enrol-options:", e instanceof Error ? e.message : e);
    return fail(500, "Could not start enrolment");
  }
}
