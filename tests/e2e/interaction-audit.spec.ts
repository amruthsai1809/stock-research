import { expect, test, type Page } from "@playwright/test";

const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(String(error)));
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page) ?? []).toEqual([]);
});

test("Dip Finder controls all produce visible state changes", async ({ page }) => {
  await page.goto("/?view=dips");
  await expect(page.getByRole("heading", { name: "Dip Finder", exact: true })).toBeVisible();

  for (const label of ["Quality on sale", "Deep corrections", "Cash generators", "All signals"]) {
    const control = page.getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator(".filter-ribbon select").selectOption({ label: "Technology" });
  await expect(page.locator(".filter-ribbon select")).toHaveValue("Technology");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".opportunity-map")).toBeVisible();
  const secondBubble = page.locator(".map-bubble").nth(1);
  await secondBubble.click();
  await expect(secondBubble).toHaveClass(/is-selected/);

  await page.getByRole("button", { name: "Ranked", exact: true }).click();
  const oneMonthSort = page.getByRole("button", { name: /1 month/ });
  await oneMonthSort.click();
  await expect(oneMonthSort.locator("..")).toHaveAttribute("aria-sort", "descending");
  await oneMonthSort.click();
  await expect(oneMonthSort.locator("..")).toHaveAttribute("aria-sort", "ascending");

  const watchButton = page.getByRole("button", { name: /^Add .* to watchlist$/ }).first();
  const watchLabel = await watchButton.getAttribute("aria-label");
  const watchedSymbol = watchLabel?.match(/^Add (.+) to watchlist$/)?.[1];
  expect(watchedSymbol).toBeTruthy();
  await watchButton.click();
  await expect(page.getByRole("button", { name: `Remove ${watchedSymbol} from watchlist` })).toBeVisible();

  await page.locator(".filter-ribbon select").selectOption({ label: "All sectors" });
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator(".table-pagination b")).toContainText("2 /");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".table-pagination b")).toContainText("1 /");
  await expectNoOverflow(page);
});

test("Screener and Valuation controls update outputs, reset, export, and navigate", async ({ page }) => {
  await page.goto("/?view=screener");
  await expect(page.getByRole("heading", { name: /Build a better shortlist/i })).toBeVisible();
  const qualitySlider = page.locator(".range-field input[type='range']").first();
  await qualitySlider.fill("80");
  await expect(qualitySlider).toHaveValue("80");
  await page.getByLabel("52W drawdown").selectOption("-30");
  await page.getByLabel("Sector").selectOption({ label: "Technology" });
  const positiveFcf = page.locator(".toggle-field input[type='checkbox']");
  await positiveFcf.uncheck();
  await expect(positiveFcf).not.toBeChecked();

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export CSV/ }).click(),
  ]);
  expect(csv.suggestedFilename()).toBe("equity-lab-screen.csv");

  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(qualitySlider).toHaveValue("50");
  await expect(page.getByLabel("52W drawdown")).toHaveValue("0");
  await expect(page.getByLabel("Sector")).toHaveValue("All sectors");
  await expect(positiveFcf).toBeChecked();

  await page.goto("/?view=valuation&symbol=AAPL");
  await expect(page.getByRole("heading", { name: /Make expectations visible/i })).toBeVisible();
  const modelValue = page.getByText("Model value", { exact: true }).locator("..");
  const initialModel = await modelValue.textContent();
  await page.getByLabel("Five-year FCF growth exact value").fill("20");
  await expect(modelValue).not.toHaveText(initialModel ?? "");
  const buyBelow = page.getByText("Buy-below price", { exact: true }).locator("..");
  const initialBuyBelow = await buyBelow.textContent();
  await page.getByLabel("Margin of safety exact value").fill("40");
  await expect(buyBelow).not.toHaveText(initialBuyBelow ?? "");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Five-year FCF growth exact value")).toHaveValue("8");
  await expect(page.getByLabel("Margin of safety exact value")).toHaveValue("20");
  await expectNoOverflow(page);

  await page.getByRole("button", { name: /Review AAPL fundamentals/ }).click();
  await expect(page.getByRole("heading", { name: /Apple/i }).first()).toBeVisible();
});

test("Stock Intelligence controls stay responsive with the complete universe", async ({ page }) => {
  await page.goto("/?view=signals");
  await expect(page.getByRole("heading", { name: /A score you can interrogate/i })).toBeVisible();

  for (const label of ["Compounder", "Value", "Trend", "Dip hunter", "Balanced"]) {
    const control = page.locator(".strategy-tabs").getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  for (const label of ["opportunity", "confidence", "ranked"]) {
    const control = page.locator(".ranking-toolbar").getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }

  const rankingRows = page.locator(".ranking-list > button");
  await expect(rankingRows).toHaveCount(100);
  await page.locator(".intelligence-ranking > .incremental-load").click();
  await expect(rankingRows).toHaveCount(200);

  const search = page.locator(".ranking-toolbar input");
  await search.fill("duoli");
  await expect(rankingRows).toHaveCount(1);
  await rankingRows.first().click();
  await expect(page.locator(".score-spotlight")).toContainText("DUOL");
  await search.fill("");

  await page.getByRole("button", { name: "Generate with my AI key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close AI setup", exact: true })).toBeVisible();
  for (const provider of ["anthropic", "gemini", "openai"]) {
    const control = page.locator(".provider-tabs").getByRole("button", { name: provider, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await expect(page.getByRole("button", { name: "Generate research memo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use local explanation", exact: true }).click();

  const [evidence] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export evidence/ }).click(),
  ]);
  expect(evidence.suggestedFilename()).toMatch(/-research-evidence\.json$/);
  await expectNoOverflow(page);
});

test("Filings, 13F, and public-disclosure controls use bounded lists and visible filters", async ({ page }) => {
  await page.goto("/?view=filings");
  await expect(page.getByRole("heading", { name: /The filing is the source of truth/i })).toBeVisible();
  await expect(page.locator(".filing-list article")).toHaveCount(100);
  await page.locator(".filing-feed > .incremental-load").click();
  await expect(page.locator(".filing-list article")).toHaveCount(200);

  await page.goto("/?view=institutional");
  await expect(page.getByRole("heading", { name: /Trace conviction/i })).toBeVisible();
  for (const label of ["new", "increased", "reduced", "exited", "all"]) {
    const control = page.locator(".filter-tabs").getByRole("button", { name: label, exact: true }).first();
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await page.getByRole("button", { name: /AAPL.*inspect history/i }).click();
  await expect(page.locator(".position-inspector")).toContainText("AAPL");
  for (const label of ["Weight", "Shares"]) {
    const control = page.getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await page.getByRole("button", { name: "Browse all managers", exact: true }).click();
  await expect(page.locator(".intel-directory__drawer")).toBeVisible();
  await page.getByRole("button", { name: /Closed \/ historical/ }).click();
  await expect(page.getByRole("button", { name: /Scion Asset Management/ })).toBeVisible();
  await page.getByRole("button", { name: "Close directory", exact: true }).click();

  await page.goto("/?view=government");
  await expect(page.getByRole("heading", { name: /Follow the filing/i })).toBeVisible();
  for (const label of ["Most consistent", "Largest activity", "Most active", "Latest disclosure", "Top 1Y return"]) {
    const control = page.getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  for (const label of ["House", "Senate", "Executive", "All branches"]) {
    const control = page.getByRole("button", { name: label, exact: true }).first();
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await page.getByRole("button", { name: "Show 20 more", exact: false }).click();
  await expect(page.getByRole("button", { name: "Show 20 more", exact: false })).toContainText("40 of");

  await page.getByRole("button", { name: "Browse all officials", exact: true }).click();
  await expect(page.locator(".intel-directory__drawer")).toBeVisible();
  for (const label of ["recent", "all", "archive", /Current \(/]) {
    const control = page.locator(".intel-directory__drawer .filter-tabs").first().getByRole("button", { name: label, exact: typeof label === "string" });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await page.getByRole("button", { name: "Close directory", exact: true }).click();

  for (const label of ["purchase", "sale", "exchange", "other", "all"]) {
    const control = page.locator(".public-activity-ledger").getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  for (const label of ["1Y", "3Y", "5Y", "ALL"]) {
    const control = page.locator(".public-activity-ledger").getByRole("button", { name: label, exact: true });
    await control.click();
    await expect(control).toHaveClass(/is-active/);
  }
  await expectNoOverflow(page);
});

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}
