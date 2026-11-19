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
file list, and checks the snapshot against the service's size limit before anything is uploaded.
Confirming it starts encryption, then chunked upload, then completion. A published
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

Use the file tree, breadcrumbs, search, filters, and sorting to find an artifact. On desktop you can drag the sidebar edge or focus the separator and use the arrow keys. The gallery lets you compare images, play a slideshow, and place notes on images. Notes last for this tab.

Share previews Markdown, formatted source, JSON, YAML, notebooks, HTML, PDFs, images, audio, video, fonts, ZIP directory listings, spreadsheets, and supported 3D models. Sandbox previews resolve bundled HTML links, responsive images, and local CSS resources. XLSX previews expose sheet selection and filtered rows. DOCX and PPTX show common formatting and layout. Charts, embedded media, and Office-specific formatting may need the original application. Model previews support OBJ, STL, and glTF or GLB with embedded textures and buffers.

## Local and published data

| Location     | Contents                                        | Encrypted             |
| ------------ | ----------------------------------------------- | --------------------- |
| This browser | Workspaces and file blobs                       | No                    |
| API storage  | Published manifests and chunks                  | Yes, with AES-256-GCM |
| API metadata | IDs, timestamps, sizes, expiry, credential hash | Not applicable        |

Deleting a share requires the delete credential that was issued when it was created, and it works
after expiry too. Deleting a local workspace does not affect a published snapshot.

Entries are listed folders first, then by name, so a move changes where an entry lives rather than
its position. Every move is also available from the entry's `Move to` control, which is the same
destination list the tree offers while dragging.

[Revoking a share](/docs#revoking-a-share) describes how to end a live snapshot early.

## Previewing large files

Share can reuse decrypted files up to 16 MiB while the page is open. The cache holds up to 64 MiB
per unlocked share and drops older entries as it fills. Reload the page or close the tab to clear it.
Previously opened files can remain visible in that tab after the share expires or is revoked.

Larger previews start when you choose **Load preview** or **Load player**. PDF previews request
encrypted chunks as needed, within the PDF preview size limit. The PDF decoder may still fetch the entire document, depending on its layout, and can allocate a document-sized buffer. Searching PDF text can also fetch more chunks. Browser-compatible audio and video play from streamed chunks when supported.
On browsers with a save-file picker, large downloads stream directly to the selected destination.
When the save-file picker is unavailable, Share can hand decrypted chunks to the browser's download manager. If the browser does not support either streaming route, Share uses a temporary in-memory copy.

## Refreshing an encrypted share

After a successful unlock, Share remembers the decryption secret only in **this tab’s sessionStorage**. Refreshing reopens the share without requiring the key. It is not kept in localStorage, IndexedDB, or cookies. Some browsers restore tab sessions after closing and reopening.

Use **Lock tab** at the top of the viewer to forget the key and require a fresh key after reload. This does not revoke the link for others.
