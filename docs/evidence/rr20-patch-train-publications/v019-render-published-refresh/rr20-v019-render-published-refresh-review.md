# Local v0.19 renderer published-main refresh

Original immutable candidate: `127669807df12fbead5ea805c4d54a7c3fcbc03b` at `/private/tmp/opf-v019-render-refresh` (untouched).
New isolated worktree: `/private/tmp/opf-v019-render-published-refresh`.
Branch: `codex/rr-81-render-published-refresh`.
Final clean head: `d4ab7a5861719fb366e50299ee0604b05eec444e`.
Merged actual published main: `de0a5034f49dbacfe190946ec7416a976981cf45`.

Before tree: `444ad274a260e382d6c53587da21f19f0573d32f`.
After tree: `c5320e3ae5dab1dfc6bf9970ac86b2b9b06c5f19`.
Published-main tree: `3231ef7e0052e285b59bb1bd71ac664a47f1339c`.

Only conflict was package.json version/prerequisite header: selected authentic 0.18.2 and retained `opf.requiresUnreleasedCore: 0.19.0`. Core dependency adopts published main ^0.18.4. All nine changed paths are published release metadata, changelog and six assembled fragment deletions. Source/dist/test/scripts/workflows/font manifest/goldens have an empty diff against original127 candidate. Original v2 prerequisite, runtime changes and baseline bytes remain intact. No gallery range/lock fabrication or staging declaration changes.

Qualification: Node24.21.0/npm11.16/TMPDIR=/private/tmp. Fresh frozen `npm ci` passed against authentic committed registry lock (`/private/tmp/rr20-v019-render-published-ci.log`). Then ONLY this disposable checkout's installed core was replaced by an explicit link to `/private/tmp/opf-v019-core-current-integration/packages/javascript`, and gallery linked to `/private/tmp/opf-gallery2-bootstrap` (core c6b81092, gallery e0a7eee). Those links qualify source behavior, not registry installability of v2. No shared source or earlier staged packet changed.

Serial `npm run build`, `npm run typecheck`, `npm run validate`, `node test/layout-templates.mjs`, `git diff --check` all passed, session2373 terminal0. Logs `/private/tmp/rr20-v019-render-published-{build,type,validate,layout}.log`. Syntax254 files; layout997 items/654cards/27bled pictures/95column lists;42overflow sources152pages/7016bounded region elements;84gallery alignment cases. Build caused no tracked dist change. No check:changed script exists here. A full suite was not repeated for this metadata-only merge; existing immutable source qualification remains historical, with these focused source checks newly run.

No new golden generation/promotion, packed final graph, registry v0.19 acceptance, cross-platform/native acceptance, release preparation, publication, push or PR. Genuine v0.19 metadata and final source-lock/registry adoption are still pending.
