import type { BrowserContext } from "@playwright/test";

/** Test-mode session cookie (see lib/phase1/allowlist.ts TEST_COOKIE). Test mode only. */
export const TEST_USER = "test@example.com";

export async function signInAs(context: BrowserContext, baseURL: string, email = TEST_USER) {
  await context.addCookies([{ name: "phase1-test-user", value: email, url: baseURL }]);
}
