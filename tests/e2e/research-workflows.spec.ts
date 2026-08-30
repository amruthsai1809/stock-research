import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const pageErrors: string[] = [];
  errorsByPage.set(page, pageErrors);
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Today's market, explained/i })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page) ?? []).toEqual([]);
});

test("ten-year chart controls render the complete available histories", async ({ page }) => {
  await page.getByLabel(/price range/).first().getByRole("button", { name: "10Y" }).click();
  const discoverReadout = page.locator("[data-chart-range='10Y']").first();
  await expect(discoverReadout).toHaveAttribute("data-session-count", /[1-9][0-9]{3}/);
  await expectCompleteRange(discoverReadout);
  const discoverChart = page.locator(".interactive-price-chart").first();
  const discoverPlot = discoverChart.locator(".chart-stage");
  const discoverPlotBox = await discoverPlot.boundingBox();
  expect(discoverPlotBox).not.toBeNull();
  await expect(discoverPlot.locator("canvas").first()).toBeVisible();
  await page.waitForTimeout(300);
  // Locator hover scrolls the canvas fully into view before sending pointer
  // events. Absolute page coordinates become stale when the sticky shell or a
  // late chart resize adjusts the document after boundingBox() resolves.
  await discoverPlot.hover({
    position: {
      x: Math.floor(discoverPlotBox!.width * 0.5),
      y: Math.floor(discoverPlotBox!.height * 0.5),
    },
  });
  await expect(discoverChart.locator(".chart-readout__quote")).toContainText("Pointed session");

  await page.getByRole("button", { name: /Compare/ }).click();
  await expect(page.getByRole("heading", { name: /Compare the business and the price/i })).toBeVisible();
  await expect(page.locator(".compare-company-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Add company" }).click();
  await page.getByRole("combobox", { name: "Find a company to add" }).fill("amazo");
  await page.getByRole("option", { name: /AMZN/ }).click();
  await page.getByRole("button", { name: "Add company" }).click();
  await page.getByRole("combobox", { name: "Find a company to add" }).fill("nvid");
  await page.getByRole("option", { name: /NVDA/ }).click();
  await expect(page.locator(".compare-company-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Move NVDA left" }).click();
  await expect(page.locator(".comparison-table thead th")).toHaveText(["Metric", "AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"]);
  await page.getByRole("button", { name: "Remove AMZN" }).click();
  await expect(page.locator(".compare-company-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Add company" }).click();
  await page.getByRole("combobox", { name: "Find a company to add" }).fill("amazo");
  await page.getByRole("option", { name: /AMZN/ }).click();
  await page.getByRole("button", { name: "Replace GOOGL" }).click();
  await page.getByRole("combobox", { name: "Find a company to replace GOOGL" }).fill("tesla");
  await page.getByRole("option", { name: /TSLA/ }).click();
  await expect(page.locator(".comparison-table thead th")).toHaveText(["Metric", "AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]);
  await expect(page.locator(".comparison-live")).toContainText("AMZN");
  await expect(page.locator(".comparison-live")).toContainText("NVDA");
  await page.getByLabel("Comparison period").getByRole("button", { name: "10Y" }).click();
  const compareReadout = page.locator("[data-chart-range='10Y']").first();
  await expect(compareReadout).toHaveAttribute("data-session-count", /[1-9][0-9]{3}/);
  await expectCompleteRange(compareReadout);
});

test("public-official rankings and inferred positions sort by their selected amounts", async ({ page }) => {
  await page.getByRole("button", { name: /Public officials/ }).click();
  await expect(page.getByRole("heading", { name: "Who has had the strongest disclosed activity?" })).toBeVisible();
  await page.getByRole("button", { name: "Largest activity" }).click();
  await expect(page.locator(".leaderboard-podium-card").first()).toContainText("Nancy Pelosi");

  const amounts = await page.locator(".exposure-grid > button > strong").allTextContents();
  const numericAmounts = amounts.map(parseCompactMoney);
  expect(numericAmounts).toEqual([...numericAmounts].sort((a, b) => b - a));
  await expect(page.locator(".exposure-grid > button").first()).toContainText("AB");

  await expectAccessible(page);
});

test("archive lifecycle, private portfolio import, search, and theme controls remain usable", async ({ page }) => {
  await page.getByRole("button", { name: /13F Explorer/ }).click();
  await expect(page.getByRole("heading", { name: /Trace conviction/i })).toBeVisible();
  await page.getByRole("button", { name: "Browse all managers" }).click();
  await page.getByRole("button", { name: /Closed \/ historical/ }).click();
  await page.getByRole("button", { name: /Scion Asset Management/ }).click();
  await expect(page.getByRole("status")).toContainText("not an active reporting manager");

  await page.getByRole("button", { name: /My Portfolio/ }).click();
  await page.locator("input[type='file']").setInputFiles("tests/fixtures/sample-portfolio.csv");
  await expect(page.getByText("sample-portfolio.csv · CSV", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance, on equal footing" })).toBeVisible();

  await page.keyboard.press("Control+K");
  const searchDialog = page.getByRole("dialog", { name: "Search companies" });
  await expect(searchDialog).toBeVisible();
  await page.getByRole("combobox", { name: "Search by ticker or company name" }).fill("meta plat");
  await searchDialog.getByRole("option", { name: /META/ }).click();
  await expect(page.getByRole("heading", { name: /Meta Platforms/i }).first()).toBeVisible();

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
});

test("every primary research feature loads through the application shell", async ({ page }) => {
  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  const destinations: Array<[RegExp, RegExp]> = [
    [/Dip Finder/, /^Dip Finder$/],
    [/Screener/, /Build a better shortlist/i],
    [/Valuation Lab/, /Make expectations visible/i],
    [/Options Lab/, /See what price and time actually do/i],
    [/Company filings/, /The filing is the source of truth/i],
    [/Stock Intelligence/, /A score you can interrogate/i],
  ];

  for (const [navigationName, headingName] of destinations) {
    await primaryNavigation.getByRole("button", { name: navigationName }).click();
    await expect(page.getByRole("heading", { name: headingName }).first()).toBeVisible();
  }

  await primaryNavigation.getByRole("button", { name: /Discover/ }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page);
});

test("options lab links contract, time, volatility, charts, and worker output", async ({ page }) => {
  await page.goto("/?view=options&symbol=TSLA");
  await expect(page.getByRole("heading", { name: /See what price and time actually do/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Underlying company: TSLA/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /This scenario (makes|loses) money/i })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  if (process.env.VISUAL_EVIDENCE === "1") await page.locator("main.content").screenshot({ path: "outputs/visual-qa/options-desktop.png" });

  const targetInput = page.getByLabel("Stock price on scenario date exact value");
  const strikePrice = Number(await page.getByLabel("Strike price").inputValue());
  await targetInput.fill(String(strikePrice + 20));
  await expect(page.getByText("Recomputing")).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.locator("canvas").filter({ visible: true }).last()).toBeVisible();

  const optionMetric = page.getByText("Option P/L", { exact: true }).locator("..").getByRole("strong");
  const earlyOutcome = await optionMetric.textContent();
  await page.getByRole("button", { name: "Expiration", exact: true }).click();
  await expect(optionMetric).not.toHaveText(earlyOutcome ?? "");

  await page.getByRole("button", { name: /Put Benefits from a fall/i }).click();
  await expect(page.getByRole("button", { name: /Put Benefits from a fall/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("This scenario cannot be modeled yet.")).toHaveCount(0);

  const payoff = page.getByRole("img", { name: /Profit and loss curve/i });
  await expect(payoff).toBeVisible();
  await payoff.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("on selected date", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Model assumptions/i }).click();
  await expect(page.getByLabel("Exercise style")).toBeVisible();
  await expectAccessible(page);

  if (process.env.VISUAL_EVIDENCE === "1") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?view=options&symbol=TSLA");
    await expect(page.getByRole("heading", { name: /See what price and time actually do/i })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "outputs/visual-qa/options-mobile.png", fullPage: false });
  }
});

test("company research controls update every analysis surface without stale content", async ({ page }) => {
  await page.goto("/?view=company&symbol=AAPL");
  await expect(page.getByRole("heading", { name: /Apple/i }).first()).toBeVisible();
  await page.getByRole("button", { name: "10Y", exact: true }).first().click();
  await page.getByRole("button", { name: "Candles", exact: true }).click();
  await expect(page.getByRole("button", { name: "Candles", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const control of ["200D", "Reset", "50D"] as const) await page.getByRole("button", { name: control, exact: true }).first().click();

  await page.getByRole("button", { name: "Ownership & activity" }).click();
  await expect(page.getByRole("heading", { name: "Open-market insider activity" })).toBeVisible();
  for (const window of ["30D", "90D", "1Y"] as const) {
    await page.getByRole("button", { name: window, exact: true }).click();
    await expect(page.getByRole("button", { name: window, exact: true })).toHaveClass(/is-active/);
  }
  await expect(page.getByRole("heading", { name: "Short interest" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Institutional positioning" })).toBeVisible();

  await page.getByRole("button", { name: "Financial charts" }).click();
  const metricButtons = page.locator(".atlas-metric-tabs button");
  for (let index = 0; index < await metricButtons.count(); index += 1) {
    const button = metricButtons.nth(index);
    await button.click();
    await expect(button).toHaveClass(/is-active/);
  }
  for (const mode of ["growth", "margin", "value"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByRole("button", { name: mode, exact: true })).toHaveClass(/is-active/);
  }

  await page.getByRole("button", { name: "quality", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Business quality" })).toBeVisible();
  await page.getByRole("button", { name: "Source lens" }).click();
  const inspectButtons = page.getByRole("button", { name: /Inspect .* lineage/ });
  for (let index = 0; index < await inspectButtons.count(); index += 1) {
    const button = inspectButtons.nth(index);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await button.click();
  }
  await expectAccessible(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=company&symbol=AAPL");
  await page.getByRole("button", { name: "Ownership & activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open-market insider activity" })).toBeVisible();
  const mobileWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(mobileWidth.document).toBeLessThanOrEqual(mobileWidth.viewport + 1);
  if (process.env.VISUAL_EVIDENCE === "1") await page.screenshot({ path: "outputs/visual-qa/company-ownership-mobile.png", fullPage: false });
});

test("Duolingo insider chart, filters, and SEC rows reconcile visibly", async ({ page }) => {
  await page.goto("/?view=company&symbol=DUOL");
  await expect(page.getByRole("heading", { name: /Duolingo/i }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ownership & activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open-market insider activity" })).toBeVisible();
  await page.getByRole("button", { name: "1Y", exact: true }).click();

  await expect(page.getByRole("button", { name: "Purchases 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sales \d+$/ })).toBeVisible();
  await page.getByRole("button", { name: "Purchases 1", exact: true }).click();
  await expect(page.locator(".signal-table tbody")).toContainText("Shelton James H");
  await expect(page.locator(".signal-table tbody")).toContainText("Mar 3, 2026");
  await expect(page.locator(".signal-table tbody")).toContainText("$498.8K");

  await page.getByRole("button", { name: /^All \d+$/ }).click();
  await page.getByRole("button", { name: /March 2026:.*purchases.*sales/i }).click();
  await expect(page.locator(".signal-table tbody")).toContainText("Shelton James H");
  await expect(page.getByText("Showing 1 of 1", { exact: true })).toBeVisible();

  await page.getByText("Why this can differ from Robinhood", { exact: true }).click();
  await expect(page.getByText(/Robinhood’s TipRanks view also classifies Form 4 activity/i)).toBeVisible();
  await expectAccessible(page);
  if (process.env.VISUAL_EVIDENCE === "1") await page.locator(".market-signal-card--wide").first().screenshot({ path: "outputs/visual-qa/duol-insider-reconciled.png" });
});

async function expectCompleteRange(locator: ReturnType<Page["locator"]>) {
  const attributes = await locator.evaluate((element) => ({ start: element.getAttribute("data-range-start"), rendered: element.getAttribute("data-rendered-start") }));
  expect(attributes.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(attributes.rendered).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(attributes.rendered! <= attributes.start!).toBe(true);
  expect(Number(attributes.start!.slice(0, 4))).toBeLessThanOrEqual(2022);
}

async function expectAccessible(page: Page) {
  await expect(page.locator(".view-stack").first()).toHaveCSS("opacity", "1");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const severe = result.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" > ")),
    }));
  expect(severe).toEqual([]);
}

function parseCompactMoney(value: string) {
  const match = value.replace(/[$,]/g, "").match(/^([\d.]+)([KMBT])?$/i);
  if (!match) throw new Error(`Unrecognized compact amount: ${value}`);
  return Number(match[1]) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[2]?.toUpperCase() as "K" | "M" | "B" | "T"] ?? 1);
}
