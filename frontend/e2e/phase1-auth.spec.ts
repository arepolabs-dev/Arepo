import { expect, test } from "@playwright/test";
import { signInAs } from "./phase1-helpers";

// Runs against `next start` with PHASE1_TEST_MODE=1 PHASE1_TEST_USER=test@example.com
// PHASE1_ALLOWED_EMAILS=test@example.com. No backend, no Supabase. Real passkey sign-in needs the
// passkey tables, so it is not run here (see the skipped ceremony test below).

test("signed out: /phase1 redirects 307 to the sign-in page", async ({ request }) => {
  const res = await request.get("/phase1", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(new URL(res.headers()["location"]!, "http://x").pathname).toBe("/phase1/signin");
});

test("signed out: /phase1/api/* returns 401 JSON", async ({ request }) => {
  const res = await request.get("/phase1/api/anything");
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toEqual({ error: "Not signed in" });
});

test("sign-in page renders and is noindex", async ({ page }) => {
  await page.goto("/phase1/signin");
  await expect(page.getByRole("heading", { name: "Phase 1" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("sign-in page has no email form or magic link", async ({ page }) => {
  await page.goto("/phase1/signin");
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByText(/sign-in link/i)).toHaveCount(0);
  // Test mode swaps the passkey button for the test-user link.
  await expect(page.getByRole("link", { name: /Sign in as the test user/ })).toBeVisible();
});

test("the old magic-link callback is gone", async ({ request }) => {
  const res = await request.get("/phase1/auth/callback?code=x", { maxRedirects: 0 });
  // Not public any more: signed out, the middleware sends it to the sign-in page.
  expect(res.status()).toBe(307);
  expect(new URL(res.headers()["location"]!, "http://x").pathname).toBe("/phase1/signin");
});

test("the enrol page is public and the passkey API refuses test mode", async ({ page, request }) => {
  await page.goto("/phase1/enrol?token=abc");
  await expect(page.getByRole("heading", { name: "Set up your passkey" })).toBeVisible();
  await expect(page.getByTestId("not-configured")).toBeVisible();
  const res = await request.post("/phase1/api/auth/passkey/login-options");
  expect(res.status()).toBe(503);
});

test.skip("passkey ceremony: invite, enrol, sign out, sign in with the virtual authenticator", async () => {
  // Skipped: needs a real database (passkeys, invites, challenges tables) and PHASE1_RP_ID / PHASE1_ORIGINS
  // for the test host, and test mode keeps no passkey store. To run it by hand against a preview:
  // create an invite with scripts/phase1/invite.ts, open the link in Chromium with a CDP
  // WebAuthn.addVirtualAuthenticator (ctap2, internal, hasResidentKey, hasUserVerification,
  // isUserVerified), click "Create passkey", sign out, then "Sign in with passkey".
});

test("allowlisted user sees the shell with 7 tabs, initials and sign out", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!);
  await page.goto("/phase1");
  const nav = page.getByRole("navigation", { name: "Phase 1" });
  for (const t of ["Plan", "Prospects", "Pipeline", "Emails", "Replies", "Metrics", "Profiles"]) {
    await expect(nav.getByRole("link", { name: t, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("phase1-initials")).toHaveText("T");
  await nav.getByRole("link", { name: "Prospects" }).click();
  await expect(page).toHaveURL(/\/phase1\/prospects$/);
  await expect(page.getByRole("heading", { name: "Prospects" })).toBeVisible();
  // No horizontal overflow at phone width.
  await page.setViewportSize({ width: 375, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the API accepts the signed-in user", async ({ context, baseURL }) => {
  await signInAs(context, baseURL!);
  // An allowlisted session passes the middleware: a missing route is a 404, not 401/403.
  const res = await context.request.get("/phase1/api/anything");
  expect(res.status()).toBe(404);
});

test("non-allowlisted session: Not invited, signed out", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "stranger@example.com");
  await page.goto("/phase1");
  await expect(page).toHaveURL(/\/phase1\/signin\?error=not_invited/);
  await expect(page.getByTestId("signin-error")).toContainText("Not invited");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "phase1-test-user")).toBeUndefined();
  const api = await context.request.get("/phase1/api/anything");
  expect(api.status()).toBe(401);
});

test("non-allowlisted API call gets 403", async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, "stranger@example.com");
  const res = await context.request.get("/phase1/api/anything");
  expect(res.status()).toBe(403);
});

test("test sign-in then sign out", async ({ page }) => {
  await page.goto("/phase1/signin");
  await page.getByRole("link", { name: /Sign in as the test user/ }).click();
  await expect(page).toHaveURL(/\/phase1$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/phase1\/signin/);
  const res = await page.request.get("/phase1", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
});

test("the rest of the site is untouched by the middleware", async ({ request }) => {
  const res = await request.get("/predictionmarket/how-it-works", { maxRedirects: 0 });
  expect(res.status()).not.toBe(401);
  expect([200, 404]).toContain(res.status());
});
