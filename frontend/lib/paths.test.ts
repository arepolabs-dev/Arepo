import { describe, expect, it } from "vitest";
import { PM, pm } from "./paths";

describe("pm", () => {
  it("prefixes paths", () => {
    expect(PM).toBe("/predictionmarket");
    expect(pm("/markets")).toBe("/predictionmarket/markets");
    expect(pm("/markets/123?mode=live")).toBe("/predictionmarket/markets/123?mode=live");
    expect(pm("/account?tab=preferences")).toBe("/predictionmarket/account?tab=preferences");
    expect(pm("/methodology#signal-strength")).toBe("/predictionmarket/methodology#signal-strength");
  });
  it("maps the root to the bare prefix", () => {
    expect(pm("/")).toBe("/predictionmarket");
    expect(pm("")).toBe("/predictionmarket");
  });
  it("tolerates a missing leading slash", () => {
    expect(pm("lab")).toBe("/predictionmarket/lab");
  });
});
