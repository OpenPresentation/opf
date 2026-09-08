# Continue the OPF ecosystem work

The coordinated working branch is `codex/opf-ecosystem-20260907` in these repositories:

| Checkout | Draft PR |
| --- | --- |
| opf | https://github.com/OpenPresentation/opf/pull/9 |
| opf-render | https://github.com/OpenPresentation/opf-render/pull/1 |
| opf-editor | https://github.com/OpenPresentation/opf-editor/pull/1 |
| opf-pptx | https://github.com/OpenPresentation/opf-pptx/pull/1 |
| pptx-gallery | https://github.com/Data-Advantage/pptx-gallery/pull/9 |
| openpresentation-site | https://github.com/Data-Advantage/openpresentation-site/pull/5 |

Clone the six branches into sibling directories. Use Node.js 24 and pnpm 10.33.2. From the parent directory:

```sh
gh repo clone OpenPresentation/opf -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-render -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-editor -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-pptx -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/pptx-gallery -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/openpresentation-site -- --branch codex/opf-ecosystem-20260907
```

Install dependencies with `pnpm install --frozen-lockfile` in `opf`, `pptx-gallery` and `openpresentation-site`; use `npm ci` in the three library repositories. Then, from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test
pnpm test:skills
pnpm test:ecosystem
pnpm test:layout
pnpm test:lists
pnpm demo:editor
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The link step builds the sibling libraries against the current core. Re-run it after reinstalling dependencies. The ecosystem currently requires coordinated source builds; the older stable registry versions do not contain these new APIs. Generated review artifacts, installed dependencies and local server state are excluded from Git and rebuilt by these commands.

Start the editor with `python3 -m http.server 3102 --directory artifacts/editor` from `opf`. In another terminal start the gallery with `OPF_LOCAL_WORKSPACE=1 pnpm dev --port 3101` from `pptx-gallery`. From `openpresentation-site`, run `OPF_LOCAL_SOURCE=../opf pnpm sync:opf`, then `pnpm dev --port 3103`.

For public-site documentation built from a remote branch instead of the sibling checkout, use `OPF_REPO_REF=codex/opf-ecosystem-20260907 OPF_FORCE_SYNC=1 pnpm sync:opf`.

Production builds use `OPF_LOCAL_WORKSPACE=1 pnpm build` in `pptx-gallery` after linking, and `OPF_LOCAL_SOURCE=../opf pnpm build` in `openpresentation-site`. The gallery workspace flag lets Turbopack resolve the sibling package. On hosted builds, set the site source ref explicitly until the coordinated OPF PR is merged.

## September 7 continuation on this machine

PR #8 has been reconciled locally into the checkpoint branch, retaining its structural package types, catalog/index fixes, governance, Node 20/24 discovery, lint, and release gates. The migrated validator suite now accepts the supported nested-block shape; both the migrated CLI suite and the checkpoint's 60 command checks run against the current CLI contract. Named schema `$defs` remain statically accessible without restoring enormous literal declaration files; this was necessary for the gallery composition endpoint to compile.

A new `.github/workflows/ecosystem-ci.yml` checks the four public repositories at explicit sibling checkpoint commits. Its local equivalent is `pnpm build`, `node scripts/link-ecosystem.mjs --packages-only`, then `pnpm test:packages`. The editor demo falls back to the bundled public examples if the private gallery checkout is absent; `OPF_BUNDLED_GALLERY=1` exercises that path locally. Existing standalone workflows and the renderer's historical golden gate have not been weakened. Their release dependencies and approved pixel baseline still need work. The coordinated workflow has not yet been pushed or run on GitHub.

`release-plan.json` records release targets (core 0.4.0; renderer/editor/PPTX/CLI 0.1.0). Core 0.4.0 and CLI 0.1.0 manifests and publishing workflows are prepared locally; none are published. Downstream manifests and registry lockfiles await the core release. `pnpm test:registry-ecosystem` installs these exact versions without local dependency overrides; it is expected to fail until publication. `pnpm pack:ecosystem` builds local preview.11 artifacts, which remain explicitly unpublished.

Verified during this continuation: core Node 20 and Node 24 test suites; lint, typecheck, example validation and previous-release gate; all three library model suites; cross-package geometry, pagination, rich text/list, data and font checks; 854 gallery documents; gallery production build and 106 unit tests; public-site production build and 583 raw-file hashes, six downloaded skills and seven guide pages; local tarball installation/type/browser-bundle checks; 40 source and 40 installed-package browser creation checks. The actual editor was visually inspected. The historical renderer PNG baseline is still skipped for the current corpus. An explicit rerun against its original 29713f5 corpus fails, confirming that reviewed baseline renewal remains required. Native PowerPoint raster comparison is still outstanding.

Registry reads still report core 0.3.0, renderer 0.0.2, editor/PPTX 0.0.1 and CLI 404. Local `npm whoami` returns ENEEDAUTH; reading trusted-publisher settings returns 401. No credentials were displayed. No npm publication, remote PR update, push, merge or deployment has occurred in this continuation. The user's session instructions require confirmation before external GitHub writes. Prepare and review the reconciled checkpoint before requesting that confirmation, then publish core first, refresh downstream dependency ranges and genuine registry lockfiles, publish the remaining packages, and run the registry consumer check. The CLI's initial publication requires an authenticated maintainer path; do not invent a successful trusted-publisher setup.

## Checkpoint verification

All six branches are pushed to their origins. Newer upstream renderer, gallery and site changes have been merged into these checkpoint branches. The merged gallery passes its 106 unit tests, production build, nine served-document smoke checks, and validation/rendering of all 854 gallery documents. The merged public site passes its production build and verification of 581 raw file hashes, six downloadable portable skills, seven agent guide pages, and schema/text discovery endpoints. The browser checks confirmed that the gallery retains both dynamic composition and the newer related-layout design.

OPF [PR #8](https://github.com/OpenPresentation/opf/pull/8) remains a separate health-pass branch, `claude/repo-branch-status-rl7pwd`. Fixes for Node 20 test discovery and the publish breaking-change gate are committed and pushed there at `8b7c45d`; both Node 20 and Node 24 CI jobs pass. That PR is not yet merged or incorporated into the six checkpoint branches. Its test migration, schema housekeeping and package slimming need reconciliation with this work before release.

## Current scope and remaining work

The branch includes shared dynamic layout and pagination, loaded-font measurement and substitutes, rich text/lists, CSV/JSON import, an installable agent CLI, six portable skills, schema-driven properties, copy/import/galleries, canvas resizing/moving/creation/deletion, native PPTX improvements, and site/galleries integration. See [ecosystem quality](plans/ecosystem-quality.md) and [coverage](plans/spec-editor-coverage.md) for evidence and remaining fidelity gaps.

The broader goal is still active. Continuous rich typing, advanced table/media/preset fidelity, native PowerPoint raster comparison, coordinated public npm releases and CI integration remain work. Local preview tarballs are not evidence of registry publication.

Standalone renderer CI currently fails because its installed stable `@openpresentation/opf` lacks the new `./composition` export. The gallery also needs the new composition/pagination APIs from the coordinated core; a normal registry-only install is not sufficient. Use the sibling build/link procedure above to continue locally. Before marking these PRs ready, integrate PR #8, establish a coordinated source CI or publish the new core first, update downstream dependency ranges and lockfiles, and verify clean npm installs and rendering baselines. The last observed core/editor/PPTX checkpoint CI checks passed; this does not establish full ecosystem release readiness. No new npm package versions have been published from this checkpoint.
