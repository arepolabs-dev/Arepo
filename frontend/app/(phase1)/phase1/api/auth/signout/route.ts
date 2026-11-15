import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE, isTestMode, supabaseEnv } from "@/lib/phase1/allowlist";
import { createSessionClient } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/phase1/signin";
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  if (isTestMode()) {
    res.cookies.delete(TEST_COOKIE);
  } else if (supabaseEnv()) {
    await createSessionClient().auth.signOut();
  }
  return res;
}
