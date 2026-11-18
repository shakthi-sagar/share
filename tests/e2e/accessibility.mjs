/** Automated WCAG 2.1 AA smoke audit. Not a replacement for a manual screen-reader review. */

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const base = process.env.SHARE_E2E_BASE_URL ?? "http://localhost:5173";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SHARE_E2E_CHROME_PATH
    ? { executablePath: process.env.SHARE_E2E_CHROME_PATH }
    : {}),
});
const cases = [
  { name: "home desktop", path: "/", width: 1440 },
  { name: "docs desktop", path: "/docs/previews", width: 1440 },
  { name: "home mobile", path: "/", width: 390 },
  { name: "docs mobile", path: "/docs/cli", width: 390 },
];
let failure = false;
try {
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: item.width, height: 850 } });
    const page = await context.newPage();
    try {
      await page.goto(new URL(item.path, base).href, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact),
      );
      console.log(
        `${item.name}: ${serious.length} serious/critical failures; ${results.violations.length} total findings`,
      );
      if (serious.length) {
        for (const item of serious)
          console.error(
            `  ${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(", ")}`,
          );
        failure = true;
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failure) process.exitCode = 1;
