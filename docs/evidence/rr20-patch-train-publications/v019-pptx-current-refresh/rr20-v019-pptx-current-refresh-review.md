# Local v0.19 PPTX current-main refresh

Original immutable candidate: `1fae5a9df400ea37954ad4bb4fca8c2d1b96588b`, `/private/tmp/opf-pptx-pareto-docs-integration` untouched.
New worktree `/private/tmp/opf-v019-pptx-current-refresh`, branch codex/rr-83-pptx-current-refresh.
Final clean local head `f62dd05a8ef0712ca2a35a11857f9085de6fd7a1`; authentic merged main `1954c9ce3d2c54a69666b54acdc9fcc87dcb9ca2`.
Before tree `d866e89c3a5c1e686d73fe55332b583579ad857e`.
After tree `4d1cba5ac0a51f133f478b67814b8763b3bb394c`.

Conflict-free merge. Exactly three changed paths: package.json, package-lock.json, CHANGELOG.md. Genuine main version0.18.2, core^0.18.4, optional renderer^0.18.2 and exact renderer dev0.18.2 adopted; original requiresUnreleasedCore0.19.0 retained. Lock/changelog byte-identical to actual main; src/dist/tests/scripts/workflows/fragments/goldens unchanged against original candidate. Multi-series Pareto fallback/native rejection and all v2 behavior preserved byte-for-byte.

Fresh `npm ci` against authentic committed lock passed (Node24.21.0, npm11.16.0, TMPDIR=/private/tmp), /private/tmp/rr20-v019-pptx-refresh-ci.log. Then owned installed dependencies explicitly linked to core1921a28c6d4eea090dc368c13c75ca1b359bdc39 at /private/tmp/opf-v019-engine-peer-contract/packages/javascript, renderd4ab7a5861719fb366e50299ee0604b05eec444e at /private/tmp/opf-v019-render-published-refresh, gallerye0a7eee2dfe996e680b34a907cabfe41905e6d99 at /private/tmp/opf-gallery2-bootstrap. These qualify source only, not registry-installable v0.19 metadata or an exact six-package staged graph. Shared inputs were not built/mutated.

Serial session47765 terminal0: npm run build/typecheck/validate; node test/pareto-multi-series.mjs; node test/chart-types.mjs; node test/template-layouts.mjs; node test/gallery-layout-alignment.mjs; git diff --check. Per-command logs /private/tmp/rr20-v019-pptx-refresh-{build,type,validate,pareto,charts,layout,alignment}.log. Pareto all3series preserved after provenance removal; native multi rejects; single-series unchanged. Chart56exports pass. Layout28templates/native round trips pass; all28×3 alignment cases225lines deterministic accepted geometry. No tracked dist drift. No check:changed script here; narrow mapped-equivalent checks justified by metadata-only delta, no broad suite repeated.

No push/PR/release preparation/publication/native Office, fresh golden generation or source-lock promotion. Actual main1954 is merged0.18.2 release metadata; publication was pending at assignment. This candidate's requiresUnreleasedCore0.19 declaration remains a real release gate. Original packet06 and prior staged graph identities remain historical unchanged.
