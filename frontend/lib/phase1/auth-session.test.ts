import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (n: string) => (n === "phase1-session" && cookieValue ? { value: cookieValue } : undefined) }),
}));

import { requireUser } from "./supabase";
import { signSession } from "./session";

const SECRET = "s".repeat(40);

beforeEach(() => {
  delete process.env.PHASE1_TEST_MODE;
  process.env.PHASE1_SESSION_SECRET = SECRET;
  process.env.PHASE1_ALLOWED_EMAILS = "a@example.com";
  cookieValue = undefined;
});

describe("requireUser with the passkey session cookie", () => {
  it("401 with no cookie, 503 with no secret", async () => {
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    delete process.env.PHASE1_SESSION_SECRET;
    await expect(requireUser()).rejects.toMatchObject({ status: 503 });
  });
  it("403 for a validly signed but non-allowlisted email", async () => {
    cookieValue = await signSession("c@example.com", SECRET);
    await expect(requireUser()).rejects.toMatchObject({ status: 403 });
  });
  it("401 for a forged cookie", async () => {
    cookieValue = await signSession("a@example.com", "z".repeat(40));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("ok for an allowlisted email", async () => {
    cookieValue = await signSession("a@example.com", SECRET);
    await expect(requireUser()).resolves.toMatchObject({ email: "a@example.com" });
  });
});
