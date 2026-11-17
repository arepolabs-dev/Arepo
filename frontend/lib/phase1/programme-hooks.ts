/** Small hooks the existing send and status code calls, so the programme stays in step. Never throws: the programme tables may not exist yet. */
import type { Phase1Db } from "./supabase";
import { BLOCKED_STATUSES } from "./programme";

/** An outreach email went out: mark its programme message sent and the prospect contacted. */
export async function onEmailSent(db: Phase1Db, emailId: string, at: string): Promise<void> {
  try {
    const msgs = await db.select("programme_messages", { eq: { outreach_email_id: emailId } });
    for (const m of msgs) {
      await db.update("programme_messages", { id: m.id }, { status: "sent", sent_at: at });
      const p = (await db.select("programme_prospects", { eq: { ext_id: m.prospect_ext_id } }))[0];
      if (p && !BLOCKED_STATUSES.has(p.status)) await db.update("programme_prospects", { id: p.id }, { status: "contacted" });
    }
  } catch {
    /* programme not set up */
  }
}

/** The core prospect's status changed: mirror it onto the programme row (a first email's "contacted" included). */
export async function onStatusChange(db: Phase1Db, prospectId: string, to: string): Promise<void> {
  if (to === "prospect") return;
  try {
    await db.update("programme_prospects", { prospect_id: prospectId }, { status: to });
  } catch {
    /* programme not set up */
  }
}
