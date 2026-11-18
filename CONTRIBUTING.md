# Contributing

Use Node.js 22+, pnpm 10, and a private `.env` copied from `.env.example`. Do not publish real share keys, revoke tokens, filenames, or private URLs in issues or CI logs.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm exec biome check .
pnpm build
pnpm bench:files
pnpm audit --prod --audit-level high
```

Browser E2E requires Vite on `localhost:5173` and an isolated local Worker on `localhost:8787` with its D1 migrations; CI provisions and tests all of this automatically. Run `pnpm test:browser` and `pnpm test:a11y` against those servers. Include regression tests and update in-app Markdown documentation for user-visible changes. Never weaken CSP, authenticated encryption, API authorization or expiry invariants without a dedicated security review.
