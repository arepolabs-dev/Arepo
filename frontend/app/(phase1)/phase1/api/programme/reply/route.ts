import { ActionError } from "@/lib/phase1/actions";
import { GmailApiError, GmailAuthError, buildMime, sendRaw } from "@/lib/phase1/gmail";
import { ReconnectError, accessTokenFor, canUse } from "@/lib/phase1/mailbox";
import { markReplySent } from "@/lib/phase1/programme-actions";
import { unresolvedIn } from "@/lib/phase1/programme";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

/** Send ONE prepared reply on a reply's thread. Only on his click: the browser posts here, nothing sends on its own. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const b = (await request.json().catch(() => ({}))) as { reply_id?: string; subject?: string; body?: string; category?: string | null };
    const db = getDb();
    const reply = (await db.select("replies", { eq: { id: String(b.reply_id ?? "") } }))[0];
    if (!reply) throw new ActionError(404, "Reply not found");
    if (reply.reply_sent_at) throw new ActionError(409, "A reply was already sent to this one");
    const prospect = reply.prospect_id ? (await db.select("prospects", { eq: { id: reply.prospect_id } }))[0] : undefined;
    if (!prospect) throw new ActionError(409, "This reply is not linked to a business");
    if (prospect.status === "do_not_contact") throw new ActionError(409, "This business is marked do not contact");
    if (reply.reply_type === "stop" || reply.reply_type === "bounce" || reply.reply_type === "auto") throw new ActionError(409, "No reply goes to a stop, bounce or automatic message");
    const subject = String(b.subject ?? "").trim();
    const body = String(b.body ?? "").trim();
    if (!subject || !body) throw new ActionError(400, "Empty subject or text");
    const left = unresolvedIn(`${subject}\n${body}`);
    if (left.length) throw new ActionError(400, `Unfilled: ${left.join(" ")}`);
    const m = (await db.select("mailboxes", { eq: { id: reply.mailbox_id ?? "" } }))[0];
    if (!m || !canUse(m, user) || !m.send_as) throw new ActionError(409, "The mailbox for this reply is not available");
    try {
      const access = await accessTokenFor(db, m);
      const mime = buildMime({ fromName: m.send_as_name ?? "Dayyan Sheikh", fromAddress: m.send_as, to: reply.from_address, subject, body });
      const sent = await sendRaw(access, mime.raw, reply.gmail_thread_id ?? undefined);
      await markReplySent(db, user, reply.id, b.category ?? null, sent.id);
      return Response.json({ ok: true });
    } catch (err) {
      if (err instanceof ReconnectError || err instanceof GmailAuthError) {
        await db.update("mailboxes", { id: m.id }, { status: "needs_reconnect" });
        return Response.json({ error: "Reconnect Gmail", reconnect: true }, { status: 409 });
      }
      if (err instanceof GmailApiError) return Response.json({ error: "Gmail would not send this one", detail: err.message.slice(0, 200) }, { status: 502 });
      throw err;
    }
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
