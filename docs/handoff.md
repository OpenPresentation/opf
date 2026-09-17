# Continue the OPF ecosystem work

Runtime update (September 10): use **Node 24 only** for new development and verification; see [migration instructions](migrations/node24.md). Historical Node 20/24 results and commands below describe prior checkpoints. Keep distinct browser/OS/native gates and the existing Office recovery prerequisite.

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


## Native background fill checkpoint

Local PPTX commit 4c06cf7 advances codex/pptx-fidelity-20260908 in /private/tmp/opf-pptx-fidelity/opf-pptx. Fixed solid and linear-gradient backgrounds now serialize as editable native p:bg fills rather than flattening gradients to a solid fallback. Solid opacity, hex alpha, gradient stop alpha/positions, deck defaults and slide overrides are retained. An inheritance test also exposed and fixed ignored inline theme overrides: theme objects now resolve their base record and then apply the inline properties.

SVG's object-bounding-box gradient and DrawingML's unscaled slide-coordinate gradient need both direction and stop-interval conversion. The new background helper performs that conversion and native RGB solid/linear import without hidden OPF metadata. Native integer angles/positions incur rounding. Uniform alpha returns as background opacity; differing stop alpha returns as eight-bit RGBA, which may round. Unsupported native path gradients, transformed/theme stop colors, non-default tile/flip geometry and unrepresentable stop intervals produce unsupported-background-gradient through the new optional fromPptx onDiagnostic callback. Other background/decorative features remain open.

Final Node 20.20.2 and 24.20.0 full suites, syntax and metadata checks pass (artifacts/backgrounds/node20-final.log and node24-final.log in the PPTX worktree). Coverage includes 38 principal gradient/solid cases and 990 sample comparisons derived independently from serialized SVG endpoints and native physical gradient properties across landscape, portrait and square canvases. Additional cases cover theme inheritance, alpha, native edits, repeated export/import, empty/single/descending stops, malformed colors and unsupported native fills. The historical implementation fails the first editable-gradient assertion. The structural corpus still passes 126 decks / 805 slides using its documented fallback fonts and 26 synthetic image substitutions; that is not native raster parity evidence.

Native visual verification is unresolved. Four Quick Look thumbnails (0, 30, 45 and 90 degrees) all contain the same flat RGB(106,176,222), rather than the intended gradient. The PNG files and corresponding PPTX/SVG references are under artifacts/backgrounds. Keynote UI inspection was attempted but the desktop tool reported the Mac locked; an unlock request is pending. Microsoft PowerPoint is unavailable. The native XML/mathematical checks must not be treated as proof of native appearance. This discrepancy needs investigation in a native viewer before a release decision.

Local package: /private/tmp/opf-pptx-fidelity/packed-backgrounds/openpresentation-opf-pptx-0.1.0.tgz, SHA-1 ceacb66d28703b3de866db6847084df59b0dc893. Fresh consumer /private/tmp/opf-pptx-fidelity/consumer-backgrounds installs it with local renderer 87663fb plus published core 0.4.0, editor 0.1.1 and CLI 0.1.0. Installed gradient checks, all 47 JPEG/WebP raster cases, editor import and the combined browser dependency boundary pass. The package still has development version 0.1.0 and must not overwrite the existing registry release. No follow-up pushes, PRs or publications occurred.


## JPEG picture import and dimension precision checkpoint

PPTX codex/pptx-fidelity-20260908 now advances through d08fa9e (JPEG picture import) to 4a3a6e3 (dimension precision) in /private/tmp/opf-pptx-fidelity/opf-pptx. A direct audit found that every exported JPEG EXIF orientation imported as orientation 1 because the native rotation/mirror was discarded. The importer now combines existing JPEG EXIF orientation with native quarter-turns/flips and writes the resulting orientation into a copied EXIF record, without decoding/recompressing pixels. Existing metadata is applied before the native transform; that is the importer contract, not a claim about every external viewer. All eight orientations emitted by this exporter recover exact source JPEG bytes through repeated fit-mode round-trips. Alternative text and input PPTX bytes are preserved.

JPEGs without an orientation tag receive a minimal EXIF segment, or a replacement IFD0 appended within the existing bounded APP1 segment. Original metadata entries, referenced offsets and the next-IFD link remain intact. Both byte orders and malformed metadata are covered. Native crop windows are still not represented in the imported asset, and non-quarter-turn/non-JPEG transforms are unsupported. These cases now report unsupported-image-crop or unsupported-image-orientation through fromPptx's optional onDiagnostic callback, using native picture-order paths such as slides.0.pictures.0. Import still recomposes layout and is not a lossless picture/placement/crop/effect/group round trip.

A complete image-slide preview comparison found a separate defect: emuToInches rounded native dimensions to six decimals, changing a 1280-pixel canvas to 1279.999968 pixels and perturbing raster edges. 4a3a6e3 removes that premature rounding. With the local JPEG-aware renderer, all eight complete fit-mode image-slide PNGs now match their source OPF PNG bytes after native export/import. This compares OPF-rendered previews; it does not compare native PowerPoint pixels. One imported orientation-7 PNG was visually inspected.

Node 20.20.2 and 24.20.0 complete suites, syntax and metadata checks pass, including the final precision change (artifacts/image-import/node20-precision.log and node24-precision.log). Forty-two principal image-import cases cover all eight orientations in fit/crop, 16 native quarter-turn/flip combinations, existing EXIF plus native rotation, metadata insertion/link preservation, exact source bytes, independent pixel permutations, malformed EXIF and diagnostics. The old implementation fails the exact-JPEG round-trip assertion; artifacts/image-import/before.json records its eight incorrect orientation results. The 126-deck/805-slide structural corpus remains green with documented font and image substitutions.

Latest local tarball: /private/tmp/opf-pptx-fidelity/packed-import-precision/openpresentation-opf-pptx-0.1.0.tgz, SHA-1 88a32daefda4524161c87cfc5adaa5270b3cf68a. Fresh consumer /private/tmp/opf-pptx-fidelity/consumer-import-precision installs it with local renderer 87663fb and published core 0.4.0/editor 0.1.1/CLI 0.1.0. Installed picture-import and background tests pass. verify-preview.mjs records all eight exact whole-slide PNG comparisons, editor import and the combined browser dependency boundary; results are in preview/report.json and preview-verification.log. No browser UI or native viewer run was performed for this milestone. Historical d08fa9e tarball SHA-1 3af059814d4f22ae2b992228b75b8659d9427756 remains in packed-image-import; it lacks the subsequent precision fix.

Both changes are local/unpublished, still using development version 0.1.0. The four follow-up draft PR/push request remains pending. The native gradient visual discrepancy and locked-desktop Keynote review remain unresolved; no publication or new native-compatibility claim follows from this checkpoint.


## Native Keynote background verification and merge preparation

PPTX commit 821c047 resolves the earlier native gradient verification gap. Keynote 14.4 displays editable Advanced Gradient Fill controls and exports the six landscape angles correctly. Twelve unchanged native PNGs cover those opaque angles and six portrait solid/gradient transparency cases. Eighteen comparisons, including the native Keynote PPTX reimport, pass: opaque maximum channel error 4/255 and mean below 0.38; transparent alpha error at most 1/255. Quick Look remains a thumbnail limitation, not evidence that Keynote renders these gradients flat. Microsoft PowerPoint remains unverified. Generated documents were closed without saving.

The Keynote round-trip also exposed synthetic titles added to empty/background-only slides. Import now preserves blank content and notes-only slides. Project-authored native fixtures and their hashes are checked in; normal CI does not require Keynote. The historical importer fails the blank-slide assertion. Final Node 20/24 complete suites, syntax, package metadata and browser dependency checks pass, including the 126-deck/805-slide structural corpus with previously documented substitutions. Logs are artifacts/backgrounds/native-node20.log and native-node24.log in the PPTX worktree.

The user has authorized pushing, PR updates and merging the four prepared follow-ups. Merge preparation covers PPTX 821c047, renderer 87663fb, site 2858456 and this core example/handoff branch. These changes do not publish new npm versions; the existing development version numbers must not overwrite registry releases. Historical pending-approval and locked-desktop notes above describe earlier checkpoints and are superseded here.

## Published fidelity releases and registry verification

The follow-up implementations are merged and now published through trusted publishing with npm provenance:

| Package | Version | Tagged source | Publish workflow |
| --- | --- | --- | --- |
| @openpresentation/opf | 0.4.1 | aed5e5493998a5081fea68bf3bd42c52409e0c15 | 34204122730 |
| @openpresentation/cli | 0.1.1 | aed5e5493998a5081fea68bf3bd42c52409e0c15 | 34204125018 |
| @openpresentation/opf-render | 0.2.0 | df7ce5c6915a084f101adf90e6329117c0094a23 | 34204875207 |
| @openpresentation/opf-pptx | 0.2.0 | 1fef9dcfadeeb8310b3c3b668f7506b52717b695 | 34205556749 |
| @openpresentation/opf-editor | 0.1.2 | 5819a2ac12ec22f08a348c81bc3c66630682ecfb | 34205593335 |

Core/CLI release PR 18, renderer PR 3, PPTX PR 3 and editor PR 2 were merged after Node 20/24 CI and automated review. Their merge commits passed CI before tags were pushed. GitHub releases contain matching changelog notes. Registry propagation briefly delayed PPTX availability; publication was not rerun, and the subsequent exact-version install passed.

Renderer/PPTX 0.2.0 require Node 20.9 or later and core 0.4.1. Editor 0.1.2 accepts renderer 0.1.1 or 0.2.x through its optional peer; its development dependency explicitly installs renderer 0.2.0 for CI. The renderer release uses the individually reviewed corrected-image baseline and retains the preceding core-0.4.0 manifest for audit. Only the repaired example slide changes; the other 804 raster hashes remain identical.

The clean registry consumer at artifacts/npm/registry-consumer installs all five exact release-plan versions without local package overrides. Model/API, TypeScript, browser bundling and CLI checks pass. The actual registry CLI reports 0.1.1 with bundled OPF 0.4.1 and passes 60 command checks. Eight complete JPEG image-slide previews are byte-identical before and after PPTX export/import using the installed registry packages.

The new pnpm test:registry-fidelity command runs immutable test/fixture snapshots against installed npm dist files, checks registry lock records and real paths, and rejects local package overrides. It passes 23 WebP and 24 JPEG raster/PDF cases, all 805 raster baselines, 18 captured Keynote comparisons, table/image/background/import tests and the 126-deck/805-slide structural corpus with its documented fallback fonts and 26 synthetic image substitutions. Coordinated CI now pins the release commits and also runs the exact-version registry integration and fidelity checks on Node 20/24; full core history makes the pinned browser harness source available.

Browser execution against the registry packages passes 176 editor harness checks plus 13 WebP and 16 JPEG checks. JPEG comparison retains the previously documented aggregate bounds (maximum channel 49, mean below 0.616, at most 1.225% of channels differing by more than 10); it is not pixel-identical browser output. These harnesses do not establish real OS IME, cross-browser behavior or Microsoft PowerPoint fidelity. Core remains free and provider-neutral; normal CI needs no native presentation application.

Gallery and site release worktrees are /private/tmp/opf-release-gallery/pptx-gallery and /private/tmp/opf-release-site/openpresentation-site on codex/fidelity-release-20260908. Their locked core is 0.4.1, and editor/showcase assets are regenerated from the five-package registry consumer with version/integrity/hash manifests. All 854 gallery examples validate/render, 106 gallery tests pass, and both production builds pass. The site syncs opf-v0.4.1 and exposes 583 raw files/six skills. Public deployment verification follows these prepared updates; earlier production manifests remain historical until those PRs merge.

## Shared table rows and native rich-table import releases

The current coordinated package set is core 0.6.0, CLI 0.3.0, renderer 0.4.0, PPTX 0.4.0 and editor 0.3.0. `release-plan.json` pins all five versions and their immutable source commits. Core PR 23, renderer PR 5, PPTX PR 8 and editor PR 4 merged after Node 20/24 CI and automated review. Each merged tree matches the tested head. All five packages were published through trusted publishing with provenance, and registry tarball integrities match the tested release candidates.

Core exports `layoutTable` for shared content-aware row geometry. Rows use spare height before shrinking text; rich cell lines reserve uniform native paragraph advances. Renderer and PPTX consume the same row/cell boxes and fitted text, while editor 0.3.0 aligns dependency minima. PPTX imports supported native rich table character styles, paragraph defaults, theme fonts/colors, external links, run/field/break order and significant whitespace directly from XML. Unstyled body cells remain strings. Cached display text does not reconstruct original scalar types or live fields.

Final PPTX/editor candidate tarballs with published core/renderer dependencies passed native import and row geometry tests on Node 20/24, 15 browser import/containment checks and 14 browser editor checks. Full standalone tests retained the 126-deck/805-slide structural corpus and all 805 renderer raster baselines. These checks do not establish Microsoft PowerPoint raster parity, complete conditional table styles/merged geometry/cell decoration, cross-engine editing or real OS IME support.

Core publication run 34228179949 published npm successfully but its later GitHub release step failed because a matching release already existed. Preserve existing release notes when the workflow runs again; only create a GitHub release when absent. Do not republish the existing npm version. CLI run 34228594104, renderer run 34229511905, editor run 34230608709 and PPTX run 34231015995 succeeded. PPTX package-index propagation briefly delayed normal clean installation after the exact-version endpoint was available; publication was not repeated.

The gallery and public-site rollout uses isolated `codex/table-layout-registry-20260908` branches in `/private/tmp/opf-release-gallery/pptx-gallery` and `/private/tmp/opf-release-site/openpresentation-site`. Their core manifests and locks are updated to 0.6.0. Regenerate editor/showcase assets from the verified registry consumer, pin site documentation to the reviewed coordination commit, then verify production deployments and bytes. Earlier public deployment evidence remains historical until those updates land.
