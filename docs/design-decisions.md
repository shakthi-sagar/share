# Web design decisions

The workspace is a local drafting surface that publishes immutable encrypted snapshots. Keep the
active file, expiry, or publication state visible where it affects the user's next action.

The graphite redesign takes its overall hierarchy from Linear's near-black product surfaces and
pale controls. Fonts in Use informed the gallery's neutral framing, where the shared artwork carries
the color. File-browser references from Weights & Biases informed the breadcrumb and sidebar layout.

- Use graphite layers, thin borders, and compact controls around artifacts. A pale primary action
  marks the next step and a lime accent conveys encryption, progress, or an active drop target.
- Use bundled Inter for interface text and monospace for paths, byte counts, and CLI commands.
- Home pairs a short introduction with an import surface, followed by local workspaces and published
  snapshots. The CLI command appears as copyable text.
- Keep file navigation and filters beside the preview at desktop widths. In a narrow viewport,
  open the tree as a drawer. Make the desktop divider operable with a pointer and the keyboard.
- Keep annotations in the tab. Published artifacts stay immutable and the service receives
  neither a decryption key nor file contents in plaintext.
