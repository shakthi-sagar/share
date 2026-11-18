import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const cli = new URL("../dist/cli.mjs", import.meta.url).pathname;
test("CLI help includes expiring upload and revoke commands", () => {
  const output = execFileSync(process.execPath, [cli, "help"], { encoding: "utf8" });
  assert.match(output, /share put/);
  assert.match(output, /share revoke/);
  assert.match(output, /24h expiry/);
});
test("CLI rejects permanent expiry", () => {
  let error;
  try {
    execFileSync(process.execPath, [cli, "put", cli, "--expires", "never"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (e) {
    error = e;
  }
  assert.ok(error);
  assert.match(error.stderr.toString(), /Expiry must be/);
});
