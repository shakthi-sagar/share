# Security model

## Trust boundary

The client owns plaintext and the 32-byte master secret. The API receives ciphertext and a read
credential derived separately from the encryption keys, so the API cannot derive a manifest or file
encryption key from what it stores.

The web app is code delivered by the service, so its integrity remains part of the web threat model.
Independent clients — a CLI or an MCP server — use the same documented wire protocol.

## Key schedule

All keys are derived with HKDF-SHA-256 using the UTF-8 salt `share/v1/<share-id>`.

| Purpose | HKDF info |
| --- | --- |
| Manifest AES-256-GCM key | `share/v1/manifest` |
| Read authorization credential | `share/v1/read-authorization` |
| File AES-256-GCM key | `share/v1/file/<opaque-object-id>` |

The read credential is base64url encoded before use. The server stores only the SHA-256 hash of that
encoded credential and requires the credential before returning a manifest or a chunk.

## Ciphertext format

The manifest is a 12-byte random AES-GCM IV followed by ciphertext and its 16-byte tag, with
`share/v1/manifest/<share-id>` as authenticated additional data. The decrypted JSON holds display
names, safe relative paths, MIME types, plaintext sizes, chunk counts, and per-file nonce prefixes.

Each file gets its own derived key and a random eight-byte nonce prefix. A chunk IV is the prefix
followed by the four-byte big-endian chunk index, and chunk authenticated data binds the protocol
version, share ID, object ID, index, and expected plaintext length.

## Rules that must not regress

- The master secret lives in the URL fragment only, never in a path, query, header, log, database,
  or error report.
- Only the SHA-256 hash of the encoded read credential is stored server side.
- All object access passes through API authorization. Object storage stays private.
- Absent, expired, incomplete, and unauthorized shares return indistinguishable not-found responses.
- Relative paths are validated before encryption and before display. New shares refuse paths with
  control or text-direction characters, and the viewer shows any such character in an older share
  as a visible `\u{…}` escape, so a file name cannot display as a different one.
- Pages are served with a strict Content Security Policy, because a script injected into the viewer
  could read the key from the URL fragment.
- The API rate limits share creation and uploads and caps the ciphertext one share can store.
- Manifest and chunk reads stay bounded; no request buffers an entire share.
- Authorization headers, tokens, read credentials, fragments, manifests, and paths are never logged.

## Reporting a vulnerability

Report security issues privately through the repository's security policy rather than in a public
issue.
