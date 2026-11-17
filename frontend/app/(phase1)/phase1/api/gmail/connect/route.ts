import { NextResponse } from "next/server";
import { signState } from "@/lib/phase1/crypto";
import { buildAuthUrl, gmailConfig } from "@/lib/phase1/gmail";
import { errorResponse, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

/** Start Google sign-in for a mailbox: ?kind=personal (default) or ?kind=shared (enquiries). */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const back = (note: string) => NextResponse.redirect(new URL(`/phase1?gmail=${note}`, url.origin), 303);
    const cfg = gmailConfig();
    if (!cfg) return back("not_configured");
    const kind = url.searchParams.get("kind") === "shared" ? "shared" : "personal";
    const state = signState(JSON.stringify({ kind, email: user.email, ts: Date.now() }));
    return NextResponse.redirect(buildAuthUrl(cfg, url.origin, state), 303);
  } catch (e) {
    return errorResponse(e);
  }
}
