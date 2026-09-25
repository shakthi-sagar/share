export const API_BASE_URL = required("SHARE_PUBLIC_API_URL", import.meta.env.SHARE_PUBLIC_API_URL);
export const SHARE_BASE_URL = required(
  "SHARE_PUBLIC_WEB_URL",
  import.meta.env.SHARE_PUBLIC_WEB_URL,
);
export const DEFAULT_EXPIRY_SECONDS = parseExpiry(
  import.meta.env.SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS,
);

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing from the root .env file`);
  return value.replace(/\/$/u, "");
}

function parseExpiry(value: string | undefined): number {
  const parsed = Number(value);
  if (![3600, 86400, 604800, 2592000].includes(parsed)) {
    throw new Error("SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS is invalid");
  }
  return parsed;
}
