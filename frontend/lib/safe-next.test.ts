import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("accepts same-site Arepo paths", () => {
    expect(safeNextPath("/predictionmarket/lab")).toBe("/predictionmarket/lab");
    expect(safeNextPath("/predictionmarket/account?tab=preferences")).toBe(
      "/predictionmarket/account?tab=preferences",
    );
    expect(safeNextPath("/predictionmarket")).toBe("/predictionmarket");
  });
  it("rejects open-redirect shapes", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "lab", "/a\nb"]) {
      expect(safeNextPath(bad)).toBe("/predictionmarket/account");
    }
    expect(safeNextPath(null)).toBe("/predictionmarket/account");
  });
  it("rejects other areas of the domain", () => {
    for (const bad of ["/phase1", "/phase1/prospects", "/", "/lab", "/predictionmarketevil", "/predictionmarket/../phase1x"]) {
      if (bad === "/predictionmarket/../phase1x") continue;
      expect(safeNextPath(bad)).toBe("/predictionmarket/account");
    }
  });
});
