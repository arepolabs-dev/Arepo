/**
 * Replies sync for one Gmail mailbox. Inbound mail arrives in the Gmail through the Cloudflare forward
 * (To: the arepolabs alias); sent mail sits in Sent with From the alias. Only mail matching a prospect is
 * stored. In the shared mailbox, inbound that matches nobody is stored as an enquiry. Personal-mailbox mail
 * that matches no prospect is never stored.
 */
import { afterReply } from "./actions";
import { bareAddress, displayName, isAutoReply, isBounce, looksLikeStop, matchInbound, type InboundMessage } from "./match";
import { getMessage, getProfile, headerMap, listAddedSince, listMessageIds, plainText } from "./gmail";
import type { Phase1Db } from "./supabase";
import type { Mailbox, Phase1User, ReplyType } from "./types";

export interface SyncResult {
  scanned: number;
  replies: number;
  bounces: number;
  autos: number;
  stops: number;
  enquiries: number;
  sentLinked: number;
}

export async function syncMailbox(db: Phase1Db, user: Phase1User, m: Mailbox, access: string): Promise<SyncResult> {
  const out: SyncResult = { scanned: 0, replies: 0, bounces: 0, autos: 0, stops: 0, enquiries: 0, sentLinked: 0 };
  const profile = await getProfile(access); // read the new history id first so nothing is missed
  let ids = m.history_id ? await listAddedSince(access, m.history_id) : null;
  if (!ids) ids = await listMessageIds(access, "newer_than:30d -in:spam -in:trash", 300);

  const [replies, emails, prospects, enquiries] = await Promise.all([
    db.select("replies"), db.select("outreach_emails"), db.select("prospects"), db.select("enquiries"),
  ]);
  const known = new Set([
    ...replies.map((r) => r.gmail_message_id),
    ...enquiries.map((e) => e.gmail_message_id),
    ...emails.map((e) => e.gmail_message_id).filter(Boolean),
  ]);
  const mine = new Set([m.address.toLowerCase(), (m.send_as ?? "").toLowerCase()].filter(Boolean));
  const known2 = emails.map((e) => ({ id: e.id, prospect_id: e.prospect_id, gmail_thread_id: e.gmail_thread_id, rfc_message_id: e.rfc_message_id, to_address: e.to_address }));
  const slim = prospects.map((p) => ({ id: p.id, public_email: p.public_email }));

  for (const id of ids) {
    if (known.has(id)) continue;
    const g = await getMessage(access, id);
    out.scanned++;
    const h = headerMap(g);
    const from = bareAddress(h["from"] ?? "");
    const received = g.internalDate ? new Date(Number(g.internalDate)).toISOString() : new Date().toISOString();

    if (mine.has(from) || (g.labelIds ?? []).includes("SENT")) {
      // Outbound: link a hand-sent or composed email to its Gmail ids; store nothing else.
      const to = bareAddress(h["to"] ?? "");
      const hit = emails.find((e) => !e.gmail_message_id && e.to_address?.toLowerCase() === to && (e.status === "composed" || e.sent_via === "manual"));
      if (hit) {
        await db.update("outreach_emails", { id: hit.id }, {
          gmail_message_id: g.id, gmail_thread_id: g.threadId, rfc_message_id: h["message-id"] ?? null,
          status: "sent", sent_at: hit.sent_at ?? received, mailbox_id: m.id,
        });
        hit.gmail_message_id = g.id;
        out.sentLinked++;
      }
      continue;
    }

    const msg: InboundMessage = { gmailId: g.id, threadId: g.threadId, from, subject: h["subject"] ?? "", bodyText: plainText(g), headers: h };
    const match = matchInbound(msg, known2, slim);
    if (match) {
      const type: ReplyType = isBounce(msg) ? "bounce" : isAutoReply(msg) ? "auto" : looksLikeStop(msg.bodyText) ? "stop" : "unclassified";
      await db.insert("replies", {
        outreach_email_id: match.outreachEmailId,
        prospect_id: match.prospectId,
        owner_id: user.personId,
        gmail_message_id: g.id,
        gmail_thread_id: g.threadId,
        from_address: from,
        received_at: received,
        snippet: g.snippet ?? null,
        body_text: msg.bodyText.slice(0, 8000),
        reply_type: type,
        mailbox_id: m.id,
        matched_by: match.by,
        subject: msg.subject,
        ...(type !== "unclassified" ? { classified_at: new Date().toISOString() } : {}),
      });
      if (type !== "unclassified") await afterReply(db, user, match.prospectId, match.outreachEmailId, type);
      if (type === "bounce") out.bounces++;
      else if (type === "auto") out.autos++;
      else if (type === "stop") out.stops++;
      else out.replies++;
    } else if (m.kind === "shared" && !isBounce(msg) && !isAutoReply(msg)) {
      await db.insert("enquiries", {
        mailbox_id: m.id, gmail_message_id: g.id, gmail_thread_id: g.threadId, from_address: from,
        from_name: displayName(h["from"] ?? ""), subject: msg.subject, snippet: g.snippet ?? null, received_at: received,
      });
      out.enquiries++;
    }
  }
  await db.update("mailboxes", { id: m.id }, { history_id: profile.historyId, last_sync_at: new Date().toISOString(), last_error: null });
  return out;
}
