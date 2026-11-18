# Security policy

Report vulnerabilities privately through GitHub's **Report a vulnerability** flow in the Security tab if enabled, or contact the repository owner privately. Do not create a public issue containing exploit details, full `#k=` links, revocation credentials or real file paths.

The secret in a share link grants read access until expiry or revocation. After unlocking, the browser keeps it in tab-scoped `sessionStorage` for refreshes. **Lock tab** clears the retained secret. Some browsers restore session storage with restored tabs; an origin-level XSS could access the session key. Decrypted file bytes remain in memory, not persistent browser storage.

Security fixes target the latest `main`. Automated audits are not independent penetration tests. Security-sensitive components include AES-GCM and HKDF, file preview sandboxes, Cloudflare/self-hosted authorization and MCP directory restrictions.
