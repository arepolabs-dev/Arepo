/**
 * Shared-secret check for the machine routes (cron send, admin load/invite). The secret lives only in the database
 * vault (phase1_cron_secret) and in the pg_cron job that reads it; the route asks the database whether the bearer
 * matches (rpc phase1_cron_ok), so the secret is never in the repo, a log or a chat. PHASE1_CRON_SECRET (env) also works if set.
 */
import { timingSafeEqual } from "node:crypto";

export async function cronAuthorised(request: Request): Promise<boolean> {
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? request.headers.get("x-phase1-secret") ?? "";
  if (given.length < 24) return false;
  const env = process.env.PHASE1_CRON_SECRET;
  if (env && env.length >= 24) {
    const a = Buffer.from(given), b = Buffer.from(env);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/phase1_cron_ok`, {
      method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ s: given }), cache: "no-store",
    });
    return res.ok && (await res.json()) === true;
  } catch {
    return false;
  }
}
