import data from "@/content/phase1/programme-data.json";
import { cronAuthorised } from "@/lib/phase1/cron-auth";
import { loadProgramme } from "@/lib/phase1/programme-load";
import { getDb } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Loads the bundled programme (prospects, phases, messages) into the database. Idempotent; secret-protected. */
export async function POST(request: Request) {
  if (!(await cronAuthorised(request))) return Response.json({ error: "Not allowed" }, { status: 401 });
  try {
    const report = await loadProgramme(getDb(), data);
    return Response.json({ ok: true, report });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 300) : "Load failed" }, { status: 500 });
  }
}
