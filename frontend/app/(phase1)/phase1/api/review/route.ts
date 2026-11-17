import { timingSafeEqual } from "node:crypto";
import { ActionError, } from "@/lib/phase1/actions";
import { addReview } from "@/lib/phase1/programme-actions";
import { Phase1Error, errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

function tokenOk(request: Request): boolean {
  const want = process.env.PHASE1_REVIEW_TOKEN?.trim();
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!want || want.length < 24 || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Add one review record. A signed-in allowlisted person (the same session as the rest of /phase1) may write one;
 * TENET can also write with `Authorization: Bearer $PHASE1_REVIEW_TOKEN` if that variable is set (it only ever
 * writes a review_log row).
 */
export async function POST(request: Request) {
  try {
    let by: string;
    if (tokenOk(request)) by = "TENET";
    else by = (await requireUser()).email;
    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) throw new ActionError(400, "Send a JSON body");
    return Response.json(await addReview(getDb(), by, b));
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof Phase1Error) return errorResponse(e);
    return errorResponse(e);
  }
}
