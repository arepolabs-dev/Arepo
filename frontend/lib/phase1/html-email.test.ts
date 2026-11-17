import { describe, expect, it } from "vitest";
import { bodyToHtml } from "./html-email";

const U = "https://calendly.com/dayyan-sheikh-arepolabs/30min";
const A = `<a href="${U}">`;

describe("bodyToHtml", () => {
  it("escapes and keeps paragraphs", () => {
    const h = bodyToHtml("Hi <b>A & B</b>,\n\nSecond \"para\".\nNext line");
    expect(h).toBe('<div><p>Hi &lt;b&gt;A &amp; B&lt;/b&gt;,</p>\n<p>Second &quot;para&quot;.<br>\nNext line</p></div>');
  });
  it("turns 'Pick a time here: URL' into a linked phrase", () => {
    expect(bodyToHtml(`Could we do 15 minutes? Pick a time here: ${U}`)).toContain(`Could we do 15 minutes? ${A}Pick a time here</a>.`);
    expect(bodyToHtml(`Pick a time here: ${U}.`)).not.toContain("</a>..");
    expect(bodyToHtml(`Pick a time here: ${U}`)).not.toContain(`>${U}<`);
  });
  it("uses 'Book a time' for a URL alone on its line", () => {
    expect(bodyToHtml(`Jack\n${U}\n\nIf you'd rather not hear from me, reply.`)).toContain(`Jack<br>\n${A}Book a time</a></p>`);
  });
  it("uses 'this link' elsewhere and handles several links", () => {
    const h = bodyToHtml(`Use ${U}, or ${U}/x.`);
    expect(h.match(/this link/g)).toHaveLength(2);
    expect(h).toContain(`${A}this link</a>, or`);
  });
  it("leaves other text, opt-out and sign-off unchanged, and other URLs plain", () => {
    const t = "See https://example.com/a?x=1&y=2\n\nIf you'd rather not hear from me, reply to this email and let me know.\n\nKind regards,\nDayyan Sheikh\nArepo Labs";
    const h = bodyToHtml(t);
    expect(h).toContain("https://example.com/a?x=1&amp;y=2");
    expect(h).toContain("<p>If you'd rather not hear from me, reply to this email and let me know.</p>".replace("'", "&#39;"));
    expect(h).toContain("Kind regards,<br>\nDayyan Sheikh<br>\nArepo Labs</p>");
  });
  it("falls back to plain escaped text with no link", () => expect(bodyToHtml("Hello")).toBe("<div><p>Hello</p></div>"));
});
