/**
 * Load a programme JSON file into the /phase1 database. Run by hand, never in CI:
 *
 *   npx tsx --env-file=.env.local scripts/phase1/load-programme.ts <file.json> [--request <lead_request_id>]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Migration 0004 must be applied first.
 * Safe to run again: it never resets a sent or replied status, never adds the same business twice (matched on id,
 * normalised email and domain) and never rewrites a message that has been sent.
 * With --request <id> the new prospects get status "new" (awaiting approval on the Today page) and that lead
 * request is marked done with the number of leads added.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadProgramme } from "../../lib/phase1/programme-load";
import type { Phase1Db } from "../../lib/phase1/supabase";

type AnyRow = Record<string, unknown>;

function dbFrom(url: string, key: string): Phase1Db {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(`Database error: ${e.message}`);
  };
  return {
    async select(table, q) {
      let query = c.from(table).select("*");
      for (const [k, v] of Object.entries((q?.eq ?? {}) as AnyRow)) query = query.eq(k, v as never);
      const { data, error } = await query;
      fail(error);
      return (data ?? []) as never;
    },
    async insert(table, rows) {
      const { data, error } = await c.from(table).insert(rows as never).select();
      fail(error);
      return (data ?? []) as never;
    },
    async update(table, match, patch) {
      let query = c.from(table).update(patch as never);
      for (const [k, v] of Object.entries(match as AnyRow)) query = query.eq(k, v as never);
      const { data, error } = await query.select();
      fail(error);
      return (data ?? []) as never;
    },
    async upsert(table, rows, onConflict) {
      const { data, error } = await c.from(table).upsert(rows as never, { onConflict }).select();
      fail(error);
      return (data ?? []) as never;
    },
    async remove(table, match) {
      let query = c.from(table).delete();
      for (const [k, v] of Object.entries(match as AnyRow)) query = query.eq(k, v as never);
      const { data, error } = await query.select();
      fail(error);
      return (data ?? []).length;
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--request");
  const ri = args.indexOf("--request");
  const requestId = ri >= 0 ? args[ri + 1] : undefined;
  if (process.env.CI) throw new Error("Refusing to run in CI");
  if (!file || (ri >= 0 && !requestId)) throw new Error("Usage: load-programme.ts <file.json> [--request <id>]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const json = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const report = await loadProgramme(dbFrom(url, key), json, { requestId });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
