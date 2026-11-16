/**
 * Reply matcher and message classifiers for Gmail sync. Pure functions: sync.ts feeds them parsed messages.
 */

export interface InboundMessage {
  gmailId: string;
  threadId: string;
  /** Bare lower-case sender address. */
  from: string;
  subject: string;
  bodyText: string;
  /** Lower-case header name -> value. */
  headers: Record<string, string>;
}

export interface KnownEmail {
  id: string;
  prospect_id: string;
  gmail_thread_id: string | null;
  rfc_message_id: string | null;
  to_address: string | null;
}

export interface KnownProspect {
  id: string;
  public_email: string | null;
}

export type MatchedBy = "thread" | "in_reply_to" | "address" | "bounce";

export interface Match {
  prospectId: string;
  outreachEmailId: string | null;
  by: MatchedBy;
}

/** "Name <a@b.co>" or "a@b.co" to "a@b.co" (lower case). */
export function bareAddress(v: string): string {
  const m = v.match(/<([^>]+)>/);
  return (m ? m[1]! : v).trim().toLowerCase();
}

export function displayName(v: string): string | null {
  const m = v.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1]!.trim() : null;
}

function messageIds(v: string | undefined): string[] {
  return (v ?? "").match(/<[^>]+>/g) ?? [];
}

export function isBounce(m: Pick<InboundMessage, "from" | "subject" | "headers">): boolean {
  if (/^(mailer-daemon|postmaster)@/i.test(m.from) || /mailer-daemon/i.test(m.from)) return true;
  if (/delivery status notification|undeliverable|undelivered mail|delivery has failed|returned mail/i.test(m.subject)) {
    return /mailer-daemon|postmaster/i.test(m.from) || /multipart\/report/i.test(m.headers["content-type"] ?? "");
  }
  return /multipart\/report/i.test(m.headers["content-type"] ?? "") && /delivery-status/i.test(m.headers["content-type"] ?? "");
}

/** Out-of-office and other automatic replies (Auto-Submitted, X-Autoreply, Precedence headers). */
export function isAutoReply(m: Pick<InboundMessage, "subject" | "headers">): boolean {
  const h = m.headers;
  const auto = (h["auto-submitted"] ?? "").trim().toLowerCase();
  if (auto && auto !== "no") return true;
  if ("x-autoreply" in h || "x-autorespond" in h) return true;
  if (/auto[_-]?reply|auto_reply/i.test(h["precedence"] ?? "")) return true;
  if ((h["x-auto-response-suppress"] ?? "").trim()) return true;
  return /^(automatic reply|auto(matic)?[- ]?reply|out of office)/i.test(m.subject.trim());
}

/** A reply that is just "stop" (the opt-out wording), ignoring quoted text and punctuation. */
export function looksLikeStop(bodyText: string): boolean {
  const first = bodyText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith(">"));
  if (!first) return false;
  return /^["'“]?(stop|unsubscribe|remove me)[\s.!"'”]*$/i.test(first);
}

export function matchInbound(msg: InboundMessage, emails: KnownEmail[], prospects: KnownProspect[]): Match | null {
  const bounce = isBounce(msg);
  const byThread = emails.find((e) => e.gmail_thread_id && e.gmail_thread_id === msg.threadId);
  if (byThread) return { prospectId: byThread.prospect_id, outreachEmailId: byThread.id, by: bounce ? "bounce" : "thread" };

  const refs = [...messageIds(msg.headers["in-reply-to"]), ...messageIds(msg.headers["references"])];
  if (refs.length) {
    const byRef = emails.find((e) => e.rfc_message_id && refs.includes(e.rfc_message_id));
    if (byRef) return { prospectId: byRef.prospect_id, outreachEmailId: byRef.id, by: bounce ? "bounce" : "in_reply_to" };
  }

  if (bounce) {
    const failed = (msg.headers["x-failed-recipients"] ?? "").toLowerCase();
    const hay = `${failed}\n${msg.bodyText.toLowerCase()}`;
    const hit = emails.find((e) => e.to_address && hay.includes(e.to_address.toLowerCase()));
    if (hit) return { prospectId: hit.prospect_id, outreachEmailId: hit.id, by: "bounce" };
    return null;
  }

  const byAddr = prospects.find((p) => p.public_email && p.public_email.trim().toLowerCase() === msg.from);
  if (byAddr) {
    const last = emails.filter((e) => e.prospect_id === byAddr.id).pop();
    return { prospectId: byAddr.id, outreachEmailId: last?.id ?? null, by: "address" };
  }
  return null;
}
