/**
 * Create a one-time passkey enrolment invite for an allowlisted person. Run by hand, never in CI:
 *
 *   npx tsx --env-file=.env.local scripts/phase1/invite.ts <email>
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PHASE1_ALLOWED_EMAILS and
 * NEXT_PUBLIC_SITE_URL in the environment. Prints the link once; only its sha256 is stored.
 */
import { createClient } from "@supabase/supabase-js";
import { createInvite, type InviteStore } from "../../lib/phase1/invite";
import { parseAllowlist } from "../../lib/phase1/allowlist";

async function main() {
  const email = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (process.env.CI) throw new Error("Refusing to run in CI");
  if (!email) throw new Error("Usage: invite.ts <email>");
  if (!url || !key || !site) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL");
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const store: InviteStore = {
    async insert(row) {
      const { error } = await db.from("passkey_invites").insert(row);
      if (error) throw new Error(`Database error: ${error.message}`);
    },
    async find() {
      throw new Error("unused");
    },
    async claim() {
      throw new Error("unused");
    },
    async release() {
      throw new Error("unused");
    },
  };
  const token = await createInvite(store, email, parseAllowlist(process.env.PHASE1_ALLOWED_EMAILS));
  console.log(`Invite for ${email.trim().toLowerCase()} (valid 7 days, works once):`);
  console.log(`${site}/phase1/enrol?token=${token}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
