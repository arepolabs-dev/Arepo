/** Shared-secret check for the machine routes (cron send, admin load/invite). The secret is a Vercel env var, never in the repo. */
import { timingSafeEqual } from "node:crypto";

export function cronAuthorised(request: Request): boolean {
  const secret = process.env.PHASE1_CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-phase1-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
