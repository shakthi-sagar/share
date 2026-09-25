# Web design reference lock

## Brief

Designing an encrypted artifact workspace and sharing flow for developers and AI-assisted workflows
on the web. The primary user journey is local import or creation, workspace editing, deliberate
snapshot review, encrypted publishing, and recipient unlock/view. The primary trust question is
whether plaintext or the master secret reaches the API.

## Research

Refero research reviewed Factory.ai, Tailscale, Dropbox, SST, and shadcn visual systems; Skiff Drive,
Dropbox link settings, and Rork workspace screens; and the Skiff file-import, Shuttle sharing, and
Dropbox viewing-link flows.

## Reference lock

- Primary direction: Factory.ai's precise technical workbench.
- Preserve: light gray canvas, white task surfaces, compact UI typography, small radii, thin borders,
  dense-but-readable application chrome, and functional product visuals rather than decoration.
- Borrow from Skiff: one obvious import entry, a bounded file queue/list, and an empty-to-populated
  workspace transition that keeps import available.
- Borrow from Tailscale: direct trust language and restrained use of a security accent.
- Borrow from Dropbox: a focused share-settings hierarchy and confirmation in context.
- Keep from SST: monospaced machine data and technical editorial restraint.
- Reject: marketing-style hero dominance, equal-weight action-card grids, decorative security art,
  gradients, large soft SaaS cards, hidden essential actions, and browser prompt/confirm dialogs.

## Token commitments

| Decision | Source | Role |
| --- | --- | --- |
| `#f1f1ef` canvas and white task surfaces | Factory.ai and Tailscale | Application background and active work areas |
| `#181817` primary | Factory.ai | Primary actions, focus, and strongest emphasis |
| `#d15432` accent | Factory.ai functional orange | Progress and active-location indicators only |
| System sans plus system mono | Factory.ai/SST and performance craft | UI/readable prose plus paths, sizes, keys, and progress |
| 6px control radius and 8px panel radius | Factory.ai | Compact controls and bounded work areas |
| 1px borders and shadows only for overlays | Factory.ai/Tailscale | Structure without ornamental elevation |
| 120ms and 200ms motion | Existing product system | Feedback and state continuity |
| 720–760px readable Markdown measure | Existing viewer contract | Long-form artifact reading |

## UX commitments

- Home leads with one workspace-start surface: drop files, choose files, choose a folder, or start
  empty. Recent workspaces are a file-oriented table, not cards.
- Local draft status remains visible in the workspace header. Publishing is always labeled as an
  immutable snapshot.
- Create, rename, and delete use product dialogs with contextual consequences and recoverable
  validation errors.
- Publishing is review → progress → result. The result prioritizes the full secret link and places
  split link/key controls behind an advanced disclosure.
- Recipient viewing keeps artifact identity in the reading pane and navigation in the file tree.
- No visual or UX language may imply the API can read plaintext or recover the master secret.
