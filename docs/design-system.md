# Web design system

This document defines the shared visual and interaction rules for `apps/web`. The CSS custom
properties at the top of `apps/web/src/styles.css` are the implementation source of truth. This
document explains how to apply them. `docs/design-decisions.md` records why this direction was
chosen.

## Product character

The interface should feel like a precise technical workbench: compact, direct, and trustworthy.
The current task belongs in the first viewport, technical details appear where they support a
decision, and hierarchy comes from typography, borders, surface shifts, and state changes rather
than decoration.

Use:

- a light gray application canvas with white task surfaces
- compact controls with persistent text labels for unfamiliar actions
- monospaced type for paths, keys, sizes, and machine-oriented status
- thin borders and small radii to define work areas
- a dark neutral primary action and a restrained orange functional indicator
- plain language that distinguishes a local draft from an immutable published snapshot

Avoid gradients, decorative security imagery, large shadows, oversized hero sections, pill-shaped
primary controls, equal-weight action-card grids, and hidden hover-only actions required to proceed.

## Foundations

### Color

Use semantic variables instead of raw color values in component rules.

| Token | Role |
| --- | --- |
| `--page`, `--surface` | Main page and component backgrounds |
| `--surface-subtle`, `--surface-hover` | Secondary areas, selections, and hover feedback |
| `--surface-code`, `--surface-success` | Code presentation and positive status surfaces |
| `--text`, `--text-reading` | Primary UI and long-form reading text |
| `--text-secondary`, `--text-muted` | Supporting and low-emphasis information |
| `--text-on-primary` | Text or icons on the primary color |
| `--border`, `--border-strong` | Default and emphasized boundaries |
| `--primary`, `--primary-hover`, `--primary-tint` | Primary actions, focus, and selected items |
| `--accent`, `--accent-tint` | Functional progress, drag-active state, and the publish secrecy callout only |
| `--danger`, `--success` | Error and success meaning |
| `--overlay`, `--tap-highlight` | Transient interaction layers |

Do not use color alone to communicate state. Pair it with text, an icon, or a structural change.

### Typography

The interface uses the system sans stack. Use `--mono` for filenames, paths, byte counts, keys,
code, and terse machine status. Keep prose in the sans stack.

The defined size tokens are `--text-xs`, `--text-sm`, `--text-ui`, `--text-body`,
`--text-reading-size`, `--text-lead`, `--text-title-sm`, and `--text-title-md`. Use a nearby existing
component as the first reference. Add a new size only when a distinct recurring role requires it.

- Use sentence case for headings, labels, and buttons.
- Start action labels with a verb: `Add files`, `Copy link`, `Download all`.
- Selection is shown with `--primary-tint` plus the primary text color. Do not mark the selected row
  with `--accent`; that token is reserved for progress and transient active states.
- Keep status and help text factual and brief.
- Never imply that the server can read encrypted content or that a share is safe after its full URL
  has been exposed.

### Spacing and layout

Spacing follows a 4px base scale: `--space-1` through `--space-14`. Prefer these tokens for new
layout work. Optical adjustments of 1–3px are acceptable for icons, borders, and text alignment.

- Keep the upload workflow within the existing 860px content measure.
- Keep long-form Markdown near a 720–760px reading measure.
- Keep the viewer sidebar compact; filenames need the majority of each row.
- Use whitespace before adding containers or separators.

### Shape, borders, and elevation

- Controls use `--radius-control` (6px).
- Panels use `--radius-panel` (8px).
- Fully round indicators use `--radius-round`.
- Default structure uses a 1px border.
- Avoid shadows unless content must visibly float above another interaction layer.

### Motion

Use `--duration-fast` for hover and press feedback and `--duration-default` for layout or progress
transitions. Use the existing easing tokens. Every animation must respect `prefers-reduced-motion`.
Motion should clarify a state change and should not delay an action.

## Components

### Buttons

Use `.button` with one intent class:

- `.button-primary` for the single preferred action in a region
- `.button-secondary` for an important alternative
- `.button-quiet` for low-emphasis actions
- `.icon-button` for a familiar action with an accessible name

Buttons use `--control-height`; icon controls use `--icon-control-size`. Keep loading labels stable
enough to avoid a large width shift. Disable an action only when the user cannot complete it, and
keep any explanation visible nearby.

### Panels and drop targets

Panels organize a complete task or bounded work area. A drop target must also work by keyboard and
must make both file and folder selection discoverable. Drag-active, populated, uploading, success,
and error states should retain the same basic geometry so the page does not jump unnecessarily.

### Inputs and selects

Every control needs a visible label or an accessible name. Use the strong border at rest, the shared
focus ring for keyboard focus, and inline error text tied to the control. Preserve entered values
after recoverable errors.

### File lists and trees

Use monospaced type for paths and sizes. Preserve full relative paths in data, truncate visually,
and expose the complete value through the accessible name or title when needed. Folder rows expand;
file rows select. File rows carry an empty chevron slot so their icons sit in the same column as
folder icons; never fake that indent with a magic padding number. Selected, hovered, and focused
states must remain distinguishable.

Siblings are name-sorted, so the tree has no manual order. Dragging moves an entry to another
folder, never to a position between siblings:

- Valid drop targets are folder rows and the empty tree area below the last row, which means the
  workspace root: the tree fills the sidebar like an explorer, so empty space is always present.
  A file row is not a target, and a folder cannot target itself or one of its own descendants.
  Drive that list from `folderOptions(workspace, draggedId)` so a target and the model never disagree.
- Never insert or remove a row, strip, or label to create a drop target while dragging. It shifts
  the list under the pointer and causes mis-drops; an always-present zone is the only safe target.
- Mark the dragged row as dragged, the hovered valid target as a drop target, and the root zone as
  hovered. Keep the drop target neutral; `--accent` is not a drop color.
- Hovering a collapsed folder for about 600ms expands it, and a completed move expands the
  destination, so the result is visible without another click.
- Ignore a click that lands within a few hundred milliseconds of a drop so a move never also
  toggles a folder or closes the drawer.
- Report the result in the editor status region, including the model error when a name would collide.
- Drag is pointer-only. The entry toolbar's `Move to` control stays the keyboard path to the same
  destinations and must keep working.

### Status and feedback

Show progress near the action that started it. State what is happening in user terms, such as
`Encrypting files` or `Uploading encrypted chunks`. Errors should say what failed and what the user
can do next. Success state must keep the share link and its secrecy requirement together.

### Long-form reading

Markdown in a share and Markdown in the documentation share the same typography tokens and reading
measure. Reuse `.markdown-body` for structure and add only page-specific layout rules.

### File previews

`apps/web/src/preview` owns every preview, shared by the viewer and the workspace editor.
`previewKind` classifies a file from its extension first and its MIME type second; `kinds.test.ts`
lists the mapping. Only files the browser cannot show (archives, office documents, HEIC, and
unknown binaries) fall back to the download state.

- Text kinds (Markdown, CSV, JSON, SVG, HTML, code, plain text) offer `Preview` and `Source`, and
  Markdown, SVG, and HTML also offer `Split` on wide screens. The switch is a segmented control in
  the file header; the workspace editor uses `Edit`, `Split`, and `Preview` tabs instead.
- Source uses `CodeView`: a line-number gutter and highlight.js colors from the `--syntax-*`
  tokens. Highlighting stops past 300,000 characters.
- `SplitView` owns the resizable divider. It is a focusable separator (arrow keys, Home, End, Enter
  to reset) and keeps both panes' scroll positions proportional.
- Mermaid fences render as diagrams with a `Show source` toggle; a syntax error shows the message
  and the source instead of failing the whole document.
- Each kind has a preview size limit in `PREVIEW_LIMIT_BYTES`. Past it the file is offered for
  download rather than decrypted into memory. Unknown files up to 2 MiB are decrypted and shown as
  text when they look like UTF-8 text.
- Media previews always get a blob type chosen by `safeMediaType`, never the sender's MIME type.
- The transparency checkerboard behind SVG previews is the only gradient in the system; it is
  functional, not decorative.
- mermaid, highlight.js, and pdf.js load on first use, so a share without diagrams, code, or PDFs
  never downloads them.

### Artifact viewer

The viewer keeps share identity in its fixed header, navigation in the file tree, and the selected
artifact in the reading pane. The reading pane's file header owns the per-file actions: `Copy` for
decrypted text and `Download`, which becomes icon-only (keeping its accessible name) at the narrow
breakpoint so it stays reachable on phones. It shows the file name and, beneath it, the parent folder
and size rather than repeating the name. Render unsupported formats as a clear download state. Fetch
and decrypt file content only when it is needed for preview or download.

Render every name that came from a manifest through `displayPath`, so control and text-direction
characters in an older share appear as visible escapes rather than reordering the name.

The tree follows the WAI-ARIA tree pattern: Up and Down move between visible rows, Home and End jump
to the ends, Right opens a folder or moves into it, and Left closes it.

### Workspace editor

Keep workspace navigation compact and file-oriented. The header owns the workspace name, explicit
`Local draft` save status, and `Share snapshot` action (shortened to `Share` at the narrow
breakpoint), with the right-hand controls grouped in one
end-aligned cluster so the status stays beside the primary action. The sidebar owns labeled
creation and import actions plus hierarchy. The content pane owns entry actions and editing or
preview. Do not use browser prompts or confirms for create, rename, or delete; use the shared product
dialog and keep validation errors in that dialog.

Two actions in the same group must never share a label. Creation and import read as a pair:
`New file` / `New folder` for an empty entry and `Add files` / `Add folder` for one that comes from
disk, using the same verb across the sidebar and the content pane.

### Published shares

Publishing records the share id, its delete token, and the local snapshot name and file count in
browser storage so the publisher can recognize and revoke the share before it expires. The home page
lists those shares as a compact table: snapshot name with the monospaced id and file count beneath,
relative publish time, expiry (`Never`, `in 6d`, a date beyond a week, or `Expired`), and a labeled
`Revoke` text button. Shares recorded before names were stored show `Untitled snapshot`. The section
appears only when this browser has published shares, and it is not a list of every share on the
service. At the narrow breakpoint the column headings are hidden and each value carries an inline
label instead.

- Keep the revoke action visible rather than hover-only, and labeled with text. It is the only way to
  end a live share.
- Revoking requires the shared danger dialog, names the share id, and says the deletion cannot be
  undone.
- Treat a not-found response as success and forget the local record: an expired and swept share, or
  one deleted in another tab, is already gone.
- Keep the local record when a revoke fails for any other reason so the action can be retried.
- Refresh the list on the browser `storage` event so another tab's publish or revoke is reflected.
- The delete token stays in browser storage. Say so where a share is published, and never display,
  copy, or log it.

### Publishing flow

Publishing has three visible states: review, progress, and result. Review shows snapshot identity,
file count, total size against the service limit, bounded file list, expiry, and the immutable/local
distinction. A snapshot that cannot be published, because it is too large or its file list is, shows
the reason inline and disables `Encrypt and publish` before anything is uploaded. Errors from the
service go through `describeShareError` so rate limits, size limits, and network failures read as
next steps. Progress
shows the current path plus byte or chunk progress when available. Result makes `Copy full link`
the dominant action and keeps split link/key controls in an advanced disclosure. Keep the single
secrecy warning, which also says the key cannot be recovered, adjacent to the full-link action.

### Site shell, documentation, and footer

The site header owns the wordmark and the three primary destinations: `Docs`, `Self-host`, and the
GitHub repository. Each keeps a text label with a small monochrome icon, and external destinations
open in a new tab. Do not hide navigation behind a menu; every destination stays reachable at the
narrow breakpoint.

Internal destinations route in the app through `AppLink`: a modified click, a non-primary button, or
an external href keeps the browser default, and every in-app navigation updates the URL, restores
the matching scroll position, and honors back and forward.

The documentation route at `/docs` uses a two-column layout: a sticky section nav and a reading
article on the 720–760px Markdown measure. The current page is marked with `aria-current` and the
tinted selected state, and every page ends with previous/next navigation. An unknown documentation
path shows an in-app not-found state that links back to the overview rather than a bare error.

The footer repeats the documentation and project destinations, states the encryption boundary in
one sentence, and stays quiet: a hairline top border, no dark band, and no marketing sections.

## Responsive behavior

The primary breakpoint is `760px`.

- Above it, the viewer uses a persistent sidebar and reading pane.
- At or below it, the sidebar becomes a dismissible drawer with a scrim.
- Keep the current task and primary action visible without horizontal scrolling.
- Long names truncate; action groups may stack; content remains selectable and scrollable.
- Test the smallest supported viewport with long filenames, nested folders, errors, and progress.

## Interaction and accessibility

- Support keyboard use for every action and preserve the shared `:focus-visible` ring.
- Use semantic buttons, links, labels, headings, lists, and status regions before adding ARIA.
- Maintain at least the existing 36px button and 32px icon-control targets with enough separation.
- Provide text alternatives for meaningful icons and hide decorative icons from assistive tools.
- Keep text and controls at WCAG AA contrast or better.
- Announce asynchronous progress, completion, and errors when they affect the current task.
- Do not rely on hover to reveal information required to proceed.

## Adding or changing UI

1. Reuse an existing component and token before adding a new pattern.
2. Add semantic tokens at `:root`; do not scatter raw colors, timing values, or recurring dimensions.
3. Extract a shared component when a pattern has repeated behavior or appears in multiple flows.
4. Implement default, hover, focus, active, disabled, loading, error, success, and empty states that
   apply to the change.
5. Check desktop and narrow layouts, keyboard navigation, zoom, long content, and reduced motion.
6. Update this document when the system gains a reusable rule. Record a change of visual direction
   in `docs/design-decisions.md`.

## Review checklist

- Existing tokens and components are reused where their meaning matches.
- New raw style values are limited to documented one-off optical or layout needs.
- Hierarchy is clear without depending on decoration.
- Copy is concise, accurate, and consistent with the encryption model.
- Interactive and asynchronous states are complete.
- Desktop, narrow, keyboard, and accessibility behavior have been checked.
