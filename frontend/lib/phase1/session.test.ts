import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifySession,
  verifySessionAnyEmail,
} from "./session";

const SECRET = "x".repeat(40);
const OTHER = "y".repeat(40);
const list = ["a@example.com", "b@example.com"];
const NOW = 1_800_000_000_000;

describe("session sign and verify", () => {
  it("round-trips an allowlisted email (normalised)", async () => {
    const t = await signSession(" A@Example.com ", SECRET, NOW);
    expect(await verifySession(t, SECRET, list, NOW + 1000)).toBe("a@example.com");
  });

  it("rejects a tampered payload", async () => {
    const t = await signSession("a@example.com", SECRET, NOW);
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ e: "b@example.com", exp: NOW / 1000 + 99999 })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, SECRET, list, NOW)).toBeNull();
  });

  it("rejects a tampered signature, a wrong secret and garbage", async () => {
    const t = await signSession("a@example.com", SECRET, NOW);
    expect(await verifySession(t.slice(0, -2) + "AA", SECRET, list, NOW)).toBeNull();
    expect(await verifySession(t, OTHER, list, NOW)).toBeNull();
    for (const bad of ["", "abc", "a.b.c", "!!.??", undefined, null]) {
      expect(await verifySession(bad as string, SECRET, list, NOW)).toBeNull();
    }
    expect(await verifySession(t, null, list, NOW)).toBeNull();
  });

  it("expires after 30 days", async () => {
    const t = await signSession("a@example.com", SECRET, NOW);
    const last = NOW + SESSION_TTL_SECONDS * 1000;
    expect(await verifySession(t, SECRET, list, last - 1000)).toBe("a@example.com");
    expect(await verifySession(t, SECRET, list, last)).toBeNull();
  });

  it("re-checks the allowlist on every verify", async () => {
    const t = await signSession("c@example.com", SECRET, NOW);
    expect(await verifySession(t, SECRET, list, NOW)).toBeNull(); // never invited
    const ok = await signSession("a@example.com", SECRET, NOW);
    expect(await verifySession(ok, SECRET, ["b@example.com"], NOW)).toBeNull(); // removed later
    expect(await verifySession(ok, SECRET, [], NOW)).toBeNull();
  });

  it("verifySessionAnyEmail returns a valid non-allowlisted email but still checks signature and expiry", async () => {
    const t = await signSession("c@example.com", SECRET, NOW);
    expect(await verifySessionAnyEmail(t, SECRET, NOW)).toBe("c@example.com");
    expect(await verifySessionAnyEmail(t, OTHER, NOW)).toBeNull();
    expect(await verifySessionAnyEmail(t, SECRET, NOW + SESSION_TTL_SECONDS * 1000)).toBeNull();
  });
});

describe("session config", () => {
  it("needs a secret of at least 32 characters", () => {
    expect(sessionSecret({} as NodeJS.ProcessEnv)).toBeNull();
    expect(sessionSecret({ PHASE1_SESSION_SECRET: "short" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(sessionSecret({ PHASE1_SESSION_SECRET: SECRET } as unknown as NodeJS.ProcessEnv)).toBe(SECRET);
  });
  it("cookie is HttpOnly, Lax, 30 days, Secure in production", () => {
    const o = sessionCookieOptions({ NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv);
    expect(o).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 });
    expect(sessionCookieOptions({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv).secure).toBe(false);
  });
});
