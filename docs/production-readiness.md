# Production hardening and release checks

This record distinguishes measured checks from operational and manual checks. Automated tests are not an independent security audit.

## Refresh and secret retention

The master secret enters through `#k=` and is removed from the address bar after opening. On a successful unlock, a validated key is retained **in this tab's sessionStorage** under its share ID. It survives refresh, but is not in localStorage, IndexedDB, a cookie or server storage. The **Lock tab** button clears the key and viewer state. A failed 404 unlock also clears the cached key. Some browser session restores and duplicate-tab operations may preserve or clone sessionStorage; do not treat tab closure as a guaranteed time-to-live. An XSS on Share's origin could access the key, so preview isolation and strict CSP remain important. Decrypted *file bytes* are only in a bounded in-memory cache; refresh discards them.

## Automated gates

- `pnpm check`, `pnpm test`, `pnpm exec biome check .`, `pnpm build` for types, unit coverage, lint and compilation.
- `pnpm test:browser` creates an encrypted share with the CLI, opens it from a full URL, removes the fragment, reloads without prompting, verifies HTML assets and blocked scripts, checks an identical plaintext download, locks the tab, verifies it stays locked on refresh, revokes the share and checks it is no longer readable.
- `pnpm test:a11y` runs axe WCAG 2.1 A/AA for home and help on desktop and narrow viewport. The browser suite also audits the decrypted viewer in Chromium. Neither replaces physical-device or screen-reader evaluation.
- `pnpm bench:files` builds and sorts a synthetic 10,000-file tree, measures heap growth, and guards against multi-second regressions. Increase `SHARE_BENCH_COUNT` for heavier local testing; synthetic results do not prove mobile rendering performance.
- GitHub CI provisions local Cloudflare storage and tests Chromium, Firefox and Linux WebKit. This is not physical iOS Safari / Android Chrome; those remain manual checks.
- `pnpm audit --prod --audit-level high` blocks release on known production high/critical advisories. The initially detected vulnerable transitive packages were overridden to fixed versions. The local audit returned **0 high, 0 critical, 8 moderate and 2 low** findings across all dependencies (6 moderate and 2 low in production dependencies). Low/moderate advisories still require review; a package advisory does not prove exploitability in this application.

## Memory and large transfers

The small-file cache is limited to 16 MiB per item, 64 MiB total per unlocked share, and 256 entries. Large PDF/media use chunk/range reads where feasible, though PDF decoders may allocate document-sized buffers. Large downloads use picker/streaming where the browser supports it, with a potentially memory-heavy fallback on older devices. Run at least one manual 1 GiB transfer and low-memory mobile test before advertising guaranteed performance at those limits.

## Observability and incident response

- Share's API logs route, error type, and aggregate counts; no authorization tokens, secret URLs, manifest paths or blob keys should enter logs.
- The hourly cleanup sweep logs scanned, removed, failed, truncated, retention and duration counts. `severity:error` uses `console.error` when any deletion fails; a truncated backlog produces a warning. Set up a Cloudflare Logs alert on these events. **The alert itself is not auto-provisioned** by the repository.
- A GitHub Actions uptime workflow checks `/health` and the site's CSP twice per hour. Enable repository Actions and notifications for failures, or connect them to your alerting system; a workflow failure is not itself a push notification.
- To roll back, deploy the previous known-good Worker version, inspect aggregate cleanup logs and preserve existing encrypted storage. Follow `docs/deployment.md` for configuration details.
- There is no external penetration test or formal WCAG certification; treat a full independent audit and physical mobile testing as open external release gates.

## Publishing the CLI

`pnpm --filter @share/cli build && pnpm package:cli` produces a single executable Node bundle in `release/*.tgz`. Install with `npm install -g ./encrypted-share-cli-bundle-<version>.tgz`. Release tags `v*` trigger a GitHub release workflow that attaches the tarball. This does not automatically publish to npm or Homebrew.
