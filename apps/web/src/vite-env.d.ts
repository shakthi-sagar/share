/// <reference types="vite/client" />

import "react";

interface ImportMetaEnv {
  readonly SHARE_PUBLIC_API_URL: string;
  readonly SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS: string;
  readonly SHARE_PUBLIC_WEB_URL: string;
}

// biome-ignore lint/correctness/noUnusedVariables: augments Vite's global import.meta.env type.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
  }
}
