import { describe, expect, it } from "vitest";
import {
  initialsFor,
  isAllowed,
  isTestMode,
  parseAllowlist,
  safePhase1Next,
} from "./allowlist";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const list = parseAllowlist(" A@Example.com , b@example.com,, a@example.com ");

describe("allowlist", () => {
  it("trims, lowercases and dedupes", () => {
    expect(list).toEqual(["a@example.com", "b@example.com"]);
  });
  it("is case-insensitive and trims the candidate", () => {
    expect(isAllowed("  A@EXAMPLE.COM ", list)).toBe(true);
    expect(isAllowed("b@example.com", list)).toBe(true);
  });
  it("rejects others, empty and missing", () => {
    expect(isAllowed("c@example.com", list)).toBe(false);
    expect(isAllowed("", list)).toBe(false);
    expect(isAllowed(undefined, list)).toBe(false);
    expect(isAllowed("a@example.com", [])).toBe(false);
    expect(isAllowed("a@example.com.evil.io", list)).toBe(false);
  });
  it("an empty env gives an empty list", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
  });
});

describe("test mode", () => {
  it("is off by default and on with 1", () => {
    expect(isTestMode(env({ NODE_ENV: "test" }))).toBe(false);
    expect(isTestMode(env({ PHASE1_TEST_MODE: "1", NODE_ENV: "production" }))).toBe(true);
  });
  it("is refused on production Vercel", () => {
    expect(() =>
      isTestMode(env({ PHASE1_TEST_MODE: "1", NODE_ENV: "production", VERCEL_ENV: "production" })),
    ).toThrow();
    expect(
      isTestMode(env({ PHASE1_TEST_MODE: "1", NODE_ENV: "production", VERCEL_ENV: "preview" })),
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("initials", () => {
    expect(initialsFor("dayyan.sheikh@x.com")).toBe("DS");
    expect(initialsFor("jack@x.com")).toBe("J");
  });
  it("safePhase1Next blocks open redirects", () => {
    expect(safePhase1Next("/phase1/prospects")).toBe("/phase1/prospects");
    expect(safePhase1Next("//evil.com")).toBe("/phase1");
    expect(safePhase1Next("https://evil.com")).toBe("/phase1");
    expect(safePhase1Next("/predictionmarket")).toBe("/phase1");
    expect(safePhase1Next("/phase1/signin")).toBe("/phase1");
    expect(safePhase1Next("/phase1/enrol?token=x")).toBe("/phase1");
    expect(safePhase1Next(null)).toBe("/phase1");
  });
});
