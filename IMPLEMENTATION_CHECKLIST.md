# Share implementation checklist

Check each item after verification. Finish functional work before the overall UI redesign. Update the published and repository documentation after the redesign, then remove this checklist.

- [ ] Cloudflare retention: verify expiry and actual R2 deletion, surface stored bytes and cleanup backlog/failures, inventory legacy shares and record disposition.
- [ ] Large files: exercise 100 MB PDF and 500 MB video using representative inputs, including mobile/browser coverage, seeking, cancellation, interrupted transfer, and download fallback.
- [ ] HTML bundles: linked HTML pages, responsive images, and local CSS images/fonts in the sandbox.
- [ ] Documents: PDF search and page jump, spreadsheet navigation and table controls, visual DOCX and PPTX previews.
- [ ] More formats: ZIP browsing, HEIC and TIFF images, and 3D previews.
- [ ] CLI and automation: repeatable install/update, verify installed CLI end to end, and add an MCP interface.
- [ ] Self-hosting: Node API, SQLite metadata, S3-compatible storage, Docker Compose, and lifecycle verification.
- [ ] Full UI redesign: review design references, redesign the workspace and viewer, then address breadcrumbs, filters, sorting, sidebar sizing, responsive and keyboard navigation, and gallery slideshow/annotations.
- [ ] Final verification: test, deploy, smoke-test production, and publish a review link with the installed CLI.
- [ ] Update repository and in-app documentation, then remove this checklist.
