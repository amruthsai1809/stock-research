import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSET_DIRECTORY = path.join(ROOT, "dist", "client", "assets");
const MAX_ASSET_BYTES = 460 * 1024;

const files = (await readdir(ASSET_DIRECTORY)).filter((file) => /\.(?:js|mjs)$/.test(file));
if (!files.length) throw new Error("No built client JavaScript assets were found. Run the production build first.");
const assets = await Promise.all(files.map(async (file) => ({ file, bytes: (await stat(path.join(ASSET_DIRECTORY, file))).size })));
const oversized = assets.filter((asset) => asset.bytes > MAX_ASSET_BYTES).sort((a, b) => b.bytes - a.bytes);
if (oversized.length) {
  const details = oversized.map((asset) => `${asset.file}: ${(asset.bytes / 1024).toFixed(1)} KiB`).join("\n");
  throw new Error(`Client bundle budget exceeded (${MAX_ASSET_BYTES / 1024} KiB per asset):\n${details}`);
}
const largest = assets.sort((a, b) => b.bytes - a.bytes)[0];
process.stdout.write(`Bundle budget passed: largest client asset is ${largest.file} at ${(largest.bytes / 1024).toFixed(1)} KiB.\n`);
