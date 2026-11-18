/**
 * Pure logic for the phased outreach programme: normalising keys, choosing today's batch, classifying replies
 * against the playbook, computing a phase's result and the numbers behind the scoreboard. No database, no
 * network: everything takes plain rows so it is easy to test.
 */
import { findUnresolved, placeOptOut } from "./merge";
import { checkSendable, isValidEmail, type RuleProspect } from "./rules";
import type {
  EventRow, MessageStep, Phase, ProgrammeMessage, ProgrammeProspect, Reply, ReplyPlaybook, Row, Track,
} from "./types";

type Core = Pick<Row<"prospects">, "id" | "status"> & Partial<Pick<Row<"prospects">, "company_type" | "public_email" | "consent_recorded">>;

// ---------------------------------------------------------------- keys

const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "yahoo.com", "yahoo.co.uk", "icloud.com", "live.com", "live.co.uk", "me.com", "aol.com", "btinternet.com", "sky.com", "proton.me", "protonmail.com"]);

export const normEmail = (e: string | null | undefined): string | null => {
  const v = (e ?? "").trim().toLowerCase();
  return v && v.includes("@") ? v : null;
};

/** The business domain: from the website, else from the email unless it is free mail. Null when unusable. */
export function normDomain(website: string | null | undefined, email?: string | null): string | null {
  const clean = (h: string) => h.toLowerCase().replace(/^www\./, "");
  const w = (website ?? "").trim();
  if (w) {
    try {
      const host = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname;
      if (host.includes(".")) return clean(host);
    } catch {
      /* fall through */
    }
  }
  const e = normEmail(email);
  if (e) {
    const d = clean(e.split("@")[1] ?? "");
    if (d && !FREE_MAIL.has(d)) return d;
  }
  return null;
}

export const slug = (s: string | null | undefined): string => (s ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---------------------------------------------------------------- dates

/** "YYYY-MM-DD" for the London calendar day of `now`. */
export function londonToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ---------------------------------------------------------------- statuses

/** A programme prospect in one of these is never emailed by the batch. */
export const BLOCKED_STATUSES = new Set([
  "new", "skipped", "replied", "call_booked", "discovery", "proposal", "won", "lost", "do_not_contact", "opted_out", "bounced", "stopped",
]);
export const CALL_STATUSES = new Set(["call_booked", "discovery", "proposal", "won"]);

// ---------------------------------------------------------------- variants and templates

export function variantText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["text", "subject", "body", "label", "description", "value"]) if (typeof o[k] === "string") return o[k] as string;
  }
  return String(v);
}

export function variantKeys(p: Pick<Phase, "variants">): string[] {
  return p.variants ? Object.keys(p.variants).sort() : [];
}

/** The winning parts of the latest judged phase before `phase` in the same track, if any. */
export function winnerOf(phase: Phase | undefined, phases: Phase[]): { phase: Phase; key: string; text: string } | null {
  if (!phase) return null;
  const earlier = phases.filter((p) => p.track_key === phase.track_key && p.ord < phase.ord && p.status === "judged" && p.winner && p.winner !== "none").sort((a, b) => b.ord - a.ord)[0];
  if (!earlier) return null;
  return { phase: earlier, key: earlier.winner!, text: variantText(earlier.variants?.[earlier.winner!]) };
}

export interface TemplateCtx {
  firstName: string;
  company: string;
  hook: string;
  winner: { variable: string | null; text: string } | null;
}

/** Fill {{first_name}}, {{company}}, {{hook}}, {{winner}} and {{winner.<variable>}}. Unknown slots are left for the check. */
export function fillTemplate(text: string, ctx: TemplateCtx): string {
  let out = text.replace(/\{\{\s*first_name\s*\}\}/gi, ctx.firstName || "there").replace(/\{\{\s*company\s*\}\}/gi, ctx.company).replace(/\{\{\s*hook\s*\}\}/gi, ctx.hook);
  if (ctx.winner) {
    out = out.replace(/\{\{\s*winner(?:\.([a-z0-9_ ]+))?\s*\}\}/gi, (_m, v: string | undefined) => (!v || slug(v) === slug(ctx.winner!.variable) ? ctx.winner!.text : _m));
  }
  return out;
}

export const unresolvedIn = (text: string): string[] => Array.from(new Set([...findUnresolved(text), ...(text.match(/\{\{[^}]*\}\}/g) ?? [])]));

// ---------------------------------------------------------------- today's batch

export interface BatchItem {
  message: ProgrammeMessage;
  prospect: ProgrammeProspect;
  phase: Phase | null;
  step: MessageStep;
  overdue: boolean;
  subject: string;
  body: string;
  unresolved: string[];
}

export interface BatchInput {
  messages: ProgrammeMessage[];
  prospects: ProgrammeProspect[];
  phases: Phase[];
  core: Core[];
  now: Date;
  /** Track keys to include; empty or undefined means every track. */
  trackKeys?: string[];
  /** Only messages written in this sender's voice (see `senderKey`); needs `tracks` to resolve a message with no sender. */
  sender?: string;
  tracks?: Pick<Track, "key" | "sender">[];
}

const STEP_ORDER: MessageStep[] = ["first", "followup1", "followup2"];

export interface Rendered { subject: string; body: string; unresolved: string[] }

/** The email as the recipient will read it: a template message gets its merge fields and the previous winner filled. */
export function renderMessage(m: Pick<ProgrammeMessage, "subject" | "body" | "template">, p: Pick<ProgrammeProspect, "contact_name" | "company" | "hook" | "phase_id">, phases: Phase[]): Rendered {
  let subject = m.subject ?? "";
  let body = m.body ?? "";
  if (m.template) {
    const phase = p.phase_id ? phases.find((x) => x.phase_id === p.phase_id) : undefined;
    const w = winnerOf(phase, phases);
    const ctx: TemplateCtx = {
      firstName: (p.contact_name ?? "").trim().split(/\s+/)[0] ?? "", company: p.company, hook: p.hook ?? "",
      winner: w ? { variable: w.phase.variable, text: w.text } : null,
    };
    subject = fillTemplate(subject, ctx);
    body = fillTemplate(body, ctx);
  }
  body = placeOptOut(body);
  return { subject, body, unresolved: unresolvedIn(`${subject}\n${body}`) };
}

/**
 * Every first touch and follow-up due today or earlier, for the given tracks. Skips anyone who replied, opted
 * out, bounced, is awaiting review, or is blocked. A follow-up needs the step before it to have been sent.
 */
export function selectBatch(input: BatchInput): BatchItem[] {
  const today = londonToday(input.now);
  const byExt = new Map(input.prospects.map((p) => [p.ext_id, p]));
  const coreById = new Map(input.core.map((c) => [c.id, c]));
  const phaseById = new Map(input.phases.map((p) => [p.phase_id, p]));
  const msgsOf = new Map<string, ProgrammeMessage[]>();
  for (const m of input.messages) msgsOf.set(m.prospect_ext_id, [...(msgsOf.get(m.prospect_ext_id) ?? []), m]);
  const tracks = new Set((input.trackKeys ?? []).map(slug));
  const trackList = input.tracks ?? [];
  const voice = input.sender ? senderKey(input.sender) : "";
  const out: BatchItem[] = [];

  for (const m of input.messages) {
    if (m.status !== "pending" || !m.send_on || m.send_on > today) continue;
    const p = byExt.get(m.prospect_ext_id);
    if (!p) continue;
    if (tracks.size && !tracks.has(slug(p.track_key))) continue;
    if (voice && messageVoice(m, p, trackList) !== voice) continue;
    const mine = msgsOf.get(m.prospect_ext_id) ?? [];
    // One voice per prospect: once a first email went out (from anyone), no other voice sends to them.
    if (m.step === "first" && mine.some((x) => x.step === "first" && x.status === "sent")) continue;
    if (BLOCKED_STATUSES.has(p.status)) continue;
    const core = p.prospect_id ? coreById.get(p.prospect_id) : undefined;
    if (core && BLOCKED_STATUSES.has(core.status)) continue;
    if (!isValidEmail(p.email)) continue;
    const phase = p.phase_id ? phaseById.get(p.phase_id) ?? null : null;
    if (phase && phase.status === "planned") continue;
    // A phase also waits for its start date, and the person must be a confirmed limited company (or have consented).
    if (phase?.starts_on && phase.status !== "active" && phase.starts_on > today) continue;
    if (p.walk_in && !core?.consent_recorded) continue; // walk-in / card only, unless consent has been given
    if (core && core.company_type !== undefined && checkSendable(core as unknown as RuleProspect).blocked) continue;
    const idx = STEP_ORDER.indexOf(m.step);
    if (idx > 0) {
      // A follow-up continues the thread of whoever sent the first email: same voice only.
      const mv = messageVoice(m, p, trackList);
      const same = mine.filter((x) => messageVoice(x, p, trackList) === mv);
      const before = STEP_ORDER.slice(0, idx).map((s) => same.find((x) => x.step === s)).filter(Boolean) as ProgrammeMessage[];
      if (!before.length || before.some((b) => b.status !== "sent" && b.status !== "skipped") || !before.some((b) => b.status === "sent")) continue;
    }
    const r = renderMessage(m, p, input.phases);
    out.push({ message: m, prospect: p, phase, step: m.step, overdue: m.send_on < today, subject: r.subject, body: r.body, unresolved: r.unresolved });
  }
  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.message.send_on ?? "").localeCompare(b.message.send_on ?? "") || STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step) || a.prospect.company.localeCompare(b.prospect.company));
}

/** A sender's key: the lower-cased first name ("Dayyan Sheikh" or "dayyan.sheikh@x" give "dayyan"). */
export function senderKey(nameOrEmail: string | null | undefined): string {
  return (nameOrEmail ?? "").split("@")[0]!.trim().split(/[\s._-]+/)[0]?.toLowerCase() ?? "";
}

/** Whose voice a message is in: its own `sender`, else the sender of the prospect's track. */
export function messageVoice(m: Pick<ProgrammeMessage, "sender">, p: Pick<ProgrammeProspect, "track_key">, tracks: Pick<Track, "key" | "sender">[]): string {
  if (m.sender) return senderKey(m.sender);
  return senderKey(tracks.find((t) => slug(t.key) === slug(p.track_key))?.sender);
}

/** Every voice the programme has copy or a track sender for, in first-seen order. */
export function senderKeys(tracks: Pick<Track, "sender">[], messages: Pick<ProgrammeMessage, "sender">[]): string[] {
  const out: string[] = [];
  for (const k of [...tracks.map((t) => senderKey(t.sender)), ...messages.map((m) => senderKey(m.sender))]) if (k && !out.includes(k)) out.push(k);
  return out;
}

/** Who sent a prospect's first email (a sender key), or null if nobody has yet. */
export function sentBy(p: Pick<ProgrammeProspect, "ext_id" | "track_key">, messages: ProgrammeMessage[], tracks: Pick<Track, "key" | "sender">[]): string | null {
  const m = messages.find((x) => x.prospect_ext_id === p.ext_id && x.step === "first" && x.status === "sent");
  return m ? messageVoice(m, p, tracks) : null;
}

// ---------------------------------------------------------------- reply classification

export interface Classified { category: string; score: number; entry: ReplyPlaybook }

const cuesOf = (e: ReplyPlaybook): string[] => (e.detect_cues ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean);

/** Simple cue matching: the entry with the most cues found in the text wins; a track-specific entry beats "all". */
export function classifyAgainstPlaybook(text: string, playbook: ReplyPlaybook[], trackKey: string | null): Classified | null {
  const t = ` ${text.toLowerCase()} `;
  let best: Classified | null = null;
  for (const e of playbook) {
    if (e.track_key !== "all" && trackKey && slug(e.track_key) !== slug(trackKey)) continue;
    const score = cuesOf(e).filter((c) => t.includes(c)).length;
    if (!score) continue;
    const specific = e.track_key !== "all" ? 0.5 : 0;
    if (!best || score + specific > best.score + (best.entry.track_key !== "all" ? 0.5 : 0)) best = { category: e.category, score, entry: e };
  }
  return best;
}

export const isOptOutEntry = (e: Pick<ReplyPlaybook, "next_status" | "category">): boolean => e.next_status === "do_not_contact" || /opt.?out|unsubscribe|stop/i.test(e.category);

/** The prepared reply for a category, filled in. */
export function fillReply(entry: ReplyPlaybook, ctx: { firstName: string; company: string; senderFirstName: string; subject?: string | null }): { subject: string; body: string; unresolved: string[] } {
  const fill = (s: string) =>
    s.replace(/\{\{?\s*first_name\s*\}?\}/gi, ctx.firstName || "there").replace(/\{\{?\s*(?:company|business)\s*\}?\}/gi, ctx.company).replace(/\{\{?\s*(?:sender_first_name|sender)\s*\}?\}/gi, ctx.senderFirstName);
  const subject = fill(entry.reply_subject?.trim() || `Re: ${(ctx.subject ?? "").replace(/^re:\s*/i, "")}`);
  const body = fill(entry.reply_body ?? "");
  return { subject, body, unresolved: unresolvedIn(`${subject}\n${body}`) };
}

// ---------------------------------------------------------------- numbers

export interface ProspectFacts {
  ext_id: string; track_key: string; phase_id: string | null; variant: string; segment: string; sent: boolean; replied: boolean; positive: boolean; call: boolean;
}

/** One row of facts per programme prospect, from messages, replies and the core status. */
export function prospectFacts(
  prospects: ProgrammeProspect[], messages: ProgrammeMessage[], core: Core[],
  replies: Pick<Reply, "prospect_id" | "reply_type">[], events: Pick<EventRow, "prospect_id" | "kind">[] = [],
): ProspectFacts[] {
  const coreById = new Map(core.map((c) => [c.id, c]));
  const sentFirst = new Set(messages.filter((m) => m.step === "first" && m.status === "sent").map((m) => m.prospect_ext_id));
  return prospects.map((p) => {
    const c = p.prospect_id ? coreById.get(p.prospect_id) : undefined;
    const mine = replies.filter((r) => r.prospect_id && r.prospect_id === p.prospect_id && r.reply_type !== "bounce" && r.reply_type !== "auto");
    const call = (c ? CALL_STATUSES.has(c.status) : false) || CALL_STATUSES.has(p.status) || events.some((e) => e.prospect_id === p.prospect_id && e.kind === "call_booked");
    return {
      ext_id: p.ext_id, track_key: p.track_key, phase_id: p.phase_id, variant: p.variant ?? "-", segment: p.segment ?? "-",
      sent: sentFirst.has(p.ext_id), replied: mine.length > 0 || p.status === "replied" || call,
      positive: mine.some((r) => r.reply_type === "positive") || call, call,
    };
  });
}

export interface Tally { key: string; sent: number; replied: number; positive: number; calls: number; replyRate: number | null; positiveRate: number | null }

export function tally(facts: ProspectFacts[], by: "variant" | "phase_id" | "track_key" | "segment" | "all"): Tally[] {
  const groups = new Map<string, Tally>();
  for (const f of facts) {
    if (!f.sent) continue;
    const key = by === "all" ? "all" : String(f[by] ?? "-");
    const t = groups.get(key) ?? { key, sent: 0, replied: 0, positive: 0, calls: 0, replyRate: null, positiveRate: null };
    t.sent++;
    if (f.replied) t.replied++;
    if (f.positive) t.positive++;
    if (f.call) t.calls++;
    groups.set(key, t);
  }
  return Array.from(groups.values()).map((t) => ({ ...t, replyRate: t.sent ? t.replied / t.sent : null, positiveRate: t.sent ? t.positive / t.sent : null })).sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------- winner

export type Metric = "replied" | "positive" | "calls";
export interface PhaseResult {
  state: "waiting" | "insufficient" | "result";
  /** Variant key, or "none". */
  winner: string;
  metric: Metric;
  due: boolean;
  rows: Tally[];
  summary: string;
  /** What the phase said should happen next for this outcome. */
  next: string | null;
}

export const metricFromRule = (rule: string | null | undefined): Metric => (/call/i.test(rule ?? "") ? "calls" : /positive/i.test(rule ?? "") ? "positive" : "replied");

/**
 * Winner by the phase's rule: the variant with the best rate on the metric the rule names (replies by default,
 * "positive" or "call" if the rule says so). Every variant needs min_sample sends first; a tie or no events is
 * "no signal". Ahead-so-far is reported even before the judge day.
 */
export function computePhaseResult(phase: Phase, facts: ProspectFacts[], now: Date): PhaseResult {
  const mine = facts.filter((f) => f.phase_id === phase.phase_id);
  const keys = variantKeys(phase);
  const tallied = tally(mine, "variant");
  const rows = (keys.length ? keys : tallied.map((t) => t.key)).map((k) => tallied.find((t) => t.key === k) ?? { key: k, sent: 0, replied: 0, positive: 0, calls: 0, replyRate: null, positiveRate: null });
  const metric = metricFromRule(phase.winner_rule);
  const count = (t: Tally) => (metric === "calls" ? t.calls : metric === "positive" ? t.positive : t.replied);
  const rate = (t: Tally) => (t.sent ? count(t) / t.sent : 0);
  const due = !!phase.judge_on && phase.judge_on <= londonToday(now);
  const next = (w: string) => (w === "A" ? phase.on_a_wins : w === "B" ? phase.on_b_wins : w === "C" ? phase.on_c_wins : phase.on_no_signal) ?? null;
  const label = metric === "calls" ? "calls booked" : metric === "positive" ? "positive replies" : "replies";
  const short = rows.filter((r) => r.sent < phase.min_sample);
  const ranked = [...rows].sort((a, b) => rate(b) - rate(a) || count(b) - count(a));
  const lead = ranked[0];
  const second = ranked[1];
  const clear = !!lead && count(lead) > 0 && (!second || rate(lead) > rate(second));
  const line = rows.map((r) => `${r.key}: ${count(r)} of ${r.sent}`).join(", ");
  if (!due) {
    return { state: "waiting", winner: clear ? lead!.key : "none", metric, due, rows, summary: `${clear ? `${lead!.key} is ahead` : "No clear lead yet"} on ${label} (${line}).`, next: null };
  }
  if (short.length) {
    return { state: "insufficient", winner: "none", metric, due, rows, summary: `Judge day, but ${short.map((r) => `${r.key} has ${r.sent} of ${phase.min_sample} sends`).join(" and ")}. Treated as no signal (${line}).`, next: next("none") };
  }
  const winner = clear ? lead!.key : "none";
  return { state: "result", winner, metric, due, rows, summary: clear ? `${winner} wins on ${label} (${line}).` : `No signal on ${label} (${line}).`, next: next(winner) };
}

/** Which variant is ahead right now in a phase, for the scoreboard. */
export function aheadInPhase(phase: Phase, facts: ProspectFacts[], now: Date): { key: string | null; summary: string } {
  const r = computePhaseResult(phase, facts, new Date(0));
  const sent = r.rows.reduce((n, x) => n + x.sent, 0);
  if (!sent) return { key: null, summary: "Nothing sent in this phase yet." };
  void now;
  return { key: r.winner === "none" ? null : r.winner, summary: r.summary };
}
