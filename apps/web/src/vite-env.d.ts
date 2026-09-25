/// <reference types="vite/client" />

import "react";

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
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
