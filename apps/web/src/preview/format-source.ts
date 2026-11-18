import { extensionOf } from "./kinds";

export type FormattingLanguage =
  | "babel"
  | "typescript"
  | "json"
  | "html"
  | "css"
  | "markdown"
  | "yaml";

const parsers: Record<string, FormattingLanguage> = {
  js: "babel",
  jsx: "babel",
  mjs: "babel",
  cjs: "babel",
  json5: "json",
  json: "json",
  geojson: "json",
  ipynb: "json",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  html: "html",
  htm: "html",
  svg: "html",
  vue: "html",
  css: "css",
  scss: "css",
  less: "css",
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  yaml: "yaml",
  yml: "yaml",
};

export const MAX_FORMAT_CHARACTERS = 500_000;

export function formatterFor(path: string): FormattingLanguage | null {
  return parsers[extensionOf(path)] ?? null;
}

/** Formatting is display-only. No formatted bytes are written back to shared files. */
export async function formatSource(text: string, path: string): Promise<string> {
  const parser = formatterFor(path);
  if (!parser) throw new Error("Formatting is not supported for this file type.");
  if (text.length > MAX_FORMAT_CHARACTERS)
    throw new Error("This file is too large to format safely.");
  const prettier = await import("prettier/standalone");
  const plugins =
    parser === "json" || parser === "babel"
      ? [
          (await import("prettier/plugins/babel")).default,
          (await import("prettier/plugins/estree")).default,
        ]
      : parser === "typescript"
        ? [
            (await import("prettier/plugins/typescript")).default,
            (await import("prettier/plugins/estree")).default,
          ]
        : parser === "html"
          ? [(await import("prettier/plugins/html")).default]
          : parser === "css"
            ? [(await import("prettier/plugins/postcss")).default]
            : parser === "markdown"
              ? [(await import("prettier/plugins/markdown")).default]
              : [(await import("prettier/plugins/yaml")).default];
  return prettier.format(text, {
    parser,
    plugins,
    printWidth: 100,
    tabWidth: 2,
    singleQuote: true,
  });
}
