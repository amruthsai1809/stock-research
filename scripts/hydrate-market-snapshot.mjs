import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { replaceDirectory } from "./lib/atomicOutput.mjs";

const baseUrl = (process.env.MARKET_BASE_URL || "https://el.amruthg.com").replace(/\/+$/, "");
const dataRoot = path.resolve(import.meta.dirname, "..", "public", "data");
const targetDirectory = path.join(dataRoot, "market");
const concurrency = Math.max(1, Math.min(32, Number.parseInt(process.env.MARKET_HYDRATE_CONCURRENCY ?? "16", 10) || 16));

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchBytes(relativePath) {
  const url = new URL(relativePath.replace(/^\.\//, "/"), `${baseUrl}/`);
  if (url.origin !== new URL(baseUrl).origin) throw new Error(`Refused cross-origin snapshot path: ${relativePath}`);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
        throw new Error(`${response.status} ${response.statusText}: ${url}`);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw new Error(`Unable to download ${url}`);
}

function outputPath(stage, relativePath) {
  const normalized = relativePath.replace(/^\.\//, "").replaceAll("/", path.sep);
  const absolute = path.resolve(stage, normalized.replace(/^data[\\/]market[\\/]/, ""));
  if (!absolute.startsWith(`${path.resolve(stage)}${path.sep}`)) throw new Error(`Unsafe snapshot path: ${relativePath}`);
  return absolute;
}

async function main() {
  const indexBytes = await fetchBytes("/data/market/index.json");
  const index = JSON.parse(indexBytes.toString("utf8"));
  if (!Array.isArray(index.stocks) || index.stocks.length < 2_000) {
    throw new Error(`Refused incomplete deployed snapshot: ${index.stocks?.length ?? 0} companies.`);
  }

  await mkdir(dataRoot, { recursive: true });
  const stage = await mkdtemp(path.join(dataRoot, ".market-hydrate-"));
  const files = index.stocks.flatMap((stock) => [
    { symbol: stock.symbol, path: stock.dataPath },
    { symbol: stock.symbol, path: stock.recentDataPath },
  ]);
  let cursor = 0;
  let completed = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      while (cursor < files.length) {
        const entry = files[cursor];
        cursor += 1;
        const bytes = await fetchBytes(entry.path);
        const payload = JSON.parse(bytes.toString("utf8"));
        if (payload.symbol !== entry.symbol) throw new Error(`${entry.symbol} snapshot returned ${payload.symbol ?? "no symbol"}: ${entry.path}`);
        const destination = outputPath(stage, entry.path);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
        completed += 1;
        if (completed % 250 === 0 || completed === files.length) {
          process.stdout.write(`[market hydrate] ${completed}/${files.length} files\n`);
        }
      }
    }));
    await writeFile(path.join(stage, "index.json"), indexBytes);
    await replaceDirectory(stage, targetDirectory);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write(`Hydrated ${index.stocks.length} companies and ${files.length} history files from ${baseUrl}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
