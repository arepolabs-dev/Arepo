import { describe, expect, it, vi } from "vitest";
import { ActionError } from "./actions";
import { buildMime } from "./gmail";
import { parseSingleEmail, sendTest } from "./test-send";

const msg = { id: "m1", prospect_ext_id: "S01", step: "first", subject: "Quick chat?", body: "Hi {{first_name}},\n\nHello.\n\nKind regards,\nDayyan Sheikh\nArepo Labs", template: true, status: "pending", send_on: "2026-11-18" };
const prospect = { ext_id: "S01", company: "Satago", contact_name: "Sam Lee", hook: "", phase_id: "S1", track_key: "s" };
const box = { id: "b1", kind: "personal", owner_id: "u1", send_as: "dayyan.sheikh@arepolabs.com", send_as_name: "Dayyan Sheikh" };
const user = { email: "d@x.co", personId: "u1" } as never;

function setup() {
  const writes = vi.fn();
  const db = {
    select: vi.fn(async (t: string) => (t === "programme_messages" ? [msg] : t === "programme_prospects" ? [prospect] : t === "phases" ? [] : t === "mailboxes" ? [box] : [])),
    insert: writes, update: writes, remove: writes,
  } as never;
  const sent: string[] = [];
  const deps = {
    accessTokenFor: vi.fn(async () => "tok"),
    listSendAs: vi.fn(async () => [{ sendAsEmail: box.send_as, verificationStatus: "accepted" }]),
    sendRaw: vi.fn(async (_a: string, raw: string) => { sent.push(raw); return { id: "g", threadId: "t" }; }),
    buildMime,
  };
  return { db, writes, deps: deps as never, sent };
}

describe("parseSingleEmail", () => {
  it("accepts one address", () => expect(parseSingleEmail(" a@b.co ")).toBe("a@b.co"));
  it.each(["a@b.co,c@d.co", "a@b.co\nBcc: x@y.co", "a@b.co\r\n", "", "nope", "A <a@b.co>", "a@b.co c@d.co"])("rejects %j", (v) => expect(() => parseSingleEmail(v)).toThrow(ActionError));
});

describe("sendTest", () => {
  it("sends the production email with the subject unchanged, from the send-as address, and writes nothing", async () => {
    const { db, writes, deps, sent } = setup();
    const res = await sendTest(db, user, { messageId: "m1", to: "me@x.co" }, deps);
    expect(res).toEqual({ ok: true, to: "me@x.co" });
    expect(writes).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    const raw = sent[0]!;
    expect(raw).toContain("To: me@x.co");
    expect(raw).toContain("From: Dayyan Sheikh <dayyan.sheikh@arepolabs.com>");
    expect(raw).toContain("Subject: Quick chat?");
    expect(raw).toContain("multipart/alternative");
    expect(msg.status).toBe("pending");
  });
  it("rejects a bad address before touching Gmail", async () => {
    const { db, deps } = setup();
    await expect(sendTest(db, user, { messageId: "m1", to: "a@b.co,c@d.co" }, deps)).rejects.toThrow(ActionError);
    expect((deps as never as { sendRaw: ReturnType<typeof vi.fn> }).sendRaw).not.toHaveBeenCalled();
  });
  it("refuses when the send-as address is not verified", async () => {
    const { db, deps } = setup();
    (deps as never as { listSendAs: ReturnType<typeof vi.fn> }).listSendAs.mockResolvedValue([]);
    await expect(sendTest(db, user, { messageId: "m1", to: "me@x.co" }, deps)).rejects.toThrow(/Send mail as/);
  });
});
