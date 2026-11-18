import { cronAuthorised } from "@/lib/phase1/cron-auth";
import { makeGmailTransport, sendDue } from "@/lib/phase1/server-send";
import { getDb } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every minute by Supabase pg_cron (pg_net). Sends at most 1 due email per sender per run. */
export async function POST(request: Request) {
  if (!(await cronAuthorised(request))) return Response.json({ error: "Not allowed" }, { status: 401 });
  try {
    const db = getDb();
    const r = await sendDue(db, makeGmailTransport(db));
    const line = `phase1 cron: due=${r.due} sent=${r.results.filter((x) => x.outcome === "sent").length} failed=${r.results.filter((x) => x.outcome === "failed").length} waiting=${r.results.filter((x) => x.outcome === "waiting").length}`;
    console.log(line);
    return Response.json({ ok: true, due: r.due, results: r.results.map((x) => ({ id: x.id, outcome: x.outcome, detail: x.detail })) });
  } catch (e) {
    console.error("phase1 cron failed", e instanceof Error ? e.message : e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
export const GET = POST;
