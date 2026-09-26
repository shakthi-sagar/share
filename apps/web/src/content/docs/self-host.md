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

## Expired shares

Expiry alone only refuses access; the sweep is what frees storage. The Worker includes an hourly cron
trigger that deletes the encrypted objects and the database row of every share whose expiry has
passed. The schedule lives in `apps/api-cloudflare/wrangler.base.jsonc` and needs no configuration.
The sweep runs on a platform schedule, has no public endpoint, and reports only counts in its logs.

## Notes

- A workers.dev URL works, but the account Workers subdomain is shared by every Worker in that
  account. Prefer a custom domain as the canonical URL.
- Roll back a failed release from Wrangler deployment history. Repair data with a new forward
  migration rather than editing an applied one.
