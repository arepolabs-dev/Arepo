import { describe, expect, it, vi } from "vitest";
import { sendDue } from "./server-send";
import { placeOptOut, OPT_OUT } from "./merge";
import { ukLocalToIso } from "./uktime";
import { checkSendable } from "./rules";
import { fromIdentity } from "./sender-identity";

type T = Record<string, Record<string, unknown>[]>;
function fake(t: T) {
  const m = (r: Record<string, unknown>, eq?: Record<string, unknown>) => !eq || Object.entries(eq).every(([k, v]) => r[k] === v);
  return {
    select: async (n: string, q?: { eq?: Record<string, unknown> }) => (t[n] ?? []).filter((r) => m(r, q?.eq)),
    update: async (n: string, match: Record<string, unknown>, patch: Record<string, unknown>) => { const hit = (t[n] ?? []).filter((r) => m(r, match)); hit.forEach((r) => Object.assign(r, patch)); return hit; },
    insert: async (n: string, rows: Record<string, unknown> | Record<string, unknown>[]) => { const a = Array.isArray(rows) ? rows : [rows]; (t[n] ??= []).push(...a); return a; },
    upsert: async () => [], remove: async () => 0,
  } as never;
}
const NOW = new Date("2026-11-19T08:00:00Z");
function world(over: Partial<T> = {}): T {
  const mk = (id: string, mb: string, at: string, extra = {}) => ({ id, status: "queued", send_at: at, mailbox_id: mb, owner_id: `o-${mb}`, prospect_id: `p-${id}`, to_address: `${id}@x.co`, subject: "s", body_rendered: "b", composed_at: "2026-11-18T10:00:00Z", ...extra });
  return {
    outreach_emails: [mk("a1", "d", "2026-11-19T07:59:00Z"), mk("a2", "d", "2026-11-19T07:59:30Z"), mk("b1", "j", "2026-11-19T07:59:00Z"), mk("late", "d", "2026-11-19T09:00:00Z")],
    prospects: ["a1", "a2", "b1", "late"].map((i) => ({ id: `p-${i}`, status: "prospect", public_email: `${i}@x.co`, company_type: "ltd", consent_recorded: false })),
    mailboxes: [{ id: "d", status: "connected", send_as: "dayyan.sheikh@arepolabs.com", send_as_verified: true, address: "d@gmail.com" }, { id: "j", status: "connected", send_as: null, send_as_verified: false, address: "jackburbridge72@gmail.com" }],
    programme_messages: [], ...over,
  };
}
const ok = () => vi.fn(async () => ({ id: "g", threadId: "t", messageId: "<m@x>" }));

describe("server send (cron)", () => {
  it("sends at most one due email per sender per run and leaves future ones queued", async () => {
    const t = world(); const tr = ok();
    const r = await sendDue(fake(t), tr, NOW);
    expect(tr).toHaveBeenCalledTimes(2);
    expect(r.results.filter((x) => x.outcome === "sent").map((x) => x.id).sort()).toEqual(["a1", "b1"]);
    expect(t.outreach_emails!.find((e) => e.id === "a2")!.status).toBe("queued");
    expect(t.outreach_emails!.find((e) => e.id === "late")!.status).toBe("queued");
  });
  it("keeps the 2-minute gap after a send", async () => {
    const t = world(); const tr = ok();
    await sendDue(fake(t), tr, NOW);
    const again = await sendDue(fake(t), tr, new Date(NOW.getTime() + 60_000));
    expect(again.results.some((x) => x.outcome === "sent")).toBe(false);
    const later = await sendDue(fake(t), tr, new Date(NOW.getTime() + 121_000));
    expect(later.results.filter((x) => x.outcome === "sent").length).toBeGreaterThan(0);
  });
  it("never sends to someone who is not a confirmed limited company, and fails the row", async () => {
    const t = world(); (t.prospects![0] as Record<string, unknown>).company_type = "unknown";
    const tr = ok();
    const r = await sendDue(fake(t), tr, NOW);
    expect(r.results.find((x) => x.id === "a1")!.outcome).toBe("failed");
    expect(t.outreach_emails!.find((e) => e.id === "a1")!.status).toBe("failed");
  });
  it("sends nothing when nothing is queued", async () => {
    const tr = ok();
    expect((await sendDue(fake(world({ outreach_emails: [] })), tr, NOW)).due).toBe(0);
    expect(tr).not.toHaveBeenCalled();
  });
});

describe("gate", () => {
  const base = { public_email: "a@b.co", status: "prospect" as const, consent_recorded: false };
  it("Yes (ltd/llp) is sendable; No, unclear and not checked are not, until consent", () => {
    expect(checkSendable({ ...base, company_type: "ltd" }).blocked).toBe(false);
    for (const c of ["sole_trader", "partnership", "unknown"] as const) {
      expect(checkSendable({ ...base, company_type: c }).blocked).toBe(true);
      expect(checkSendable({ ...base, company_type: c, consent_recorded: true }).blocked).toBe(false);
    }
  });
});

describe("opt-out above the signature", () => {
  it("goes above Kind regards for both senders, once, with no signature block left under it", () => {
    for (const name of ["Dayyan Sheikh", "Jack Burbridge"]) {
      const out = placeOptOut(`Hi Sam,\n\nHello.\n\nKind regards,\n${name}\nArepo Labs\narepolabs.com\n\n${OPT_OUT}`);
      expect(out.split(OPT_OUT).length - 1).toBe(1);
      expect(out.indexOf(OPT_OUT)).toBeLessThan(out.indexOf("Kind regards"));
      expect(out.trim().endsWith(name)).toBe(true);
    }
  });
  it("goes last only when there is no sign-off", () => expect(placeOptOut("Hello.").endsWith(OPT_OUT)).toBe(true));
});

describe("send at and sender identity", () => {
  it("reads a UK wall-clock time across summer and winter", () => {
    expect(ukLocalToIso("2026-11-19T08:45")).toBe("2026-11-19T08:45:00.000Z");
    expect(ukLocalToIso("2026-07-01T08:45")).toBe("2026-07-01T07:45:00.000Z");
    expect(ukLocalToIso("nope")).toBeNull();
  });
  it("Jack sends from his own Gmail as Jack Burbridge; others need a verified alias", () => {
    const j = fromIdentity({ address: "JackBurbridge72@gmail.com", send_as: null, send_as_name: null, send_as_verified: false } as never);
    expect(j).toEqual({ address: "jackburbridge72@gmail.com", name: "Jack Burbridge", alias: false });
    expect(fromIdentity({ address: "x@gmail.com", send_as: "d@arepolabs.com", send_as_name: "Dayyan Sheikh", send_as_verified: false } as never)).toBeNull();
  });
});
