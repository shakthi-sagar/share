# Security policy

## Reporting a vulnerability

Do not publish exploitable details in a public issue. Use GitHub's private vulnerability reporting
for this repository when available. If that option is unavailable, contact the repository owner
through the [shakthi-sagar GitHub profile](https://github.com/shakthi-sagar) to arrange a private
report.

Include the affected version, reproduction steps, expected impact, and whether the issue may expose
plaintext, keys, credentials, object existence, or deletion capability. Do not include real user
files or active share URLs.

## Security scope

High-impact areas include:

- client-side key generation and derivation
- AES-GCM nonce and authenticated-data construction
- manifest validation and safe relative paths
- upload, read, and delete authorization
- expiry and lifecycle enforcement
- ciphertext size limits
- R2 privacy and object-key construction
- accidental logging or browser-bundle exposure
- hosted client integrity
- local workspace isolation and unintended network transmission

Local workspaces are stored as plaintext metadata and blobs in browser IndexedDB. They are protected
by the browser profile and operating system, not by the encrypted-share protocol. No workspace data
should leave the browser until the user explicitly starts publishing a snapshot.

The protocol and current trust boundary are documented in [docs/protocol.md](docs/protocol.md) and
[docs/architecture.md](docs/architecture.md).

## Supported version

Security fixes target the current `main` branch until tagged releases are introduced.
