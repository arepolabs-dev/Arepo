import { errorResponse, requireUser } from "@/lib/phase1/supabase";
import { loadState } from "@/lib/phase1/state";

export const dynamic = "force-dynamic";

/** Everything the dashboard shows, in one read. Signed-in allowlisted users only. */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await loadState(user), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
