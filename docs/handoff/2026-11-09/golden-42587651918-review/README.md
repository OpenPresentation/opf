# Pinned golden42587651918: objective review packet

EVIDENCE ONLY. NEVER MERGE this branch. This packet does not approve golden pixels, chart design, native output or a release. The coordinator owns actual visual acceptance of every one of the67 before/after pairs.

Producer: a1126f6b7d08a24ca9b76303e22ac9316685c301. Generated golden commit: f32f7ea982a3bf41edd7e31064ea9a5d779ea5db. Accepted prior golden: 348fd323b31302b5a3cdd7af2db8bb8bf6fffa2a, run42498350968, original source 545067d7be36df86b82be9c38b324ddf1bb2e887. This evidence branch starts at freshly fetched main9545016583ccfa151077cda4d51043ac6505a140, not at the product integration, and changes no product files.

## Original artifacts and pairing

Both service ZIPs are preserved losslessly, along with original download receipts and lossless gzip transports of their exact original bytes. Plain receipt JSON is a convenient text view; use its gzip transport for raw-byte recovery. The current ZIP is2,763,486 bytes/SHA256 7eed35d3e55bba0850ab716ce7be66ac3d6cc9298bd27e7b6d7c2a72ec200c0d. The prior ZIP is5,351,851 bytes/SHA256 8f77c62729f58b9fed689df0344457f0d7deea108f8416808fdd150bff68976c. artifact-inventory.json binds every decompressed member of both archives:74 current + 186 prior. No ZIP was reconstructed, normalized or repacked.

pair-manifest.json binds all 67 changed current keys to the precise old/current archive member, original local path, PNG byte count, SHA256 and committed expected SVG/PNG hashes. Every required before-image exists in the old artifact. Every before PNG matches the accepted 348fd baseline; the old baseline parsed JSON exactly equals the baseline at producer a112. Current candidate JSON equals the generated f32 baseline. Do not align images by the same numeric filename across runs.

The current bot patch changes exactly two authoritative generated files: core template-goldens-0.19.json and renderer layout-templates-rr96-color-variants.json. The example diff has zero changed slides/decks and zero written/removed files. No chart/table SVG digest or example golden changed.

Renderer template keys change731 to 728:67 changed retained keys, zero added keys, three removed Venn 5 long pages 5/6/7. Their exact before-images are old templates/0103.png,0104.png and0105.png. This artifact does not itself serialize their current page source payloads. Source order/content retention for that pagination reduction is a separate proof obligation, not inferred from removed hashes.

Core retains exactly 480 keys, with ten changed summaries. Full original before/after core JSON bytes and every changed summary are preserved. Six keys (inverted-pyramid/org-chart/hierarchy, each 5 long and 6 long) show the first block falling from rounded 21.3 px to 16 px and different placement; all relevant after blocks carry text-overflow diagnostics. These numerical changes are objective. Overflow diagnostics do not waive the owner's never-shrink instruction. A separate coordinator-assigned causal investigation decides whether correction is required. Core estimated summaries do not establish the actual font size of renderer PNG text.

## Causal boundaries

Since 348fd, the only relevant source changes are composition.ts, lazy-fonts.js and inverted-pyramid catalog description/index metadata. No example source changed. Composition introduces authored-track eligibility for text tiles and additional growth, plus shared readable flat fallback/continuation fitting for org-chart, hierarchy, Venn and downward pyramids. The shared pass retains or grows the settled fallback fit, preserves authored counts and RTL/source order, and marks an unfit retained-size reading measure as overflow. Its interaction with earlier layout/grid decisions must still be reviewed; the six core size changes must not be relabeled as accepted no-shrink output.

SH24 description/index metadata and the successful face-selection cache provide no justification for pixel movement. Earlier LH177/LH183/font and Venn source were already present in the first accepted run. Font CI/model work is a separate issue. The explicit chart reference-line proposal remains unapproved and unimplemented.

## Visual interpretation correction

The child attempted individual image inspection for current indices 0000 through 0032 and prior 0011,0053,0056. It mistakenly described current 0018 as title-only and tentatively made similar descriptions for 0020/0021/0023/0024/0026/0027/0029. The coordinator independently viewed 0018 and contradicted that interpretation: it contains subtitle, card and seven labels in two columns. The child explicitly retracts every title-only/body-loss claim and every causal inference based on it. No missing-body product defect was established. These descriptions are not usable visual findings.

Current 0018 has exact SHA256 be25a98f4b852f7af4ef61ab1b447be35f78c6e16023f10ea3067f925d6f6f2d; prior 0056 has d0c2c31b915a0a9d68b317c290093d9eabfc88c0708d3c382f4a0e886254ae05. Both match the corresponding committed baseline entries.

To independently guard against those misleading interpretations, read-only.mjs decodes actual 8-bit RGBA PNGs using only Node builtins, verifies PNG chunk CRCs, and records the RGB hash plus bright-pixel count of body ROI x0, y48, width320, height132. All 67current bodies contain at least 2,077 bright pixels. Current 0018 contains 2,892 versus 2,932 before. This directly refutes a blank body in those bytes. It does not OCR words, measure text, establish ordering, prove complete source preservation or accept slide design. All 67 pair judgments therefore remain explicitly ROOT_REVIEW_REQUIRED in the manifest; no completed reliable child visual sign-off is claimed.

## Remaining review and source coverage

The coordinator must view every paired image and judge body fill, retained/grown type, complete words/order, approximate 70-character lines, title/card/footer geometry, RTL and real overflow. Quarter-scale PNGs alone cannot certify full-size legibility, exact physical font fidelity or PowerPoint edit/save/reopen behavior.

Existing maintained sh26-readable-fallbacks.test.mjs and fixtures/sh26-readable-continuations.json cover four representative 4 long family inputs and assert actual paginator source/order retention, retained type and readable lines. They do not specifically establish the removed Venn 5 long-page transition. The narrow remaining source proof is the maintained templateDeck('venn') 5 long input (five blocks of seven labels), followed by maintained pagination and exact whole-item/source-order comparison under a verified current runtime. No immutable current dist fingerprint was found in the metadata-only union receipt. During the initial artifact audit no composition, rendering, export, regeneration, build, package test, workflow, service API or Office call was performed. The required docs qualification below subsequently ran its maintained workspace build and selected check tests. No all 728composition report was manufactured.

## Offline verification

From the root of this evidence worktree:

```
node docs/handoff/2026-11-09/golden-42587651918-review/verify.mjs
```

The verifier passed using Node 24.20. It checks original ZIP identities, all 260members with decompression/CRC, all 67 paired PNGs plus three removed keys against committed fixtures, all 480 core keys/ten changed summaries, the exact two-file patch, zero changed examples, and objective decoded body observations. It neither imports the OPF runtime nor writes artifacts. Keep this evidence branch separate from all product and golden commits.

## Required changed-file qualification

At coordinator instruction, the evidence branch normally merged exact reviewed f32 as e1f6359e8ce7a140f6979d3e54d5ad00be6839d0. Entire packages, spec, examples, scripts and workflow trees match f32 exactly; source-proof.json records every matching tree object. This supersedes the initial fresh-main-only branch location above. The branch remains evidence-only and NEVER MERGE.

The first required `pnpm check:changed --base f32f7ea982a3bf41edd7e31064ea9a5d779ea5db` is retained RED: 39.2 seconds reported by the checker (40.3 seconds outer process), five steps passed, one failed, typecheck skipped; no product package tests selected. Install, workspace build, Biome, changelog checks and skill-command checks passed. Biome has no eligible nonignored evidence files; its passing exit is not a source-lint acceptance claim. Text integrity passed six of seven test controls and failed only because the helper sparse checkout omitted a tracked compressed fixture.

The missing painting-Linux.json.gz fixture was hydrated only from exact HEAD blob 2bb264bd47d1382c5cf50c9b7c4f75e2750be7f6, 16102 bytes, SHA256 0b7ef1b73bbd4f31c5ac67716bea08f22a64df066f4ad343765c0d3d74511e56. No existing file was overwritten, assertion changed or raw byte normalized. Narrow `pnpm run check:text` recovery passed all seven controls and repository text integrity. Every original top-level output, exit receipt and per-step log is preserved in gzip transports with raw-byte hashes under checks/. Initial failure is not rewritten as success. A final docs-scope mapped run follows these evidence additions; its actual outcome will be appended. No golden, browser, native or product package tests were run.

Final docs-only mapped run at tested metadata head238b661b98f299f9dcfba59f88804580cb892d3c (plus the source-proof.json metadata update) is GREEN: 31.9 seconds checker time, 32.7 seconds outer process, five selected steps passed, typecheck skipped and zero product package tests selected. Build, Biome, check:changes, check:skill-commands and check:text all pass. checks/qualification.json records exact commands, source heads, timings and exits; final-raw-files.json binds seven exact raw outputs via gzip transports. No stale install log is attributed to the final run. The original RED run remains unchanged. All protected package/spec/example/script/workflow trees still match f32 exactly. This final sealing commit adds only evidence metadata and raw transports; root visual acceptance and A's no-shrink/35-label work remain held.


## Coordinator review and native-size paired figures

The coordinator independently and individually viewed all 67 before/after pairs and all three removed before-pages. This is root review, not a recovered child visual sign-off. All visible body, card and heading content was accounted for. The six raw cases at indices 2,3,6,7,10,11 fail the no-shrink requirement: inverted-pyramid/org-chart/hierarchy, each 5 long and 6 long. The entire current-wave golden remains NOT ACCEPTED pending the separate source correction. Overflow diagnostics do not waive this rejection. root-review.json records every reviewed key and exact PNG pair.

The 52 changed pagination panels show the intended readable reflow. In particular, org-chart and hierarchy 5 long pages 2 through 4 use a SINGLE centered column; they must not be described as universal two-column output. No overall font/native, chart design or release acceptance follows.

[Browse all 17 paired PNG review sheets](paired-sheets/index.html). Each sheet contains four pairs (the last contains three), with BEFORE 348fd and AFTER f32 headers, exact index/key labels and six rejection markers outside the slide panels. The original panels stay at native 320 x 180 pixels on an opaque integer grid: no crop, resize or content modification. The assembler uses the existing scripts/layout-sampler-sheet.mjs SVG-with-PNG pattern and renderer toPng only for the derivative figure canvas; it never composes an OPF document or writes authoritative golden hashes. All 134 output panel RGBA buffers equal the respective original source pixels byte-for-byte. sheet-manifest.json binds the SVG/PNG derivatives, every header/index/key/source PNG hash, coordinates and pixel proof. verify-sheets.mjs rechecks all original embedded bytes and cropped output pixels offline without importing the OPF runtime.

The first assembly command had an evidence-script repository-path error (five parent traversals instead of four) and failed module resolution before generating a sheet. The corrected evidence-only path produced all 17 sheets once in 1.9 seconds; its actual output/exit receipt is retained under checks/figure-assembly. No original slide or golden was changed.

## Later source proof for the three removed Venn keys

The earlier source-coverage gap is now resolved by a later audit supplied by the separate source agent and reviewed by root. Its original report, driver, output and fresh-build preflight/log/exit receipt are preserved losslessly under venn5long-evidence. The driver ran once at clean exact f32 source/tree, invoked the maintained paginatedDecks helper and selected Venn 5 long; it wrote no raster or golden. Input/output are exactly 35 labels in the same complete value/order sequence, in four pages of 14,7,7,7 labels, with no text-overflow diagnostic. Duplicate repeated label strings limit discrimination of original block identity; count and full value/order are preserved. This audit does not repair or approve the six separate no-shrink failures. The original pair-manifest.json remains unchanged as an initial snapshot; this later evidence supersedes only its historical coverage-pending field.

The actual new derivative-figure and later-audit additions require one new docs-only mapped check. Its raw result will be appended after execution; previous required checks remain literal, and no product/browser/native suite or golden update is requested.

Final figure-change mapped qualification at tested head84b16a863d34f1801b0ac36ad3e3a4d87c941c3f (plus source-proof metadata) is GREEN: 32.6 seconds checker time / 33.5 seconds outer process, five selected steps passed, typecheck skipped, no package tests selected. Build, Biome, check:changes, check:skill-commands and check:text passed. Exact commands, exit and seven raw outputs are retained under checks/figures-mapped. This sealing descendant adds only the factual check receipt and review links; no repeated product qualification or new authoritative golden update follows. The entire golden wave remains NOT ACCEPTED until the six rejected cases are corrected and requalified.

### Direct paired PNG review sheets

- [Sheet 01: pairs 00-03](paired-sheets/sheet-01.png) - REJECTED indices 02, 03
- [Sheet 02: pairs 04-07](paired-sheets/sheet-02.png) - REJECTED indices 06, 07
- [Sheet 03: pairs 08-11](paired-sheets/sheet-03.png) - REJECTED indices 10, 11
- [Sheet 04: pairs 12-15](paired-sheets/sheet-04.png)
- [Sheet 05: pairs 16-19](paired-sheets/sheet-05.png)
- [Sheet 06: pairs 20-23](paired-sheets/sheet-06.png)
- [Sheet 07: pairs 24-27](paired-sheets/sheet-07.png)
- [Sheet 08: pairs 28-31](paired-sheets/sheet-08.png)
- [Sheet 09: pairs 32-35](paired-sheets/sheet-09.png)
- [Sheet 10: pairs 36-39](paired-sheets/sheet-10.png)
- [Sheet 11: pairs 40-43](paired-sheets/sheet-11.png)
- [Sheet 12: pairs 44-47](paired-sheets/sheet-12.png)
- [Sheet 13: pairs 48-51](paired-sheets/sheet-13.png)
- [Sheet 14: pairs 52-55](paired-sheets/sheet-14.png)
- [Sheet 15: pairs 56-59](paired-sheets/sheet-15.png)
- [Sheet 16: pairs 60-63](paired-sheets/sheet-16.png)
- [Sheet 17: pairs 64-66](paired-sheets/sheet-17.png)
