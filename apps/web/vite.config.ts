import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "SHARE_PUBLIC_");
  const webUrl = new URL(required("SHARE_PUBLIC_WEB_URL", env.SHARE_PUBLIC_WEB_URL));

  return {
    envDir: repositoryRoot,
    envPrefix: "SHARE_PUBLIC_",
    plugins: [react()],
    server: {
      host: webUrl.hostname,
      port: webUrl.port ? Number(webUrl.port) : 5173,
    },
  };
});

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing from the root .env file`);
  return value;
}
