import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CALENDLY, EMAIL, EMAIL_GENERAL, EMAIL_JACK, JACK_CALENDLY, contacts, copy } from "./copy";

const all = JSON.stringify(copy);
const page = readFileSync(resolve(__dirname, "../../app/(agency)/page.tsx"), "utf8");
const header = readFileSync(resolve(__dirname, "../../components/agency/Header.tsx"), "utf8");

describe("agency copy", () => {
  it("has no em dash", () => {
    expect(all.includes("—")).toBe(false);
  });
  it("hero has no AI mention", () => {
    expect(/\bAI\b/.test(JSON.stringify(copy.hero))).toBe(false);
    expect(/\bAI\b/.test(copy.meta.description)).toBe(false);
  });
  it("names no prices (Dayyan, 15 Nov)", () => {
    expect(/£\s?\d/.test(all)).toBe(false);
  });
  it("has no Recent work section and no footer", () => {
    expect(all.includes("Recent work")).toBe(false);
    expect("work" in copy).toBe(false);
    expect("footer" in copy).toBe(false);
  });
  it("never links to the prediction-market site", () => {
    expect(all.includes("predictionmarket")).toBe(false);
    expect(all.includes("prediction market")).toBe(false);
    expect(/href=["'{][^"'}]*predictionmarket/.test(page)).toBe(false);
  });

  describe("booking links (Dayyan, 15 Nov, 2nd voice note)", () => {
    it("has exactly 1 primary booking button, in the hero, in Arepo red", () => {
      const ctas = Object.values(copy).flatMap((section) =>
        typeof section === "object" && section !== null && "cta" in section ? [section.cta] : [],
      );
      expect(ctas).toEqual(["Book a free chat"]);
      expect(CALENDLY.startsWith("https://calendly.com/")).toBe(true);
      expect(page.match(/data-testid="primary-cta"/g)).toHaveLength(1);
      expect(page.match(/href=\{CALENDLY\}/g)).toHaveLength(1);
      expect(/data-testid="primary-cta"[^>]*bg-arepo-accent/s.test(page)).toBe(true);
    });
    it("banner and nav carry no booking button", () => {
      expect("cta" in copy.banner).toBe(false);
      expect(copy.banner.href).toBe("#contact");
      expect(header.includes("CALENDLY")).toBe(false);
      expect(header.includes("calendly")).toBe(false);
    });
    it("Contact lists each founder with their own email and a plain calendar link", () => {
      expect(contacts.map((c) => c.name)).toEqual(["Dayyan Sheikh", "Jack Burbridge"]);
      expect(contacts[0]).toEqual({ name: "Dayyan Sheikh", email: EMAIL, calendly: CALENDLY });
      expect(contacts[1]).toEqual({ name: "Jack Burbridge", email: EMAIL_JACK, calendly: JACK_CALENDLY });
      // Jack's link is hidden while empty; a real link must be a Calendly URL.
      if (JACK_CALENDLY) expect(JACK_CALENDLY.startsWith("https://calendly.com/")).toBe(true);
      expect(page.includes("c.calendly ? (")).toBe(true);
      expect(page.includes('data-testid="calendar-link"')).toBe(true);
      expect(/data-testid="calendar-link"[^>]*rounded-control/s.test(page)).toBe(false);
    });
  });

  describe("emails", () => {
    it("the general address is the 1 email in the hero line and the main Contact email", () => {
      expect(EMAIL_GENERAL).toBe("enquiries@arepolabs.com");
      expect(page.match(/mailto:\$\{EMAIL_GENERAL\}/g)).toHaveLength(2);
      expect(page.includes("mailto:${EMAIL}")).toBe(false);
      expect(page.includes("mailto:${EMAIL_JACK}")).toBe(false);
    });
    it("both founders' addresses are on the page as mailto links", () => {
      expect(EMAIL).toBe("dayyan.sheikh@arepolabs.com");
      expect(EMAIL_JACK).toBe("jack.burbridge@arepolabs.com");
      expect(contacts.map((c) => c.email)).toEqual([EMAIL, EMAIL_JACK]);
      expect(page.includes("mailto:${c.email}")).toBe(true);
    });
  });

  describe("Who we are (Dayyan, 15 Nov)", () => {
    it("sits directly under the hero and the ticker, before What we do", () => {
      const ticker = page.indexOf("<ScrollTicker");
      const who = page.indexOf('id="who"');
      const what = page.indexOf('id="what"');
      const how = page.indexOf("{copy.how.label}");
      expect(ticker).toBeGreaterThan(page.indexOf('data-testid="hero"'));
      expect(who).toBeGreaterThan(ticker);
      expect(what).toBeGreaterThan(who);
      expect(how).toBeGreaterThan(what);
      expect(copy.nav.links.map((l) => l.href)).toEqual(["#who", "#what", "#contact"]);
    });
    it("uses his header wording, Dayyan left and Jack right, matching roles and bios", () => {
      expect(copy.who.title).toBe("Two engineers who like fixing things properly.");
      expect(copy.who.people.map((p) => p.name)).toEqual(["Dayyan Sheikh", "Jack Burbridge"]);
      expect(copy.who.people.map((p) => p.role)).toEqual(["Co-founder, engineer", "Co-founder, engineer"]);
      expect(copy.who.people.map((p) => p.bio)).toEqual(["Master of Engineering, UCL", "Bachelor of Engineering, Exeter"]);
      expect(all.includes("Fospha")).toBe(false);
      expect(all.includes("Works in")).toBe(false);
      expect(all.includes("TODO")).toBe(false);
      expect(copy.who.people.map((p) => p.photo)).toEqual(["/team/dayyan.jpg", "/team/jack.jpg"]);
    });
  });

  it("What we do and Contact titles say different things", () => {
    expect(copy.contact.title).toBe("Tell us the 1 job you would happily never do again.");
    expect(copy.what.title).not.toBe(copy.contact.title);
    expect(copy.what.title.includes("never do again")).toBe(false);
  });
  it("the banner is 1 short line and names the company's brand", () => {
    expect(copy.banner.text.split(/\s+/).length).toBeLessThan(12);
    expect(copy.nav.brand).toBe("Arepo Labs");
    for (const e of [EMAIL, EMAIL_JACK, EMAIL_GENERAL]) expect(e.endsWith("@arepolabs.com")).toBe(true);
  });
  it("stays short: under 240 words of reading on the page", () => {
    const prose = [
      copy.banner.text,
      copy.hero.eyebrow,
      copy.hero.h1,
      copy.hero.sub,
      copy.who.title,
      ...copy.who.people.flatMap((p) => [p.name, p.role, p.bio]),
      copy.what.title,
      ...copy.what.items.flatMap((i) => [i.title, i.body]),
      ...copy.how.steps.flatMap((s) => [s.title, s.body]),
      copy.contact.title,
      copy.contact.body,
      ...contacts.map((c) => c.name),
    ].join(" ");
    const words = prose.replace(/[^A-Za-z0-9' ]+/g, " ").trim().split(/\s+/).length;
    expect(words).toBeLessThan(240);
  });
});
