# share documentation

`share` is an end-to-end encrypted artifact sharing service. You organize files in a workspace
that lives only in this browser, then publish an immutable encrypted snapshot and send a single
link.

## How a share works

1. Files, folder paths, and display names are held in a local workspace in IndexedDB.
2. Pressing `Share snapshot` encrypts the manifest and every file in this browser with AES-256-GCM.
3. The encrypted manifest and encrypted chunks are uploaded to the API.
4. The API stores ciphertext and a SHA-256 hash of a separately derived read credential.
5. You receive a link whose fragment (`#k=…`) holds the master secret. The fragment is never sent to
   the server.

Anyone who has the complete link can decrypt the share. Treat it as a secret.

## What the server can see

The service may know opaque share identifiers, timestamps, counts, sizes, and expiry. It never
receives plaintext content, filenames, folder paths, the master secret, or any key that can derive
an encryption key.

## Revoking a share

A published share stays live until it expires. The browser that published it keeps the delete
credential, so the home page lists it under `Published shares` with a `Revoke` action. Revoking
deletes the encrypted objects and the metadata row, and the link stops working immediately. It
cannot be undone, and the sweep eventually does the same thing on its own for shares that simply
expire.

Revocation depends on that stored credential, so it is only possible from the browser profile that
published the share. Clearing site data or switching browsers means the share can only be ended by
waiting for its expiry. A share that is already gone reports not-found, and the app treats that as
success and forgets the local record.

The server never sees the delete credential, only its SHA-256 hash, and the app never displays,
copies, or logs it.

## Where to go next

- [Using share](/docs/using-share) — workspaces, publishing, and opening a link.
- [Security model](/docs/security) — the trust boundary and the key schedule.
- [Self-hosting](/docs/self-host) — run the API and web app on your own Cloudflare account.
