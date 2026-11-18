/**
 * Server-side sending for queued outreach: called every minute by the cron route. At most ONE due email per
 * sender (mailbox) per run, never closer than 2 minutes to that sender's previous send, within the daily cap,
 * and only to someone who may still be emailed (confirmed limited company or consent). Pure over Phase1Db with an
 * injectable transport, so tests never touch Gmail.
 */
import { recordSent, sentTodayCount } from "./actions";
import { GmailApiError, GmailAuthError, buildMime, findAlias, listSendAs, sendRaw } from "./gmail";
import { ReconnectError, accessTokenFor, fromIdentity } from "./mailbox";
import { checkSendable } from "./rules";
import { DAILY_CAP } from "./send";
import type { Phase1Db } from "./supabase";
import type { Mailbox, Row } from "./types";

export const SERVER_GAP_MS = 120_000;

export interface Transport {
  (mailbox: Mailbox, email: Row<"outreach_emails">): Promise<{ id: string; threadId: string; messageId: string }>;
}
export interface SendResult { id: string; to: string | null; outcome: "sent" | "failed" | "waiting"; detail?: string }

/** The real transport: refresh token, verified alias, MIME, Gmail send. */
export function makeGmailTransport(db: Phase1Db): Transport {
  return async (m, e) => {
    const id = fromIdentity(m);
    if (!id) throw new Error("No sending address set for this mailbox");
    const access = await accessTokenFor(db, m);
    if (id.alias) {
      const found = findAlias(await listSendAs(access), id.address);
      if (!found.found || !found.verified) throw new Error(`${id.address} is not a verified "Send mail as" address in Gmail`);
    }
    const mime = buildMime({ fromName: id.name, fromAddress: id.address, to: e.to_address!, subject: e.subject!, body: e.body_rendered! });
    const sent = await sendRaw(access, mime.raw);
    return { id: sent.id, threadId: sent.threadId, messageId: mime.messageId };
  };
}

export async function sendDue(db: Phase1Db, transport: Transport, now = new Date()): Promise<{ due: number; results: SendResult[] }> {
  const nowIso = now.toISOString();
  const all = await db.select("outreach_emails");
  const due = all.filter((e) => e.status === "queued" && !!e.send_at && e.send_at <= nowIso).sort((a, b) => (a.send_at ?? "").localeCompare(b.send_at ?? "") || a.composed_at.localeCompare(b.composed_at));
  const results: SendResult[] = [];
  const done = new Set<string>();
  for (const e of due) {
    const who = e.mailbox_id ?? e.owner_id ?? "none";
    if (done.has(who)) continue; // one per sender per run
    done.add(who);
    const mine = all.filter((x) => (e.mailbox_id ? x.mailbox_id === e.mailbox_id : x.owner_id === e.owner_id));
    const last = mine.map((x) => (x.status === "sent" ? x.sent_at : x.status === "sending" || x.status === "failed" ? x.attempted_at : null)).filter((t): t is string => !!t).sort().pop();
    if (last && now.getTime() - new Date(last).getTime() < SERVER_GAP_MS) {
      results.push({ id: e.id, to: e.to_address, outcome: "waiting", detail: "2-minute gap" });
      continue;
    }
    if ((await sentTodayCount(db, { mailboxId: e.mailbox_id, ownerId: e.owner_id }, now)) >= DAILY_CAP) {
      results.push({ id: e.id, to: e.to_address, outcome: "waiting", detail: `daily cap of ${DAILY_CAP}` });
      continue;
    }
    const claimed = await db.update("outreach_emails", { id: e.id, status: "queued" }, { status: "sending", attempted_at: nowIso });
    if (!claimed.length) continue;
    const fail = async (why: string): Promise<void> => {
      await db.update("outreach_emails", { id: e.id }, { status: "failed", send_error: why.slice(0, 300) });
      results.push({ id: e.id, to: e.to_address, outcome: "failed", detail: why.slice(0, 120) });
    };
    const msg = (await db.select("programme_messages", { eq: { outreach_email_id: e.id } }))[0];
    if (msg && msg.status !== "pending") { await fail(`Message already ${msg.status}`); continue; }
    const core = (await db.select("prospects", { eq: { id: e.prospect_id } }))[0];
    if (!core) { await fail("Prospect not found"); continue; }
    const check = checkSendable(core);
    if (check.blocked) { await fail(check.reasons.join(", ")); continue; }
    if (!e.to_address || !e.subject || !e.body_rendered) { await fail("Email is incomplete"); continue; }
    const m = e.mailbox_id ? (await db.select("mailboxes", { eq: { id: e.mailbox_id } }))[0] : undefined;
    if (!m || m.status !== "connected" || !fromIdentity(m)) { await fail(m ? "Gmail needs reconnecting" : "Mailbox not found"); continue; }
    try {
      const sent = await transport(m, e);
      await recordSent(db, { email: "server", initials: "", personId: e.owner_id }, e.id, { via: "gmail", gmail_message_id: sent.id, gmail_thread_id: sent.threadId, rfc_message_id: sent.messageId, sent_at: now.toISOString() });
      results.push({ id: e.id, to: e.to_address, outcome: "sent" });
    } catch (err) {
      if (err instanceof ReconnectError || err instanceof GmailAuthError) {
        await db.update("mailboxes", { id: m.id }, { status: "needs_reconnect" });
        await fail("Reconnect Gmail");
      } else await fail(err instanceof GmailApiError ? `Gmail: ${err.message}` : err instanceof Error ? err.message : "Send failed");
    }
  }
  return { due: due.length, results };
}
