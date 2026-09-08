# Continue the OPF ecosystem work

The coordinated ecosystem PRs were merged on September 8, 2026 UTC. Continue from `main` in these repositories:

| Checkout | Merged PR |
| --- | --- |
| opf | https://github.com/OpenPresentation/opf/pull/9 |
| opf-render | https://github.com/OpenPresentation/opf-render/pull/1 |
| opf-editor | https://github.com/OpenPresentation/opf-editor/pull/1 |
| opf-pptx | https://github.com/OpenPresentation/opf-pptx/pull/1 |
| pptx-gallery | https://github.com/Data-Advantage/pptx-gallery/pull/9 |
| openpresentation-site | https://github.com/Data-Advantage/openpresentation-site/pull/5 |

Clone the six repositories into sibling directories. Use Node.js 24 and pnpm 10.33.2. From the parent directory:

```sh
gh repo clone OpenPresentation/opf -- --branch main
gh repo clone OpenPresentation/opf-render -- --branch main
gh repo clone OpenPresentation/opf-editor -- --branch main
gh repo clone OpenPresentation/opf-pptx -- --branch main
gh repo clone Data-Advantage/pptx-gallery -- --branch main
gh repo clone Data-Advantage/openpresentation-site -- --branch main
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

The link step builds the sibling libraries against the current core. Re-run it after reinstalling dependencies. Core 0.4.0, renderer/editor 0.1.1 and PPTX/CLI 0.1.0 are now published. The source-link workflow remains useful for development. Generated review artifacts, installed dependencies and local server state are excluded from Git and rebuilt by these commands.

Start the editor with `python3 -m http.server 3102 --directory artifacts/editor` from `opf`. In another terminal start the gallery with `OPF_LOCAL_WORKSPACE=1 pnpm dev --port 3101` from `pptx-gallery`. From `openpresentation-site`, run `OPF_LOCAL_SOURCE=../opf pnpm sync:opf`, then `pnpm dev --port 3103`.

For public-site documentation built from a remote branch instead of the sibling checkout, use `OPF_REPO_REF=codex/opf-ecosystem-20260907 OPF_FORCE_SYNC=1 pnpm sync:opf`.

Production builds use `OPF_LOCAL_WORKSPACE=1 pnpm build` in `pptx-gallery` after linking, and `OPF_LOCAL_SOURCE=../opf pnpm build` in `openpresentation-site`. The gallery workspace flag lets Turbopack resolve the sibling package. Normal standalone gallery builds now use registry core 0.4.0. Normal site builds default to the source tag matching the installed core version; stale/local snapshots refresh automatically unless OPF_LOCAL_SOURCE explicitly selects local development.

## Current release checkpoint — September 8 UTC

PR #8 is incorporated into the pushed PR #9 branch through merge 10ed11c. Both test suites, structural package slimming, named schema definitions, catalog/index fixes, governance and Node 20/24 release gates are retained. All six PRs are merged with merge commits; GitHub also marked PR #8 merged through its preserved ancestry. Both sites deployed automatically from the merged main branches.

All five planned versions are now published and resolve through ordinary npm installation:

| Package | Version | Source and publication |
| --- | --- | --- |
| @openpresentation/opf | 0.4.0 | Tag opf-v0.4.0 at 6180096; workflow 34182120112 with provenance |
| @openpresentation/opf-render | 0.1.1 | Tag opf-render-v0.1.1 at de53df7; workflow 34184779283 with provenance |
| @openpresentation/opf-editor | 0.1.1 | Tag opf-editor-v0.1.1 at dbbe1a1; workflow 34184868180 with provenance |
| @openpresentation/opf-pptx | 0.1.0 | Tag opf-pptx-v0.1.0 at 7a385fc; retried workflow 34182814991 with provenance |
| @openpresentation/cli | 0.1.0 | Reviewed standalone tarball from core 6180096, authenticated first publication; no provenance on this bootstrap release |

The user completed npm login and browser 2FA. Trusted publishers now exist for editor/PPTX release.yml and core cli-publish.yml. Initial permissions failures were resolved, and exact tagged jobs reran successfully. The CLI public tarball SHA-1 is 0308493d1d85ce18518b69882085419ec3817d73, matching the reviewed artifact. npm metadata took several minutes to expose the new package; it now installs normally. Do not republish an existing version.

`pnpm test:registry-ecosystem` passed for all five exact versions with no local overrides: model operations, fonts, SVG, editable PPTX, TypeScript, browser bundle, CLI create/validate/version. All 60 CLI command checks also pass using the registry-installed executable. `release-plan.json` pins immutable core/editor harness refs for the published release set so unreleased source tests cannot silently change release verification. `test:registry-libraries` is an additional four-library check, not a replacement for the complete gate. All six registry-installed browser suites pass 176 checks (34 canvas, 19 lists, 46 rich text, 19 layout, 18 blocks, 40 creation). Browser evidence lives in `artifacts/npm/registry-browser-verification.json`.

Published in 0.1.1: renderer 5472483 adds trace-only rich-line geometry; editor a4be429 adds native continuous rich typing with glyph-aligned caret/pointer selection, mixed-style preservation, draft undo/redo, cancellation, conflict protection and composition lifecycle handling. Source browser suites pass 176 checks (34 canvas, 19 lists, 46 rich text, 19 layout, 18 blocks, 40 creation). Actual keystrokes and a measured pointer hit were verified. Renderer/editor 0.1.1 passed standalone Node 20/24 CI (34184700599 and 34184801283), trusted publication, and clean five-package registry verification. Real OS IME, bidi/complex-script and cross-browser behavior remain open. Normal renderer output is unchanged and all 805 raster checks pass.

The renderer baseline covers 805 slides in 126 installed-core example decks; missing/changed corpora fail and updates create review candidates without replacing the baseline. All 17 overview sheets were inspected and timeline endpoint clipping was fixed. PptxGenJS remains pinned to 4.0.1; its unused image-size advisory remains unresolved, with model/image embedding tested while parser loading is blocked. Neither baseline nor model checks establish native PowerPoint fidelity.

Gallery review fix ee01bc5 passes production build and header geometry checks at 320, 640, 1024, 1279, 1280 and 1440 pixels. Phone/laptop screenshots and mobile search were checked. Site review fix fe638e8 removes duplicate sitemap routes, preserves root-relative guide links, omits catalogs without indexes and repairs code-block colors. Its prebuild regression suite covers 592 unique sitemap URLs, link resolution and missing/empty/legacy catalogs. All five confirmed review threads were resolved before merging.

The gallery editor and site showcase have now been regenerated from the exact npm set above. All 854 gallery documents validate and render using the installed packages; the schema reference exposes 604 fields. Checked-in manifests record package tarball URLs/integrities, example source refs and SHA-256 asset hashes. Normal production builds pass. Served checks pass for nine gallery documents, 583 site source hashes, six skills, seven guides and all refreshed editor/showcase asset hashes.

Reproduce registry assets after installing core build tooling and fetching the immutable harness/example refs in release-plan.json:

```sh
pnpm test:registry-ecosystem
pnpm prepare:gallery:registry
pnpm build:showcase:registry
```

The gallery command updates its checked-in editor/reference files. Copy the four files in artifacts/site-showcase to openpresentation-site/public/showcase, then build both sites. Registry checks generate their own browser HTML and font files; prior source-demo artifacts are no longer required. Source preparation removes any old registry manifest so it cannot falsely label a development bundle as published.

Final reviewed core ece9b90 passed core CI 34185231548 and coordinated CI 34185231533 on Node 20/24. The workflow pins renderer/editor release commits. Main now contains the complete ecosystem implementation and the 0.4.0 changelog correction. The user authorized pushes, PR updates, npm publication, and these six merges with their normal site deployment triggers. Preserve unrelated gallery pnpm-workspace.yaml.

## Current scope and remaining work

The branch includes shared dynamic layout and pagination, loaded-font measurement and substitutes, rich text/lists, CSV/JSON import, an installable agent CLI, six portable skills, schema-driven properties, copy/import/galleries, canvas resizing/moving/creation/deletion, native PPTX improvements, and site/galleries integration. See [ecosystem quality](plans/ecosystem-quality.md) and [coverage](plans/spec-editor-coverage.md) for evidence and remaining fidelity gaps.

The broader goal is still active. Real OS IME/cross-browser typing, advanced table/media/preset fidelity, and native PowerPoint raster comparison remain work. Local preview tarballs are not evidence of registry publication.

## Merged checkpoint and local follow-ups

| Repository | Main merge commit |
| --- | --- |
| opf | c6323d9 |
| opf-render | 371c6ce |
| opf-editor | 33cfebc |
| opf-pptx | e3afb70 |
| pptx-gallery | 22f1748 |
| openpresentation-site | b385495 |

Both production deployments are ready at www.pptx.gallery and www.openpresentation.org, from the exact merge commits above. Releases were already published before merging; no versions were republished.

Post-merge checks passed: core 34186567364, coordinated packages 34186567415, renderer 34186581381, editor 34186583983, PPTX 34186586280 and gallery 34186589351. Live verification passed for 583 source-file hashes, six downloadable skills, seven guides, schema/text endpoints and nine schema-valid gallery documents. All seven gallery manifest hashes and three showcase hashes match production. The manifest's opf-spec.json is served at /api/opf-spec.json; the other editor assets are under /opf-editor/. The live editor renders six starter slides and opens its complete property controls.

Two separately tested local follow-ups remain outside this merged checkpoint:

- PPTX table fidelity: c549049 on codex/table-export-fidelity-20260908 in /private/tmp/opf-table-export/opf-pptx. Native editable cells use shared loaded-font fitting, preserve nested minimum font sizes, fill uneven rows, and match the SVG border theme slot. Node 20/24 tests compare 168 cells, including 24 shrinking cases. Quick Look and Keynote can open the exports, but wrapping differs. Keynote's round-trip changes the specimen's 11.25/6.75-point text to 11/6 points; this is viewer-specific evidence, not PowerPoint verification.
- Site snapshot source links: d5642af on codex/site-snapshot-links-20260908 in /private/tmp/opf-site-snapshot/openpresentation-site. View-source links serve the exact documentation snapshot bytes instead of GitHub main. Regression tests, production build, 583 raw-file hashes, six skill downloads, seven guides and representative source links pass locally.

Next: review and integrate these follow-ups as separate changes, then continue native PowerPoint comparison, real OS typing, and the remaining table/media/preset roadmap. The local commits are not published releases.
