import { test, expect } from "@playwright/test";
import { PM, VIEWPORTS, expectNoHorizontalOverflow } from "./helpers";

const CALENDLY = "https://calendly.com/dayyan-sheikh-arepolabs/30min";

test("/ returns 200 with the headline and one Calendly link in the hero and one at the end", async ({
  page,
}) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Small software fixes for busy local businesses.");
  await expect(page.getByTestId("hero").locator(`a[href="${CALENDLY}"]`)).toHaveCount(1);
  await expect(page.getByTestId("final").locator(`a[href="${CALENDLY}"]`)).toHaveCount(1);
  await expect(page.locator(`main a[href="${CALENDLY}"]`)).toHaveCount(2);
  await expect(page.locator(`a[href="${PM}"]`).first()).toBeAttached();
});

for (const vp of VIEWPORTS.filter((v) => [320, 375, 768, 1280].includes(v.width))) {
  test(`no horizontal overflow @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await expectNoHorizontalOverflow(page, `/@${vp.name}`);
  });
}

test("robots.txt disallows /phase1", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Disallow: /phase1");
});

test("sitemap.xml lists / and /predictionmarket", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  expect(body).toContain("https://www.arepolabs.com/</loc>");
  expect(body).toContain(`https://www.arepolabs.com${PM}</loc>`);
});
