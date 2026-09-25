# share

Open-source, end-to-end encrypted file and folder sharing for people and AI agents.

Files, paths, and the manifest are encrypted in the client before upload. The URL fragment holds
the master secret and is never sent to the server. The API stores ciphertext plus a hash of a
separately derived read credential, and requires that credential before returning encrypted data.

## What works

- File and recursive folder uploads
- AES-256-GCM chunk encryption in the browser
- Separate manifest, file, read authorization, upload, and deletion credentials
- Expiring shares
- Lazy file download and local decryption
- Markdown, text, code, and image previews
- Collapsible nested folder tree
- One Cloudflare Worker serving the React app and API
- D1 metadata and private R2 ciphertext storage

## Requirements

- Node.js 22+
- pnpm 10+
- A Cloudflare account for deployment

## Configuration

Copy the example file and edit only the root `.env`:

```sh
cp .env.example .env
pnpm config:check
```

`pnpm config:sync` validates the file and generates the Wrangler configuration used by every
Cloudflare command. Only variables beginning with `SHARE_PUBLIC_` are compiled into the browser
bundle.

## Local development

```sh
pnpm install
pnpm dev
```

The default configuration serves Vite at `http://localhost:5173` and the API at
`http://localhost:8787`.

## Verification

```sh
pnpm check
pnpm test
pnpm build
```

## Deployment

Create the configured D1 database and R2 bucket, put the resulting D1 UUID in `.env`, then set the
public web and API URLs. Set `SHARE_CUSTOM_DOMAIN` when the Worker should own a hostname in a
Cloudflare-managed zone. Deploy with:

```sh
pnpm deploy:cloudflare
```

This validates production configuration, builds the web app, applies D1 migrations, uploads static
assets, and deploys the API in one Worker release.

After deployment, verify the complete storage and authorization path with:

```sh
pnpm smoke:deployment
```

## Security model

The hosted service never receives plaintext, filenames, folder paths, or the master secret. Anyone
who has the complete share URL can decrypt the share, so the URL must be treated as a secret.

The hosted web application remains part of the trust boundary because it delivers the encryption
client. Independently built CLI and MCP clients will use the same documented wire protocol.

See [the protocol documentation](docs/protocol.md) for the key schedule and ciphertext format.

## Project documentation

- [Agent operating guide](AGENTS.md)
- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [Deployment guide](docs/deployment.md)
- [Web design system](docs/design-system.md)
- [Design decisions](docs/design-decisions.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
