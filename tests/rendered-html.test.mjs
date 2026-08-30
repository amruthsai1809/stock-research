import assert from "node:assert/strict";
import test from "node:test";

async function render(url = "http://localhost/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(url, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Equity Lab application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Equity Lab<\/title>/i);
  assert.match(html, /property="og:title" content="Equity Lab"/i);
  assert.match(html, /https:\/\/el\.amruthg\.com/i);
  assert.match(html, /Preparing the research desk/);
  assert.match(html, /Loading the compact market index and SEC-derived fundamentals/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("permanently redirects the legacy hostname to the canonical domain", async () => {
  const response = await render("https://equitylab.amruthg.com/?view=company&symbol=DUOL");
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://el.amruthg.com/?view=company&symbol=DUOL");
});
