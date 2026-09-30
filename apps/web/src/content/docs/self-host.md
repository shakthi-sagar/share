# Self-hosting

`share` is a single Cloudflare Worker that serves the web app, the `/v1` API, and the `/health`
endpoint, backed by a D1 database and a private R2 bucket. Deploying it to your own account takes
a few minutes.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- A Cloudflare account

## Run it locally first

```sh
pnpm install
cp .env.example .env
pnpm config:check
pnpm dev
```

This serves the web app at `http://localhost:5173` and the API at `http://localhost:8787`. Use
`pnpm dev:local` to run everything against local Cloudflare storage instead of remote resources.

## Configure

Edit only the root `.env`. It is ignored by Git, and `.env.example` is the committed template.

- set `SHARE_ENV=production`
- use HTTPS for `SHARE_PUBLIC_WEB_URL` and `SHARE_PUBLIC_API_URL`
- set `SHARE_ALLOWED_ORIGINS` to the exact browser origins
- set `SHARE_CUSTOM_DOMAIN` when the Worker should own a hostname in a Cloudflare-managed zone
- fill in `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_ID`, `CLOUDFLARE_R2_BUCKET`, and resource names
- set `SHARE_PUBLIC_MAX_SHARE_BYTES` to the largest encrypted share you are willing to store

Only `SHARE_PUBLIC_` variables reach the browser bundle. Never put a secret in one of them.

## Provision storage

```sh
pnpm --filter @share/api-cloudflare exec wrangler login
pnpm --filter @share/api-cloudflare exec wrangler d1 create <database-name>
pnpm --filter @share/api-cloudflare exec wrangler r2 bucket create <bucket-name>
```

Put the returned D1 UUID in `.env`, then validate and generate the Wrangler configuration:

```sh
pnpm config:check
pnpm config:sync
```

`config:sync` writes `apps/api-cloudflare/wrangler.generated.jsonc`. Never edit that file by hand.

## Deploy

```sh
pnpm deploy:cloudflare
```

That validates production configuration, builds the web app, applies pending D1 migrations, uploads
static assets, and deploys the API as one Worker release.

## Verify

```sh
curl -s https://<your-host>/health
pnpm smoke:deployment
```

The smoke test creates a short-lived share, checks upload and read authorization and byte equality,
then deletes the share. Finally, open the deployed web app and create, open, preview, and download a
share in a browser.

## Expired and abandoned shares

Expiry alone only refuses access; the sweep is what frees storage. The Worker includes an hourly cron
trigger that deletes the encrypted objects and the database row of every share whose expiry has
passed, and of every upload that did not complete within 24 hours, including uploads with no expiry.
The schedule lives in `apps/api-cloudflare/wrangler.base.jsonc` and needs no configuration.
The sweep runs on a platform schedule, has no public endpoint, and reports only counts in its logs.

## Abuse limits

Creating a share needs no account, so the Worker limits what one client can store:

- Share creation is limited to 10 per minute per client address, and upload requests to 600 per
  minute, through Workers rate limiting bindings declared in `wrangler.base.jsonc`. Their
  `namespace_id` values must be unique within your Cloudflare account.
- Each share may store at most `SHARE_PUBLIC_MAX_SHARE_BYTES` of ciphertext and 1,000,000 chunks.
  The API counts every accepted upload body before storing it and refuses the rest with `413`.
- Uploads are accepted only during the first 24 hours of a share's life.

## Browser security headers

The build writes a `_headers` file that Workers Static Assets serves with every page. Its Content
Security Policy allows only same-origin scripts and styles and network access only to the site and
the configured API origin. The key sits in the page's URL fragment, so an injected script would be
key theft; keep the policy strict when you change the web app.

## Notes

- A workers.dev URL works, but the account Workers subdomain is shared by every Worker in that
  account. Prefer a custom domain as the canonical URL.
- Roll back a failed release from Wrangler deployment history. Repair data with a new forward
  migration rather than editing an applied one.
