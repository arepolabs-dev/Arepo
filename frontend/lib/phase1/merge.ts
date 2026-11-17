/**
 * Merge-field renderer for outreach emails. The drafts in content/phase1/seed/variants.json are copied
 * word for word from doc 08; only the slots are tokens: {first_name}, {business}, {opener}, {subject_hint}.
 * Bracket placeholders from the drafts ([booking link], [phone number], [email], [Business name]) are
 * filled from the sender's details; any bracket or token left over is reported in `unresolved`, and the
 * send screen refuses to send until the text has none.
 */

/** The fallback opt-out line, appended only when a body has no opt-out at all. Normally it sits above the sign-off. */
export const OPT_OUT = `If you'd rather not hear from me, reply to this email and let me know.`;

/** The older wording, still accepted so earlier drafts are not changed or skipped. */
export const OLD_OPT_OUT = `If you'd rather not hear from me, reply "stop" and I won't write again.`;

/** True when the text has an opt-out line anywhere (new or old wording, or an unsubscribe line). */
export function hasOptOut(text: string): boolean {
  return /rather not hear from me/i.test(text) || /reply\s+["“'‘]?\s*stop/i.test(text) || /unsubscribe/i.test(text);
}

export interface Sender {
  /** Full name, e.g. "Dayyan Sheikh". */
  name: string;
  firstName: string;
  /** The address the mail goes out as (the arepolabs alias). */
  email: string;
  phone?: string;
  bookingLink?: string;
  business?: string;
}

export interface MergeProspect {
  name: string;
  first_name?: string | null;
  opener_general?: string | null;
  opener_specific?: string | null;
  subject_hint?: string | null;
}

export interface MergeInput {
  prospect: MergeProspect;
  subject: string;
  body: string;
  /** Signature block text (a "signature" variant); optional. */
  signature?: string | null;
  sender: Sender;
  /** Which opening line to use; falls back to the other one when the preferred one is empty. */
  opener?: "specific" | "general";
}

export interface MergeResult {
  subject: string;
  body: string;
  openerUsed: string;
  unresolved: string[];
  warnings: string[];
}

const SIGNOFF = /^(Dayyan|Jack)$/;

export function pickOpener(p: MergeProspect, prefer: "specific" | "general" = "specific"): string {
  const s = (p.opener_specific ?? "").trim();
  const g = (p.opener_general ?? "").trim();
  return prefer === "specific" ? s || g : g || s;
}

function fillBrackets(text: string, s: Sender): string {
  const map: [RegExp, string | undefined][] = [
    [/\[(?:booking link|Calendly link)\]/gi, s.bookingLink],
    [/\[(?:phone number|phone)\]/gi, s.phone],
    [/\[email\]/gi, s.email],
    [/\[Business name\]/gi, s.business],
  ];
  let out = text;
  for (const [re, val] of map) if (val && val.trim()) out = out.replace(re, val.trim());
  return out;
}

/** Fill the slots in one string. `{first_name}` falls back to "there" in the body. */
export function fillSlots(text: string, p: MergeProspect, opener: string, s: Sender, isSubject = false): string {
  const first = (p.first_name ?? "").trim();
  let out = text;
  if (isSubject) {
    out = first ? out.replace(/\{first_name\}/g, first) : out.replace(/,\s*\{first_name\}/g, "").replace(/\{first_name\}/g, "");
  } else {
    out = out.replace(/\{first_name\}/g, first || "there");
  }
  out = out.replace(/\{business\}/g, p.name);
  if (opener) out = out.replace(/\{opener\}/g, opener);
  const hint = (p.subject_hint ?? "").trim();
  if (hint) out = out.replace(/\{subject_hint\}/g, hint);
  return fillBrackets(out, s);
}

/** Tokens and brackets still in the text. */
export function findUnresolved(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{[a-z_ ]+\}|\[[^\]\n]{2,}\]/gi)) found.add(m[0]);
  return Array.from(found);
}

export function endsWithOptOut(text: string): boolean {
  return hasOptOut(text);
}

function lastNonEmptyIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i]!.trim()) return i;
  return -1;
}

/** Swap the draft's sign-off name for the sender's, or attach the signature block. */
function finishBody(body: string, signature: string | null | undefined, s: Sender): string {
  const lines = body.replace(/\s+$/, "").split("\n");
  const last = lastNonEmptyIndex(lines);
  const hasSignoff = last >= 0 && SIGNOFF.test(lines[last]!.trim());
  let out: string;
  if (signature && signature.trim()) {
    const kept = hasSignoff ? lines.slice(0, last) : lines;
    const sigLines = signature.trim().split("\n");
    if (SIGNOFF.test(sigLines[0]!.trim())) sigLines[0] = s.firstName;
    out = kept.join("\n").replace(/\s+$/, "") + "\n\n" + sigLines.join("\n");
  } else {
    if (hasSignoff) lines[last] = s.firstName;
    out = lines.join("\n");
  }
  if (!hasOptOut(out)) out = out.replace(/\s+$/, "") + "\n\n" + OPT_OUT;
  return fillBrackets(out, s);
}

export function renderEmail(input: MergeInput): MergeResult {
  const { prospect, sender } = input;
  const opener = pickOpener(prospect, input.opener ?? "specific");
  const subject = fillSlots(input.subject, prospect, opener, sender, true).trim();
  const filled = fillSlots(input.body, prospect, opener, sender);
  const body = finishBody(filled, input.signature ? fillSlots(input.signature, prospect, opener, sender) : null, sender);
  const warnings: string[] = [];
  if (!opener && /\{opener\}/.test(input.body)) warnings.push("No opening line for this business: write one in the preview.");
  const other = sender.firstName.toLowerCase() === "jack" ? "Dayyan" : "Jack";
  if (new RegExp(`I'm ${other}\\b`).test(body)) warnings.push(`The draft says "I'm ${other}" but it sends as ${sender.firstName}: edit the text.`);
  return { subject, body, openerUsed: opener, unresolved: Array.from(new Set([...findUnresolved(subject), ...findUnresolved(body)])), warnings };
}

/** A mailto: link with the subject and body filled (the "Open in mail app" fallback). */
export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
