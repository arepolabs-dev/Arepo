import { describe, expect, it } from "vitest";
import { CALENDLY, EMAIL, copy } from "./copy";

const all = JSON.stringify(copy);

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
  });
  it("has exactly 1 booking call to action", () => {
    const ctas = Object.values(copy).flatMap((section) =>
      typeof section === "object" && section !== null && "cta" in section ? [section.cta] : [],
    );
    expect(ctas).toHaveLength(1);
    expect(CALENDLY.startsWith("https://calendly.com/")).toBe(true);
  });
  it("names both founders and the company", () => {
    const names = copy.who.people.map((p) => p.name);
    expect(names).toEqual(["Dayyan Sheikh", "Jack Burbridge"]);
    expect(copy.nav.brand).toBe("Arepo Labs");
    expect(EMAIL.endsWith("@arepolabs.com")).toBe(true);
  });
  it("stays short: under 240 words of reading on the page", () => {
    const prose = [
      copy.hero.eyebrow,
      copy.hero.h1,
      copy.hero.sub,
      copy.what.title,
      ...copy.what.items.flatMap((i) => [i.title, i.body]),
      ...copy.how.steps.flatMap((s) => [s.title, s.body]),
      copy.who.title,
      ...copy.who.people.flatMap((p) => [p.name, p.role, p.bio]),
      copy.contact.title,
      copy.contact.body,
    ].join(" ");
    const words = prose.replace(/[^A-Za-z0-9' ]+/g, " ").trim().split(/\s+/).length;
    expect(words).toBeLessThan(240);
  });
});
