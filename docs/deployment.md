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
`wrangler.generated.jsonc`.

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
