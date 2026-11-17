import { describe, expect, it } from "vitest";
import { buildMime } from "./gmail";
import { emailHtml, emailText, hasSignature, signatureHtml } from "./signature";

const body = "Hi Sam,\n\nHello <b>there</b> & co.\n\nIf you'd rather not hear from me, reply to this email and let me know.\n\nKind regards,\nDayyan Sheikh\nArepo Labs";
const dec = (raw: string, type: string) => {
  const part = raw.split("\r\n--").find((p) => p.includes(type))!;
  return Buffer.from(part.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString("utf8").replace(/\r\n/g, "\n");
};
const mime = (from: string) => buildMime({ fromName: "X", fromAddress: from, to: "a@b.co", subject: "S", body }).raw;

describe("signature", () => {
  it("is in both parts for Dayyan's sender, any case", () => {
    for (const from of ["dayyan.sheikh@arepolabs.com", "Dayyan.Sheikh@Arepolabs.com"]) {
      const raw = mime(from);
      expect(dec(raw, "text/plain")).toContain("arepolabs.com | dayyan.sheikh@arepolabs.com\nWhite City, Shepherd's Bush, London");
      const html = dec(raw, "text/html");
      expect(html).toContain('src="https://www.arepolabs.com/brand/arepo-icon-light.png"');
      expect(html).toContain("mailto:dayyan.sheikh@arepolabs.com");
      expect(html).toContain("border-left:2px solid #E50C0E");
      expect(html).toContain("Shepherd&#39;s Bush");
    }
  });
  it("is absent and byte-identical for other senders", () => {
    const raw = mime("jack@arepolabs.com");
    expect(dec(raw, "text/plain")).toBe(body);
    expect(dec(raw, "text/html")).not.toContain("<table");
    expect(hasSignature("jack@arepolabs.com")).toBe(false);
    expect(hasSignature(null)).toBe(false);
  });
  it("does not duplicate the name and keeps the opt-out first", () => {
    const t = emailText(body, "dayyan.sheikh@arepolabs.com");
    expect(t.match(/Dayyan Sheikh/g)).toHaveLength(1);
    expect(t.match(/Arepo Labs/g)).toHaveLength(1);
    expect(t.indexOf("rather not hear from me")).toBeLessThan(t.indexOf("Kind regards,"));
    expect(t).toContain("Kind regards,\nDayyan Sheikh\nArepo Labs\narepolabs.com");
    const h = emailHtml(body, "dayyan.sheikh@arepolabs.com");
    expect(h).toContain("Kind regards,");
    expect(h.match(/Dayyan Sheikh/g)).toHaveLength(1);
    expect(h.indexOf("rather not hear from me")).toBeLessThan(h.indexOf("Kind regards,"));
  });
  it("appends after a body with no sign-off, and escapes the body", () => {
    const t = emailText("Hello", "dayyan.sheikh@arepolabs.com");
    expect(t).toBe(`Hello\n\n${emailText("", "dayyan.sheikh@arepolabs.com").trim()}`);
    expect(emailHtml(body, "dayyan.sheikh@arepolabs.com")).toContain("&lt;b&gt;there&lt;/b&gt; &amp; co.");
  });
  it("uses inline styles only", () => expect(signatureHtml()).not.toMatch(/class=|<style/));
});
