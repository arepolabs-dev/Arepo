/**
 * Dashboard formulas (plan WP4/WP6). Pure functions over plain rows so they can be tested.
 *  - Emails out = outreach emails with sent_at not null.
 *  - Reply rate only counts emails sent at least 5 working days ago, shown as "x of y".
 *  - Replies exclude bounce and auto.
 *  - A test winner needs at least 2 more positive replies or booked calls than the other, and at least 2 in total.
 *  - Follow-ups due: sent, no reply, no follow-up yet, sent more than 4 working days ago.
 *  - The week starts Monday 00:00 Europe/London.
 */

export const LONDON = "Europe/London";
export const REPLY_WAIT_WORKING_DAYS = 5;
export const FOLLOW_UP_WORKING_DAYS = 4;
/** Week 1 of the 4-week plan starts on this Monday (London). */
export const PLAN_START = "2026-11-16";

const DAY = 86_400_000;

function londonParts(d: Date): { y: number; m: number; d: number; wd: number; h: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return { y: +get("year"), m: +get("month"), d: +get("day"), wd: wdMap[get("weekday")] ?? 0, h: +get("hour") };
}

function londonOffsetMs(at: number): number {
  const d = new Date(at);
  const p = londonParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, d.getUTCMinutes(), d.getUTCSeconds());
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** The instant of 00:00 London time on the given London calendar date. */
export function londonMidnight(y: number, m: number, d: number): Date {
  let t = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 3; i++) t = Date.UTC(y, m - 1, d) - londonOffsetMs(t);
  return new Date(t);
}

export function londonDayStart(now: Date): Date {
  const p = londonParts(now);
  return londonMidnight(p.y, p.m, p.d);
}

/** Monday 00:00 London of the week containing `now`. */
export function londonWeekStart(now: Date): Date {
  const p = londonParts(now);
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.d) - p.wd * DAY);
  return londonMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

/** Whole working days (Mon to Fri) from `from` to `to`, counting London calendar days; 0 if to <= from. */
export function workingDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const a = londonParts(from);
  const b = londonParts(to);
  let cur = Date.UTC(a.y, a.m - 1, a.d);
  const end = Date.UTC(b.y, b.m - 1, b.d);
  let n = 0;
  while (cur < end) {
    cur += DAY;
    const dow = new Date(cur).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export interface MEmail {
  id: string;
  prospect_id: string;
  sent_at: string | null;
  status: string;
  follow_up_of: string | null;
  owner_id?: string | null;
  subject_variant_id?: string | null;
  body_variant_id?: string | null;
  test_id?: string | null;
}
export interface MReply {
  prospect_id: string | null;
  outreach_email_id: string | null;
  reply_type: string;
  received_at: string;
}
export interface MEvent {
  prospect_id: string | null;
  kind: string;
  at: string;
  detail?: Record<string, unknown> | null;
}
export interface MProspect {
  id: string;
  status: string;
  channel: string | null;
}

export const isRealReply = (r: MReply) => r.reply_type !== "bounce" && r.reply_type !== "auto";
const sent = (e: MEmail) => !!e.sent_at;

/** Did this email get a real reply (not bounce or auto)? */
function hasRealReply(e: MEmail, replies: MReply[]): boolean {
  return replies.some(
    (r) =>
      isRealReply(r) &&
      (r.outreach_email_id === e.id || (r.outreach_email_id == null && r.prospect_id === e.prospect_id && !!e.sent_at && r.received_at >= e.sent_at)),
  );
}

export interface Ratio {
  num: number;
  den: number;
  /** 0 to 1, or null with no denominator. */
  rate: number | null;
}
const ratio = (num: number, den: number): Ratio => ({ num, den, rate: den > 0 ? num / den : null });

/** "1 in N" text for a ratio, or "n/a". */
export function oneIn(r: Ratio): string {
  return r.num > 0 && r.den > 0 ? `1 in ${Math.round(r.den / r.num)}` : "n/a";
}

export function replyRate(emails: MEmail[], replies: MReply[], now: Date): Ratio {
  const matured = emails.filter((e) => e.sent_at && workingDaysBetween(new Date(e.sent_at), now) >= REPLY_WAIT_WORKING_DAYS && e.status !== "bounced");
  const replied = matured.filter((e) => hasRealReply(e, replies));
  return ratio(replied.length, matured.length);
}

export function followUpsDue(emails: MEmail[], replies: MReply[], prospects: MProspect[], now: Date): MEmail[] {
  const followed = new Set(emails.filter((e) => e.follow_up_of).map((e) => e.follow_up_of));
  const blocked = new Set(prospects.filter((p) => p.status === "do_not_contact").map((p) => p.id));
  return emails.filter(
    (e) =>
      e.sent_at &&
      !e.follow_up_of &&
      !followed.has(e.id) &&
      e.status !== "bounced" &&
      e.status !== "stopped" &&
      !blocked.has(e.prospect_id) &&
      !hasRealReply(e, replies) &&
      workingDaysBetween(new Date(e.sent_at), now) >= FOLLOW_UP_WORKING_DAYS,
  );
}

export function countEvents(events: MEvent[], kind: string, since?: Date): number {
  return events.filter((e) => e.kind === kind && (!since || new Date(e.at) >= since)).length;
}

export interface Counts {
  emailsOut: number;
  emailsThisWeek: number;
  emailsToday: number;
  replies: number;
  positive: number;
  bounces: number;
  autos: number;
  stops: number;
  walkIns: number;
  calls: number;
  discoveries: number;
  proposals: number;
  won: number;
}

export function computeCounts(emails: MEmail[], replies: MReply[], events: MEvent[], now: Date, since?: Date): Counts {
  const inRange = (iso: string | null) => !!iso && (!since || new Date(iso) >= since);
  const week = londonWeekStart(now);
  const day = londonDayStart(now);
  const rs = replies.filter((r) => inRange(r.received_at));
  return {
    emailsOut: emails.filter((e) => sent(e) && inRange(e.sent_at)).length,
    emailsThisWeek: emails.filter((e) => e.sent_at && new Date(e.sent_at) >= week).length,
    emailsToday: emails.filter((e) => e.sent_at && new Date(e.sent_at) >= day).length,
    replies: rs.filter(isRealReply).length,
    positive: rs.filter((r) => r.reply_type === "positive").length,
    bounces: rs.filter((r) => r.reply_type === "bounce").length,
    autos: rs.filter((r) => r.reply_type === "auto").length,
    stops: rs.filter((r) => r.reply_type === "stop").length,
    walkIns: countEvents(events, "walk_in", since),
    calls: countEvents(events, "call_booked", since),
    discoveries: countEvents(events, "discovery_done", since),
    proposals: countEvents(events, "proposal_sent", since),
    won: countEvents(events, "won", since),
  };
}

export interface Funnel {
  emailToCall: Ratio;
  walkInToCall: Ratio;
  discoveryToProposal: Ratio;
  proposalToSigned: Ratio;
}

export function funnel(c: Counts, prospects: MProspect[], events: MEvent[]): Funnel {
  const walkProspects = new Set(events.filter((e) => e.kind === "walk_in" && e.prospect_id).map((e) => e.prospect_id));
  const walkCalls = new Set(events.filter((e) => e.kind === "call_booked" && e.prospect_id && walkProspects.has(e.prospect_id)).map((e) => e.prospect_id));
  const emailCalls = c.calls - walkCalls.size;
  void prospects;
  return {
    emailToCall: ratio(Math.max(0, emailCalls), c.emailsOut),
    walkInToCall: ratio(walkCalls.size, c.walkIns),
    discoveryToProposal: ratio(c.proposals, c.discoveries),
    proposalToSigned: ratio(c.won, c.proposals),
  };
}

export interface Winner {
  winner: "a" | "b" | "none";
  a: number;
  b: number;
  reason: string;
}

/** The doc 07 rule: at least 2 more than the other, and at least 2 in total, else no winner yet. */
export function testWinner(a: number, b: number): Winner {
  const total = a + b;
  if (total < 2) return { winner: "none", a, b, reason: "no winner yet: fewer than 2 positive replies or calls in total" };
  if (a - b >= 2) return { winner: "a", a, b, reason: `A leads by ${a - b}` };
  if (b - a >= 2) return { winner: "b", a, b, reason: `B leads by ${b - a}` };
  return { winner: "none", a, b, reason: "no winner yet: the lead is under 2" };
}

/** Positive replies or booked calls among emails sent with this variant (subject or body). */
export function variantScore(
  variantId: string | null,
  emails: MEmail[],
  replies: MReply[],
  events: MEvent[],
  testId?: string | null,
): { sent: number; wins: number } {
  if (!variantId) return { sent: 0, wins: 0 };
  const mine = emails.filter(
    (e) => e.sent_at && (e.subject_variant_id === variantId || e.body_variant_id === variantId) && (!testId || e.test_id === testId),
  );
  const prospects = new Set(mine.map((e) => e.prospect_id));
  const wins = new Set<string>();
  for (const r of replies) if (r.reply_type === "positive" && r.prospect_id && prospects.has(r.prospect_id)) wins.add(r.prospect_id);
  for (const ev of events) if (ev.kind === "call_booked" && ev.prospect_id && prospects.has(ev.prospect_id)) wins.add(ev.prospect_id);
  return { sent: mine.length, wins: wins.size };
}

/** Plan week (1 to 4) for `now`; 0 before the start, 5 after the 4 weeks. */
export function planWeek(now: Date, start = PLAN_START): number {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const s = londonMidnight(y, m, d).getTime();
  const w = londonWeekStart(now).getTime();
  const n = Math.round((w - s) / (7 * DAY)) + 1;
  return n < 1 ? 0 : n > 4 ? 5 : n;
}
