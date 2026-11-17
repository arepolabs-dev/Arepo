/**
 * "Send test": the exact production email for one programme message, sent to an address the signed-in person types.
 * It reads only. It never changes a message, writes outreach_emails or sent_at, counts toward the daily cap, or touches
 * opt-outs or replies.
 */
import { ActionError } from "./actions";
import { findAlias, type SendAs } from "./gmail";
import { OPT_OUT, hasOptOut } from "./merge";
import { canUse } from "./mailbox";
import { renderMessage, senderKey } from "./programme";
import type { Phase1Db } from "./supabase";
import type { Phase1User } from "./types";

/** One plain address: no list, no spaces, no CR/LF, no angle brackets. */
export function parseSingleEmail(v: unknown): string {
  const raw = String(v ?? "");
  if (/[\r\n]/.test(raw)) throw new ActionError(400, "Type one email address, nothing else");
  const s = raw.trim();
  if (!s || /[\r\n,;<>\s"]/.test(s) || !/^[^@]+@[^@.]+(\.[^@.]+)+$/.test(s) || s.length > 254) throw new ActionError(400, "Type one email address, nothing else");
  return s;
}

export interface TestSendDeps {
  accessTokenFor: (db: Phase1Db, m: never) => Promise<string>;
  listSendAs: (access: string) => Promise<SendAs[]>;
  sendRaw: (access: string, raw: string) => Promise<{ id: string; threadId: string }>;
  buildMime: (m: { fromName: string; fromAddress: string; to: string; subject: string; body: string }) => { raw: string; messageId: string };
}

export async function sendTest(db: Phase1Db, user: Phase1User, input: { messageId?: unknown; to?: unknown }, deps: TestSendDeps) {
  const to = parseSingleEmail(input.to);
  const m = (await db.select("programme_messages", { eq: { id: String(input.messageId ?? "") } }))[0];
  if (!m) throw new ActionError(404, "Message not found");
  const p = (await db.select("programme_prospects", { eq: { ext_id: m.prospect_ext_id } }))[0];
  if (!p) throw new ActionError(404, "Recipient not found");
  const phases = await db.select("phases");
  const r = renderMessage(m, p, phases);
  if (r.unresolved.length) throw new ActionError(400, `Unfilled: ${r.unresolved.join(" ")}`);
  if (!r.subject.trim() || !r.body.trim()) throw new ActionError(400, "Empty subject or text");
  const body = hasOptOut(r.body) ? r.body : `${r.body.replace(/\s+$/, "")}\n\n${OPT_OUT}`;

  const boxes = (await db.select("mailboxes")).filter((x) => canUse(x, user) && x.kind === "personal");
  const box = boxes[0];
  if (!box || !box.send_as) throw new ActionError(409, "Connect Gmail first");
  const access = await deps.accessTokenFor(db, box as never); // throws ReconnectError, handled by the route
  const found = findAlias(await deps.listSendAs(access), box.send_as);
  if (!found.found || !found.verified) throw new ActionError(409, `${box.send_as} is not set up in Gmail as a verified "Send mail as" address`);
  const mime = deps.buildMime({ fromName: box.send_as_name ?? "Dayyan Sheikh", fromAddress: box.send_as, to, subject: r.subject, body });
  await deps.sendRaw(access, mime.raw);
  void senderKey;
  return { ok: true as const, to };
}
