/**
 * Load a programme JSON file (tracks, phases, prospects, messages, reply playbook, review log) into the database.
 * Idempotent: running it again updates descriptions but never resets sent or replied statuses, never duplicates
 * a business (unique by ext id, normalised email and domain), and never rewrites a message that was sent.
 * Pure over Phase1Db, so it runs on the in-memory store in tests. Optional keys may be missing.
 */
import { normDomain, normEmail, slug } from "./programme";
import type { Phase1Db } from "./supabase";
import type { Insert, Row } from "./types";

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const list = (v: unknown): J[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map((x) => x as J) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const int = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : d);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === "string" ? v.split(/[;,|\n]/).map((x) => x.trim()).filter(Boolean) : []);
const first = (o: J, ...keys: string[]): unknown => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== "");

function variantsMap(v: unknown): Record<string, unknown> | null {
  if (Array.isArray(v)) {
    const m: Record<string, unknown> = {};
    v.forEach((x, i) => {
      const o = obj(x);
      m[str(first(o, "id", "key", "variant", "name")) ?? String.fromCharCode(65 + i)] = typeof x === "string" ? x : (o.text ?? o.description ?? o);
    });
    return m;
  }
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

const areaKind = (v: unknown): "local" | "non_local" | null => {
  const s = (str(v) ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return s === "local" ? "local" : s === "non_local" || s === "nonlocal" ? "non_local" : null;
};
const STEPS = ["first", "followup1", "followup2"] as const;
const stepOf = (v: unknown): (typeof STEPS)[number] | null => {
  const s = (str(v) ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "first" || s === "1" || s === "first_touch" || s === "firsttouch") return "first";
  if (s === "followup1" || s === "followup" || s === "2") return "followup1";
  if (s === "followup2" || s === "3") return "followup2";
  return null;
};

export interface LoadReport {
  tracks: number; phases: number;
  prospects: { added: number; updated: number; duplicates: { ext_id: string; of: string }[]; skipped: string[] };
  messages: { added: number; updated: number; keptSent: number; skipped: number };
  playbook: number; reviews: number; meta: string[]; request?: { id: string; result_count: number };
}

export interface LoadOptions { requestId?: string }

export async function loadProgramme(db: Phase1Db, json: unknown, opts: LoadOptions = {}): Promise<LoadReport> {
  const root = obj(json);
  const report: LoadReport = {
    tracks: 0, phases: 0, prospects: { added: 0, updated: 0, duplicates: [], skipped: [] },
    messages: { added: 0, updated: 0, keptSent: 0, skipped: 0 }, playbook: 0, reviews: 0, meta: [],
  };

  // ---- meta (everything the dashboard may show that is not its own table)
  for (const k of ["version", "written", "senders", "statuses", "metrics", "dashboard_notes"]) {
    if (root[k] === undefined) continue;
    const found = (await db.select("programme_meta", { eq: { key: k } }))[0];
    if (found) await db.update("programme_meta", { key: k }, { value: root[k], updated_at: new Date().toISOString() });
    else await db.insert("programme_meta", { key: k, value: root[k] });
    report.meta.push(k);
  }
  const senders = root.senders;
  const senderFor = (key: string, name: string | null): string | null => {
    const entries: [string, J][] = Array.isArray(senders) ? senders.map((s, i) => [str(obj(s).key ?? obj(s).name) ?? String(i), obj(s)]) : Object.entries(obj(senders)).map(([k, v]) => [k, obj(v)]);
    for (const [k, v] of entries) {
      const tracks = strList(v.tracks ?? v.track).map(slug);
      if (tracks.includes(slug(key)) || (name && tracks.includes(slug(name)))) return str(v.name) ?? k;
    }
    return null;
  };

  // ---- tracks
  const trackKeys = new Map<string, string>(); // slug of key or name -> canonical key
  const existingTracks = await db.select("tracks");
  for (const [i, t] of list(root.tracks).entries()) {
    const name = str(first(t, "name", "title", "label")) ?? str(first(t, "key", "id", "track_id", "track")) ?? `Track ${i + 1}`;
    const key = slug(str(first(t, "key", "id", "track_id", "track")) ?? name);
    trackKeys.set(key, key);
    trackKeys.set(slug(name), key);
    const row: Insert<"tracks"> = { key, name, sender: str(first(t, "sender", "owner", "send_as")) ?? senderFor(key, name), description: str(first(t, "description", "about", "summary")), sort_order: int(t.order, i) };
    if (existingTracks.some((x) => x.key === key)) await db.update("tracks", { key }, row);
    else await db.insert("tracks", row);
    report.tracks++;
  }
  const trackOf = (v: unknown): string => {
    const s = slug(str(v));
    return trackKeys.get(s) ?? s;
  };

  // ---- phases (never touch status/winner/result of one already in progress)
  const existingPhases = await db.select("phases");
  for (const p of list(root.phases)) {
    const phase_id = str(first(p, "phase_id", "id"));
    if (!phase_id) continue;
    const base: Insert<"phases"> = {
      phase_id, track_key: trackOf(p.track), ord: int(first(p, "order", "ord")), variable: str(p.variable), hypothesis: str(p.hypothesis),
      variants: variantsMap(p.variants), send_days: strList(p.send_days), followup_days: strList(p.followup_days),
      judge_on: str(p.judge_on), winner_rule: str(p.winner_rule), min_sample: int(p.min_sample),
      on_a_wins: str(p.on_A_wins ?? p.on_a_wins), on_b_wins: str(p.on_B_wins ?? p.on_b_wins), on_c_wins: str(p.on_C_wins ?? p.on_c_wins), on_no_signal: str(p.on_no_signal),
    };
    const found = existingPhases.find((x) => x.phase_id === phase_id);
    if (found) await db.update("phases", { phase_id }, base);
    else {
      const st = str(p.status);
      await db.insert("phases", { ...base, status: st === "active" || st === "judged" ? st : "planned" });
    }
    report.phases++;
  }

  // ---- prospects (core row for sending and replies, programme row for the phase detail)
  const progs = await db.select("programme_prospects");
  const cores = await db.select("prospects");
  const byExt = new Map(progs.map((p) => [p.ext_id, p]));
  const byEmail = new Map(progs.filter((p) => p.email_norm).map((p) => [p.email_norm!, p]));
  const byDomain = new Map(progs.filter((p) => p.domain_norm).map((p) => [p.domain_norm!, p]));
  for (const p of list(root.prospects)) {
    const ext = str(first(p, "id", "ext_id"));
    const company = str(first(p, "company", "name"));
    if (!ext || !company) {
      report.prospects.skipped.push(ext ?? "(no id)");
      continue;
    }
    const email = str(p.email);
    const emailN = normEmail(email);
    const domainN = normDomain(str(p.website), email);
    const existing = byExt.get(ext);
    if (!existing) {
      const dup = (emailN && byEmail.get(emailN)) || (domainN && byDomain.get(domainN)) || null;
      if (dup) {
        report.prospects.duplicates.push({ ext_id: ext, of: dup.ext_id });
        continue;
      }
    }
    const contact = str(first(p, "contact_name", "contact"));
    const detail = {
      track_key: trackOf(p.track), phase_id: str(p.phase_id), variant: str(p.variant), segment: str(p.segment), area_kind: areaKind(p.area), company,
      contact_name: contact, email, website: str(p.website), what_they_do: str(p.what_they_do), hook: str(p.hook), source: str(p.source), send_slot: str(p.send_slot),
      email_norm: emailN, domain_norm: domainN,
    };
    if (existing) {
      // Never reset status or request_id.
      await db.update("programme_prospects", { ext_id: ext }, detail);
      if (existing.prospect_id) {
        await db.update("prospects", { id: existing.prospect_id }, { name: company, website: detail.website, public_email: email, first_name: contact?.split(/\s+/)[0] ?? null, why_fit: detail.what_they_do, opener_specific: detail.hook, vertical: detail.segment });
      }
      report.prospects.updated++;
      continue;
    }
    // A core row already on this email (an earlier hand-made prospect) is reused, not duplicated.
    let core: Row<"prospects"> | undefined = emailN ? cores.find((c) => normEmail(c.public_email) === emailN) : undefined;
    if (!core) {
      const ct = str(p.company_type);
      [core] = await db.insert("prospects", {
        name: company, vertical: detail.segment, website: detail.website, public_email: email, email_found: !!email, channel: "email",
        company_type: ct === "ltd" || ct === "llp" || ct === "sole_trader" || ct === "partnership" ? ct : "unknown",
        first_name: contact?.split(/\s+/)[0] ?? null, why_fit: detail.what_they_do, opener_specific: detail.hook, source_doc: "notes",
      });
      cores.push(core!);
    }
    const status = str(p.status) ?? (opts.requestId ? "new" : "ready");
    const [made] = await db.insert("programme_prospects", { ext_id: ext, prospect_id: core?.id ?? null, status, request_id: opts.requestId ?? null, ...detail });
    byExt.set(ext, made!);
    if (emailN) byEmail.set(emailN, made!);
    if (domainN) byDomain.set(domainN, made!);
    report.prospects.added++;
  }

  // ---- messages
  const msgs = await db.select("programme_messages");
  const mkey = (e: string, s: string) => `${e}|${s}`;
  const mByKey = new Map(msgs.map((m) => [mkey(m.prospect_ext_id, m.step), m]));
  for (const m of list(root.messages)) {
    const ext = str(first(m, "prospect_id", "prospect_ext_id"));
    const step = stepOf(m.step);
    if (!ext || !step || !byExt.has(ext)) {
      report.messages.skipped++;
      continue;
    }
    const row = { subject: str(m.subject), body: str(m.body), send_on: str(m.send_on), template: m.template === true };
    const found = mByKey.get(mkey(ext, step));
    if (!found) {
      const [made] = await db.insert("programme_messages", { prospect_ext_id: ext, step, status: "pending", ...row });
      mByKey.set(mkey(ext, step), made!);
      report.messages.added++;
    } else if (found.status === "pending") {
      await db.update("programme_messages", { id: found.id }, row);
      report.messages.updated++;
    } else report.messages.keptSent++;
  }

  // ---- reply playbook
  const pb = await db.select("reply_playbook");
  for (const r of list(root.reply_playbook)) {
    const category = str(r.category);
    if (!category) continue;
    const track_key = str(r.track) && slug(str(r.track)) !== "all" ? trackOf(r.track) : "all";
    const row: Insert<"reply_playbook"> = {
      category, track_key, detect_cues: strList(r.detect_cues), reply_subject: str(r.reply_subject), reply_body: str(r.reply_body),
      next_status: str(r.next_status), retouch: r.retouch === true || (typeof r.retouch === "string" && r.retouch.trim() !== "" && !/^(no|false)$/i.test(r.retouch)),
    };
    const found = pb.find((x) => x.category === category && x.track_key === track_key);
    if (found) await db.update("reply_playbook", { id: found.id }, row);
    else await db.insert("reply_playbook", row);
    report.playbook++;
  }

  // ---- review log (matched on date, track and learnings so a re-run adds nothing)
  const logs = await db.select("review_log");
  for (const r of list(root.review_log)) {
    const reviewed_on = str(first(r, "date", "reviewed_on"));
    if (!reviewed_on) continue;
    const track_key = str(r.track) ? trackOf(r.track) : null;
    const learnings = str(r.learnings);
    if (logs.some((l) => l.reviewed_on === reviewed_on && l.track_key === track_key && l.learnings === learnings)) continue;
    await db.insert("review_log", { reviewed_on, track_key, sends: typeof r.sends === "number" ? r.sends : null, replies_by_variant: (r.replies_by_variant ?? null) as never, learnings, decision: str(r.decision), created_by: "loader" });
    report.reviews++;
  }

  // ---- lead request bookkeeping
  if (opts.requestId) {
    const result_count = report.prospects.added;
    await db.update("lead_requests", { id: opts.requestId }, { status: "done", done_at: new Date().toISOString(), result_count });
    report.request = { id: opts.requestId, result_count };
  }
  return report;
}
