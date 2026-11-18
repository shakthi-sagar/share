import { chmod, copyFile, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bin = resolve(process.env.SHARE_CLI_BIN_DIR ?? join(homedir(), ".local", "bin"));
const target = join(bin, "share");
await mkdir(bin, { recursive: true });
const scratch = await mkdtemp(join(bin, ".share-install-"));
try {
  const staging = join(scratch, "share");
  await copyFile(fileURLToPath(new URL("../packages/cli/dist/cli.mjs", import.meta.url)), staging);
  await chmod(staging, 0o755);
  await rename(staging, target);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
console.log(`Installed ${target}`);
