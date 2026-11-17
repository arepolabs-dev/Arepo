import { ActionError, } from "@/lib/phase1/actions";
import { addReview } from "@/lib/phase1/programme-actions";
import { Phase1Error, errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";

export const dynamic = "force-dynamic";

/** Add one review record. Only a signed-in allowlisted person (the same session as the rest of /phase1) may write one. */
export async function POST(request: Request) {
  try {
    const by = (await requireUser()).email;
    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) throw new ActionError(400, "Send a JSON body");
    return Response.json(await addReview(getDb(), by, b));
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof Phase1Error) return errorResponse(e);
    return errorResponse(e);
  }
}
