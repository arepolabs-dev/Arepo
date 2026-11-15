import { test, expect } from "@playwright/test";
import { PM } from "./helpers";

/**
 * Old Arepo paths (before the move under /predictionmarket) must 308 to the prefixed path with the
 * query string kept, so links in already-sent emails (verify, reset, unsubscribe, digests) still work.
 * `/` is NOT redirected (it is the agency page), and `/api/*` is still proxied.
 */
const OLD = [
  "markets",
  "signals",
  "replay",
  "research-lab",
  "how-it-works",
  "methodology",
  "opportunities",
  "account",
  "signin",
  "signup",
  "forgot",
  "reset",
  "verify",
  "unsubscribe",
  "lab",
];

for (const p of OLD) {
  test(`/${p} 308s to ${PM}/${p}`, async ({ request }) => {
    const res = await request.get(`/${p}`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers()["location"], "http://localhost").pathname).toBe(`${PM}/${p}`);
  });
}

test("sub-paths and queries are kept", async ({ request }) => {
  const cases: Array<[string, string]> = [
    ["/verify?token=abc", `${PM}/verify?token=abc`],
    ["/reset?token=abc", `${PM}/reset?token=abc`],
    ["/account?tab=preferences", `${PM}/account?tab=preferences`],
    ["/unsubscribe?token=abc", `${PM}/unsubscribe?token=abc`],
    ["/markets/2694364?mode=live", `${PM}/markets/2694364?mode=live`],
    ["/lab/security", `${PM}/lab/security`],
    ["/lab/members", `${PM}/lab/members`],
  ];
  for (const [from, to] of cases) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), from).toBe(308);
    const loc = new URL(res.headers()["location"], "http://localhost");
    expect(loc.pathname + loc.search, from).toBe(to);
  }
});

test("/ is not redirected", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["location"]).toBeUndefined();
});

test("/api/status is still proxied (not redirected)", async ({ request }) => {
  const res = await request.get("/api/status", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});
