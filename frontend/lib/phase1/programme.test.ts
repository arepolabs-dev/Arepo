import { describe, expect, it } from "vitest";
import {
  classifyAgainstPlaybook, computePhaseResult, fillReply, normDomain, normEmail, prospectFacts, selectBatch, tally, tracksForUser,
} from "./programme";
import type { Phase, ProgrammeMessage, ProgrammeProspect, ReplyPlaybook, Track } from "./types";

const NOW = new Date("2026-11-18T10:00:00Z");
const base = { id: "x", created_at: "2026-11-01T00:00:00Z" };

const phase = (o: Partial<Phase> = {}): Phase => ({
  ...base, phase_id: "S1", track_key: "startups", ord: 1, variable: "Subject", hypothesis: null, variants: { A: "a", B: "b" }, send_days: [], followup_days: [],
  judge_on: "2026-11-25", winner_rule: "Most replies per send", min_sample: 2, on_a_wins: "keep A", on_b_wins: "use B", on_c_wins: null, on_no_signal: "keep both",
  status: "active", winner: null, judged_at: null, result: null, ...o,
}) as Phase;
const pp = (ext: string, o: Partial<ProgrammeProspect> = {}): ProgrammeProspect => ({
  ...base, id: ext, ext_id: ext, prospect_id: `core-${ext}`, track_key: "startups", phase_id: "S1", variant: "A", segment: "fin", area_kind: null, company: ext, contact_name: "Sam Lee",
  email: `${ext}@${ext}.io`, website: null, what_they_do: null, hook: "your launch", source: null, send_slot: null, status: "ready", request_id: null, email_norm: null, domain_norm: null, ...o,
}) as ProgrammeProspect;
const msg = (ext: string, step: ProgrammeMessage["step"], send_on: string, o: Partial<ProgrammeMessage> = {}): ProgrammeMessage => ({
  ...base, id: `${ext}-${step}`, prospect_ext_id: ext, step, subject: "Hi", body: "Hello {{first_name}}", send_on, template: false, status: "pending", outreach_email_id: null, sent_at: null, ...o,
}) as ProgrammeMessage;
const core = (ext: string, status = "prospect") => ({ ...base, id: `core-${ext}`, status }) as never;

describe("normalisers", () => {
  it("normalises email and domain; free mail has no domain", () => {
    expect(normEmail(" Sam@AcmeApps.IO ")).toBe("sam@acmeapps.io");
    expect(normEmail("nope")).toBeNull();
    expect(normDomain("https://www.Acme.io/about")).toBe("acme.io");
    expect(normDomain(null, "x@gmail.com")).toBeNull();
    expect(normDomain(null, "x@acme.io")).toBe("acme.io");
  });
});

describe("selectBatch", () => {
  const run = (prospects: ProgrammeProspect[], messages: ProgrammeMessage[], phases = [phase()], cores = prospects.map((p) => core(p.ext_id))) =>
    selectBatch({ messages, prospects, phases, core: cores, now: NOW, trackKeys: ["startups"] });

  it("includes first touches due today and overdue ones, not future ones", () => {
    const out = run([pp("a"), pp("b"), pp("c")], [msg("a", "first", "2026-11-18"), msg("b", "first", "2026-11-16"), msg("c", "first", "2026-11-19")]);
    expect(out.map((i) => i.prospect.ext_id)).toEqual(["b", "a"]);
    expect(out[0]!.overdue).toBe(true);
  });
  it("skips replied, opted-out, bounced and not-yet-approved prospects", () => {
    const ps = ["r", "o", "b", "n", "ok"].map((e) => pp(e));
    ps[0] = pp("r", { status: "replied" });
    ps[1] = pp("o", { status: "do_not_contact" });
    ps[2] = pp("b", { status: "bounced" });
    ps[3] = pp("n", { status: "new" });
    const out = run(ps, ps.map((p) => msg(p.ext_id, "first", "2026-11-18")));
    expect(out.map((i) => i.prospect.ext_id)).toEqual(["ok"]);
  });
  it("skips a prospect whose core status says replied or do not contact", () => {
    const ps = [pp("a"), pp("b")];
    const out = run(ps, ps.map((p) => msg(p.ext_id, "first", "2026-11-18")), [phase()], [core("a", "replied"), core("b", "do_not_contact")]);
    expect(out).toHaveLength(0);
  });
  it("sends a follow-up only after the first was sent, and not to someone who replied", () => {
    const ps = [pp("a"), pp("b"), pp("c", { status: "replied" })];
    const messages = [
      msg("a", "first", "2026-11-12", { status: "sent" }), msg("a", "followup1", "2026-11-18"),
      msg("b", "first", "2026-11-12"), msg("b", "followup1", "2026-11-18"),
      msg("c", "first", "2026-11-12", { status: "sent" }), msg("c", "followup1", "2026-11-18"),
    ];
    const out = run(ps, messages);
    expect(out.map((i) => `${i.prospect.ext_id}:${i.step}`).sort()).toEqual(["a:followup1", "b:first"]);
  });
  it("ignores planned phases, bad emails and other tracks", () => {
    const out = run(
      [pp("a", { phase_id: "S2" }), pp("b", { email: "bad" }), pp("c", { track_key: "local" }), pp("d")],
      ["a", "b", "c", "d"].map((e) => msg(e, "first", "2026-11-18")),
      [phase(), phase({ phase_id: "S2", status: "planned" })],
    );
    expect(out.map((i) => i.prospect.ext_id)).toEqual(["d"]);
  });
  it("fills template messages with the previous phase winner and flags unfilled slots", () => {
    const phases = [phase({ phase_id: "S1", status: "judged", winner: "B", variable: "Subject" }), phase({ phase_id: "S2", ord: 2, status: "active", variants: { A: "x" } })];
    const out = run([pp("a", { phase_id: "S2" })], [msg("a", "first", "2026-11-18", { template: true, subject: "{{winner}}", body: "Hi {{first_name}} re {{hook}} {{missing}}" })], phases);
    expect(out[0]!.subject).toBe("b");
    expect(out[0]!.body).toContain("Hi Sam re your launch");
    expect(out[0]!.unresolved).toContain("{{missing}}");
  });
  it("tracksForUser matches the track's sender", () => {
    const tracks = [{ key: "startups", sender: "Dayyan" }, { key: "local", sender: "Jack" }] as Track[];
    expect(tracksForUser(tracks, { email: "dayyan.sheikh@arepolabs.com", name: "Dayyan Sheikh" })).toEqual(["startups"]);
  });
});

describe("reply classification", () => {
  const pb = (category: string, cues: string[], o: Partial<ReplyPlaybook> = {}): ReplyPlaybook => ({ ...base, category, track_key: "all", detect_cues: cues, reply_subject: null, reply_body: "Hi {{first_name}} at {{company}}, {{sender_first_name}}", next_status: null, retouch: false, ...o }) as ReplyPlaybook;
  const book = [pb("interested", ["sounds good", "tell me more"]), pb("opt_out", ["unsubscribe", "stop emailing"], { next_status: "do_not_contact" }), pb("not_now", ["maybe later"])];
  it("matches cues, case-insensitively", () => {
    expect(classifyAgainstPlaybook("Sounds good, TELL ME MORE", book, null)?.category).toBe("interested");
    expect(classifyAgainstPlaybook("please stop emailing me", book, null)?.category).toBe("opt_out");
    expect(classifyAgainstPlaybook("hello there", book, null)).toBeNull();
  });
  it("prefers a track-specific entry on a tie", () => {
    const b = [...book, pb("interested", ["sounds good"], { track_key: "startups", reply_body: "specific" })];
    expect(classifyAgainstPlaybook("sounds good", b, "startups")?.entry.reply_body).toBe("specific");
  });
  it("fills the prepared reply", () => {
    const r = fillReply(book[0]!, { firstName: "Sam", company: "Acme", senderFirstName: "Dayyan", subject: "Re: hi" });
    expect(r.body).toBe("Hi Sam at Acme, Dayyan");
    expect(r.subject).toBe("Re: hi");
    expect(r.unresolved).toEqual([]);
  });
});

describe("winner computation", () => {
  const people = (a: [number, number], b: [number, number]) => {
    const rows: ProgrammeProspect[] = [];
    for (let i = 0; i < a[0]; i++) rows.push(pp(`a${i}`, { variant: "A", status: i < a[1] ? "replied" : "contacted" }));
    for (let i = 0; i < b[0]; i++) rows.push(pp(`b${i}`, { variant: "B", status: i < b[1] ? "replied" : "contacted" }));
    const msgs = rows.map((r) => msg(r.ext_id, "first", "2026-11-10", { status: "sent" }));
    return prospectFacts(rows, msgs, rows.map((r) => core(r.ext_id, r.status)), []);
  };
  it("waits before the judge day but reports who is ahead", () => {
    const r = computePhaseResult(phase(), people([4, 1], [4, 3]), new Date("2026-11-20T10:00:00Z"));
    expect(r.state).toBe("waiting");
    expect(r.winner).toBe("B");
  });
  it("picks the winner on the judge day and gives the next step", () => {
    const r = computePhaseResult(phase(), people([4, 1], [4, 3]), new Date("2026-11-25T10:00:00Z"));
    expect(r).toMatchObject({ state: "result", winner: "B", due: true, next: "use B" });
  });
  it("calls a tie no signal", () => {
    const r = computePhaseResult(phase(), people([4, 2], [4, 2]), new Date("2026-11-26T10:00:00Z"));
    expect(r).toMatchObject({ winner: "none", next: "keep both" });
  });
  it("treats too small a sample as no signal", () => {
    const r = computePhaseResult(phase({ min_sample: 5 }), people([4, 3], [4, 0]), new Date("2026-11-26T10:00:00Z"));
    expect(r.state).toBe("insufficient");
    expect(r.winner).toBe("none");
  });
  it("uses calls booked when the rule says so", () => {
    const rows = [pp("a0", { variant: "A", status: "replied" }), pp("a1", { variant: "A" }), pp("b0", { variant: "B", status: "call_booked" }), pp("b1", { variant: "B" })];
    const facts = prospectFacts(rows, rows.map((r) => msg(r.ext_id, "first", "2026-11-10", { status: "sent" })), rows.map((r) => core(r.ext_id, r.status)), []);
    expect(computePhaseResult(phase({ winner_rule: "Most calls booked", min_sample: 2 }), facts, new Date("2026-11-26T10:00:00Z")).winner).toBe("B");
  });
  it("tallies by variant", () => {
    const t = tally(people([4, 1], [4, 3]), "variant");
    expect(t.find((x) => x.key === "B")).toMatchObject({ sent: 4, replied: 3 });
  });
});
