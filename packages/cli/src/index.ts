import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import {
  createEncryptedShare,
  deleteEncryptedShare,
  type ShareSourceFile,
  unlockEncryptedShare,
} from "@share/client";
import { isPublishablePath } from "@share/protocol";

const DEFAULT_URL = "https://share.shadster.dev";
const HOUR = 3600;
const DAY = 86400;
const MAX_TTL = 7 * DAY;
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  html: "text/html",
  htm: "text/html",
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  ts: "text/typescript",
  tsx: "text/typescript",
  js: "text/javascript",
  css: "text/css",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};
const receiptDir = join(homedir(), ".local", "share", "receipts");

export function parseTTL(raw: string): number {
  const match = /^(\d+)(m|h|d)$/.exec(raw);
  if (!match) throw new Error("Expiry must be like 30m, 1h, 1d, or 7d");
  const seconds =
    Number(match[1]) * ({ m: 60, h: HOUR, d: DAY } as const)[match[2] as "m" | "h" | "d"];
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > MAX_TTL)
    throw new Error("Expiry must be between 1 minute and 7 days");
  return seconds;
}

export function parseShareURL(raw: string): { id: string; key: string } {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("Share URL must use HTTPS");
  const match = /^\/s\/([A-Za-z0-9_-]{22})$/.exec(url.pathname);
  const key = new URLSearchParams(url.hash.slice(1)).get("k");
  if (!match || !key || !/^[A-Za-z0-9_-]{43}$/.test(key))
    throw new Error("Invalid share URL or missing decryption key");
  return { id: match[1]!, key };
}

function option(args: string[], flag: string, fallback?: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1]!.startsWith("--"))
    throw new Error(`${flag} requires a value`);
  return args[index + 1];
}
function positional(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (["--expires", "--name", "--server"].includes(args[i]!)) {
      i++;
      continue;
    }
    if (args[i]!.startsWith("--")) throw new Error(`Unknown flag: ${args[i]}`);
    out.push(args[i]!);
  }
  return out;
}
function baseURL(args: string[]): string {
  const url = new URL(option(args, "--server", process.env.SHARE_SERVER ?? DEFAULT_URL)!);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("Server must use HTTPS");
  return url.origin;
}

function collect(inputs: string[]): ShareSourceFile[] {
  const items: ShareSourceFile[] = [];
  const paths = new Set<string>();
  function visit(full: string, rel: string): void {
    const info = statSync(full);
    if (info.isDirectory()) {
      for (const child of readdirSync(full).sort()) {
        if (child === ".git" || child === "node_modules") continue;
        visit(join(full, child), `${rel}/${child}`);
      }
      return;
    }
    if (!info.isFile()) throw new Error(`Not a regular file: ${full}`);
    const path = rel.replaceAll(sep, "/");
    if (!isPublishablePath(path) || paths.has(path))
      throw new Error(`Invalid or duplicate relative path: ${path}`);
    paths.add(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    items.push({
      path,
      mime: MIME[ext] ?? "application/octet-stream",
      size: info.size,
      stream: () => Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>,
    });
  }
  for (const input of inputs) {
    const full = resolve(input);
    if (!existsSync(full)) throw new Error(`Does not exist: ${input}`);
    const root = realpathSync(full);
    const name = basename(root);
    visit(root, name);
  }
  if (!items.length) throw new Error("No files to share");
  return items;
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || ["help", "--help", "-h"].includes(cmd)) {
    console.log(
      `share — encrypted, expiring file links\n\n  share put <file|folder> [...] [--expires 1d] [--name title] [--server URL]\n  share inspect <share-url> [--server URL]\n  share revoke <share-id> [--server URL]\n\nDefaults: 24h expiry (maximum 7d), https://share.shadster.dev\nUploads encrypt locally; URLs contain the decryption key. Treat links as secrets.\nReceipts for revocation are stored locally in ~/.local/share/receipts/ (mode 0600).`,
    );
    return;
  }
  if (cmd === "put") {
    const inputs = positional(args);
    if (!inputs.length) throw new Error("Provide at least one file or directory");
    const files = collect(inputs);
    const expiresInSeconds = parseTTL(option(args, "--expires", "1d")!);
    const name = option(
      args,
      "--name",
      inputs.length === 1 ? basename(resolve(inputs[0]!)) : "Shared files",
    )!;
    const base = baseURL(args);
    const created = await createEncryptedShare({
      apiBaseUrl: base,
      shareBaseUrl: base,
      name,
      files,
      expiresInSeconds,
      onProgress: (p) => {
        if (p.stage === "uploading")
          process.stderr.write(
            `\rUploaded ${p.path}: ${p.uploadedChunks}/${p.totalChunks} chunks   `,
          );
      },
    });
    mkdirSync(receiptDir, { recursive: true, mode: 0o700 });
    const receipt = join(receiptDir, `${created.id}.json`);
    writeFileSync(
      receipt,
      JSON.stringify(
        {
          id: created.id,
          deleteToken: created.deleteToken,
          server: base,
          expiresAt: created.expiresAt,
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    process.stderr.write("\n");
    console.log(created.urlWithKey);
    console.error(`Expires: ${created.expiresAt}; revoke: share revoke ${created.id}`);
    return;
  }
  if (cmd === "inspect") {
    const [url] = positional(args);
    if (!url) throw new Error("Provide a share URL");
    const { id, key } = parseShareURL(url);
    const shared = await unlockEncryptedShare({ apiBaseUrl: baseURL(args), id, key });
    console.log(
      JSON.stringify(
        {
          name: shared.manifest.name,
          files: shared.manifest.files.map((x) => ({ path: x.path, size: x.size, mime: x.mime })),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (cmd === "revoke") {
    const [id] = positional(args);
    if (!id || !/^[A-Za-z0-9_-]{22}$/.test(id)) throw new Error("Provide a valid share ID");
    const file = join(receiptDir, `${id}.json`);
    if (!existsSync(file)) throw new Error("Local revocation receipt not found");
    const receipt = JSON.parse(readFileSync(file, "utf8")) as {
      deleteToken: string;
      server: string;
    };
    await deleteEncryptedShare(receipt.server, id, receipt.deleteToken);
    console.log(`Revoked ${id}`);
    return;
  }
  throw new Error(`Unknown command: ${cmd}`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
