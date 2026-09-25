# Web design reference lock

## Brief

Designing an encrypted artifact sharing tool for developers and AI-assisted workflows on
the web. The primary action is creating a share, and the primary trust concern is whether
plaintext or the master secret reaches the API.

## Reference lock

- Primary direction: SST's airy technical/editorial presentation from the product brief.
- Preserve: white canvas, thin neutral borders, product UI in the first viewport, restrained
  typography, and code-like details only where the content is technical.
- Borrow from Cursor Docs: compact explorer hierarchy and a focused reading column.
- Borrow from Appwrite: a large obvious drop target that becomes a compact selected-file state.
- Borrow from Linear and Tailscale: quiet chrome, sparse navigation, and operational trust copy.
- Reject: oversized marketing sections, decorative security imagery, gradients, large radii,
  elevated card grids, and Drive-like management chrome.

## Token commitments

| Decision | Source | Role |
| --- | --- | --- |
| White canvas and `#f7f7f9` secondary surface | Product brief and SST direction | Page and selected states |
| `#303055` accent | Product brief | Primary action, focus and selection only |
| System sans plus system mono | Product brief and performance craft | UI/readable prose plus paths and keys |
| 8px control radius and 10px panel radius | Product brief | Controls and bounded work areas |
| 1px borders and almost no shadow | Product brief, Linear/Tailscale direction | Structure without elevation |
| 120ms and 200ms motion | Product brief and motion craft | Feedback and state continuity |
| 720px readable Markdown measure | Cursor Docs direction | Long-form artifact reading |

