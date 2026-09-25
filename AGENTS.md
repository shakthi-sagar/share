# Agent operating guide

These instructions apply to the entire repository. Read them before changing code.

## Start here

Read the documents relevant to the task:

- [README.md](README.md) for product scope and commands
- [docs/architecture.md](docs/architecture.md) for component and data boundaries
- [docs/protocol.md](docs/protocol.md) before any crypto, manifest, or authorization change
- [docs/development.md](docs/development.md) for the local workflow and verification matrix
- [docs/deployment.md](docs/deployment.md) before changing Cloudflare configuration or deploying
- [docs/design-system.md](docs/design-system.md) for UI tokens, components, states, and review rules
- [docs/design-decisions.md](docs/design-decisions.md) before changing the web interface

## Product contract

`share` is an end-to-end encrypted artifact sharing service. The browser client is functional
product code, not a prototype. The same API and protocol must remain usable by future web, CLI, and
MCP clients.

The server may know operational metadata such as opaque IDs, timestamps, counts, sizes, and expiry.
It must never receive plaintext file content, filenames, folder paths, the master secret, or any key
that can derive an encryption key.

## Security invariants

Treat these as release blockers:

1. Generate or accept the master secret only on the client.
2. Keep the master secret in the URL fragment (`#k=`), never in a path, query, header, log, database,
   analytics event, or error report.
3. Derive manifest, file, and read authorization material independently with the documented HKDF
   schedule.
4. Require the derived read credential before returning the encrypted manifest or file chunks.
5. Store only the SHA-256 hash of the encoded read credential on the server.
6. Use authenticated encryption through Web Crypto. Do not add custom cryptographic primitives.
7. Bind ciphertext to its share, object, chunk index, and expected length through authenticated data.
8. Keep R2 private. All object access must pass through API authorization.
9. Return indistinguishable not-found responses for absent, expired, incomplete, or unauthorized
   shares where the existing service does so. Do not add share-enumeration signals.
10. Never log authorization headers, upload tokens, delete tokens, read credentials, fragments,
    decrypted manifests, file paths, or plaintext.
11. Validate relative paths with `isSafeRelativePath` before encryption or display.
12. Preserve bounded chunk and manifest reads. Do not buffer an entire arbitrary-size share.

Changing encryption formats, key derivation labels, nonce construction, authenticated data, or
manifest fields requires a protocol version and a documented compatibility plan. Existing shares
must remain readable for their advertised lifetime.

## Repository boundaries

- `packages/protocol`: wire schemas, protocol constants, limits, and safe path rules
- `packages/crypto`: key derivation, encryption, encoding, and credential hashing
- `packages/client`: surface-independent create, unlock, streaming, and deletion workflows
- `packages/server`: storage ports, authorization, lifecycle, and object-key construction
- `apps/api-cloudflare`: Hono routes plus D1 and R2 adapters
- `apps/web`: React upload, unlock, folder tree, preview, and download UI
- `scripts`: configuration, deployment support, and remote smoke verification

Dependencies should point inward through those boundaries. UI code must call `@share/client` rather
than reproduce crypto or HTTP protocol logic. Cloudflare adapters must implement `@share/server`
ports rather than leak platform types into shared packages.

## Configuration rules

The root `.env` is the single editable source of deployment and runtime configuration. It is ignored
by Git.

- Update `.env.example` whenever a variable is added, removed, or renamed.
- Validate configuration through `scripts/config.mjs`.
- Run `pnpm config:sync`; do not hand-edit `apps/api-cloudflare/wrangler.generated.jsonc`.
- Keep stable platform structure in `apps/api-cloudflare/wrangler.base.jsonc`.
- Only `SHARE_PUBLIC_*` variables may enter the browser bundle.
- Never put credentials or secrets in a `SHARE_PUBLIC_*` variable.
- Protocol constants belong in `packages/protocol`, not `.env`.
- Do not commit `.env`, `.dev.vars`, generated Wrangler files, build output, or local Cloudflare
  state.

## Implementation standards

- Use TypeScript strict mode and preserve `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- Prefer small pure functions at protocol and crypto boundaries.
- Parse untrusted JSON with the Zod schemas in `@share/protocol`.
- Keep browser and Worker APIs standards-based so future CLI and MCP clients can reuse packages.
- Maintain accessible labels, keyboard behavior, focus states, and responsive layouts.
- Follow the existing quiet, technical visual system. Do not add gradients, oversized marketing
  sections, ornamental security art, or large-radius card grids.
- Reuse the semantic tokens and component patterns in `docs/design-system.md`. Do not introduce raw
  colors, durations, or recurring dimensions without documenting why the system needs them.
- Do not add a dependency when the platform API or a small local function is sufficient.
- Update documentation in the same change when behavior, configuration, protocol, or deployment
  steps change.

## Verification

Run the smallest relevant checks while iterating. Before handing off a completed change, run:

```sh
pnpm biome check .
pnpm check
pnpm test
pnpm build
```

Additional gates:

- Crypto or protocol changes: add round-trip, tamper, wrong-context, and boundary tests.
- Authorization or lifecycle changes: test invalid credentials, expiry, and state transitions.
- Configuration changes: run `pnpm config:check` and confirm generated Wrangler output with a dry
  run through `pnpm build`.
- Deployment changes: deploy only when the user has requested it, then run
  `pnpm smoke:deployment` against the configured production URL.
- UI changes: verify desktop and narrow layouts and exercise the affected interaction in a browser.

## Change discipline

- Keep commits focused and use an imperative summary.
- Do not rewrite unrelated user changes.
- Do not weaken a security invariant to improve convenience or reduce code.
- Do not claim CLI or MCP support is implemented until those packages and their end-to-end tests
  exist.
- A change is complete when behavior, tests, docs, generated configuration, and deployed state (when
  requested) agree.
