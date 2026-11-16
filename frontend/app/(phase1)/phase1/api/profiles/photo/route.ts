import { errorResponse, createServiceClient, requireUser } from "@/lib/phase1/supabase";
import { isTestMode } from "@/lib/phase1/allowlist";
import { PROFILE_SLUGS, type ProfileSlug } from "@/lib/site/profiles";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;

/** Upload a founder photo to the public team-photos bucket and return its URL. */
export async function POST(request: Request) {
  try {
    await requireUser();
    if (isTestMode()) return Response.json({ error: "Photos need Supabase" }, { status: 503 });
    const form = await request.formData().catch(() => null);
    const slug = form?.get("slug");
    const file = form?.get("file");
    if (!PROFILE_SLUGS.includes(slug as ProfileSlug) || !(file instanceof File)) {
      return Response.json({ error: "Choose a photo first" }, { status: 400 });
    }
    const ext = TYPES[file.type];
    if (!ext) return Response.json({ error: "Use a JPG, PNG or WebP image" }, { status: 400 });
    if (file.size > MAX) return Response.json({ error: "The photo is over 5 MB" }, { status: 400 });
    // A fresh name each time so browsers and the CDN never show the old photo.
    const path = `${slug}-${Date.now()}.${ext}`;
    const sb = createServiceClient();
    const { error } = await sb.storage.from("team-photos").upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (error) {
      console.error("team-photos upload:", error.message);
      return Response.json({ error: "Upload failed. Has the migration been applied?" }, { status: 500 });
    }
    return Response.json({ url: sb.storage.from("team-photos").getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
