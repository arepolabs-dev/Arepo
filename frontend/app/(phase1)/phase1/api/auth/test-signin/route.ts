import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE, isTestMode } from "@/lib/phase1/allowlist";

export const dynamic = "force-dynamic";

/** Test mode only (PHASE1_TEST_MODE=1, refused on production Vercel): sets the fake session cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.search = "";
  const user = process.env.PHASE1_TEST_USER?.trim().toLowerCase();
  if (!isTestMode() || !user) {
    url.pathname = "/phase1/signin";
    return NextResponse.redirect(url);
  }
  url.pathname = "/phase1";
  const res = NextResponse.redirect(url);
  res.cookies.set(TEST_COOKIE, user, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
