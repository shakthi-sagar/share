/** Real-browser E2E: creates its own encrypted share and revokes it in finally.
 * Set SHARE_E2E_BASE_URL to a running Share instance; no production access required.
 * Neither the share link nor the decryption key is printed. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "@playwright/test";

const base = process.env.SHARE_E2E_BASE_URL ?? "http://localhost:5173";
const api = process.env.SHARE_E2E_API_URL ?? new URL(base).origin;
const cli = new URL("../../packages/cli/dist/cli.mjs", import.meta.url).pathname;
const temp = mkdtempSync(join(tmpdir(), "share-e2e-"));
const fixture = join(temp, "artifacts");
mkdirSync(fixture);
// Tiny valid PNG plus a linked HTML bundle; the script must never run in a file preview.
writeFileSync(
  join(fixture, "chamber.png"),
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Yma8YQAAAAASUVORK5CYII=",
    "base64",
  ),
);
writeFileSync(
  join(fixture, "index.html"),
  '<!doctype html><html><body><h1>Chamber review</h1><a href="chamber.png"><img src="chamber.png" alt="chamber"></a><script>window.parent.__shareUnsafe = true</script></body></html>',
);
writeFileSync(join(fixture, "notes.md"), "# Security review\n\nBrowser E2E test fixture.");
const platforms = process.env.SHARE_E2E_BROWSERS?.split(",") ?? ["chromium"];
let created;
let success = false;
try {
  const stdout = execFileSync(
    process.execPath,
    [cli, "put", fixture, "--server", api, "--name", "Automated test", "--expires", "1h", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  created = JSON.parse(stdout);
  const realUrl = new URL(created.url);
  const sharePath = realUrl.pathname;
  const key = realUrl.hash.slice(3);
  // Local Vite dev serves the webpage on a different origin than the Worker API.
  const url = new URL(sharePath, base);
  url.hash = `k=${key}`;
  for (const platform of platforms) {
    const browserType = { chromium, "chromium-mobile": chromium, firefox, webkit }[platform];
    if (!browserType) throw new Error(`Unknown browser: ${platform}`);
    const overridePath =
      platform === "chromium" || platform === "chromium-mobile"
        ? process.env.SHARE_E2E_CHROME_PATH
        : platform === "firefox"
          ? process.env.SHARE_E2E_FIREFOX_PATH
          : process.env.SHARE_E2E_WEBKIT_PATH;
    const browser = await browserType.launch({
      headless: true,
      ...(overridePath ? { executablePath: overridePath } : {}),
    });
    try {
      const context = await browser.newContext({
        viewport: {
          width: platform === "webkit" || platform === "chromium-mobile" ? 390 : 1300,
          height: 850,
        },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      await page.locator(".viewer-page").waitFor({ timeout: 25000 });
      assert.equal(new URL(page.url()).hash, "", "key must be removed from the address bar");
      if (platform === "chromium") {
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const violations = audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact),
        );
        for (const issue of violations)
          console.error(
            `viewer accessibility: ${issue.id}: ${issue.nodes.map((n) => n.target.join(" ")).join(", ")}`,
          );
        assert.equal(violations.length, 0, "published viewer must have no serious axe failures");
      }
      assert.equal(
        await page.evaluate((id) => sessionStorage.getItem(`share:tab-key:v1:${id}`), created.id),
        key,
      );
      assert.equal(
        await page.evaluate((id) => localStorage.getItem(`share:tab-key:v1:${id}`), created.id),
        null,
      );
      await page.reload();
      await page.locator(".viewer-page").waitFor({ timeout: 25000 });
      assert.equal(new URL(page.url()).hash, "", "refresh must not restore the secret to the URL");
      // The source HTML is inert, and navigating a relative image opens a real file in the viewer.
      if (platform === "webkit" || platform === "chromium-mobile") {
        await page.getByRole("button", { name: "Files" }).first().click();
      }
      const htmlEntry = page.locator(".tree-file").filter({ hasText: "index.html" }).first();
      await htmlEntry.click();
      const iframe = page.locator(".html-view iframe");
      await iframe.waitFor({ timeout: 20000 });
      const sandbox = await iframe.getAttribute("sandbox");
      assert.equal(sandbox?.includes("allow-scripts"), false, "HTML must never execute scripts");
      const frame = page.frameLocator(".html-view iframe");
      await frame.getByRole("heading", { name: "Chamber review" }).waitFor();
      assert.equal(await page.evaluate(() => window.__shareUnsafe === true), false);
      assert.equal((await frame.locator("img").getAttribute("src"))?.startsWith("blob:"), true);
      await frame.locator("a").first().click();
      await page.locator(".viewer-file-identity").getByText("chamber.png").waitFor();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download chamber.png" }).click();
      const transferred = await download;
      assert.equal(transferred.suggestedFilename(), "chamber.png");
      const expected = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Yma8YQAAAAASUVORK5CYII=",
        "base64",
      );
      const resultPath = await transferred.path();
      assert.equal(
        Buffer.compare(readFileSync(resultPath), expected),
        0,
        "downloaded plaintext must be identical",
      );
      await page.getByRole("button", { name: "Lock tab" }).click();
      await page.getByRole("heading", { name: "Unlock encrypted snapshot" }).waitFor();
      assert.equal(
        await page.evaluate((id) => sessionStorage.getItem(`share:tab-key:v1:${id}`), created.id),
        null,
      );
      await page.reload();
      await page.getByRole("heading", { name: "Unlock encrypted snapshot" }).waitFor();
      assert.deepEqual(errors, []);
      console.log(
        `${platform}: encryption, unlock, refresh, HTML assets, lock, and empty-key reload passed`,
      );
      await context.close();
    } finally {
      await browser.close();
    }
  }
  success = true;
} finally {
  if (created?.id) {
    try {
      execFileSync(process.execPath, [cli, "revoke", created.id, "--server", api], {
        stdio: "pipe",
      });
      const denied = await fetch(`${api}/v1/shares/${created.id}/manifest`);
      assert.equal(denied.status, 404, "revoked share must no longer be readable");
      console.log("revoke: manifest inaccessible after revocation");
    } catch {
      console.error("E2E cleanup: revocation or post-revocation verification failed");
      success = false;
    }
  }
  rmSync(temp, { recursive: true, force: true });
}
if (!success) process.exitCode = 1;
