import { describe, expect, it } from "vitest";
import { bareAddress, isAutoReply, isBounce, looksLikeStop, matchInbound } from "./match";

const emails = [{ id: "e1", prospect_id: "p1", gmail_thread_id: "t1", rfc_message_id: "<m1@arepolabs.com>", to_address: "cafe@x.co" }];
const prospects = [{ id: "p1", public_email: "Cafe@X.co" }, { id: "p2", public_email: "bar@y.co" }];
const msg = (o: object) => ({ gmailId: "g", threadId: "tx", from: "z@z.co", subject: "Re: hi", bodyText: "", headers: {}, ...o });

describe("matchInbound", () => {
  it("matches by thread", () => expect(matchInbound(msg({ threadId: "t1" }), emails, prospects)).toEqual({ prospectId: "p1", outreachEmailId: "e1", by: "thread" }));
  it("matches by In-Reply-To", () => expect(matchInbound(msg({ headers: { "in-reply-to": "<m1@arepolabs.com>" } }), emails, prospects)?.by).toBe("in_reply_to"));
  it("matches by address, case-insensitive", () => expect(matchInbound(msg({ from: "bar@y.co" }), emails, prospects)).toMatchObject({ prospectId: "p2", by: "address" }));
  it("returns null for strangers", () => expect(matchInbound(msg({}), emails, prospects)).toBeNull());
  it("matches a bounce by failed recipient", () => {
    const m = msg({ from: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Failure)", bodyText: "cafe@x.co not found" });
    expect(matchInbound(m, emails, prospects)).toMatchObject({ prospectId: "p1", by: "bounce" });
  });
});
describe("classifiers", () => {
  it("bounce", () => expect(isBounce({ from: "mailer-daemon@x", subject: "Undeliverable", headers: {} })).toBe(true));
  it("not bounce", () => expect(isBounce({ from: "a@b.co", subject: "Hi", headers: {} })).toBe(false));
  it("auto by header", () => expect(isAutoReply({ subject: "x", headers: { "auto-submitted": "auto-replied" } })).toBe(true));
  it("auto by X-Autoreply", () => expect(isAutoReply({ subject: "x", headers: { "x-autoreply": "yes" } })).toBe(true));
  it("auto-submitted no", () => expect(isAutoReply({ subject: "x", headers: { "auto-submitted": "no" } })).toBe(false));
  it("stop", () => {
    expect(looksLikeStop("Stop.\n\n> quoted")).toBe(true);
    expect(looksLikeStop("Please stop by on Tuesday")).toBe(false);
    expect(looksLikeStop("please remove me")).toBe(true);
    expect(looksLikeStop("Not interested, take me off your list.\n\nOn Tue, X wrote:\n> hi")).toBe(true);
    expect(looksLikeStop("Thanks, interested.\n\nOn Tue, X wrote:\n> if you'd rather not hear from me, remove me")).toBe(false);
  });
  it("bareAddress", () => expect(bareAddress('"A B" <A@B.co>')).toBe("a@b.co"));
});
