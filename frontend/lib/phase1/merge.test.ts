import { describe, expect, it } from "vitest";
import { OPT_OUT, endsWithOptOut, findUnresolved, mailtoLink, renderEmail } from "./merge";

const dayyan = { name: "Dayyan Sheikh", firstName: "Dayyan", email: "dayyan.sheikh@arepolabs.com", bookingLink: "https://cal.example/d" };
const jack = { ...dayyan, name: "Jack Burbridge", firstName: "Jack", email: "jack.burbridge@arepolabs.com" };
const p = { name: "Tani", first_name: "Sam", opener_specific: "Loved the flat white.", opener_general: "Saw your cafe.", subject_hint: "Tani idea" };

describe("renderEmail", () => {
  it("fills slots and appends the opt-out", () => {
    const r = renderEmail({ prospect: p, subject: "Quick question, {first_name}", body: "Hi {first_name},\n\n{opener} About {business}.\n\nDayyan", sender: jack });
    expect(r.subject).toBe("Quick question, Sam");
    expect(r.body).toContain("Hi Sam,");
    expect(r.body).toContain("Loved the flat white. About Tani.");
    expect(r.body).toContain("\nJack");
    expect(r.body.endsWith(OPT_OUT)).toBe(true);
    expect(r.unresolved).toEqual([]);
  });
  it("falls back to Hi there and general opener", () => {
    const r = renderEmail({ prospect: { name: "X", opener_general: "G" }, subject: "Quick question, {first_name}", body: "Hi {first_name},\n{opener}", sender: dayyan });
    expect(r.subject).toBe("Quick question");
    expect(r.body).toContain("Hi there,");
    expect(r.openerUsed).toBe("G");
  });
  it("does not duplicate the opt-out and flags leftovers", () => {
    const r = renderEmail({ prospect: p, subject: "s", body: `Book: [booking link] [unknown thing]\n\n${OPT_OUT}`, sender: dayyan });
    expect(r.body.match(/reply "stop"/g)).toHaveLength(1);
    expect(r.body).toContain("https://cal.example/d");
    expect(r.unresolved).toEqual(["[unknown thing]"]);
  });
  it("uses a signature and warns on the wrong name", () => {
    const r = renderEmail({ prospect: p, subject: "s", body: "Hello.\n\nI'm Dayyan.\n\nDayyan", signature: "Dayyan\nArepo Labs", sender: jack });
    expect(r.body).toContain("Jack\nArepo Labs");
    expect(r.warnings.join(" ")).toContain("I'm Dayyan");
  });
});
describe("helpers", () => {
  it("finds tokens", () => expect(findUnresolved("a {x} [y z]")).toEqual(["{x}", "[y z]"]));
  it("detects opt-out", () => expect(endsWithOptOut(`hi\n${OPT_OUT}\n`)).toBe(true));
  it("builds mailto", () => expect(mailtoLink("a@b.co", "S s", "B\nb")).toBe("mailto:a%40b.co?subject=S%20s&body=B%0Ab"));
});
