/**
 * A tab-scoped unlock secret. Unlike localStorage/IndexedDB, sessionStorage is not shared between
 * unrelated tabs and is ordinarily discarded when a tab closes. It survives refreshes and can be
 * restored by some browsers together with a tab after a browser restart; it is NOT a hard TTL.
 * Do not store decrypted files or the master secret in persistent site storage.
 */
const PREFIX = "share:tab-key:v1:";
const SHARE_ID = /^[A-Za-z0-9_-]{22}$/u;
const SECRET = /^[A-Za-z0-9_-]{43}$/u;

export function readTabShareKey(id: string, storage?: Storage): string | null {
  if (!SHARE_ID.test(id)) return null;
  try {
    const candidate = (storage ?? window.sessionStorage).getItem(`${PREFIX}${id}`);
    return candidate && SECRET.test(candidate) ? candidate : null;
  } catch {
    // Storage is blocked in some privacy modes. Unlocking from a URL still works.
    return null;
  }
}

export function rememberTabShareKey(id: string, secret: string, storage?: Storage): void {
  if (!SHARE_ID.test(id) || !SECRET.test(secret)) return;
  try {
    (storage ?? window.sessionStorage).setItem(`${PREFIX}${id}`, secret);
  } catch {
    // Browser can still use the unlocked share until the next refresh.
  }
}

export function forgetTabShareKey(id: string, storage?: Storage): void {
  if (!SHARE_ID.test(id)) return;
  try {
    (storage ?? window.sessionStorage).removeItem(`${PREFIX}${id}`);
  } catch {
    // The browser may have disabled access to storage.
  }
}
