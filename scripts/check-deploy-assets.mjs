import { access, readFile } from "node:fs/promises";
import path from "node:path";

const clientRoot = path.resolve(import.meta.dirname, "..", "dist", "client");
const indexPath = path.join(clientRoot, "data", "market", "index.json");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function deployedPath(relativePath) {
  const normalized = relativePath.replace(/^\.\//, "").replaceAll("/", path.sep);
  const absolute = path.resolve(clientRoot, normalized);
  if (!absolute.startsWith(`${clientRoot}${path.sep}`)) throw new Error(`Unsafe deployed asset path: ${relativePath}`);
  return absolute;
}

async function main() {
  if (!await exists(indexPath)) throw new Error("Production market index is absent from dist/client. Run the production build first.");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  if (!Array.isArray(index.stocks) || index.stocks.length < 2_000) {
    throw new Error(`Deployment blocked: market index contains only ${index.stocks?.length ?? 0} companies.`);
  }

  const missing = [];
  for (const stock of index.stocks) {
    for (const relativePath of [stock.dataPath, stock.recentDataPath]) {
      if (!relativePath || !await exists(deployedPath(relativePath))) missing.push(`${stock.symbol}: ${relativePath || "missing path"}`);
    }
  }
  if (missing.length) {
    const preview = missing.slice(0, 20).join("\n  ");
    throw new Error(`Deployment blocked: ${missing.length} market-history assets are missing.\n  ${preview}${missing.length > 20 ? "\n  …" : ""}`);
  }
  process.stdout.write(`Deployment asset audit passed: ${index.stocks.length} companies and ${index.stocks.length * 2} history files.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
