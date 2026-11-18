# Share implementation checklist

Check each item after verification. Finish functional work before the overall UI redesign. Update the published and repository documentation after the redesign, then remove this checklist.

Checks below describe work verified in the PC checkout. The release still needs to be pushed and deployed.

- [x] Cloudflare retention: verified the scheduled handler against production D1 and R2. The canary returned HTTP 404 at expiry, then its D1 record and both R2 objects were removed. Two legacy shares were preserved.
- [x] Large files: verified a 104 MB PDF with range reads, search, page jumps and interruption recovery. A 518 MB video sought and downloaded with matching SHA-256 in desktop Chromium and Firefox. Mobile Chromium emulation also saved the complete file.
- [x] HTML bundles: verified linked HTML, responsive image sources, CSS backgrounds, and a bundled web font.
- [x] Documents: PDF search and page jump, XLSX sheet navigation and row filtering, visual DOCX and PPTX previews passed browser checks.
- [x] More formats: verified ZIP, TIFF, HEIC, OBJ, glTF, GLB, and STL in the browser.
- [x] CLI and automation: repeatable install and update implemented. The installed CLI published and inspected shares, and its MCP server passed the handshake and health check.
- [x] Self-hosting: verified Docker Compose publishing, reading, restart persistence, revoke, and expiry cleanup in both SQLite and S3-compatible storage.
- [x] Full UI redesign: desktop and mobile checks passed for the workspace and viewer, filters, sorting, sidebar resizing, keyboard navigation, and slideshow annotations.
- [ ] Final verification: test, push code, deploy, smoke-test production, and publish a review link with the installed CLI.
- [ ] Update repository and in-app documentation, then remove this checklist.
