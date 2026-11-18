# Share implementation checklist

Check each item after verification. Finish functional work before the overall UI redesign. Update the published and repository documentation after the redesign, then remove this checklist.

Checks below describe work verified in the PC checkout. The release still needs to be pushed and deployed.

- [ ] Cloudflare retention: verify actual R2 deletion after expiry. Production returned HTTP 404 after the canary expired, and both encrypted objects were present before the sweep. The audit found two legacy shares without an expiry. Preserve those existing links pending a decision. Aggregate cleanup metrics and API expiry limits are implemented locally.
- [ ] Large files: a 104 MB PDF rendered, searched, jumped to pages, and recovered after a failed range request. A 518 MB video started and sought without reading the full file. Mobile Chromium emulation downloaded the whole video through the streaming fallback. Complete the Firefox and final byte-equality checks.
- [ ] HTML bundles: linked HTML pages, responsive images, and CSS background assets passed the browser check. Verify a bundled web font in the sandbox.
- [x] Documents: PDF search and page jump, XLSX sheet navigation and row filtering, visual DOCX and PPTX previews passed browser checks.
- [ ] More formats: ZIP, TIFF and OBJ passed browser checks. Finish HEIC and verify embedded glTF/GLB and STL samples.
- [x] CLI and automation: repeatable install and update implemented. The installed CLI published and inspected shares, and its MCP server passed the handshake and health check.
- [ ] Self-hosting: the Docker Compose stack passed create, read, restart persistence, and revoke. Verify the scheduled expiry sweep removes a test share from SQLite and S3-compatible storage.
- [x] Full UI redesign: desktop and mobile checks passed for the workspace and viewer, filters, sorting, sidebar resizing, keyboard navigation, and slideshow annotations.
- [ ] Final verification: test, push code, deploy, smoke-test production, and publish a review link with the installed CLI.
- [ ] Update repository and in-app documentation, then remove this checklist.
