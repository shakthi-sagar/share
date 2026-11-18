/** Package the fully bundled Node CLI without unresolved workspace:* dependencies. */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "packages/cli/dist/cli.mjs");
if (!existsSync(dist)) throw new Error("Build the CLI first: pnpm --filter @share/cli build");
const version = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version;
const folder = join(root, "release/cli");
mkdirSync(folder, { recursive: true });
copyFileSync(dist, join(folder, "cli.mjs"));
copyFileSync(join(root, "LICENSE"), join(folder, "LICENSE"));
writeFileSync(
  join(folder, "package.json"),
  JSON.stringify(
    {
      name: "encrypted-share-cli-bundle",
      version,
      description:
        "Portable end-to-end encrypted Share CLI. Standalone bundled Node.js executable.",
      type: "module",
      bin: { share: "./cli.mjs" },
      engines: { node: ">=22" },
      license: "MIT",
      repository: { type: "git", url: "https://github.com/shakthi-sagar/share.git" },
      files: ["cli.mjs", "README.md", "LICENSE"],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(folder, "README.md"),
  `# Share CLI ${version}\n\nStandalone Node.js 22+ command line client for [Share](https://github.com/shakthi-sagar/share).\n\nInstall the release tarball locally with \`npm install -g ./encrypted-share-cli-bundle-${version}.tgz\`. The release does not require a compiled native executable or Node workspace dependencies.\n\nRun \`share status\` to check connectivity, \`share put ./folder --expires 1d\` to publish, and \`share mcp\` for the optional local stdio agent server. Share links contain a decryption secret; keep them private.\n`,
);
const output = execFileSync(
  "npm",
  ["pack", folder, "--pack-destination", join(root, "release"), "--silent"],
  { encoding: "utf8" },
).trim();
if (!output.endsWith(".tgz")) throw new Error("npm pack did not create a tarball");
console.log(`Packaged standalone CLI at release/${output}`);
