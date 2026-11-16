import { NextResponse, type NextRequest } from "next/server";
import { beginLogin } from "@/lib/phase1/passkey";
import { fail, requireConfig, sameOrigin, setChallengeCookie } from "@/lib/phase1/passkey-http";
import { challengeStore } from "@/lib/phase1/passkey-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cfg = requireConfig();
  if (cfg instanceof NextResponse) return cfg;
  if (!sameOrigin(request, cfg.rp.origins)) return fail(403, "Bad origin");
  try {
    const { options, challengeId } = await beginLogin(cfg.rp, challengeStore());
    const res = NextResponse.json(options);
    setChallengeCookie(res, challengeId);
    return res;
  } catch (e) {
    console.error("phase1 passkey login-options:", e instanceof Error ? e.message : e);
    return fail(500, "Could not start sign-in");
  }
}
