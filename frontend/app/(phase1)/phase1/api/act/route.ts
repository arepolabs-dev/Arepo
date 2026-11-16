import {
  ActionError, cancelComposed, classifyReply, composeEmails, createProspect, importProspects, recordSent,
  saveVariant, setStatus, updateProspect, type ComposeItem,
} from "@/lib/phase1/actions";
import { findMailbox } from "@/lib/phase1/mailbox";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";
import type { ProspectStatus, ReplyType } from "@/lib/phase1/types";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown> & { action?: string };

/** One endpoint for the dashboard's writes. The owner is the signed-in person, never read from the body. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const b = ((await request.json().catch(() => null)) ?? {}) as Body;
    const db = getDb();
    const str = (k: string) => String(b[k] ?? "");
    switch (b.action) {
      case "prospect.update":
        return Response.json({ prospect: await updateProspect(db, user, str("id"), (b.patch ?? {}) as Record<string, unknown>) });
      case "prospect.create":
        return Response.json({ prospect: await createProspect(db, user, (b.row ?? {}) as Record<string, unknown>) });
      case "prospect.move":
        return Response.json({ prospect: await setStatus(db, user, str("id"), str("to") as ProspectStatus) });
      case "prospect.import": {
        const people = await db.select("people");
        return Response.json(await importProspects(db, user, str("csv"), people));
      }
      case "prospect.walkin": {
        await db.insert("events", { prospect_id: str("id"), owner_id: user.personId, kind: "walk_in", detail: { note: str("note") || null } });
        return Response.json({ ok: true });
      }
      case "outreach.compose": {
        const via = b.via === "gmail" ? "gmail" : "manual";
        let from: string | null = str("from") || user.email;
        let mailboxId: string | null = null;
        if (via === "gmail") {
          const m = await findMailbox(db, user, str("mailbox_id"));
          mailboxId = m.id;
          from = m.send_as;
        }
        return Response.json(await composeEmails(db, user, (b.items ?? []) as ComposeItem[], via, from, mailboxId));
      }
      case "outreach.markSent": {
        const ids = (b.ids ?? []) as string[];
        const rows = [];
        for (const id of ids) rows.push(await recordSent(db, user, id, { via: "manual" }));
        return Response.json({ emails: rows });
      }
      case "outreach.cancel":
        return Response.json({ cancelled: await cancelComposed(db, (b.ids ?? []) as string[]) });
      case "reply.classify":
        return Response.json({ reply: await classifyReply(db, user, str("id"), str("type") as ReplyType) });
      case "variant.save":
        return Response.json({ variant: await saveVariant(db, b) });
      case "variant.retire": {
        await db.update("variants", { id: str("id") }, { status: b.retired === false ? "active" : "retired" });
        return Response.json({ ok: true });
      }
      case "test.start":
        await db.update("tests", { id: str("id") }, { started_at: new Date().toISOString() });
        return Response.json({ ok: true });
      case "test.decide": {
        const winner = str("winner");
        if (!["a", "b", "none"].includes(winner)) throw new ActionError(400, "Unknown result");
        await db.update("tests", { id: str("id") }, { winner: winner as "a" | "b" | "none", result: str("result") || null, decided_at: new Date().toISOString() });
        return Response.json({ ok: true });
      }
      case "enquiry.handle":
        await db.update("enquiries", { id: str("id") }, { handled_at: new Date().toISOString(), handled_by: user.personId });
        return Response.json({ ok: true });
      case "mailbox.disconnect": {
        const m = await findMailbox(db, user, str("id"));
        await db.update("mailboxes", { id: m.id }, { refresh_token_enc: null, status: "needs_reconnect" });
        return Response.json({ ok: true });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
