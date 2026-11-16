/**
 * Server-side writes for the dashboard. The caller has already run requireUser(); the owner id comes from
 * the session, never from the request. Pure logic over a Phase1Db so it also runs on the in-memory store.
 */
import { csvToObjects } from "./csv";
import { OPT_OUT, endsWithOptOut, findUnresolved } from "./merge";
import { eventForStatus } from "./pipeline";
import { checkSendable } from "./rules";
import { DAILY_CAP } from "./send";
import { londonDayStart } from "./metrics";
import type { Phase1Db } from "./supabase";
import type { Insert, Phase1User, ProspectStatus, ReplyType, Row } from "./types";

export class ActionError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Fields a person may edit by hand. legal_ok is generated and never written. */
export const EDITABLE_PROSPECT_FIELDS = [
  "name", "vertical", "trade_or_type", "tier", "area", "postcode", "website", "maps_url", "public_email", "phone_public",
  "channel", "company_type", "companies_house_no", "consent_recorded", "consent_note", "email_found", "first_name",
  "opener_general", "opener_specific", "subject_hint", "why_fit", "suggested_angle", "notes", "owner_id", "status",
] as const;

const STATUSES: ProspectStatus[] = ["prospect", "contacted", "replied", "call_booked", "discovery", "proposal", "won", "lost", "do_not_contact"];
const REPLY_TYPES: ReplyType[] = ["unclassified", "positive", "neutral", "no", "stop", "bounce", "auto"];

function clean(v: unknown): unknown {
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  return v;
}

function pick(patch: Record<string, unknown>): Insert<"prospects"> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_PROSPECT_FIELDS) if (k in patch) out[k] = clean(patch[k]);
  if (out.company_type === null) out.company_type = "unknown";
  if (typeof out.name !== "undefined" && !out.name) throw new ActionError(400, "A business needs a name");
  if (out.status && !STATUSES.includes(out.status as ProspectStatus)) throw new ActionError(400, "Unknown status");
  if ("public_email" in out) out.email_found = !!out.public_email || out.email_found === true;
  return out as Insert<"prospects">;
}

async function getProspect(db: Phase1Db, id: string): Promise<Row<"prospects">> {
  const p = (await db.select("prospects", { eq: { id } }))[0];
  if (!p) throw new ActionError(404, "Business not found");
  return p;
}

export async function setStatus(db: Phase1Db, user: Phase1User, id: string, to: ProspectStatus, detail?: Record<string, unknown>) {
  if (!STATUSES.includes(to)) throw new ActionError(400, "Unknown status");
  const p = await getProspect(db, id);
  if (p.status === to) return p;
  const [row] = await db.update("prospects", { id }, { status: to, status_changed_at: new Date().toISOString() });
  await db.insert("events", { prospect_id: id, owner_id: user.personId, kind: eventForStatus(to), detail: { from: p.status, to, ...(detail ?? {}) } });
  return row!;
}

export async function updateProspect(db: Phase1Db, user: Phase1User, id: string, patch: Record<string, unknown>) {
  const fields = pick(patch);
  const wantStatus = fields.status;
  delete fields.status;
  await getProspect(db, id);
  if (Object.keys(fields).length) await db.update("prospects", { id }, fields);
  if (wantStatus) return setStatus(db, user, id, wantStatus as ProspectStatus);
  return getProspect(db, id);
}

export async function createProspect(db: Phase1Db, user: Phase1User, row: Record<string, unknown>) {
  const fields = pick({ ...row, owner_id: row.owner_id ?? user.personId });
  if (!fields.name) throw new ActionError(400, "A business needs a name");
  const [made] = await db.insert("prospects", { ...fields, source_doc: "notes" });
  return made!;
}

/** CSV import: rows keyed by the seed header. Existing (name, area) pairs are skipped, not overwritten. */
export async function importProspects(db: Phase1Db, user: Phase1User, csvText: string, people: Row<"people">[]) {
  const rows = csvToObjects(csvText);
  const existing = await db.select("prospects");
  const key = (n: string, a: string | null) => `${n.trim().toLowerCase()}|${(a ?? "").trim()}`;
  const seen = new Set(existing.map((p) => key(p.name, p.area)));
  const toMake: Insert<"prospects">[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r.name) {
      skipped++;
      continue;
    }
    if (seen.has(key(r.name, r.area || null))) {
      skipped++;
      continue;
    }
    seen.add(key(r.name, r.area || null));
    const owner = people.find((p) => (p.email ?? "").startsWith((r.owner ?? "").toLowerCase()) && r.owner)?.id ?? user.personId;
    const f = pick({ ...r, owner_id: owner, consent_recorded: false });
    toMake.push({ ...f, source_doc: "notes", tier: (r.tier || null) as never, email_found: !!r.public_email || r.email_found === "true" });
  }
  if (toMake.length) await db.insert("prospects", toMake);
  return { added: toMake.length, skipped };
}

export interface ComposeItem {
  prospect_id: string;
  subject: string;
  body: string;
  subject_variant_id?: string | null;
  body_variant_id?: string | null;
  opener_used?: string | null;
  test_id?: string | null;
  batch_id?: string | null;
}

/** Emails sent since London midnight from one mailbox (or by one person when there is no mailbox). */
export async function sentTodayCount(db: Phase1Db, who: { mailboxId: string | null; ownerId: string | null }, now = new Date()): Promise<number> {
  const since = londonDayStart(now).toISOString();
  const all = await db.select("outreach_emails");
  return all.filter((e) => e.sent_at && e.sent_at >= since && (who.mailboxId ? e.mailbox_id === who.mailboxId : e.owner_id === who.ownerId)).length;
}

/** Store the rendered emails as `composed` rows: the queue the browser then works through. */
export async function composeEmails(db: Phase1Db, user: Phase1User, items: ComposeItem[], via: "gmail" | "manual", from: string | null, mailboxId: string | null) {
  if (!items.length) throw new ActionError(400, "Nothing to send");
  if (items.length > 100) throw new ActionError(400, "At most 100 emails in one batch");
  const prospects = await db.select("prospects");
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const made: Row<"outreach_emails">[] = [];
  const skipped: { prospect_id: string; reason: string }[] = [];
  if (via === "gmail") {
    const left = DAILY_CAP - (await sentTodayCount(db, { mailboxId, ownerId: user.personId }));
    if (items.length > Math.max(0, left)) throw new ActionError(409, `The daily cap is ${DAILY_CAP} per mailbox: ${Math.max(0, left)} left today`);
  }
  for (const it of items) {
    const p = byId.get(it.prospect_id);
    if (!p) {
      skipped.push({ prospect_id: it.prospect_id, reason: "Not found" });
      continue;
    }
    const check = checkSendable(p);
    const left = [...findUnresolved(it.subject), ...findUnresolved(it.body)];
    if (check.blocked) skipped.push({ prospect_id: p.id, reason: check.reasons.join(", ") });
    else if (!it.subject.trim() || !it.body.trim()) skipped.push({ prospect_id: p.id, reason: "Empty subject or text" });
    else if (left.length) skipped.push({ prospect_id: p.id, reason: `Unfilled: ${left.join(" ")}` });
    else if (!endsWithOptOut(it.body)) skipped.push({ prospect_id: p.id, reason: "Missing the opt-out line" });
    else {
      const [row] = await db.insert("outreach_emails", {
        prospect_id: p.id,
        owner_id: user.personId,
        batch_id: it.batch_id ?? null,
        test_id: it.test_id ?? null,
        subject_variant_id: it.subject_variant_id ?? null,
        body_variant_id: it.body_variant_id ?? null,
        opener_used: it.opener_used ?? null,
        to_address: p.public_email,
        subject: it.subject,
        body_rendered: it.body,
        status: "composed",
        from_address: from,
        mailbox_id: mailboxId,
        sent_via: via,
      });
      made.push(row!);
    }
  }
  return { emails: made, skipped };
}

/** Mark one composed email as sent (by Gmail or by hand) and move the business to contacted. */
export async function recordSent(
  db: Phase1Db,
  user: Phase1User,
  emailId: string,
  info: { via: "gmail" | "manual"; gmail_message_id?: string | null; gmail_thread_id?: string | null; rfc_message_id?: string | null; sent_at?: string },
) {
  const e = (await db.select("outreach_emails", { eq: { id: emailId } }))[0];
  if (!e) throw new ActionError(404, "Email not found");
  const [row] = await db.update("outreach_emails", { id: emailId }, {
    status: "sent",
    sent_at: info.sent_at ?? new Date().toISOString(),
    sent_via: info.via,
    send_error: null,
    gmail_message_id: info.gmail_message_id ?? e.gmail_message_id,
    gmail_thread_id: info.gmail_thread_id ?? e.gmail_thread_id,
    rfc_message_id: info.rfc_message_id ?? e.rfc_message_id,
  });
  const p = await getProspect(db, e.prospect_id);
  if (p.status === "prospect") await setStatus(db, user, p.id, "contacted", { email_id: emailId });
  return row!;
}

export async function cancelComposed(db: Phase1Db, ids: string[]) {
  let n = 0;
  for (const id of ids) n += await db.remove("outreach_emails", { id, status: "composed" });
  return n;
}

/** Classify a reply; "stop" sets do_not_contact, "bounce" marks the email bounced. */
export async function classifyReply(db: Phase1Db, user: Phase1User, id: string, type: ReplyType) {
  if (!REPLY_TYPES.includes(type)) throw new ActionError(400, "Unknown reply type");
  const r = (await db.select("replies", { eq: { id } }))[0];
  if (!r) throw new ActionError(404, "Reply not found");
  const [row] = await db.update("replies", { id }, { reply_type: type, classified_by: user.personId, classified_at: new Date().toISOString() });
  await afterReply(db, user, r.prospect_id, r.outreach_email_id, type);
  return row!;
}

/** Status changes that follow from a reply's type. */
export async function afterReply(db: Phase1Db, user: Phase1User, prospectId: string | null, emailId: string | null, type: ReplyType) {
  if (emailId && type === "bounce") await db.update("outreach_emails", { id: emailId }, { status: "bounced" });
  if (emailId && type === "stop") await db.update("outreach_emails", { id: emailId }, { status: "stopped" });
  if (emailId && (type === "positive" || type === "neutral" || type === "no")) await db.update("outreach_emails", { id: emailId }, { status: "replied" });
  if (!prospectId) return;
  const p = (await db.select("prospects", { eq: { id: prospectId } }))[0];
  if (!p) return;
  if (type === "stop") await setStatus(db, user, prospectId, "do_not_contact", { reason: "replied stop" });
  else if ((type === "positive" || type === "neutral" || type === "no") && p.status === "contacted") await setStatus(db, user, prospectId, "replied");
}

export async function saveVariant(db: Phase1Db, input: Record<string, unknown>) {
  const kinds = ["subject", "body", "opener", "ask", "follow_up", "signature"];
  const kind = String(input.kind ?? "");
  const code = String(input.code ?? "").trim();
  const text = String(input.text ?? "");
  if (!kinds.includes(kind) || !code || !text.trim()) throw new ActionError(400, "A variant needs a kind, a code and text");
  const fields = { kind: kind as never, code, label: clean(input.label) as string | null, text, tone: (clean(input.tone) ?? null) as never, audience: (clean(input.audience) ?? null) as never, source: "dayyan_edit" as const };
  if (input.id) {
    const [row] = await db.update("variants", { id: String(input.id) }, fields);
    if (!row) throw new ActionError(404, "Variant not found");
    return row;
  }
  const [row] = await db.insert("variants", { ...fields, status: "active" });
  return row!;
}

export { OPT_OUT };
