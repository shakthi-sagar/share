# share

Open-source, end-to-end encrypted file and folder sharing for people and AI agents.

Files, paths, and the manifest are encrypted in the client before upload. The URL fragment holds
the master secret and is never sent to the server. The API stores ciphertext plus a hash of a
separately derived read credential, and requires that credential before returning encrypted data.

## What works

- Local workspaces persisted in browser IndexedDB
- Create, import, organize, rename, move, and delete nested files and folders
- Local editing for Markdown, text, JSON, YAML, and source files
- Markdown and image previews before publishing
- Immutable encrypted snapshots created only through an explicit Share action
- File and recursive folder uploads
- AES-256-GCM chunk encryption in the browser
- Separate manifest, file, read authorization, upload, and deletion credentials
- Expiring shares
- Revoking a published share from the browser that published it
- Hourly sweep that deletes expired shares and abandoned uploads from storage
- Per-address rate limits and a configurable per-share size limit
- Strict Content Security Policy on every page
- Lazy file download and local decryption
- Previews for Markdown (with Mermaid diagrams and a split source view), code with syntax
  highlighting, CSV and TSV tables, JSON, Jupyter notebooks, SVG, sandboxed HTML, PDF, images,
  audio, video, and fonts; other files download
- Split edit and preview for Markdown, SVG, and HTML in a local workspace
- Multi-image gallery with locally decrypted, on-demand thumbnails, pagination, and full-image navigation
- Read-only text previews for DOCX, XLSX, and PPTX (complex formatting remains download-only)
- Collapsible nested folder tree
- One Cloudflare Worker serving the React app and API
- D1 metadata and private R2 ciphertext storage
- In-app documentation at `/docs`, including a self-hosting guide

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

Unpublished workspaces and file blobs stay in IndexedDB in the current browser. The web app contacts
the share API only when the user explicitly publishes a snapshot.

Local workspaces are not encrypted at rest. Anyone with access to this browser profile or origin
storage may be able to read them. End-to-end encryption is applied to the published snapshot.

The hosted web application remains part of the trust boundary because it delivers the encryption
client. Independently built CLI and MCP clients will use the same documented wire protocol.

See [the protocol documentation](docs/protocol.md) for the key schedule and ciphertext format.

## Project documentation

The deployed web app serves this project's user documentation at `/docs`, including
[self-hosting](docs/deployment.md). The files below cover contributors and agents.

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

## Command-line sharing

The `share` CLI publishes encrypted files and directories using the same client protocol as the
website. It defaults to a **24-hour expiry**, caps new CLI shares at **7 days**, and never creates
non-expiring shares. Share URLs include a fragment secret; do not log them in public CI.

```sh
pnpm install
pnpm --filter @share/cli build
node packages/cli/dist/cli.mjs put screenshot.png --expires 1d
node packages/cli/dist/cli.mjs put ./screenshots --name "Scene renders"
node packages/cli/dist/cli.mjs inspect 'https://share.shadster.dev/s/<id>#k=<key>'
node packages/cli/dist/cli.mjs revoke <id>
```

On Linux, symlink the built script to `~/.local/bin/share` to make it available globally.
CLI delete receipts live at `~/.local/share/receipts` (private file permissions), so the original
machine can revoke links early. Publishing a new share does not modify a previous immutable snapshot.

### Retention

The API runs an hourly expiry sweep at minute 17 UTC. Expired links lose read access immediately;
background deletion normally occurs on the next hourly sweep. Abandoned uploads are purged after
24 hours. A sweep removes at most 2,000 shares, retrying failures on subsequent runs. Existing
legacy non-expiring shares are **not** automatically deleted; revoke them with their original
browser-held deletion credentials. The web publisher now only offers expiring links.
