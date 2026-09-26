# Using share

## Workspaces

A workspace is a local draft. It is stored in IndexedDB in this browser profile and is never
uploaded until you explicitly publish it.

Create one by dropping files onto the launch panel, choosing files or a folder, or starting empty.
Inside a workspace you can:

- create, rename, move, and delete nested files and folders
- drag a file or folder onto another folder to move it, or onto the empty space around the file list
  to bring it back to the top level
- edit Markdown, plain text, JSON, YAML, and source files locally
- preview Markdown and images before publishing
- duplicate a workspace to branch from an existing draft

Local workspaces are not encrypted at rest. Anyone with access to this browser profile or to origin
storage may be able to read them.

## Publishing a snapshot

`Share snapshot` opens a review step that shows the file count, total size, expiry, and a bounded
file list. Confirming it starts encryption, then chunked upload, then completion. A published
snapshot is immutable: later edits in the workspace do not change a share that is already live.

The result screen keeps `Copy full link` as the primary action and moves the split link and key
controls into a disclosure. The full link is the share, because the fragment carries the key.

Set an expiry when you publish. Once a share expires it is indistinguishable from a share that never
existed, and a scheduled sweep deletes its stored ciphertext and metadata. Expiry therefore ends
access and reclaims storage; it does not keep a record that the share ever existed.

## Opening a link

Opening a share URL requires the fragment. Without it the page cannot derive a read credential, so
the API returns the same not-found response it returns for an absent, expired, or unauthorized
share.

In a share you can browse the folder tree, preview Markdown, text, code, and images, and download a
whole folder or a single file. Content is fetched and decrypted only when you need it.

## Local and published data

| Location | Contents | Encrypted |
| --- | --- | --- |
| This browser | Workspaces and file blobs | No |
| API storage | Published manifests and chunks | Yes, with AES-256-GCM |
| API metadata | IDs, timestamps, sizes, expiry, credential hash | Not applicable |

Deleting a share requires the delete credential that was issued when it was created, and it works
after expiry too. Deleting a local workspace does not affect a published snapshot.

Entries are listed folders first, then by name, so a move changes where an entry lives rather than
its position. Every move is also available from the entry's `Move to` control, which is the same
destination list the tree offers while dragging.

[Revoking a share](/docs#revoking-a-share) describes how to end a live snapshot early.
