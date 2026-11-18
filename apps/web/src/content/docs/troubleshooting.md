# Troubleshooting

Common problems with uploads, links, previews and downloads.

## A share says “not found”

Check that you copied the **entire** URL, including `#k=...`. The fragment is the decryption secret, and losing it makes the share inaccessible. The same not-found response is used for missing, expired, revoked and unauthorized shares to avoid revealing whether an ID exists.

If the share expired or was revoked, it cannot be recovered from Share. Ask the publisher to create a new snapshot.

## An HTML preview has broken images

The HTML and images must be uploaded in one share with their folder paths intact. `<img src="chamber.png">` looks next to the HTML file, not at the server root. Use relative paths such as `images/chamber.png`. External URLs, JavaScript and embedded frames are intentionally blocked.

See [HTML bundles](/docs/previews#html-bundles).

## A video will not play or seek

Supported playback depends on your browser's codecs and container support. An MP4 file can still contain a codec that a browser cannot decode. Try another browser, or download the original. The streaming player may need to fetch additional encrypted chunks when you seek.

## A document preview is incomplete

DOCX, XLSX and PPTX previews are best-effort. Complex layouts, charts and unsupported Office features will not render exactly as in the original application. Download the file for authoritative formatting. A very large PDF may use significant memory even if its encrypted data is fetched in ranges.

## A download stops or the browser becomes slow

For very large downloads, prefer a browser that supports the streaming download route. Keep the tab open until the browser has accepted the transfer. On browsers without a streaming route, an in-memory fallback may require substantial RAM.

## I refreshed and my image cache is gone

That is expected. Decrypted previews are cached in **page memory only**. Refreshing clears the cache. Locally edited, unpublished workspaces are a different feature: those are stored in IndexedDB and survive refreshes unless site data is cleared.

## I cannot revoke a share

The original publisher's browser or CLI keeps the revocation credential. A link alone doesn't grant deletion permission. If the credential has been lost, wait for the expiry. Existing older shares without expiry require handling through the original credentials.

## Where can I report a problem?

For a reproducible bug, open an issue in the [source repository](https://github.com/shakthi-sagar/share). **Do not paste full secret share links into public issues.** For a security flaw, follow the repository's private security reporting policy instead.
