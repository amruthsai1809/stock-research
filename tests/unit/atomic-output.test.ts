import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStagedDirectory, replaceDirectory, writeJsonAtomic } from "../../scripts/lib/atomicOutput.mjs";

const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true }))); });

describe("atomic snapshot output", () => {
  it("replaces a complete directory only after staging succeeds", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "equity-lab-atomic-test-")); cleanup.push(root);
    const target = path.join(root, "snapshot"); await mkdir(target); await writeFile(path.join(target, "old.json"), "old");
    const staged = await createStagedDirectory(target); await writeFile(path.join(staged, "new.json"), "new");
    await replaceDirectory(staged, target);
    await expect(readFile(path.join(target, "new.json"), "utf8")).resolves.toBe("new");
    await expect(readFile(path.join(target, "old.json"), "utf8")).rejects.toThrow();
  });

  it("writes valid JSON without leaving temporary output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "equity-lab-json-test-")); cleanup.push(root);
    const target = path.join(root, "value.json");
    await writeJsonAtomic(target, { ok: true });
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({ ok: true });
  });
});
