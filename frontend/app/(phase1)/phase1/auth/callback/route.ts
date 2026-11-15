import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { TEST_COOKIE, allowedEmails, isAllowed, isTestMode, safePhase1Next } from "@/lib/phase1/allowlist";
import { createSessionClient } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

function to(request: NextRequest, path: string, error?: string) {
  const url = request.nextUrl.clone();
  const [p, q] = path.split("?");
  url.pathname = p!;
  url.search = q ? `?${q}` : "";
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/** Magic-link landing: exchanges the code (or token hash) for a session, then enforces the allowlist. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  if (isTestMode()) {
    const user = process.env.PHASE1_TEST_USER?.trim().toLowerCase();
    if (sp.get("test") !== "1" || !user) return to(request, "/phase1/signin", "link");
    const res = to(request, "/phase1");
    res.cookies.set(TEST_COOKIE, user, { path: "/", httpOnly: true, sameSite: "lax" });
    return res;
  }

  const next = safePhase1Next(sp.get("next"));
  const supabase = createSessionClient();
  const code = sp.get("code");
  const tokenHash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;

  let failed = true;
  if (code) {
    failed = !!(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    failed = !!(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  if (failed) return to(request, "/phase1/signin", "link");

  const { data } = await supabase.auth.getUser();
  if (!isAllowed(data.user?.email, allowedEmails())) {
    await supabase.auth.signOut();
    return to(request, "/phase1/signin", "not_invited");
  }
  return to(request, next);
}
