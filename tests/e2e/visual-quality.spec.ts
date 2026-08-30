import { expect, test, type Locator, type Page } from "@playwright/test";

const routes: Array<{ button: RegExp; heading: RegExp; slug: string }> = [
  { button: /Discover/, heading: /Today's market, explained/i, slug: "discover" },
  { button: /Dip Finder/, heading: /^Dip Finder$/, slug: "dip-finder" },
  { button: /Screener/, heading: /Build a better shortlist/i, slug: "screener" },
  { button: /Compare/, heading: /Compare the business and the price/i, slug: "compare" },
  { button: /Valuation Lab/, heading: /Make expectations visible/i, slug: "valuation" },
  { button: /Company filings/, heading: /The filing is the source of truth/i, slug: "filings" },
  { button: /Stock Intelligence/, heading: /A score you can interrogate/i, slug: "intelligence" },
  { button: /My Portfolio/, heading: /Your history/i, slug: "portfolio" },
  { button: /13F Explorer/, heading: /Trace conviction/i, slug: "institutional" },
  { button: /Public officials/, heading: /Follow the filing/i, slug: "public-officials" },
];

test("every desktop surface is visually bounded and stable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await installLayoutShiftObserver(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Today's market, explained/i })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });

  for (const route of routes) {
    await navigation.getByRole("button", { name: route.button }).click();
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    await captureIfRequested(page.locator("main.content"), `${route.slug}-desktop.png`);
  }

  const cumulativeShift = await page.evaluate(() => (window as Window & { __visualLayoutShift?: number }).__visualLayoutShift ?? 0);
  expect(cumulativeShift).toBeLessThan(0.2);
  expect(errors).toEqual([]);
});

test("mobile navigation, search, and charts remain usable without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Today's market, explained/i })).toBeVisible();
  await expectNoDocumentOverflow(page);

  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  for (const [label, heading] of [
    [/Dips/, /^Dip Finder$/],
    [/Screen/, /Build a better shortlist/i],
    [/Compare/, /Compare the business and the price/i],
    [/Scores/, /A score you can interrogate/i],
    [/Officials/, /Follow the filing/i],
  ] as const) {
    const button = mobile.getByRole("button", { name: label });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
  }

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "Search companies" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  if (process.env.VISUAL_EVIDENCE === "1") await page.screenshot({ path: "outputs/visual-qa/mobile-search.png", fullPage: false });
});

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

async function installLayoutShiftObserver(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __visualLayoutShift?: number }).__visualLayoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) (window as Window & { __visualLayoutShift?: number }).__visualLayoutShift! += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

// A small opt-in helper keeps CI fast while allowing local runs to retain a
// visual evidence pack for every route.
async function captureIfRequested(locator: Locator, name: string) {
  if (process.env.VISUAL_EVIDENCE === "1") await locator.screenshot({ path: `outputs/visual-qa/${name}` });
}
