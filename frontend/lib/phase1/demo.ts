/**
 * Demo data for PHASE1_TEST_MODE (the in-memory store): the same 107 prospects, variants, tests and plan
 * targets as supabase/phase1/seed_0001.sql, loaded from the JSON copies next to the CSV.
 */
import prospectsJson from "@/content/phase1/seed/prospects.json";
import seedJson from "@/content/phase1/seed/variants.json";
import { isTestMode } from "./allowlist";
import type { Phase1Db } from "./supabase";
import type { Insert } from "./types";

type Raw = Record<string, string>;

let seeded = false;

export async function ensureDemo(db: Phase1Db): Promise<void> {
  if (!isTestMode() || seeded) return;
  if ((await db.select("prospects", { limit: 1 })).length) {
    seeded = true;
    return;
  }
  seeded = true;
  const people = await db.select("people");
  const idOf = (name: string) => people.find((p) => (p.email ?? "").startsWith(name))?.id ?? null;
  const owners: Record<string, string | null> = { dayyan: idOf("dayyan"), jack: idOf("jack") };
  await db.insert(
    "prospects",
    (prospectsJson as Raw[]).map(
      (r): Insert<"prospects"> => ({
        name: r.name,
        vertical: r.vertical || null,
        trade_or_type: r.trade_or_type || null,
        tier: (r.tier || null) as never,
        area: (r.area || null) as never,
        postcode: r.postcode || null,
        website: r.website || null,
        maps_url: r.maps_url || null,
        public_email: r.public_email || null,
        phone_public: r.phone_public || null,
        source_doc: (r.source_doc || null) as never,
        owner_id: owners[r.owner] ?? null,
        channel: (r.channel || null) as never,
        company_type: (r.company_type || "unknown") as never,
        email_found: r.email_found === "true",
        first_name: r.first_name || null,
        opener_general: r.opener_general || null,
        opener_specific: r.opener_specific || null,
        subject_hint: r.subject_hint || null,
        why_fit: r.why_fit || null,
        suggested_angle: r.suggested_angle || null,
      }),
    ),
  );
  const variants = await db.insert("variants", seedJson.variants as never);
  const find = (kind: string, code: string) => variants.find((v) => v.kind === kind && v.code === code)?.id ?? null;
  await db.insert(
    "tests",
    seedJson.tests.map((t) => ({
      name: t.name,
      variable: t.variable as never,
      variant_a_id: find(t.a[0]!, t.a[1]!),
      variant_b_id: find(t.b[0]!, t.b[1]!),
      batch_size: t.batch_size,
      decision_rule: t.decision_rule,
    })),
  );
  await db.insert("plan_targets", seedJson.plan_targets as never);
}
