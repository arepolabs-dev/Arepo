import { ActionError } from "@/lib/phase1/actions";
import { GmailApiError, GmailAuthError, gmailConfig } from "@/lib/phase1/gmail";
import { ReconnectError, accessTokenFor, canUse } from "@/lib/phase1/mailbox";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";
import { syncMailbox, type SyncResult } from "@/lib/phase1/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pull new replies from every mailbox this person can use (their own and the shared one). */
export async function POST() {
  try {
    const user = await requireUser();
    if (!gmailConfig()) return Response.json({ configured: false, results: [], reconnect: [] });
    const db = getDb();
    const boxes = (await db.select("mailboxes")).filter((m) => canUse(m, user));
    const results: { address: string; result: SyncResult }[] = [];
    const reconnect: string[] = [];
    const errors: string[] = [];
    for (const m of boxes) {
      try {
        const access = await accessTokenFor(db, m);
        results.push({ address: m.address, result: await syncMailbox(db, user, m, access) });
      } catch (e) {
        if (e instanceof ReconnectError || e instanceof GmailAuthError) {
          await db.update("mailboxes", { id: m.id }, { status: "needs_reconnect" });
          reconnect.push(m.address);
        } else if (e instanceof GmailApiError) {
          await db.update("mailboxes", { id: m.id }, { last_error: e.message.slice(0, 200) });
          errors.push(`${m.address}: ${e.message.slice(0, 120)}`);
        } else throw e;
      }
    }
    return Response.json({ configured: true, results, reconnect, errors });
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
