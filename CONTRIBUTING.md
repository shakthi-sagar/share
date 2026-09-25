# Contributing

Thank you for improving `share`.

## Before starting

Read [AGENTS.md](AGENTS.md), especially the security invariants. Changes to cryptography,
authorization, manifest structure, or storage boundaries need an explicit compatibility and threat
model review.

## Workflow

1. Create a focused branch.
2. Copy `.env.example` to `.env` and use local Cloudflare resources.
3. Make the smallest complete change.
4. Add or update tests for meaningful behavior and failure cases.
5. Update documentation in the same pull request.
6. Run the required checks.

```sh
pnpm biome check .
pnpm check
pnpm test
pnpm build
```

## Pull requests

Explain:

- the user-visible or operational problem
- the chosen behavior
- security and compatibility effects
- how the change was verified
- deployment or migration requirements

Keep generated files and local environment values out of commits. Do not include share URLs with
keys, authorization headers, tokens, plaintext test artifacts, or production identifiers that are
not already public configuration.

## Design changes

Follow [docs/design-decisions.md](docs/design-decisions.md). Include desktop and narrow-layout
evidence for meaningful UI changes and describe keyboard or accessibility behavior.

## Protocol changes

Protocol changes require:

- a versioning decision
- old-share compatibility analysis
- updated protocol documentation
- cross-package tests
- consideration of web, CLI, and MCP clients

Do not silently reinterpret an existing protocol version.
