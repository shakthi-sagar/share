# Web design reference lock

## Brief

Designing an encrypted artifact workspace and sharing flow for developers and AI-assisted workflows
on the web. The primary user journey is local import or creation, workspace editing, deliberate
snapshot review, encrypted publishing, and recipient unlock/view. The primary trust question is
whether plaintext or the master secret reaches the API.

## Research

Refero research reviewed Dub, Tailscale, SST, and shadcn visual systems; Dropbox, MonoDesk, and
Programa file-sharing screens; and Dropbox file-request and Rox document-publish flows.

## Reference lock

- Primary direction: Dub's clean link-sharing workbench.
- Preserve: bright white surfaces, crisp near-black text, single vivid orange CTA, compact
  pill-shaped badges, and generous whitespace that keeps the task in focus.
- Borrow from Tailscale: direct trust language, light gray canvas, and technical restraint.
- Borrow from Dropbox/MonoDesk: a clear file workspace with a right-side file tree and a centered
  share-modal pattern.
- Keep from SST: monospaced machine data and technical editorial restraint.
- Reject: dark-mode command centers, decorative security imagery, gradients, oversized hero
  sections, equal-weight action-card grids, hidden essential actions, and browser prompt/confirm
  dialogs.

## Token commitments

| Decision | Source | Role |
| --- | --- | --- |
| `#fafafa` canvas and `#ffffff` surfaces | Dub clean workbench | Page background and active work areas |
| `#171717` text | Dub/Tailscale | Primary text and headings |
| `#f97316` primary | Dub Ember Glow | Primary call-to-action and active states |
| `#737373` secondary and `#a3a3a3` muted | Dub grayscale | Supporting and low-emphasis text |
| System sans plus system mono | Dub/SST | UI/readable prose plus paths, sizes, keys, and progress |
| 8px control radius and 12px panel radius | Dub | Buttons, inputs, and card containers |
| 1px borders and subtle shadows | Dub/Tailscale | Structure without ornamental elevation |
| 120ms and 200ms motion | Existing product system | Feedback and state continuity |
| 720px readable Markdown measure | Existing viewer contract | Long-form artifact reading |

## UX commitments

- Home leads with one focused workspace-start card: drop files, choose files, choose a folder, or
  start empty. Recent workspaces are a clean file-oriented list, not cards.
- Local draft status remains visible in the workspace header. Publishing is always labeled as an
  immutable snapshot.
- Create, rename, and delete use product dialogs with contextual consequences and recoverable
  validation errors.
- Publishing is review → progress → result. The result prioritizes the full secret link and places
  split link/key controls behind an advanced disclosure.
- Workspace and recipient viewing keep the content pane primary and the file tree on the right.
- No visual or UX language may imply the API can read plaintext or recover the master secret.
