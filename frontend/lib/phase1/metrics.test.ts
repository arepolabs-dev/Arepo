import { describe, expect, it } from "vitest";
import { followUpsDue, londonWeekStart, planWeek, replyRate, testWinner, workingDaysBetween } from "./metrics";

const e = (id: string, sent: string | null, extra: object = {}) => ({ id, prospect_id: "p" + id, sent_at: sent, status: "sent", follow_up_of: null, ...extra });
const now = new Date("2026-11-23T12:00:00Z");

describe("dates", () => {
  it("week starts Monday 00:00 London", () => {
    expect(londonWeekStart(new Date("2026-11-18T15:00:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(londonWeekStart(new Date("2026-07-02T10:00:00Z")).toISOString()).toBe("2026-06-28T23:00:00.000Z");
  });
  it("working days skip weekends", () => {
    expect(workingDaysBetween(new Date("2026-11-20T10:00:00Z"), new Date("2026-11-23T10:00:00Z"))).toBe(1);
    expect(workingDaysBetween(new Date("2026-11-16T10:00:00Z"), new Date("2026-11-23T10:00:00Z"))).toBe(5);
  });
  it("plan week", () => {
    expect(planWeek(new Date("2026-11-16T09:00:00Z"))).toBe(1);
    expect(planWeek(new Date("2026-12-09T09:00:00Z"))).toBe(4);
    expect(planWeek(new Date("2026-11-10T09:00:00Z"))).toBe(0);
  });
});
describe("replyRate", () => {
  it("counts only matured emails and ignores bounce/auto", () => {
    const emails = [e("1", "2026-11-16T09:00:00Z"), e("2", "2026-11-16T09:00:00Z"), e("3", "2026-11-22T09:00:00Z"), e("4", null)];
    const replies = [
      { prospect_id: "p1", outreach_email_id: "1", reply_type: "positive", received_at: "2026-11-17T09:00:00Z" },
      { prospect_id: "p2", outreach_email_id: "2", reply_type: "auto", received_at: "2026-11-17T09:00:00Z" },
    ];
    const r = replyRate(emails, replies, now);
    expect(r).toMatchObject({ num: 1, den: 2 });
    expect(r.rate).toBe(0.5);
  });
  it("is null with nothing mature", () => expect(replyRate([e("1", "2026-11-22T09:00:00Z")], [], now).rate).toBeNull());
});
describe("followUpsDue", () => {
  it("lists old unreplied emails without follow-up", () => {
    const emails = [e("1", "2026-11-16T09:00:00Z"), e("2", "2026-11-16T09:00:00Z"), e("3", "2026-11-16T09:00:00Z"), e("4", "2026-11-22T09:00:00Z")];
    const replies = [{ prospect_id: "p2", outreach_email_id: "2", reply_type: "question", received_at: "2026-11-17T09:00:00Z" }];
    const fu = [{ ...e("5", "2026-11-20T09:00:00Z", { follow_up_of: "3", prospect_id: "p3" }) }];
    const due = followUpsDue([...emails, ...fu], replies, [], now).map((x) => x.id);
    expect(due).toEqual(["1"]);
  });
});
describe("testWinner", () => {
  it("needs a lead of 2 and 2 in total", () => {
    expect(testWinner(2, 0).winner).toBe("a");
    expect(testWinner(1, 0).winner).toBe("none");
    expect(testWinner(3, 2).winner).toBe("none");
    expect(testWinner(1, 4).winner).toBe("b");
    expect(testWinner(0, 0).reason).toContain("no winner yet");
  });
});
