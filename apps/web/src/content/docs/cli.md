# CLI and agent tools

Share includes a command-line client for Linux, macOS and Windows development environments. It publishes the same end-to-end encrypted snapshots as the website, without creating a browser workspace.

## Install or update

With Node.js 22 or later, download the CLI tarball from [GitHub Releases](https://github.com/shakthi-sagar/share/releases) and install it once:

```sh
npm install --global ./encrypted-share-cli-bundle-1.0.0-rc.1.tgz
share status
```

Use the filename you downloaded. If you already have the repository checked out, run `pnpm install` and `pnpm install:cli` to install from source. The source installer uses `~/.local/bin` by default. Add it to your `PATH` or set `SHARE_CLI_BIN_DIR` to choose another directory.

## Publish a file or directory

```sh
share put ./screenshot.png
share put ./renders --name "Chamber renders" --expires 1d
share put ./renders --json
```

The default expiry is 24 hours and new shares are capped at seven days. The full returned URL includes the secret after `#k=`. **Treat it like a password**; do not print it to public logs.

## Inspect, list and revoke

```sh
share inspect 'https://share.shadster.dev/s/<id>#k=<secret>'
share ls --json
share revoke '<share-id>'
share status --json
```

`share ls` reads receipts saved **on this machine**. It does not enumerate everyone else's shares. A receipt contains the credential needed for early revocation; keep it private.

## Agent integration (MCP)

```sh
share mcp
```

This starts a local **stdio** MCP server. Agents can check service health and inspect shares. To allow an agent to publish a path, configure `SHARE_MCP_ROOT` to the directory it is allowed to access. The root restriction matters: without it, an agent could be asked to publish unrelated personal files.

There is no account-wide cloud file browser, remote agent daemon or requirement to expose a network port for MCP.

## Sharing bundles with HTML

Publish the entire directory rather than only `index.html`:

```sh
share put ./chamber-review --name "Chamber review"
```

Relative images and styles can then resolve inside Share's sandboxed HTML preview.
