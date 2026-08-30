import { expect, test, type Locator, type Page } from "@playwright/test";

const routes: Array<{ button: RegExp; heading: RegExp; slug: string }> = [
  { button: /Discover/, heading: /Today's market, explained/i, slug: "discover" },
  { button: /Dip Finder/, heading: /^Dip Finder$/, slug: "dip-finder" },
  { button: /Screener/, heading: /Build a better shortlist/i, slug: "screener" },
  { button: /Compare/, heading: /Compare the business and the price/i, slug: "compare" },
  { button: /Valuation Lab/, heading: /Make expectations visible/i, slug: "valuation" },
  { button: /Options Lab/, heading: /See what price and time actually do/i, slug: "options" },
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
    [/Options/, /See what price and time actually do/i],
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

test("Dip Finder scores stay legible and sidebar support content never collapses", async ({ page }) => {
  await page.goto("/?view=dips");
  await expect(page.getByRole("heading", { name: /^Dip Finder$/ })).toBeVisible();

  const dial = page.locator(".signal-inspector .score-dial");
  const dialStyles = await dial.evaluate((element) => {
    const value = element.querySelector("strong")!;
    const inside = element.querySelector(".score-dial__inside")!;
    return {
      width: element.getBoundingClientRect().width,
      fontSize: Number.parseFloat(getComputedStyle(value).fontSize),
      valueColor: getComputedStyle(value).color,
      backgroundColor: getComputedStyle(inside).backgroundColor,
    };
  });
  expect(dialStyles.width).toBeGreaterThanOrEqual(76);
  expect(dialStyles.width).toBeLessThanOrEqual(80);
  expect(dialStyles.fontSize).toBeGreaterThanOrEqual(20);
  expect(dialStyles.valueColor).not.toBe(dialStyles.backgroundColor);

  const supportCard = page.locator(".sidebar-card");
  const cardDimensions = await supportCard.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    bottom: element.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
    text: element.textContent,
  }));
  expect(cardDimensions.clientHeight).toBeGreaterThan(100);
  expect(cardDimensions.scrollHeight).toBeLessThanOrEqual(cardDimensions.clientHeight + 1);
  expect(cardDimensions.bottom).toBeLessThanOrEqual(cardDimensions.viewportHeight);
  expect(cardDimensions.text).toContain("Portfolio lab");
  expect(cardDimensions.text).toContain("Open private lab");
  await expect(page.locator(".sidebar-footer")).toBeInViewport();
});

test("company picker stays anchored on desktop and becomes a bounded mobile sheet", async ({ page }) => {
  await page.goto("/?view=compare");
  await expect(page.getByRole("heading", { name: /Compare the business and the price/i })).toBeVisible();
  await expect(page.locator(".brand small")).toHaveCount(0);

  const addCompany = page.getByRole("button", { name: "Add company" });
  const triggerBox = await addCompany.boundingBox();
  expect(triggerBox).not.toBeNull();
  await addCompany.click();
  const picker = page.locator(".company-picker");
  await expect(picker).toBeVisible();
  const desktopPickerBox = await picker.boundingBox();
  expect(desktopPickerBox).not.toBeNull();
  expect(desktopPickerBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height - 1);
  expect(desktopPickerBox!.x).toBeGreaterThanOrEqual(0);
  expect(desktopPickerBox!.x + desktopPickerBox!.width).toBeLessThanOrEqual(1440);
  if (process.env.VISUAL_EVIDENCE === "1") await page.screenshot({ path: "outputs/visual-qa/compare-picker-desktop.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileAdd = page.getByRole("button", { name: "Add company" });
  await mobileAdd.scrollIntoViewIfNeeded();
  await mobileAdd.click();
  const mobilePickerBox = await page.locator(".company-picker").boundingBox();
  expect(mobilePickerBox).not.toBeNull();
  expect(mobilePickerBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobilePickerBox!.x + mobilePickerBox!.width).toBeLessThanOrEqual(390);
  expect(mobilePickerBox!.y).toBeGreaterThanOrEqual(0);
  expect(mobilePickerBox!.y + mobilePickerBox!.height).toBeLessThanOrEqual(844);
  await expectNoDocumentOverflow(page);
  if (process.env.VISUAL_EVIDENCE === "1") {
    await page.waitForTimeout(250);
    await page.screenshot({ path: "outputs/visual-qa/compare-picker-mobile.png", fullPage: false });
  }
});

test("all company selectors search partial names, update state, and remain bounded", async ({ page }) => {
  await page.goto("/?view=valuation&symbol=AAPL");
  await expect(page.getByRole("heading", { name: /Make expectations visible/i })).toBeVisible();
  const valuationTrigger = page.getByRole("button", { name: /Valuing: AAPL/ });
  await valuationTrigger.click();
  await page.getByRole("combobox", { name: "Find a company for valuing" }).fill("duol");
  await page.getByRole("option", { name: /DUOL Duolingo/i }).click();
  await expect(page.getByRole("button", { name: /Valuing: DUOL Duolingo/i })).toBeVisible();
  await expect(page.getByText("Latest price", { exact: true }).locator("..")).not.toContainText("$308.91");

  await page.goto("/?view=options&symbol=AAPL");
  const optionTrigger = page.getByRole("button", { name: /Underlying company: AAPL/ });
  await optionTrigger.click();
  await page.getByRole("combobox", { name: "Find a company for underlying company" }).fill("spotify");
  await page.getByRole("option", { name: /SPOT Spotify/i }).click();
  await expect(page.getByRole("button", { name: /Underlying company: SPOT Spotify/i })).toBeVisible();

  await page.goto("/?view=portfolio");
  await page.getByRole("button", { name: "Benchmark: SPY" }).click();
  await page.getByRole("combobox", { name: "Search stock or ETF benchmark" }).fill("micro");
  await page.getByRole("option", { name: /MSFT Microsoft/i }).click();
  await expect(page.getByRole("button", { name: "Benchmark: MSFT" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=valuation&symbol=DUOL");
  const mobileTrigger = page.getByRole("button", { name: /Valuing: DUOL Duolingo/i });
  await expect(mobileTrigger).toBeVisible();
  await mobileTrigger.click();
  const pickerBox = await page.locator(".company-picker").boundingBox();
  expect(pickerBox).not.toBeNull();
  expect(pickerBox!.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox!.x + pickerBox!.width).toBeLessThanOrEqual(390);
  expect(pickerBox!.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(844);
  await expectNoDocumentOverflow(page);
  if (process.env.VISUAL_EVIDENCE === "1") await page.screenshot({ path: "outputs/visual-qa/valuation-picker-mobile.png", fullPage: false });

  await page.getByRole("button", { name: "Close company picker" }).click();
  await page.goto("/?view=options&symbol=SPOT");
  await page.getByRole("button", { name: /Underlying company: SPOT Spotify/i }).click();
  await expectMobilePickerBounds(page);

  await page.getByRole("button", { name: "Close company picker" }).click();
  await page.goto("/?view=portfolio");
  await page.getByRole("button", { name: "Benchmark: SPY" }).click();
  await expectMobilePickerBounds(page);
  if (process.env.VISUAL_EVIDENCE === "1") await page.screenshot({ path: "outputs/visual-qa/portfolio-picker-mobile.png", fullPage: false });
});

async function expectMobilePickerBounds(page: Page) {
  const box = await page.locator(".company-picker").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await expectNoDocumentOverflow(page);
}

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
