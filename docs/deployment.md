# Deployment guide

## Production topology

One Cloudflare Worker deploys:

- the React static assets
- the `/v1/*` API
- the `/health` endpoint
- a D1 binding named `DB`
- a private R2 binding named `BLOBS`

The current canonical origin is `https://share.shadster.dev`. Web and API requests share that origin.

## Configuration

Production values live in the ignored root `.env`. The committed `.env.example` is the template.
For production:

- set `SHARE_ENV=production`
- use HTTPS for `SHARE_PUBLIC_WEB_URL` and `SHARE_PUBLIC_API_URL`
- set `SHARE_ALLOWED_ORIGINS` to exact browser origins
- set `SHARE_CUSTOM_DOMAIN` when using a Worker Custom Domain
- provide the Cloudflare account, D1 database, and R2 bucket identifiers

`scripts/config.mjs` rejects placeholder D1 IDs and non-HTTPS public URLs in production. It combines
the environment values with `apps/api-cloudflare/wrangler.base.jsonc` and writes the ignored
`wrangler.generated.jsonc`. The hourly expired-share sweep is declared in the base file, so it is
present in every environment without configuration.

## Provisioning a new environment

Authenticate without pasting credentials into chat or logs:

```sh
pnpm --filter @share/api-cloudflare exec wrangler login
```

Create storage:

```sh
pnpm --filter @share/api-cloudflare exec wrangler d1 create <database-name>
pnpm --filter @share/api-cloudflare exec wrangler r2 bucket create <bucket-name>
```

Put the returned D1 UUID and resource names in the root `.env`, then generate and inspect the
configuration:

```sh
node scripts/config.mjs sync --production
pnpm build
```

## Release

Deployment is an external production change. Run it only after explicit authorization:

```sh
pnpm deploy:cloudflare
pnpm smoke:deployment
```

The deploy command validates production configuration, builds all assets, performs a Wrangler dry
run, applies pending D1 migrations, uploads assets, and deploys the Worker. The smoke test creates a
short-lived test share, verifies upload/read authorization and byte equality, then deletes it.

## Abuse limits

- `CREATE_RATE_LIMITER` allows 10 share creations per minute per client address and
  `UPLOAD_RATE_LIMITER` 600 upload requests per minute. Both are `ratelimits` bindings in
  `wrangler.base.jsonc`; their `namespace_id` values must be unique within the Cloudflare account.
  Limited requests receive `429` with `Retry-After: 60`. Addresses are limiter keys only and are not
  logged or stored.
- `SHARE_PUBLIC_MAX_SHARE_BYTES` caps the ciphertext one share may store. `config:sync` passes it to
  the Worker as `SHARE_MAX_SHARE_BYTES`, and the web app checks it before uploading.
- Uploads are accepted for `UPLOAD_WINDOW_SECONDS` (24 hours) after a share is created.

## Browser security headers

`apps/web/vite.config.ts` emits `dist/_headers` during the build. Workers Static Assets applies it to
every page, including the single-page fallback, with a strict Content Security Policy
(`script-src 'self'`, `worker-src 'self'` for the pdf.js worker, and `connect-src` limited to the
site plus `SHARE_PUBLIC_API_URL`). `style-src` also allows `'unsafe-inline'`, because Mermaid's
SVG and the CSS inside a sandboxed HTML preview need inline styles; CSS cannot run script, and its
ways of sending data out (images, fonts, connections) remain restricted to this origin. The build
also copies the pdf.js character maps and standard fonts to `/pdfjs/`. Pages also get
`Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and related headers. API responses get
equivalent headers from Hono. The Vite development server does not send them; check them against
`wrangler dev`, which serves the built assets.

## Expired and abandoned share sweep

Expiry refuses access; it does not free storage. A cron trigger reclaims it.

`triggers.crons` in `apps/api-cloudflare/wrangler.base.jsonc` runs the sweep at `17 * * * *`, off the
top of the hour. The schedule is platform structure, so it is committed with the rest of the Wrangler
base rather than read from `.env`.

- The sweep is a `scheduled` export on the Worker, not an HTTP route. Nothing can trigger it with a
  request, and it exposes no counts over HTTP.
- It also removes shares still uploading 24 hours after creation, found through
  `shares_uploading_idx`, so an abandoned upload cannot hold storage even without an expiry.
- It lists expired shares through the `shares_expiry_idx` index, then removes each share's R2
  prefix before its D1 row, using the same `deleteShare` path as `DELETE /v1/shares/:id`.
- Each share is independent. If object removal fails, the row stays and the next run retries it, so a
  storage failure never orphans ciphertext behind a deleted record.
- A run lists at most `EXPIRED_SWEEP_LIMIT` shares in batches of `EXPIRED_BATCH_SIZE`. A large
  backlog drains across several runs; the log line reports `truncated` when that happens.
- The log line contains counts and duration only. Share ids, object keys, and credentials are never
  logged.

Run it locally against local storage with a test-scheduled server:

```sh
pnpm --filter @share/api-cloudflare exec wrangler dev --config wrangler.generated.jsonc \
  --port 8787 --ip 127.0.0.1 --test-scheduled
curl -X POST "http://127.0.0.1:8787/cdn-cgi/local/explorer/api/local/scheduled?worker=encrypted-share" \
  -H 'Content-Type: application/json' -d '{"cron":"17 * * * *"}'
```

The response is `{"success":true,...}` and the server log reports `scanned`, `removed`, and `failed`.

## Custom domains and workers.dev

`SHARE_CUSTOM_DOMAIN` generates a Wrangler Custom Domain route. Cloudflare owns DNS and certificate
provisioning for that hostname.

Workers.dev URLs follow:

```text
<worker-name>.<account-workers-subdomain>.workers.dev
```

The account Workers subdomain is global to every Worker in that Cloudflare account. Changing it can
change every workers.dev URL. Keep the custom domain as the canonical production URL.

## Database migrations

- Add migrations under `apps/api-cloudflare/migrations` with monotonically increasing prefixes.
- Make migrations safe for existing production data.
- Do not edit an already-applied migration.
- The deploy command applies migrations before publishing the new Worker version.

## Verification and rollback

After deployment, verify:

1. `/health` returns `{ "status": "ok" }`.
2. `/` returns the web application.
3. `pnpm smoke:deployment` passes.
4. A browser can create, open, preview, and download a share.

If a release fails after deployment, inspect deployment history and roll back with Wrangler. Do not
roll back a database migration by editing its applied SQL file; create a forward repair migration.
