import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE } from "@/lib/phase1/allowlist";
import { SESSION_COOKIE } from "@/lib/phase1/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/phase1/signin";
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(TEST_COOKIE);
  return res;
}
