import { execFile } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const exec = promisify(execFile);

export async function runMcp(executable: string, origin: string, rootPath?: string): Promise<void> {
  const root = rootPath ? realpathSync(rootPath) : null;
  if (root && !statSync(root).isDirectory()) throw new Error("SHARE_MCP_ROOT must be a directory");
  const server = new McpServer({ name: "share", version: "0.1.0" });

  async function cli(args: string[]) {
    try {
      const { stdout } = await exec(process.execPath, [executable, ...args], {
        timeout: 600_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      return { content: [{ type: "text" as const, text: stdout.trim() }] };
    } catch {
      return failure("The Share command failed. Check the input or configured Share server.");
    }
  }

  server.registerTool(
    "share_status",
    {
      description: "Check the configured Share server.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => cli(["status", "--server", origin, "--json"]),
  );

  server.registerTool(
    "share_inspect",
    {
      description: "Read the file manifest of a Share link from the configured Share server.",
      inputSchema: { url: z.url() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ url }) => {
      if (new URL(url).origin !== origin)
        return failure("The URL must use the configured Share server.");
      return cli(["inspect", url, "--server", origin]);
    },
  );

  if (root) {
    server.registerTool(
      "share_publish",
      {
        description:
          "Encrypt and publish local files from SHARE_MCP_ROOT. Returns an expiring link with a decryption key.",
        inputSchema: {
          paths: z.array(z.string().min(1)).min(1).max(40),
          expires: z
            .string()
            .regex(/^\d+[mhd]$/u)
            .default("1d"),
          name: z
            .string()
            .min(1)
            .max(200)
            .refine((value) => !value.startsWith("--"))
            .optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      ({ paths, expires, name }) => {
        let files: string[];
        try {
          files = paths.map((path) => {
            const full = realpathSync(resolve(root, path));
            const fromRoot = relative(root, full);
            if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
              throw new Error("Path outside the share root");
            }
            return full;
          });
        } catch {
          return failure("Each path must exist inside SHARE_MCP_ROOT.");
        }
        return cli([
          "put",
          ...files,
          "--server",
          origin,
          "--expires",
          expires,
          "--json",
          ...(name ? ["--name", name] : []),
        ]);
      },
    );
  }

  await server.connect(new StdioServerTransport());
}

function failure(text: string) {
  return { isError: true, content: [{ type: "text" as const, text }] };
}
