/**
 * Accepts either a bare key or a pasted full share link and returns the key. Only the `k` fragment
 * parameter is read; the rest of a pasted link is ignored.
 */
export function keyFromInput(value: string): string {
  const trimmed = value.trim();
  const fragment = /[#&]k=([A-Za-z0-9_-]+)/u.exec(trimmed);
  return fragment?.[1] ?? trimmed;
}
