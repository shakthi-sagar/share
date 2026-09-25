## Summary

<!-- What problem does this solve and what behavior changes? -->

## Security and compatibility

<!-- Cover encryption, authorization, protocol, data exposure, and old-share compatibility. -->

- [ ] No master secret, plaintext, file path, or authorization material reaches logs or server storage.
- [ ] Protocol compatibility is unchanged, or the versioning and migration plan is documented.
- [ ] Configuration changes update `.env.example` and `scripts/config.mjs`.

## Verification

- [ ] `pnpm biome check .`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Relevant desktop and narrow UI flows were checked when applicable.
- [ ] `pnpm smoke:deployment` passed after an authorized deployment when applicable.

## Deployment notes

<!-- Migrations, resource changes, rollout steps, or "None". -->
