/** One read of everything the dashboard shows. Tolerates missing tables (migrations not applied yet). */
import { ensureDemo } from "./demo";
import { gmailConfig, missingGmailEnv, sharedAddress } from "./gmail";
import { getDb } from "./supabase";
import type { Phase1User, Row, TableName } from "./types";
import { isTestMode } from "./allowlist";

export interface PublicMailbox {
  id: string;
  owner_id: string;
  address: string;
  kind: "personal" | "shared";
  send_as: string | null;
  send_as_name: string | null;
  send_as_verified: boolean;
  status: "connected" | "needs_reconnect";
  last_sync_at: string | null;
  last_error: string | null;
}

export interface Phase1State {
  now: string;
  me: { email: string; personId: string | null; name: string; firstName: string; alias: string };
  testMode: boolean;
  dbOk: boolean;
  dbNote: string | null;
  gmail: { configured: boolean; missing: string[]; sharedAddress: string };
  people: Row<"people">[];
  prospects: Row<"prospects">[];
  variants: Row<"variants">[];
  tests: Row<"tests">[];
  batches: Row<"batches">[];
  outreach_emails: Row<"outreach_emails">[];
  replies: Row<"replies">[];
  events: Row<"events">[];
  enquiries: Row<"enquiries">[];
  plan_targets: Row<"plan_targets">[];
  mailboxes: PublicMailbox[];
}

export function nameFromEmail(email: string): { name: string; firstName: string } {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean).map((s) => s[0]!.toUpperCase() + s.slice(1));
  return { name: parts.join(" ") || email, firstName: parts[0] ?? email };
}

export async function loadState(user: Phase1User): Promise<Phase1State> {
  const db = getDb();
  let dbOk = true;
  let dbNote: string | null = null;
  const safe = async <T extends TableName>(t: T): Promise<Row<T>[]> => {
    try {
      return await db.select(t);
    } catch {
      dbOk = false;
      dbNote = "The database is not ready yet (migrations 0001 to 0003 not applied?). Showing what can be read.";
      return [];
    }
  };
  try {
    await ensureDemo(db);
  } catch {
    /* demo seeding is best effort */
  }
  const [people, prospects, variants, tests, batches, outreach_emails, replies, events, enquiries, plan_targets, mailboxes] = await Promise.all([
    safe("people"), safe("prospects"), safe("variants"), safe("tests"), safe("batches"), safe("outreach_emails"),
    safe("replies"), safe("events"), safe("enquiries"), safe("plan_targets"), safe("mailboxes"),
  ]);
  const person = people.find((p) => p.email === user.email);
  const fallback = nameFromEmail(user.email);
  const name = person?.name || fallback.name;
  const cfg = gmailConfig();
  return {
    now: new Date().toISOString(),
    me: { email: user.email, personId: user.personId, name, firstName: name.split(" ")[0]!, alias: user.email },
    testMode: isTestMode(),
    dbOk,
    dbNote,
    gmail: { configured: !!cfg, missing: missingGmailEnv(), sharedAddress: sharedAddress() },
    people, prospects, variants, tests, batches, outreach_emails, replies, events, enquiries, plan_targets,
    mailboxes: mailboxes.map((m) => ({
      id: m.id, owner_id: m.owner_id, address: m.address, kind: m.kind, send_as: m.send_as, send_as_name: m.send_as_name,
      send_as_verified: m.send_as_verified, status: m.status, last_sync_at: m.last_sync_at, last_error: m.last_error,
    })),
  };
}
