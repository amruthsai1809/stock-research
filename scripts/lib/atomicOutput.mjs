import { access, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createStagedDirectory(targetDirectory) {
  const parent = path.dirname(targetDirectory);
  await mkdir(parent, { recursive: true });
  return mkdtemp(path.join(parent, `.${path.basename(targetDirectory)}-staged-`));
}

export async function replaceDirectory(stagedDirectory, targetDirectory) {
  const backupDirectory = path.join(path.dirname(targetDirectory), `.${path.basename(targetDirectory)}-backup-${process.pid}-${Date.now()}`);
  const targetExists = await exists(targetDirectory);
  let backupCreated = false;
  try {
    if (targetExists) {
      await rename(targetDirectory, backupDirectory);
      backupCreated = true;
    }
    await rename(stagedDirectory, targetDirectory);
  } catch (error) {
    if (backupCreated && !await exists(targetDirectory)) await rename(backupDirectory, targetDirectory);
    throw error;
  }
  if (backupCreated) await rm(backupDirectory, { recursive: true, force: true }).catch((error) => {
    process.stderr.write(`Snapshot committed but backup cleanup failed: ${error.message}\n`);
  });
}

export async function writeJsonAtomic(targetFile, value, { pretty = false } = {}) {
  await mkdir(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryFile, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`, "utf8");
    await rename(temporaryFile, targetFile);
  } finally {
    await rm(temporaryFile, { force: true }).catch(() => {});
  }
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}
