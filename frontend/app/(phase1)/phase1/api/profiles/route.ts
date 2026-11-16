import { revalidatePath, revalidateTag } from "next/cache";
import { errorResponse, createServiceClient, requireUser } from "@/lib/phase1/supabase";
import { isTestMode } from "@/lib/phase1/allowlist";
import { parseProfileInput } from "@/lib/site/profiles";

export const dynamic = "force-dynamic";

/** Save one founder profile. Signed-in allowlisted users only (middleware and requireUser). */
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    if (isTestMode()) return Response.json({ error: "Profiles need Supabase" }, { status: 503 });
    const input = parseProfileInput(await request.json().catch(() => null));
    if (!input) return Response.json({ error: "Check the fields and try again" }, { status: 400 });
    const { error } = await createServiceClient()
      .from("site_profiles")
      .upsert({ slug: input.slug, ...input.values, updated_at: new Date().toISOString(), updated_by: user.email }, { onConflict: "slug" });
    if (error) {
      console.error("site_profiles save:", error.message);
      return Response.json({ error: "Could not save. Has the migration been applied?" }, { status: 500 });
    }
    revalidateTag("site-profiles");
    revalidatePath("/");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
