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

The following local follow-ups remain outside this merged checkpoint. The PPTX table and image branches are now combined in the integration checkpoint below:

- PPTX table fidelity: 7453c33 (c549049 fitting plus ba0ad8a import fixes, reconciled with main) on codex/table-export-fidelity-20260908 in /private/tmp/opf-table-export/opf-pptx. Native editable cells use shared loaded-font fitting, preserve nested minimum font sizes, fill uneven rows, and match the SVG border theme slot. Node 20/24 tests compare 168 cells, including 24 shrinking cases. Quick Look and Keynote can open the exports, but wrapping differs. Keynote's round-trip changes the specimen's 11.25/6.75-point text to 11/6 points; this is viewer-specific evidence, not PowerPoint verification.
- Site snapshot source links: 2858456 (d5642af reconciled with main) on codex/site-snapshot-links-20260908 in /private/tmp/opf-site-snapshot/openpresentation-site. View-source links serve the exact documentation snapshot bytes instead of GitHub main. Regression tests, production build, 583 raw-file hashes, six skill downloads, seven guides and representative source links pass locally.

Next: review the combined PPTX integration and separate site source-link change, then continue native PowerPoint comparison, real OS typing, and the remaining table/media/preset roadmap. The local commits are not published releases.

The table follow-up also preserves headerless first rows and empty rows on import using native firstRow flags. Node 20/24 tests and a clean local-tarball consumer pass. Keynote 14.4 recognizes zero headers/three rows versus one header/four rows in a two-slide specimen, with blank rows retained. Native PowerPoint remains untested. Local PR descriptions are ready; approval to open the two new PRs is pending.

## Local image-fidelity follow-up

Commit 0007ff1 on codex/image-fit-fidelity-20260908 in /private/tmp/opf-image-fit/opf-pptx is separate from the table branch. It preserves native picture proportions with fit/crop, honors slide overrides, and maps all eight JPEG EXIF orientations to native rotation/mirroring without recompressing pixels. PNG/JPEG/GIF/WebP dimensions come from the actual embedded bytes. Unsupported/unreadable dimensions produce a path-specific error. Node 20/24 suites pass with image-size loading blocked; 45 geometry cases, eight orientations in fit/crop, clean local-tarball installation and browser bundling pass. Keynote visually shows correct wide/tall PNG fit/crop and all eight JPEG orientations. Native PowerPoint, animated/vector media, non-JPEG orientation and lossless picture import remain open. The change is committed locally and unpublished.

## Combined PPTX integration checkpoint

Local merge commit 4a41b2b on codex/pptx-fidelity-20260908 in /private/tmp/opf-pptx-fidelity/opf-pptx combines the table and image branches above. The original branches are preserved. An installed-example audit also exposed duplicate native object IDs on 23 slides; the integration repairs only duplicate IDs and adds an eight-slide mixed table/text/image/chart/list regression. Repeated multi-chart exports also exposed ZIP ordering differences when PptxGenJS counters cross digit widths; sorting after part-name normalization fixes them.

Node 20 and 24 pass the integrated suites, syntax checks and package metadata validation. A new structural corpus gate exports/imports all 126 decks / 805 slides, checking slide XML, unique IDs, finite geometry, table grids and imported slide counts. It explicitly uses fallback fonts and 26 synthetic image substitutions. With original asset requests and fallback fonts, 102 decks export/import; the remaining 24 encounter missing local assets or a truncated PNG fixture. With strict available fonts and original assets, only one deck completes. These are different evidence levels: the complete structural gate is not proof of original-asset, typography or native-viewer fidelity.

The clean consumer in /private/tmp/opf-pptx-fidelity/consumer passes the complete suite against the installed local tarball plus published core 0.4.0 and renderer 0.1.1, including the structural corpus and a browser bundle.

Local packed artifact: /private/tmp/opf-pptx-fidelity/packed/openpresentation-opf-pptx-0.1.0.tgz, SHA-1 ea3215e9cee82366e131e6b3d3115cd5e19a0b8e. Version 0.1.0 is unchanged for this unpublished development artifact; it must not overwrite the existing npm release. No follow-up branch has been pushed, no new PR opened, and no new package published. The earlier request to open follow-up PRs remains pending; the prepared PPTX description now covers this combined implementation.

## Image media-type and example corrections

PPTX integration now advances to 87f6616. Native raster file extensions and per-part content types are derived from actual embedded PNG/JPEG/GIF/WebP bytes, so transformed host assets and incorrect MIME/path hints cannot label JPEG pixels as PNG. Import detects these formats from bytes as well. Thirty-two cases cover byte results, typed/untyped result objects, data URIs, local paths and host paths/URIs, plus mislabeled older native files. Node 20/24 complete suites and package checks pass. The clean consumer at /private/tmp/opf-pptx-fidelity/consumer-87f6616 passes all tests, the 805-slide structural corpus and browser bundling with published core 0.4.0 / renderer 0.1.1. New local tarball: /private/tmp/opf-pptx-fidelity/packed-87f6616/openpresentation-opf-pptx-0.1.0.tgz, SHA-1 15ce44e1ee1faed81aed711a3e3795a0974d7145. Earlier tarballs remain historical artifacts, and no new version is published.

Keynote 14.4 directly opened the four-format specimen at artifacts/media-types/native-media-types.pptx in the integration worktree. PNG, JPEG and GIF show the expected quadrants and round circle. WebP imports as an empty rectangle, confirmed in both the slide overview and selected slide. That check established the need for compatible PNG fallback; the next checkpoint below implements and verifies it. Correct ZIP metadata alone was insufficient. No native PowerPoint installation is available. The generated specimen was closed without saving.

Core local commit ef25735 replaces the eight-byte PNG signature in examples/technical/asset-source-forms.opf.json with the complete project-authored square PNG from the PPTX test fixtures. All 126 examples validate. The corrected example exports/imports four slides with its exact PNG bytes retained, and its SVG/PNG image slide was visually inspected using explicit fallback fonts. Core/CLI build verification includes checking the generated examples against this source. Other illustrative file/remote references remain host-supplied, not bundled. The correction is unreleased and requires a future core package/site snapshot update.

## Compatible WebP checkpoint

PPTX integration advances to local commit 8197854 on codex/pptx-fidelity-20260908. Default imageFormat: "compatible" converts WebP to static PNG after resolving the original asset once; fit/crop uses the decoded PNG dimensions. Pixel comparisons cover alpha, EXIF orientation/mirroring and the first animation frame. imageFormat: "preserve" retains unchanged WebP embedding. Conversion errors carry the OPF path, and compatible conversion has a 40-megapixel limit. Original source documents/bytes are unchanged; the exported picture contains PNG pixels, not original WebP metadata or animation.

Node uses lazy Sharp 0.35.4 decoding, raising the package minimum to Node 20.9.0. Browser conditional imports select Blob/image/canvas decoding and exclude Sharp/Node code. Platform dependencies are present in the lockfile; npm's optional native dependencies must be installed normally. The audit still reports only the existing image-size/PptxGenJS advisories. esbuild 0.28.2 is a development-only dependency used to enforce the browser boundary.

Node 20.20.2 and 24.20.0 complete suites, syntax and metadata checks pass. Thirty-six WebP cases match independent Pillow-decoded first-frame RGBA hashes; decoder-unavailable and malformed/oversize cases produce path-specific errors. Existing preservation tests explicitly select preserve mode. The 126-deck / 805-slide structural corpus remains green with its previously documented substitutions. Thirteen browser pixel/geometry/input checks pass, including alpha, EXIF, animation's first frame and DOM canvas output. npm test builds the browser verification page and asserts no native modules enter its bundle; actual browser execution remains a separate UI check.

Keynote 14.4 now displays all six converted WebP specimens in /private/tmp/opf-pptx-fidelity/opf-pptx/artifacts/webp-fallback/compatible-webp.pptx. The earlier empty rectangles are gone; expected quadrants, circles, transparency and orientation are visible. Arial labels avoid the previous missing-font notice. The generated document was closed without saving. Microsoft PowerPoint and other browsers remain unverified, and SVG/vector assets and full animation playback remain separate work.

Local tarball /private/tmp/opf-pptx-fidelity/packed-8197854/openpresentation-opf-pptx-0.1.0.tgz has SHA-1 6c249cf52d0624c9408bd8abb4e544d444b20c3a. Clean consumer /private/tmp/opf-pptx-fidelity/consumer-8197854 installs published core 0.4.0 / renderer 0.1.1 and this tarball, and passes the complete model/image/corpus suite and browser bundle checks. The packed browser implementation also passes all 13 browser checks. Both decoder files and conditional package imports are packaged. This is unpublished development version 0.1.0; do not overwrite the existing registry release. No follow-up PRs, pushes or publications have been made.

## Renderer WebP raster checkpoint

Local renderer commit 18c79e4 on codex/renderer-webp-20260908 in /private/tmp/opf-renderer-webp/opf-render fixes WebP images disappearing from PNG/PDF output. The new Node-only raster preparation decodes embedded WebP data URIs to static PNG; it leaves the source SVG/OPF unchanged and adds no external URL/path resolution. href/xlink:href, base64/percent encoding, XML character references, alpha, EXIF and the first animation frame are covered. Malformed input reports its data-opf-path when present or svg.images.N. Input format is checked before decoding and the 40-megapixel Sharp limit applies.

Node 20.20.2 and 24.20.0 full suites, syntax/package checks and all 805 existing golden rasters pass; no baseline changed. Twenty-three focused cases inspect raster pixels, fit/crop, actual PDF image streams and PDF alpha masks. The historical renderer demonstrably fails the first independent pixel reference. Fixtures regenerate byte-for-byte with Pillow 12.3.0; the six-image overview PNG was visually inspected. PNG/PDF conversion uses lazy Sharp 0.35.4 and now requires Node 20.9+. The renderer audit reports zero advisories at this checkpoint. Browser SVG exports exclude the native raster adapter.

The local renderer tarball /private/tmp/opf-renderer-webp/packed/openpresentation-opf-render-0.1.1.tgz has SHA-1 d19e216a4e8ec0762ed9e912b0708002ec43be64. /private/tmp/opf-renderer-webp/consumer installs it with local PPTX 8197854 and published core 0.4.0, editor 0.1.1 and CLI 0.1.0. Both packages' focused/model/corpus checks pass, browser bundling excludes native decoders, editor import succeeds and CLI reports its expected versions. This is a mixed local/registry development consumer, not evidence of a new registry release.

The renderer branch and all earlier follow-ups remain local/unpublished. Prepared descriptions now cover four potential follow-up PRs: PPTX fidelity, renderer WebP raster output, the core example correction/handoff, and site snapshot source links. Existing examples/font substitutions and native Microsoft PowerPoint coverage remain separate limits. The JPEG PNG/PDF gap is addressed by the next checkpoint; other media/layout/editor requirements remain open.


## Renderer JPEG orientation checkpoint

Local renderer commit 87663fb extends codex/renderer-webp-20260908 in /private/tmp/opf-renderer-webp/opf-render to honor JPEG EXIF orientations 2–8 in PNG/PDF output. It uses the existing lazy Sharp decoder and private rasterization copy. JPEGs with orientation 1 or no orientation retain their exact SVG attribute spelling and compressed bytes. Source OPF/SVG and browser SVG exports remain unchanged. Malformed JPEGs report the image path.

Node 20.20.2 and 24.20.0 verification passes. The final Node 20 suite, syntax and metadata checks are recorded in artifacts/jpeg/node20-verification.log in the renderer worktree; all 805 golden rasters remain unchanged. Twenty-four focused cases cover all eight orientations, fit/crop, independent Pillow pixels (maximum channel difference 2), actual PDF RGB image streams, deterministic PNG output and errors. The historical renderer fails orientation 2 with a maximum channel error of 255. All 16 fixture JPEG/PNG files regenerate byte-for-byte using Pillow 12.3.0. The eight-image PNG overview was visually inspected.

Sixteen browser OPF-SVG orientation/fit/crop cases passed before the Mac locked, with an incorrect-orientation control. Maximum mean channel error was 0.6156662326388889, maximum fraction of channels differing by more than 10 was 1.2241753472222223%, and maximum individual channel difference was 49. The incorrect-orientation control had mean error 56.44899848090278. These are geometry/orientation checks with aggregate error bounds, not pixel-identical browser output. The checked-in harness is test/jpeg-browser.js; npm test builds it and asserts native raster code is absent. No additional browser run was performed after the Mac locked.

Packed artifact: /private/tmp/opf-renderer-webp/packed-jpeg/openpresentation-opf-render-0.1.1.tgz, SHA-1 c239043a3230a9d4fb55f8213abde1d1ef12a7e8. A fresh /private/tmp/opf-renderer-webp/consumer-jpeg installs this tarball, local PPTX 8197854, and published core 0.4.0/editor 0.1.1/CLI 0.1.0. All 23 WebP and 24 JPEG focused cases pass against the installed renderer. Editable PPTX, SVG/PNG, editor import and the combined browser dependency boundary pass. The development artifact retains version 0.1.1; it is not a registry publication and must not overwrite that released version.

GitHub was rechecked: all six coordinated PRs remain merged. The four follow-ups remain local, with the earlier request to push/open their draft PRs still pending. The renderer description now covers both WebP and JPEG raster fixes. Native Microsoft PowerPoint, additional browsers and remaining media/editor fidelity remain open.
