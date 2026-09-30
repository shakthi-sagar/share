import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "SHARE_PUBLIC_");
  const webUrl = new URL(required("SHARE_PUBLIC_WEB_URL", env.SHARE_PUBLIC_WEB_URL));
  const apiUrl = new URL(required("SHARE_PUBLIC_API_URL", env.SHARE_PUBLIC_API_URL));

  return {
    envDir: repositoryRoot,
    envPrefix: "SHARE_PUBLIC_",
    plugins: [react(), securityHeaders(apiUrl.origin), pdfjsAssets()],
    build: {
      // Mermaid layouts, highlight.js, and pdf.js are large, but each loads only when a file needs
      // it; the entry chunk stays small. Warn only about chunks larger than any of those.
      chunkSizeWarningLimit: 1600,
    },
    server: {
      host: webUrl.hostname,
      port: webUrl.port ? Number(webUrl.port) : 5173,
    },
  };
});

/**
 * Emits a Workers Static Assets `_headers` file for the production bundle. The decryption key lives
 * in the page's URL fragment, so any script injection on the page is key theft: the policy allows
 * only this origin's scripts and styles, and network access only to this origin and the API.
 */
function securityHeaders(apiOrigin: string): Plugin {
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    // Inline styles are needed by Mermaid's SVG output and by the page's own CSS inside a
    // sandboxed HTML preview, which inherits this policy. They cannot run script, and every way
    // CSS could send data out (images, fonts, connections) stays restricted below.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    // pdf.js decodes documents in a worker loaded from this origin.
    "worker-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
  const headers = {
    "Content-Security-Policy": csp,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
  return {
    name: "share-security-headers",
    apply: "build",
    generateBundle() {
      const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: `/*\n${lines.join("\n")}\n`,
      });
    },
  };
}

/**
 * Serves the pdf.js character maps and standard fonts at `/pdfjs/`, so PDFs with CJK text or
 * non-embedded fonts render correctly without fetching anything from another origin.
 */
function pdfjsAssets(): Plugin {
  const root = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const folders = ["cmaps", "standard_fonts"];
  return {
    name: "share-pdfjs-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = /^\/pdfjs\/(cmaps|standard_fonts)\/([\w.-]+)$/u.exec(request.url ?? "");
        if (!match?.[1] || !match[2]) return next();
        try {
          response.setHeader("Content-Type", "application/octet-stream");
          response.end(readFileSync(join(root, match[1], match[2])));
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const folder of folders) {
        for (const file of readdirSync(join(root, folder))) {
          this.emitFile({
            type: "asset",
            fileName: `pdfjs/${folder}/${file}`,
            source: readFileSync(join(root, folder, file)),
          });
        }
      }
    },
  };
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing from the root .env file`);
  return value;
}
