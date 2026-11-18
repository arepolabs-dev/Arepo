import { allowedEmails } from "@/lib/phase1/allowlist";
import { cronAuthorised } from "@/lib/phase1/cron-auth";
import { createInvite } from "@/lib/phase1/invite";
import { inviteStore } from "@/lib/phase1/passkey-store";

export const dynamic = "force-dynamic";

/** Mints a one-time passkey invite link for an allowed email. Secret-protected; the link is returned once, never stored. */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return Response.json({ error: "Not allowed" }, { status: 401 });
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  try {
    const token = await createInvite(inviteStore(), String(email ?? ""), allowedEmails());
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    return Response.json({ ok: true, link: `${site}/phase1/enrol?token=${token}` });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Failed" }, { status: 400 });
  }
}
