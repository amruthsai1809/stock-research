import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const priceChartUrl = new URL("../src/components/charts/InteractivePriceChart.tsx", import.meta.url);
const comparisonChartUrl = new URL("../src/components/charts/ComparisonChart.tsx", import.meta.url);
const financialAtlasUrl = new URL("../src/components/charts/FinancialAtlas.tsx", import.meta.url);

test("long daily histories may compress enough to render the entire five-year range", async () => {
  for (const url of [priceChartUrl, comparisonChartUrl]) {
    const source = await readFile(url, "utf8");
    assert.match(source, /minBarSpacing:\s*0\.1/);
    assert.match(source, /data-rendered-start/);
    assert.match(source, /Full selected history/);
  }
});

test("financial atlas exposes visual plots with metric and fiscal-year interactions", async () => {
  const source = await readFile(financialAtlasUrl, "utf8");
  assert.match(source, /AnnualTrendPlot/);
  assert.match(source, /annual-trend-plot__crosshair/);
  assert.match(source, /onPointerEnter/);
  assert.match(source, /Interactive financial atlas/);
});
