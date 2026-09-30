# Encrypted share protocol

## Security boundary

The client owns plaintext and the 32-byte master secret. The API receives only ciphertext
and a read credential derived separately from the encryption keys. The API cannot derive a
manifest or file encryption key from the read credential.

The hosted web client is code delivered by the service, so its integrity remains part of the
web threat model. CLI, MCP and independently built clients use the same wire protocol.

## Key schedule

All keys are derived with HKDF-SHA-256. The salt is UTF-8 `share/v1/<share-id>`.

| Purpose | HKDF info |
| --- | --- |
| Manifest AES-256-GCM key | `share/v1/manifest` |
| Read authorization credential | `share/v1/read-authorization` |
| File AES-256-GCM key | `share/v1/file/<opaque-object-id>` |

The read credential is base64url encoded before use. The server stores only SHA-256 of that
encoded credential.

## Manifest

The manifest envelope is a 12-byte random AES-GCM IV followed by ciphertext and its 16-byte
authentication tag. Its authenticated additional data is `share/v1/manifest/<share-id>`.

The decrypted JSON contains display names, safe relative paths, MIME types, plaintext sizes,
chunk counts and per-file nonce prefixes.

## File chunks

Each file has an independent derived AES key and random eight-byte nonce prefix. A chunk IV is:

```text
8-byte file nonce prefix || 4-byte big-endian chunk index
```

Chunk authenticated data binds protocol version, share ID, object ID, index and expected
plaintext length. Chunks are independently authenticated and can be retrieved lazily.


## Paths and names

Manifest paths are parsed with `isSafeRelativePath`: relative, `/`-separated, at most 1024
characters, with no empty, `.`, or `..` segment, no backslash, and no NUL. Clients publishing a new
share must also satisfy `isPublishablePath`, which additionally refuses C0 and C1 control
characters, DEL, and Unicode bidirectional formatting marks, so a name cannot render as a different
one. The parser keeps the looser rule so shares published earlier remain readable; clients display
paths and share names through `displayPath`, which renders those characters as `\u{XXXX}` escapes.

## Size limits

| Limit | Value | Enforced by |
| --- | --- | --- |
| Encrypted manifest | 1 MiB | Client before upload, API on upload |
| Encrypted chunk | 4 MiB + 16-byte tag | API on upload |
| Files per manifest | 10,000 | Client, manifest schema |
| Chunks per share | 1,000,000 | Client before upload, API reservation |
| Ciphertext per share | `SHARE_PUBLIC_MAX_SHARE_BYTES` | Client before upload, API reservation |

The client plans the manifest, including object ids and nonce prefixes, before its first request, so
it knows the exact encrypted size of the share up front. The API counts each accepted upload body
against the share in the same database statement that checks the limit. Completion totals reported
by the client may not exceed what the API accepted.
