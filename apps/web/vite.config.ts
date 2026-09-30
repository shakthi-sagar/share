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
    plugins: [react(), securityHeaders(apiUrl.origin)],
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
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
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

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing from the root .env file`);
  return value;
}
