import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser acceptance tests (final runtime acceptance §2, §3, §8). These run the ACTUAL Next app
 * (already-running dev server on :3000, backed by the FastAPI backend on :8000) and assert against
 * real rendered geometry — bounding rectangles, document scrollWidth vs clientWidth — because the
 * pure positioning unit tests passed while the running page still overflowed.
 *
 * Start the servers before running (see docs/FINAL_RUNTIME_ACCEPTANCE.md):
 *   backend:  uvicorn astrolabe.api.app:app --port 8000
 *   frontend: NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
 * or set PW_WEB_SERVER=1 to let Playwright boot the frontend itself.
 */
const BASE_URL = process.env.PW_BASE_URL ?? "http://localhost:3000";

/**
 * The private /phase1 dashboard specs (`e2e/phase1-*.spec.ts`) need no backend: they run against the
 * in-memory store with a cookie session (PHASE1_TEST_MODE=1; refused on production Vercel). They run in
 * their own `phase1` project. With PW_WEB_SERVER=1 the server below gets those variables; add
 * PW_START=1 to use `next start` (after `npm run build`) instead of `next dev`.
 */
const PHASE1_ENV =
  "PHASE1_TEST_MODE=1 PHASE1_TEST_USER=test@example.com PHASE1_ALLOWED_EMAILS=test@example.com";
const PORT = new URL(BASE_URL).port || "3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /phase1-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "phase1",
      testMatch: /phase1-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PW_WEB_SERVER
    ? {
        command: `${PHASE1_ENV} NEXT_PUBLIC_API_BASE=http://localhost:8000 ${
          process.env.PW_START ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`
        }`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
