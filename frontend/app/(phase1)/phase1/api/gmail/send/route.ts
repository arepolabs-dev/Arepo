import { ActionError, recordSent, sentTodayCount } from "@/lib/phase1/actions";
import { GmailApiError, GmailAuthError, buildMime, findAlias, listSendAs, sendRaw } from "@/lib/phase1/gmail";
import { ReconnectError, accessTokenFor, findMailbox, fromIdentity } from "@/lib/phase1/mailbox";
import { DAILY_CAP } from "@/lib/phase1/send";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

/** Send ONE composed email through Gmail as the mailbox's arepolabs alias. The browser calls this with gaps. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { email_id?: string };
    const db = getDb();
    const e = (await db.select("outreach_emails", { eq: { id: String(body.email_id ?? "") } }))[0];
    if (!e || e.status !== "composed") throw new ActionError(404, "That email is not waiting to be sent");
    if (e.owner_id !== user.personId) throw new ActionError(404, "That email is not waiting to be sent");
    if (!e.mailbox_id || !e.to_address || !e.subject || !e.body_rendered) throw new ActionError(400, "Email is incomplete");
    const m = await findMailbox(db, user, e.mailbox_id);
    if ((await sentTodayCount(db, { mailboxId: m.id, ownerId: user.personId })) >= DAILY_CAP) {
      return Response.json({ error: `Daily cap of ${DAILY_CAP} reached for this mailbox`, cap: true }, { status: 409 });
    }
    const prospect = (await db.select("prospects", { eq: { id: e.prospect_id } }))[0];
    if (!prospect || prospect.status === "do_not_contact") throw new ActionError(409, "This business is marked do not contact");
    const idn = fromIdentity({ ...m, send_as_verified: true });
    if (!idn) throw new ActionError(409, "No arepolabs address set for this mailbox");
    const alias = idn.address;
    try {
      const access = await accessTokenFor(db, m);
      const found = idn.alias ? findAlias(await listSendAs(access), alias) : { found: true, verified: true };
      if (!found.found || !found.verified) {
        await db.update("mailboxes", { id: m.id }, { send_as_verified: false });
        return Response.json({ error: `${alias} is not set up in Gmail as a verified "Send mail as" address`, alias: false }, { status: 409 });
      }
      if (idn.alias && !m.send_as_verified) await db.update("mailboxes", { id: m.id }, { send_as_verified: true });
      const mime = buildMime({ fromName: idn.name, fromAddress: alias, to: e.to_address, subject: e.subject, body: e.body_rendered });
      const sent = await sendRaw(access, mime.raw);
      const row = await recordSent(db, user, e.id, { via: "gmail", gmail_message_id: sent.id, gmail_thread_id: sent.threadId, rfc_message_id: mime.messageId });
      return Response.json({ ok: true, email: row });
    } catch (err) {
      if (err instanceof ReconnectError || err instanceof GmailAuthError) {
        await db.update("mailboxes", { id: m.id }, { status: "needs_reconnect" });
        return Response.json({ error: "Reconnect Gmail", reconnect: true }, { status: 409 });
      }
      if (err instanceof GmailApiError) {
        await db.update("outreach_emails", { id: e.id }, { send_error: err.message.slice(0, 300) });
        return Response.json({ error: "Gmail would not send this one", detail: err.message.slice(0, 200) }, { status: 502 });
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
