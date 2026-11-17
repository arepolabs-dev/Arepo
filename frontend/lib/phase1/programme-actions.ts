/**
 * Server-side writes for the programme: queue today's batch, skip a message, accept a phase result, review
 * and approve new leads, request leads, add a review, record a reply category. The caller has run requireUser();
 * the owner comes from the session. Nothing here sends mail: sending stays in /phase1/api/gmail/send.
 */
import { ActionError, sentTodayCount } from "./actions";
import { OPT_OUT, hasOptOut } from "./merge";
import { canUse } from "./mailbox";
import { aheadInPhase, computePhaseResult, londonToday, prospectFacts, selectBatch, senderKey, type BatchItem } from "./programme";
import { DAILY_CAP } from "./send";
import type { Phase1Db } from "./supabase";
import type { Phase1User, Row } from "./types";

export const PROGRAMME_GAP_SECONDS = { min: 20, max: 45 };


export async function loadProgrammeRows(db: Phase1Db) {
  const [tracks, phases, prospects, messages, core, replies, events, playbook] = await Promise.all([
    db.select("tracks"), db.select("phases"), db.select("programme_prospects"), db.select("programme_messages"),
    db.select("prospects"), db.select("replies"), db.select("events"), db.select("reply_playbook"),
  ]);
  return { tracks, phases, prospects, messages, core, replies, events, playbook };
}

export async function nameFor(db: Phase1Db, user: Phase1User): Promise<string> {
  const person = (await db.select("people", { eq: { email: user.email } }))[0];
  return person?.name || user.email.split("@")[0] || "";
}

/**
 * The batch the signed-in person may send, built on the server (the browser never decides what is due): every
 * track, but only copy written in their own voice, so a send always goes out signed by the person whose Gmail it is.
 */
export async function batchFor(db: Phase1Db, user: Phase1User, now = new Date()): Promise<BatchItem[]> {
  const r = await loadProgrammeRows(db);
  const sender = senderKey(await nameFor(db, user));
  return selectBatch({ messages: r.messages, prospects: r.prospects, phases: r.phases, core: r.core, now, sender, tracks: r.tracks });
}

async function pickMailbox(db: Phase1Db, user: Phase1User): Promise<Row<"mailboxes">> {
  const boxes = (await db.select("mailboxes")).filter((m) => canUse(m, user) && m.status === "connected" && m.send_as_verified && m.refresh_token_enc);
  const m = boxes.find((b) => b.kind === "personal") ?? boxes[0];
  if (!m || !m.send_as) throw new ActionError(409, "No Gmail mailbox is connected and verified for sending yet");
  return m;
}

export interface QueuedEmail { id: string; message_id: string; name: string; to: string; subject: string; step: string }

/**
 * Turn the requested due messages into `composed` outreach rows (the queue the browser then sends one by one
 * through /phase1/api/gmail/send). Re-checks every rule; anything no longer due or with an unfilled slot is skipped.
 */
export async function queueBatch(db: Phase1Db, user: Phase1User, messageIds: string[], now = new Date()) {
  if (!messageIds.length) throw new ActionError(400, "Nothing to send");
  if (messageIds.length > 100) throw new ActionError(400, "At most 100 emails in one batch");
  const mailbox = await pickMailbox(db, user);
  const due = new Map((await batchFor(db, user, now)).map((i) => [i.message.id, i]));
  const left = DAILY_CAP - (await sentTodayCount(db, { mailboxId: mailbox.id, ownerId: user.personId }, now));
  const wanted = messageIds.map((id) => due.get(id)).filter((x): x is BatchItem => !!x);
  const skipped: { message_id: string; reason: string }[] = messageIds.filter((id) => !due.has(id)).map((id) => ({ message_id: id, reason: "No longer due" }));
  const ready = wanted.filter((i) => {
    if (i.unresolved.length) {
      skipped.push({ message_id: i.message.id, reason: `Unfilled: ${i.unresolved.join(" ")}` });
      return false;
    }
    if (!i.subject.trim() || !i.body.trim()) {
      skipped.push({ message_id: i.message.id, reason: "Empty subject or text" });
      return false;
    }
    return true;
  });
  if (ready.length > Math.max(0, left)) throw new ActionError(409, `The daily cap is ${DAILY_CAP} per mailbox: ${Math.max(0, left)} left today`);
  const emails: QueuedEmail[] = [];
  for (const i of ready) {
    const body = hasOptOut(i.body) ? i.body : `${i.body.replace(/\s+$/, "")}\n\n${OPT_OUT}`;
    let row: Row<"outreach_emails"> | undefined;
    const prior = i.message.outreach_email_id ? (await db.select("outreach_emails", { eq: { id: i.message.outreach_email_id } }))[0] : undefined;
    if (prior && prior.status === "composed" && prior.owner_id === user.personId) {
      [row] = await db.update("outreach_emails", { id: prior.id }, { subject: i.subject, body_rendered: body, mailbox_id: mailbox.id, from_address: mailbox.send_as, sent_via: "gmail" });
    } else {
      if (!i.prospect.prospect_id) {
        skipped.push({ message_id: i.message.id, reason: "No linked prospect" });
        continue;
      }
      [row] = await db.insert("outreach_emails", {
        prospect_id: i.prospect.prospect_id, owner_id: user.personId, to_address: i.prospect.email, subject: i.subject, body_rendered: body,
        status: "composed", from_address: mailbox.send_as, mailbox_id: mailbox.id, sent_via: "gmail",
      });
      await db.update("programme_messages", { id: i.message.id }, { outreach_email_id: row!.id });
    }
    emails.push({ id: row!.id, message_id: i.message.id, name: i.prospect.company, to: i.prospect.email ?? "", subject: i.subject, step: i.step });
  }
  return { emails, skipped, gap: PROGRAMME_GAP_SECONDS };
}

export async function skipMessage(db: Phase1Db, messageId: string) {
  const m = (await db.select("programme_messages", { eq: { id: messageId } }))[0];
  if (!m) throw new ActionError(404, "Message not found");
  if (m.status === "sent") throw new ActionError(409, "Already sent");
  if (m.outreach_email_id) await db.remove("outreach_emails", { id: m.outreach_email_id, status: "composed" });
  await db.update("programme_messages", { id: messageId }, { status: "skipped", outreach_email_id: null });
  return { ok: true };
}

/** Accept the computed result: mark the winner, activate the next phase of the track, write the review. */
export async function acceptPhase(db: Phase1Db, user: Phase1User, phaseId: string, now = new Date()) {
  const r = await loadProgrammeRows(db);
  const phase = r.phases.find((p) => p.phase_id === phaseId);
  if (!phase) throw new ActionError(404, "Phase not found");
  if (phase.status === "judged") throw new ActionError(409, "This phase is already judged");
  const res = computePhaseResult(phase, prospectFacts(r.prospects, r.messages, r.core, r.replies, r.events), now);
  if (!res.due) throw new ActionError(409, "The judge day has not arrived yet");
  await db.update("phases", { phase_id: phaseId }, { status: "judged", winner: res.winner, judged_at: now.toISOString(), result: { summary: res.summary, metric: res.metric, rows: res.rows } as never });
  const nextPhase = r.phases.filter((p) => p.track_key === phase.track_key && p.ord > phase.ord && p.status === "planned").sort((a, b) => a.ord - b.ord)[0];
  if (nextPhase) await db.update("phases", { phase_id: nextPhase.phase_id }, { status: "active" });
  await db.insert("review_log", {
    reviewed_on: londonToday(now), track_key: phase.track_key, sends: res.rows.reduce((n, x) => n + x.sent, 0),
    replies_by_variant: Object.fromEntries(res.rows.map((x) => [x.key, { sent: x.sent, replied: x.replied, positive: x.positive, calls: x.calls }])) as never,
    learnings: `${phase.phase_id}: ${res.summary}`, decision: res.next ?? (res.winner === "none" ? "No winner; carry on unchanged" : `${res.winner} wins`), created_by: user.email,
  });
  return { winner: res.winner, summary: res.summary, next: nextPhase?.phase_id ?? null };
}

export async function reviewLead(db: Phase1Db, extId: string, decision: "approve" | "skip") {
  const p = (await db.select("programme_prospects", { eq: { ext_id: extId } }))[0];
  if (!p) throw new ActionError(404, "Lead not found");
  if (p.status !== "new" && p.status !== "skipped" && p.status !== "approved") throw new ActionError(409, "This lead is already in progress");
  await db.update("programme_prospects", { ext_id: extId }, { status: decision === "approve" ? "approved" : "skipped" });
  return { ok: true };
}

export async function requestLeads(db: Phase1Db, user: Phase1User, input: { track?: unknown; count?: unknown; area?: unknown; note?: unknown }) {
  const track = String(input.track ?? "").trim();
  const tracks = await db.select("tracks");
  if (!track || (tracks.length && !tracks.some((t) => t.key === track))) throw new ActionError(400, "Pick a track");
  const count = Math.min(200, Math.max(1, Math.round(Number(input.count ?? 20)) || 20));
  const area = String(input.area ?? "").trim().slice(0, 120) || "London, anywhere";
  const note = String(input.note ?? "").trim().slice(0, 500) || null;
  const [row] = await db.insert("lead_requests", { requested_by: user.email, track, count, area, note, status: "pending" });
  return { request: row! };
}

export async function addReview(db: Phase1Db, createdBy: string, input: Record<string, unknown>) {
  const learnings = String(input.learnings ?? "").trim();
  const decision = String(input.decision ?? "").trim();
  if (!learnings && !decision) throw new ActionError(400, "A review needs learnings or a decision");
  const date = String(input.reviewed_on ?? input.date ?? "");
  const [row] = await db.insert("review_log", {
    reviewed_on: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : londonToday(new Date()),
    track_key: String(input.track_key ?? input.track ?? "").trim() || null,
    sends: Number.isFinite(Number(input.sends)) && input.sends !== "" && input.sends != null ? Math.round(Number(input.sends)) : null,
    replies_by_variant: (input.replies_by_variant && typeof input.replies_by_variant === "object" ? input.replies_by_variant : null) as never,
    learnings: learnings || null, decision: decision || null, created_by: createdBy,
  });
  return { review: row! };
}

export { aheadInPhase };

// ---------------------------------------------------------------- replies

const CORE_STATUSES = ["prospect", "contacted", "replied", "call_booked", "discovery", "proposal", "won", "lost", "do_not_contact"];

/** Record a playbook category on a reply (cue match accepted, or his override). Opt-out categories mark do not contact. */
export async function setReplyCategory(db: Phase1Db, user: Phase1User, replyId: string, category: string) {
  const { classifyReply, setStatus } = await import("./actions");
  const r = (await db.select("replies", { eq: { id: replyId } }))[0];
  if (!r) throw new ActionError(404, "Reply not found");
  await db.update("replies", { id: replyId }, { playbook_category: category || null });
  const entry = (await db.select("reply_playbook", { eq: { category } }))[0];
  const next = entry?.next_status ?? null;
  if (next === "do_not_contact") await classifyReply(db, user, replyId, "stop");
  else if (next && ["call_booked", "discovery", "proposal", "won"].includes(next)) {
    await db.update("replies", { id: replyId }, { reply_type: "positive", classified_by: user.personId, classified_at: new Date().toISOString() });
    if (r.prospect_id) await setStatus(db, user, r.prospect_id, next as never, { reason: `reply: ${category}` });
  }
  return { ok: true };
}

/** After a prepared reply was sent: stamp the reply and apply the playbook's next status. */
export async function markReplySent(db: Phase1Db, user: Phase1User, replyId: string, category: string | null, gmailId: string) {
  const { setStatus } = await import("./actions");
  const r = (await db.select("replies", { eq: { id: replyId } }))[0];
  if (!r) throw new ActionError(404, "Reply not found");
  await db.update("replies", { id: replyId }, { reply_sent_at: new Date().toISOString(), reply_sent_message_id: gmailId, ...(category ? { playbook_category: category } : {}) });
  await db.insert("events", { prospect_id: r.prospect_id, owner_id: user.personId, kind: "note", detail: { reply_sent: true, category } });
  const entry = category ? (await db.select("reply_playbook", { eq: { category } }))[0] : undefined;
  const next = entry?.next_status;
  if (next && r.prospect_id && CORE_STATUSES.includes(next)) await setStatus(db, user, r.prospect_id, next as never, { reason: `reply sent: ${category}` });
  else if (next && r.prospect_id) await db.update("programme_prospects", { prospect_id: r.prospect_id }, { status: next });
  return { ok: true };
}
