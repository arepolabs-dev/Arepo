import { NextResponse, type NextRequest } from "next/server";
import { TEST_COOKIE, allowedEmails, isAllowed, isTestMode } from "@/lib/phase1/allowlist";
import { SESSION_COOKIE, sessionSecret, verifySessionAnyEmail } from "@/lib/phase1/session";

/**
 * Guards /phase1 only (the matcher below); `/`, `/predictionmarket/*` and `/api/*` never run it.
 * Signed out: pages 307 to /phase1/signin, /phase1/api/* answers 401 JSON. Signed in but not on
 * PHASE1_ALLOWED_EMAILS: signed out and sent to the sign-in page with "Not invited" (API: 403).
 * Sessions are the signed passkey cookie (lib/phase1/session.ts). Route handlers repeat the check with requireUser().
 */
export const config = { matcher: ["/phase1/:path*"] };

const PUBLIC_PREFIXES = ["/phase1/signin", "/phase1/enrol", "/phase1/api/auth/", "/phase1/api/cron/", "/phase1/api/admin/"];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/phase1/api/");
  const testMode = isTestMode();

  const bounce = (error?: string) => {
    if (isApi) {
      return NextResponse.json(
        { error: error === "not_invited" ? "Not invited" : "Not signed in" },
        { status: error === "not_invited" ? 403 : 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/phase1/signin";
    url.search = "";
    if (error) url.searchParams.set("error", error);
    else if (path !== "/phase1") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url, 307);
  };

  const response = NextResponse.next({ request });
  let email: string | null = null;

  if (testMode) {
    email = request.cookies.get(TEST_COOKIE)?.value?.trim().toLowerCase() || null;
  } else {
    const secret = sessionSecret();
    if (!secret) {
      // Not configured: let the sign-in page explain it; refuse everything else.
      if (isPublic(path)) return response;
      if (isApi) return NextResponse.json({ error: "Phase 1 is not configured" }, { status: 503 });
      const url = request.nextUrl.clone();
      url.pathname = "/phase1/signin";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
    email = await verifySessionAnyEmail(request.cookies.get(SESSION_COOKIE)?.value, secret);
  }

  if (email && !isAllowed(email, allowedEmails())) {
    // Signed in but no longer (or never) on the list: drop the session.
    const out = bounce("not_invited");
    out.cookies.delete(testMode ? TEST_COOKIE : SESSION_COOKIE);
    return out;
  }

  if (!email) {
    return isPublic(path) ? response : bounce();
  }

  // Signed in and invited: the sign-in page has nothing to offer.
  if (path === "/phase1/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/phase1";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }
  return response;
}
