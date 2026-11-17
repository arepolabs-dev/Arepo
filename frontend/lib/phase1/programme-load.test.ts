import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
import fixture from "./__fixtures__/programme.json";
import { loadProgramme } from "./programme-load";
import { getDb, resetTestStore } from "./supabase";

process.env.PHASE1_TEST_MODE = "1";
process.env.PHASE1_ALLOWED_EMAILS = "a@example.com";

describe("loadProgramme", () => {
  beforeEach(() => resetTestStore());

  it("loads tracks, phases, prospects, messages, playbook and reviews", async () => {
    const db = getDb();
    const r = await loadProgramme(db, fixture);
    expect(r.tracks).toBe(2);
    expect(r.phases).toBe(2);
    expect(r.prospects.added).toBe(3);
    expect(r.messages).toMatchObject({ added: 4, skipped: 1 });
    expect(r.playbook).toBe(3);
    expect(r.reviews).toBe(1);
    expect((await db.select("programme_prospects"))[0]!.status).toBe("ready");
    expect((await db.select("prospects"))).toHaveLength(3);
    const p1 = (await db.select("programme_prospects", { eq: { ext_id: "P1" } }))[0]!;
    expect(p1.email_norm).toBe("sam@acmeapps.io");
    expect(p1.domain_norm).toBe("acmeapps.io");
    const s2 = (await db.select("phases", { eq: { phase_id: "S2" } }))[0]!;
    expect(s2.variants).toEqual({ A: "Book a call", B: "Reply with a time" });
    expect(s2.status).toBe("planned");
  });

  it("is idempotent and never resets a sent or replied status", async () => {
    const db = getDb();
    await loadProgramme(db, fixture);
    await db.update("programme_prospects", { ext_id: "P1" }, { status: "replied" });
    const msg = (await db.select("programme_messages", { eq: { prospect_ext_id: "P1", step: "first" } }))[0]!;
    await db.update("programme_messages", { id: msg.id }, { status: "sent", body: "as sent" });
    await db.update("phases", { phase_id: "S1" }, { status: "active" });
    const again = await loadProgramme(db, fixture);
    expect(again.prospects).toMatchObject({ added: 0, updated: 3 });
    expect(again.messages).toMatchObject({ added: 0, keptSent: 1, updated: 3 });
    expect(again.reviews).toBe(0);
    expect(await db.select("programme_prospects")).toHaveLength(3);
    expect(await db.select("programme_messages")).toHaveLength(4);
    expect(await db.select("review_log")).toHaveLength(1);
    expect(await db.select("prospects")).toHaveLength(3);
    expect((await db.select("programme_prospects", { eq: { ext_id: "P1" } }))[0]!.status).toBe("replied");
    expect((await db.select("programme_messages", { eq: { id: msg.id } }))[0]).toMatchObject({ status: "sent", body: "as sent" });
    expect((await db.select("phases", { eq: { phase_id: "S1" } }))[0]!.status).toBe("active");
  });

  it("tolerates missing optional keys", async () => {
    const db = getDb();
    const r = await loadProgramme(db, { prospects: [{ id: "Z", company: "Zed Ltd", email: "a@zed.io" }] });
    expect(r.prospects.added).toBe(1);
    expect(r.tracks).toBe(0);
    await expect(loadProgramme(db, {})).resolves.toBeTruthy();
    await expect(loadProgramme(db, null)).resolves.toBeTruthy();
  });

  it("never adds the same business twice, across files or requests", async () => {
    const db = getDb();
    await loadProgramme(db, fixture);
    const r = await loadProgramme(db, { prospects: [
      { id: "N1", company: "Acme Apps again", email: "SAM@acmeapps.io" },
      { id: "N2", company: "Beta Labs Ltd", email: "other@betalabs.co", website: "https://www.betalabs.co/about" },
      { id: "N3", company: "Fresh Co", email: "x@fresh.io" },
    ] });
    expect(r.prospects.added).toBe(1);
    expect(r.prospects.duplicates.map((d) => [d.ext_id, d.of])).toEqual([["N1", "P1"], ["N2", "P2"]]);
    expect(await db.select("programme_prospects")).toHaveLength(4);
  });

  it("with a request id: new leads start as new and the request is marked done", async () => {
    const db = getDb();
    const [req] = await db.insert("lead_requests", { requested_by: "a@example.com", track: "startups", count: 5, area: "London, anywhere", status: "working" });
    const r = await loadProgramme(db, { prospects: [{ id: "L1", company: "Lead One", email: "a@lead1.io" }, { id: "L2", company: "Lead Two", email: "a@lead2.io" }] }, { requestId: req!.id });
    expect(r.request).toEqual({ id: req!.id, result_count: 2 });
    const done = (await db.select("lead_requests", { eq: { id: req!.id } }))[0]!;
    expect(done).toMatchObject({ status: "done", result_count: 2 });
    expect(done.done_at).toBeTruthy();
    const leads = await db.select("programme_prospects");
    expect(leads.every((l) => l.status === "new" && l.request_id === req!.id)).toBe(true);
  });
});
