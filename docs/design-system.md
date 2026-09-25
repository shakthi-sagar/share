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
| `--accent`, `--accent-tint` | Functional progress and active-location indicators only |
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
file rows select. Selected, hovered, and focused states must remain distinguishable.

### Status and feedback

Show progress near the action that started it. State what is happening in user terms, such as
`Encrypting files` or `Uploading encrypted chunks`. Errors should say what failed and what the user
can do next. Success state must keep the share link and its secrecy requirement together.

### Artifact viewer

The viewer keeps global actions in its fixed header, navigation in the file tree, and the selected
artifact in the reading pane. Render unsupported formats as a clear download state. Fetch and
decrypt file content only when it is needed for preview or download.

### Workspace editor

Keep workspace navigation compact and file-oriented. The header owns the workspace name, explicit
`Local draft` save status, and `Share snapshot` action. The sidebar owns labeled creation and import
actions plus hierarchy. The content pane owns entry actions and editing or preview. Do not use
browser prompts or confirms for create, rename, or delete; use the shared product dialog and keep
validation errors in that dialog.

### Publishing flow

Publishing has three visible states: review, progress, and result. Review shows snapshot identity,
file count, total size, bounded file list, expiry, and the immutable/local distinction. Progress
shows the current path plus byte or chunk progress when available. Result makes `Copy full link`
the dominant action and keeps split link/key controls in an advanced disclosure. Keep the secrecy
warning adjacent to the full-link action.

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
