import type { Mailbox } from "./types";

/** This week Jack sends from his own Gmail as it is (his ask, 18 Nov): no arepolabs "Send mail as" alias is needed. */
export const OWN_GMAIL_SENDERS = ["jackburbridge72@gmail.com"];
export const sendsFromOwnGmail = (m: Pick<Mailbox, "address">): boolean => OWN_GMAIL_SENDERS.includes((m.address ?? "").trim().toLowerCase());
/** The From address and name for a mailbox: its verified arepolabs alias, or (Jack only) his own Gmail address. */
export function fromIdentity(m: Mailbox): { address: string; name: string; alias: boolean } | null {
  if (sendsFromOwnGmail(m)) return { address: m.address.trim().toLowerCase(), name: m.send_as_name || "Jack Burbridge", alias: false };
  if (m.send_as && m.send_as_verified) return { address: m.send_as, name: m.send_as_name ?? "Dayyan Sheikh", alias: true };
  return null;
}

