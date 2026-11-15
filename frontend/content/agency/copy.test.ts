import { describe, expect, it } from "vitest";
import { copy } from "./copy";

const all = JSON.stringify(copy);

describe("agency copy", () => {
  it("has no em dash", () => {
    expect(all.includes("—")).toBe(false);
  });
  it("hero has no AI mention", () => {
    expect(/\bAI\b/.test(JSON.stringify(copy.hero))).toBe(false);
    expect(/\bAI\b/.test(copy.meta.description)).toBe(false);
  });
});
