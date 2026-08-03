import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

test("domain code remains framework and infrastructure independent", async () => {
  for (const file of await sourceFiles(path.join(root, "src", "domain"))) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from ["']react|from ["']next|src\/infrastructure|localStorage|window\./, path.relative(root, file));
  }
});

test("views depend on ports, never concrete data adapters", async () => {
  const viewRoots = [path.join(root, "src", "features"), path.join(root, "src", "modules", "stock-intelligence", "presentation")];
  for (const directory of viewRoots) {
    for (const file of await sourceFiles(directory)) {
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(source, /src\/infrastructure|app\/composition/, path.relative(root, file));
    }
  }
});

test("concrete repository construction is isolated to the composition root", async () => {
  const files = await sourceFiles(path.join(root, "src"));
  const constructors = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/new Static(?:Market|Benchmark|Institutional|Government|ResearchSignal)Repository/.test(source)) constructors.push(path.relative(root, file).replaceAll("\\", "/"));
  }
  assert.deepEqual(constructors, ["src/app/composition/services.ts"]);
});
