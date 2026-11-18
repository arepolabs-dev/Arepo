import { describe, expect, it } from "vitest";
import { bodyToHtml, stripBold } from "./html-email";

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
    expect(h).toContain(`<p style="margin:0 0 14px;color:#6b6b6b;font-size:13px;">If you'd rather not hear from me, reply to this email and let me know.</p>`.replace("'", "&#39;"));
    expect(h).toContain("Kind regards,<br>\nDayyan Sheikh<br>\nArepo Labs</p>");
  });
  it("falls back to plain escaped text with no link", () => expect(bodyToHtml("Hello")).toBe("<div><p>Hello</p></div>"));
  it("shows **bold** as <b>, escaped, and leaves lone asterisks alone", () => {
    expect(bodyToHtml("The **first look** is free & **<x>**")).toBe("<div><p>The <b>first look</b> is free &amp; <b>&lt;x&gt;</b></p></div>");
    expect(bodyToHtml("a * b ** c")).toContain("a * b ** c");
    expect(stripBold("Could we do **15 minutes** next week?")).toBe("Could we do 15 minutes next week?");
  });
});

describe("bodyToHtml styled", () => {
  const body = `Hi Peter,\n\nCould we do **15 minutes** next week? Pick a time here: ${U}\n\nIf you'd rather not hear from me, reply to this email and let me know.\n\nKind regards,`;
  const h = bodyToHtml(body, { styled: true });
  it("wraps in inline type and spacing", () => {
    expect(h.startsWith('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;')).toBe(true);
    expect(h).toContain('<p style="margin:0 0 14px;">Hi Peter,</p>');
    expect(h).toContain('<p style="margin:0;">Kind regards,</p>');
    expect(h).not.toMatch(/class=|<style/);
  });
  it("bolds and shows the booking link in brand red with an arrow, no stray full stop", () => {
    expect(h).toContain(`<b>15 minutes</b> next week? <a href="${U}" style="color:#E50C0E;font-weight:bold;text-decoration:none;">Pick a time here &rarr;</a></p>`);
    expect(bodyToHtml(`Pick a time here: ${U}.`, { styled: true })).toContain("&rarr;</a></p>");
  });
  it("greys the opt-out line", () => expect(h).toContain('<p style="margin:0 0 14px;color:#6b6b6b;font-size:13px;">If you&#39;d rather'));
});
