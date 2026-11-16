import { NextResponse } from "next/server";
import { encryptToken, verifyState } from "@/lib/phase1/crypto";
import { exchangeCode, findAlias, getProfile, gmailConfig, listSendAs, sharedAddress } from "@/lib/phase1/gmail";
import { nameFromEmail } from "@/lib/phase1/state";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

/** Google sends the person back here with ?code. Stores the encrypted refresh token and the alias check. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const back = (note: string) => NextResponse.redirect(new URL(`/phase1/prospects?gmail=${note}`, url.origin), 303);
    const cfg = gmailConfig();
    if (!cfg) return back("not_configured");
    const code = url.searchParams.get("code");
    const payload = verifyState(url.searchParams.get("state") ?? "");
    if (url.searchParams.get("error") || !code || !payload) return back("cancelled");
    const st = JSON.parse(payload) as { kind: "personal" | "shared"; email: string; ts: number };
    if (st.email !== user.email || Date.now() - st.ts > 15 * 60_000 || !user.personId) return back("cancelled");

    const tok = await exchangeCode(cfg, code, url.origin);
    if (!tok.refresh_token) return back("no_refresh_token");
    const profile = await getProfile(tok.access_token);
    const alias = st.kind === "shared" ? sharedAddress() : user.email.endsWith("@arepolabs.com") ? user.email : `${nameFromEmail(user.email).name.toLowerCase().replace(/\s+/g, ".")}@arepolabs.com`;
    const sendAs = await listSendAs(tok.access_token).catch(() => []);
    const a = findAlias(sendAs, alias);
    const display = st.kind === "shared" ? "Arepo Labs" : (a.displayName || nameFromEmail(user.email).name);

    await getDb().upsert(
      "mailboxes",
      {
        owner_id: user.personId,
        address: profile.emailAddress.toLowerCase(),
        provider: "gmail",
        kind: st.kind,
        refresh_token_enc: encryptToken(tok.refresh_token),
        history_id: null,
        last_error: null,
        send_as: alias,
        send_as_name: display,
        send_as_verified: a.found && a.verified,
        status: "connected",
        connected_at: new Date().toISOString(),
        scopes: tok.scope ?? null,
      },
      "address",
    );
    return back(a.found && a.verified ? "connected" : "alias_missing");
  } catch (e) {
    return errorResponse(e);
  }
}
