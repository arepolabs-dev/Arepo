import { describe, expect, it } from "vitest";
import { checkSendable } from "./rules";

const base = { public_email: "a@b.co", status: "prospect", company_type: "ltd", consent_recorded: false } as const;
describe("checkSendable", () => {
  it("allows a Ltd with an email", () => expect(checkSendable({ ...base })).toMatchObject({ blocked: false, reasons: [], warnings: [] }));
  it("blocks no email", () => expect(checkSendable({ ...base, public_email: null }).reasons).toContain("No email address"));
  it("blocks do not contact", () => expect(checkSendable({ ...base, status: "do_not_contact" }).blocked).toBe(true));
  it("blocks a sole trader without consent, allows with", () => {
    expect(checkSendable({ ...base, company_type: "sole_trader" }).blocked).toBe(true);
    expect(checkSendable({ ...base, company_type: "sole_trader", consent_recorded: true }).blocked).toBe(false);
  });
  it("warns but does not block unknown", () => {
    const r = checkSendable({ ...base, company_type: "unknown" });
    expect(r.blocked).toBe(false);
    expect(r.warnings).toContain("Check Companies House");
  });
  it("blocks a malformed address", () => expect(checkSendable({ ...base, public_email: "nope" }).blocked).toBe(true));
});
