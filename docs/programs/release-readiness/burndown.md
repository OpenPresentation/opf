# Release readiness: burndown

Goal, invariants, owner decisions and resume protocol: [README.md](README.md).
Predecessor: [font fidelity everywhere burndown](../font-fidelity-everywhere/burndown.md).
Counts and open items: `pnpm report:release`.

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged and
evidence linked), `descoped` (owner decision, issue linked). Dates are UTC. The
table is parsed by [report.mjs](report.mjs); keep one row per item, the six
columns below, and a status from the list.

## Items

| ID | Item | Repos | Depends | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RR-01 | Release opf-pptx 0.11.8 (wrapped rich-text rejoin, [opf-pptx#126](https://github.com/OpenPresentation/opf-pptx/pull/126)) and CLI 0.9.2 on core 0.11.4; the Node 20 question ([pptx-dev#26](https://github.com/Data-Advantage/pptx-dev/issues/26), closed as superseded: Node 24 only) | opf-pptx, opf (CLI), pptx-dev | none | done | opf-pptx 0.11.8 and CLI 0.9.2 published and verified (2026-10-01, see the log); opf-pptx 0.11.9 (RR-13 signals) published 2026-10-01 (npm `gitHead` `7c10f16` equals the merge commit of [opf-pptx#134](https://github.com/OpenPresentation/opf-pptx/pull/134), SLSA provenance attestation present) and adopted by the three sites; CLI `engines.node` stays `24.x`. merged: [openpresentation-site#59](https://github.com/Data-Advantage/openpresentation-site/pull/59) 2026-10-01, [opf#241](https://github.com/OpenPresentation/opf/pull/241) 2026-10-01, [opf#245](https://github.com/OpenPresentation/opf/pull/245) 2026-10-01, [opf#262](https://github.com/OpenPresentation/opf/pull/262) 2026-10-01, [opf-pptx#128](https://github.com/OpenPresentation/opf-pptx/pull/128) 2026-10-01, [opf-pptx#134](https://github.com/OpenPresentation/opf-pptx/pull/134) 2026-10-01, [pptx-dev#67](https://github.com/Data-Advantage/pptx-dev/pull/67) 2026-10-01, [pptx-gallery#79](https://github.com/Data-Advantage/pptx-gallery/pull/79) 2026-10-01 |
| RR-02 | pptx.dev CI green and stable on ubuntu and windows | pptx-dev | none | in-progress | merged: [pptx-dev#68](https://github.com/Data-Advantage/pptx-dev/pull/68) 2026-10-01, [pptx-gallery#81](https://github.com/Data-Advantage/pptx-gallery/pull/81) 2026-10-01. pptx-dev master runs were green for the 0.11.4 adoption and for the 2026-10-01 runs at `f57896f`, `b1e3cad`, `f57c1a9` and `3130893`, then the run at `acabe5d` ([pptx-dev#67](https://github.com/Data-Advantage/pptx-dev/pull/67), 2026-10-01 21:05) failed; failures are preserved and stability over repeated runs is not yet shown; the open boxes of [opf#88](https://github.com/OpenPresentation/opf/issues/88) are the reference list |
| RR-03 | Close the font-fidelity items in review (FF-07, FF-08, FF-22b, FF-27, FF-29, FF-30, FF-31, FF-37, FF-39, FF-58) | opf | none | in-progress | merged: [opf#242](https://github.com/OpenPresentation/opf/pull/242) 2026-10-01: FF-07, FF-22b, FF-29, FF-30, FF-31 and FF-39 are done, FF-58 is closed by the owner decision; FF-08 waits on the FF-05 native root cause (RR-17), FF-27 and FF-37 stay in review (FF-37 needs the owner's `PPTX_GALLERY_READ_TOKEN`, README Open decisions); verdicts in the font burndown rows |
| RR-04 | Cross-platform: pairwise matrix (FF-09), matrix in CI on ubuntu/windows/macos (FF-10), export determinism independent of host (FF-11) | opf, opf-pptx | RR-03 | in-progress | merged: [opf#243](https://github.com/OpenPresentation/opf/pull/243) 2026-10-01, [opf-pptx#141](https://github.com/OpenPresentation/opf-pptx/pull/141) 2026-10-01 ([evidence](../../evidence/rr-04-cross-platform-20261001/README.md)): published-package matrix, TypeScript consumer, browser re-render and determinism grid on ubuntu, windows and macos, 300 of 300 digest entries identical, no nondeterminism found; the FF-09, FF-10 and FF-11 rows in the font burndown still read review or in-progress; open: installed FF-38 parity per OS and a required status check (repository setting, owner) |
| RR-05 | Native PowerPoint sample including CJK and RTL (FF-12) | opf, opf-render, opf-pptx | RR-04 | review | supervisor-run; see FF-12. First native run 2026-10-01 found right-to-left decks unaligned and unmirrored and `v2.0` read `2.0v`; the layout fix is merged: [opf#259](https://github.com/OpenPresentation/opf/pull/259) 2026-10-02; open: [opf-pptx#142](https://github.com/OpenPresentation/opf-pptx/pull/142), [opf-render#98](https://github.com/OpenPresentation/opf-render/pull/98) (design record [rr-05-rtl-layout.md](rr-05-rtl-layout.md)). The follow-up native set `rr-05b-native` passed on 2026-10-02 (supervisor): alignment, bullets, table rtl, chart mirroring and `v2.0` bidi. The item is done when the two engine PRs merge and the FF-12 sample (CJK, `Presentation.Fonts` only the chosen families) is recorded; the native evidence files are not yet under `docs/evidence/` |
| RR-06 | Editor: switch every dimension with patch, undo and preview refresh (FF-16) and editable design-level options | opf-editor, opf | none | in-progress | FF-16 done ([opf-editor#59](https://github.com/OpenPresentation/opf-editor/pull/59) `f4eaa56`); design options, table style/merge and the panel merged in #59; image upload, every background form and every header/footer part merged in #60. merged: [opf#248](https://github.com/OpenPresentation/opf/pull/248) 2026-10-01, [opf-editor#59](https://github.com/OpenPresentation/opf-editor/pull/59) 2026-10-01, [opf-editor#60](https://github.com/OpenPresentation/opf-editor/pull/60) 2026-10-01. Unreleased (editor 0.10.6 is the latest published), so the item stays in-progress until an editor release ships both |
| RR-07 | Preview polish: code language highlighting, metric trend, all 54 background pattern presets (preview and export agree) | opf-render, opf-pptx | none | done | merged: [opf#246](https://github.com/OpenPresentation/opf/pull/246) 2026-10-02, [opf-pptx#132](https://github.com/OpenPresentation/opf-pptx/pull/132) 2026-10-02, [opf-render#89](https://github.com/OpenPresentation/opf-render/pull/89) 2026-10-02. Core tables are shared by preview and export; `test/rr-07-preview-polish.mjs` compares code runs, trend arrows and the 54 pattern presets between SVG and PPTX. A native check set (`scripts/rr07-native-set.mjs`) is prepared; the acceptance criteria do not require it |
| RR-08 | Import details: author arrays, run ColorRef (`var:`/scheme) colours, item descriptions, bullets form | opf-pptx | none | done | merged: [opf-pptx#137](https://github.com/OpenPresentation/opf-pptx/pull/137) 2026-10-01: author arrays, run `ColorRef` colours, item descriptions (covered by tests) and the bullets form, with export-then-import tests; the remaining normalisations are listed in the PR |
| RR-09 | Rich text with hard line breaks round-trips as one authored payload | opf-pptx | RR-01 | done | merged: [opf-pptx#137](https://github.com/OpenPresentation/opf-pptx/pull/137) 2026-10-01: hard line breaks (`wrap` gaps, list line breaks) return as the one authored payload; builds on the RR-01 rejoin ([opf-pptx#126](https://github.com/OpenPresentation/opf-pptx/pull/126)) |
| RR-10 | SVG images: native SVG in PPTX export (with raster fallback) and import | opf-pptx, opf-render, opf | none | done | merged: [opf-pptx#130](https://github.com/OpenPresentation/opf-pptx/pull/130) 2026-10-01, [opf-pptx#147](https://github.com/OpenPresentation/opf-pptx/pull/147) 2026-10-02, [opf-render#88](https://github.com/OpenPresentation/opf-render/pull/88) 2026-10-01, [opf-render#107](https://github.com/OpenPresentation/opf-render/pull/107) 2026-10-02. Native SVG pictures (`asvg:svgBlip` over a PNG fallback), import back as SVG, preview draws SVG and shows the placeholder for a malformed or unsafe one. Native check passed (supervisor) |
| RR-11 | Native PowerPoint header/footer (`p:hf`, slide-number/date/footer placeholders, Insert > Header & Footer) | opf-pptx, opf-render, opf | none | done | owner decision 2026-10-01: wanted (reverses the earlier deferral); merged: [opf#244](https://github.com/OpenPresentation/opf/pull/244) 2026-10-01, [opf-pptx#131](https://github.com/OpenPresentation/opf-pptx/pull/131) 2026-10-01, [opf-pptx#136](https://github.com/OpenPresentation/opf-pptx/pull/136) 2026-10-01. Native header/footer placeholders, master and layout, `p:hf`. Native check passed (supervisor); relevant to FF-27 and [opf#87](https://github.com/OpenPresentation/opf/issues/87) |
| RR-12 | Vector PDF with selectable text | opf-render | none | review | merged: [opf-render#90](https://github.com/OpenPresentation/opf-render/pull/90) 2026-10-01; open: [opf#257](https://github.com/OpenPresentation/opf/pull/257): the renderer's vector PDF with selectable text is merged (`mode: vector | raster`); the core docs PR waits for the renderer release |
| RR-13 | `fromPptx` exposes raw layout and style signals for third-party decks (deterministic) | opf-pptx | none | done | owner decision 2026-10-01: libraries stay deterministic; merged: [opf-pptx#129](https://github.com/OpenPresentation/opf-pptx/pull/129) 2026-10-01 (`fromPptx` `signals: true`; published in opf-pptx 0.11.9) |
| RR-14 | pptx.dev "Understand this deck": AI reconstruction of third-party PPTX into structured OPF with review | pptx-dev | RR-13 | in-progress | owner decision 2026-10-01: AI reconstruction lives in pptx.dev, not in opf-pptx; merged: [pptx-dev#65](https://github.com/Data-Advantage/pptx-dev/pull/65) 2026-10-01, [pptx-dev#66](https://github.com/Data-Advantage/pptx-dev/pull/66) 2026-10-01. Design and implementation are merged behind two default-off flags (`UNDERSTAND_DECK_ENABLED`, `NEXT_PUBLIC_UNDERSTAND_DECK`); open: opf-pptx dependency bump and fixtures from the release, live model recordings (the merged recordings are hand-authored stand-ins), owner decisions (gateway, budget, ZDR) and enabling the flags |
| RR-15 | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24): widen the variable-font metric gate to 0.15 px | opf-render, opf | none | done | owner decision 2026-10-01; the only gate change in the program; [opf-render#87](https://github.com/OpenPresentation/opf-render/pull/87) `9e5d616` merged (variable-font gate 0.15 px as a blocking CI step; worst measured delta 0.1346 px on Linux and 0.0024 px on macOS over 356 retained rows); [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) closed (2026-10-01) |
| RR-16 | [opf#213](https://github.com/OpenPresentation/opf/issues/213): preview font sizes snapped to PowerPoint's 0.01 pt resolution (decide and implement) | opf, opf-render, opf-pptx | none | in-progress | decided 2026-10-01 (vetoable): quantize in core, parity exact; merged: [opf#247](https://github.com/OpenPresentation/opf/pull/247) 2026-10-02, [opf-editor#75](https://github.com/OpenPresentation/opf-editor/pull/75) 2026-10-02, [opf-pptx#135](https://github.com/OpenPresentation/opf-pptx/pull/135) 2026-10-02, [opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91) 2026-10-01; closed unmerged: [opf-pptx#148](https://github.com/OpenPresentation/opf-pptx/pull/148); [record](rr-16-font-size-grid.md). The three PRs are merged; the item is done when the lockstep floors are raised with the release train |
| RR-17 | Font long tail: FF-41, FF-42, FF-43, FF-44, FF-45, FF-46, FF-05, FF-13 | opf, opf-render, opf-pptx, opf-editor | RR-05 | in-progress | per-font status in the [font tracker](../font-fidelity-everywhere/font-tracker.md); merged: [opf#249](https://github.com/OpenPresentation/opf/pull/249) 2026-10-01, [opf#253](https://github.com/OpenPresentation/opf/pull/253) 2026-10-01, [opf#254](https://github.com/OpenPresentation/opf/pull/254) 2026-10-01, [opf#255](https://github.com/OpenPresentation/opf/pull/255) 2026-10-02, [opf#260](https://github.com/OpenPresentation/opf/pull/260) 2026-10-02, [opf#261](https://github.com/OpenPresentation/opf/pull/261) 2026-10-02, [opf#274](https://github.com/OpenPresentation/opf/pull/274) 2026-10-02, [opf-editor#61](https://github.com/OpenPresentation/opf-editor/pull/61) 2026-10-02, [opf-pptx#138](https://github.com/OpenPresentation/opf-pptx/pull/138) 2026-10-02, [opf-pptx#139](https://github.com/OpenPresentation/opf-pptx/pull/139) 2026-10-01, [opf-render#92](https://github.com/OpenPresentation/opf-render/pull/92) 2026-10-02, [opf-render#93](https://github.com/OpenPresentation/opf-render/pull/93) 2026-10-01, [opf-render#94](https://github.com/OpenPresentation/opf-render/pull/94) 2026-10-02, [opf-render#95](https://github.com/OpenPresentation/opf-render/pull/95) 2026-10-02, [opf-render#101](https://github.com/OpenPresentation/opf-render/pull/101) 2026-10-02; open: [opf-render#102](https://github.com/OpenPresentation/opf-render/pull/102), [pptx-gallery#80](https://github.com/Data-Advantage/pptx-gallery/pull/80); closed unmerged: [opf-render#97](https://github.com/OpenPresentation/opf-render/pull/97). Done so far: FF-41 to FF-43 (Latin), FF-44 (script corpora, per-cluster raster) and FF-45 (symbol, emoji, math paths); open PRs above; FF-05, FF-13 and FF-46 (native font verification) are not done |
| RR-18 | Issues and roadmap hygiene: file descoped issues, refresh roadmap issues #87 and #88 | opf, opf-pptx | none | in-progress | merged: [openpresentation-site#60](https://github.com/Data-Advantage/openpresentation-site/pull/60) 2026-10-01, [opf-editor#62](https://github.com/OpenPresentation/opf-editor/pull/62) 2026-10-01, [pptx-dev#69](https://github.com/Data-Advantage/pptx-dev/pull/69) 2026-10-01, [pptx-gallery#82](https://github.com/Data-Advantage/pptx-gallery/pull/82) 2026-10-01. Descoped issues filed ([opf-pptx#127](https://github.com/OpenPresentation/opf-pptx/issues/127), [opf#240](https://github.com/OpenPresentation/opf/issues/240), [opf#250](https://github.com/OpenPresentation/opf/issues/250), [opf#251](https://github.com/OpenPresentation/opf/issues/251), [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)); status comments on #87 and #88 date from 2026-10-01 and need a refresh after RR-11 passed natively and the 2026-10-02 merges |
| RR-19 | Housekeeping: stale worktrees, branches, scratch folders | all | none | in-progress | supervisor; never touches the user's checkouts |
| RR-21 | Editor slide management: delete, duplicate, reorder (drag and keyboard), hide, sections, slide sorter and outline view | opf-editor, opf | none | done | owner scope 2026-10-01; merged: [opf-editor#65](https://github.com/OpenPresentation/opf-editor/pull/65) 2026-10-02: delete, duplicate, reorder, hide, sections, sorter and outline, each one patch |
| RR-22 | Editor autosave and restore (browser storage) and an unsaved-changes warning, adopted by the sites | opf-editor, pptx-gallery, openpresentation-site, pptx-dev | none | in-progress | owner scope 2026-10-01; merged: [opf-editor#70](https://github.com/OpenPresentation/opf-editor/pull/70) 2026-10-02; open: [pptx-gallery#83](https://github.com/Data-Advantage/pptx-gallery/pull/83) draft. The editor half is merged; the site adoption e2e waits for the editor release, and openpresentation-site and pptx-dev have no adoption PR yet |
| RR-23 | Export from the editor and the sites: vector PDF, PNG and SVG downloads next to PPTX | opf-editor, opf-render, pptx-gallery, openpresentation-site, pptx-dev | RR-12 | in-progress | owner scope 2026-10-01; merged: [opf-editor#73](https://github.com/OpenPresentation/opf-editor/pull/73) 2026-10-02, [opf-render#105](https://github.com/OpenPresentation/opf-render/pull/105) 2026-10-02; open: [pptx-dev#70](https://github.com/Data-Advantage/pptx-dev/pull/70) draft. Editor downloads and the browser PNG/PDF output are merged; pptx-dev waits for the editor and renderer releases, pptx-gallery and openpresentation-site have no PR yet |
| RR-24 | Chart and table data grid editor; table row and column insert, delete, move | opf-editor | none | done | owner scope 2026-10-01; merged: [opf-editor#71](https://github.com/OpenPresentation/opf-editor/pull/71) 2026-10-01 |
| RR-25 | Editor: deck-wide find and replace, image crop and focal point, mobile layout | opf-editor, opf-render | none | done | owner scope 2026-10-01; merged: [opf-editor#74](https://github.com/OpenPresentation/opf-editor/pull/74) 2026-10-02: deck-wide find and replace, image crop and focal point, phone and tablet layout |
| RR-26 | Core conversions module `@openpresentation/opf/convert` (list to table, timeline to table, metric set to table, list promote and demote, quote attribution parsing, image to slideImage or background, wrap in group or region, split and merge slides) with the editor as the transactional UI | opf, opf-editor | none | done | owner scope 2026-10-01; merged: [opf#258](https://github.com/OpenPresentation/opf/pull/258) 2026-10-02, [opf-editor#64](https://github.com/OpenPresentation/opf-editor/pull/64) 2026-10-02, [opf-editor#76](https://github.com/OpenPresentation/opf-editor/pull/76) 2026-10-02 |
| RR-27 | CLI render, export and import: `opf render`, `opf export pdf\|png\|svg\|pptx`, `opf import deck.pptx` | opf (CLI), opf-render, opf-pptx | RR-12 | done | owner scope 2026-10-01; merged: [opf#263](https://github.com/OpenPresentation/opf/pull/263) 2026-10-02: `opf render`, `opf export`, `opf import` with optional opf-render and opf-pptx peers; the cli-windows workflow runs windows and macos |
| RR-28 | Presenter, player and embeddable `<opf-deck>` web component (slideshow, speaker view with text notes, keyboard navigation, embedding); openpresentation.org example pages use it | opf-render, opf-editor, openpresentation-site | none | in-progress | owner scope 2026-10-01; merged: [opf-render#103](https://github.com/OpenPresentation/opf-render/pull/103) 2026-10-02; open: [openpresentation-site#61](https://github.com/Data-Advantage/openpresentation-site/pull/61) draft. The player and `<opf-deck>` are merged; the example pages on openpresentation.org wait for the renderer release |
| RR-29 | `opf audit` design and accessibility checker (contrast, overflow, alt text, reading order, font usage) in the CLI and as an editor Review panel | opf (CLI), opf-editor | none | done | owner scope 2026-10-01; merged: [opf#267](https://github.com/OpenPresentation/opf/pull/267) 2026-10-01, [opf#270](https://github.com/OpenPresentation/opf/pull/270) 2026-10-02, [opf-editor#69](https://github.com/OpenPresentation/opf-editor/pull/69) 2026-10-02, [opf-pptx#146](https://github.com/OpenPresentation/opf-pptx/pull/146) 2026-10-02, [opf-render#106](https://github.com/OpenPresentation/opf-render/pull/106) 2026-10-02: `opf audit`, the editor Review panel and the two chart-colour fixes found by it |
| RR-30 | Markdown and outline to and from OPF converter (core subpath and CLI) | opf | RR-26 | done | merged: [opf#268](https://github.com/OpenPresentation/opf/pull/268) 2026-10-02: `@openpresentation/opf/markdown`, `opf from-md`, `opf to-md`, [guide](../../markdown.md) |
| RR-31 | OPF diff and merge, `opf format`, and one unified core JSON-patch module shared by the CLI and the editor | opf, opf-editor | none | done | owner scope 2026-10-01; merged: [opf#265](https://github.com/OpenPresentation/opf/pull/265) 2026-10-02, [opf-editor#66](https://github.com/OpenPresentation/opf-editor/pull/66) 2026-10-02: one RFC 6902 module, `opf diff`, `opf merge`, `opf format`, editor on the shared module |
| RR-32 | Templates and variables: a template is an incomplete OPF file; variables extend beyond colours to text, number, date and image or asset values, usable inside text and image fields; fill from data (`opf fill`, decks from data), an editor fill UI, validation of unfilled variables | opf, opf-editor, opf-render, opf-pptx | RR-31 | done | owner scope 2026-10-01; merged: [opf#256](https://github.com/OpenPresentation/opf/pull/256) 2026-10-01, [opf-editor#63](https://github.com/OpenPresentation/opf-editor/pull/63) 2026-10-01, [opf-pptx#140](https://github.com/OpenPresentation/opf-pptx/pull/140) 2026-10-01, [opf-render#96](https://github.com/OpenPresentation/opf-render/pull/96) 2026-10-01: schema, `opf fill`, preview, export and the editor Fill panel |
| RR-33 | Spec: numbered lists | opf, opf-render, opf-pptx, opf-editor | none | done | owner scope 2026-10-01; merged: [opf#264](https://github.com/OpenPresentation/opf/pull/264) 2026-10-02, [opf-editor#67](https://github.com/OpenPresentation/opf-editor/pull/67) 2026-10-02, [opf-pptx#143](https://github.com/OpenPresentation/opf-pptx/pull/143) 2026-10-02, [opf-render#99](https://github.com/OpenPresentation/opf-render/pull/99) 2026-10-02. Passed the v2 native run on 2026-10-01 (supervisor) |
| RR-34 | Spec: footnotes, citations and captions | opf, opf-render, opf-pptx, opf-editor | none | done | owner scope 2026-10-01; merged: [opf#269](https://github.com/OpenPresentation/opf/pull/269) 2026-10-02, [opf-editor#72](https://github.com/OpenPresentation/opf-editor/pull/72) 2026-10-02, [opf-pptx#145](https://github.com/OpenPresentation/opf-pptx/pull/145) 2026-10-02, [opf-render#104](https://github.com/OpenPresentation/opf-render/pull/104) 2026-10-02. Passed the v2 native run on 2026-10-01 (supervisor), including the F1 marker size fix |
| RR-35 | Spec: chart options (axis titles, legend position, data labels) | opf, opf-render, opf-pptx, opf-editor | none | done | owner scope 2026-10-01; merged: [opf#266](https://github.com/OpenPresentation/opf/pull/266) 2026-10-02, [opf-editor#68](https://github.com/OpenPresentation/opf-editor/pull/68) 2026-10-02, [opf-pptx#144](https://github.com/OpenPresentation/opf-pptx/pull/144) 2026-10-02, [opf-render#100](https://github.com/OpenPresentation/opf-render/pull/100) 2026-10-02. Passed the v2 native run on 2026-10-01 (supervisor), including the F2 chartex axis titles fix |
| RR-36 | Single-series bar and column charts get one colour; the parity harness counts `c:dPt` | opf-pptx, opf | none | done | merged: [opf#272](https://github.com/OpenPresentation/opf/pull/272) 2026-10-02, [opf-pptx#149](https://github.com/OpenPresentation/opf-pptx/pull/149) 2026-10-02. Single-series column and bar charts export in one colour (opf-pptx#149) and the parity harness reads `c:dPt` fills (opf#272); the colour fix was native-verified (supervisor) |
| RR-37 | Windows packed-install CRLF bin script | opf, opf-render | none | done | merged: [opf#273](https://github.com/OpenPresentation/opf/pull/273) 2026-10-02, [opf-render#108](https://github.com/OpenPresentation/opf-render/pull/108) 2026-10-02. The packed install stages the bytes npm installs for bin files and names the file when the installed runtime differs (opf#273); opf-render pins dist, src and scripts to LF so a Windows checkout packs the published bytes (opf-render#108) |
| RR-38 | Arabic Typesetting preview scale vs PowerPoint | opf, opf-render | none | in-progress | owner agent working; open: [opf#275](https://github.com/OpenPresentation/opf/pull/275), [opf-render#109](https://github.com/OpenPresentation/opf-render/pull/109). Font policy `sizeAdjust` (a preview size multiplier, Arabic Typesetting 0.64) so the preview matches PowerPoint's Arabic Typesetting size |
| RR-39 | CJK and Thai line breaking in core (dictionary word breaking for Thai, Lao, Khmer and Myanmar; East Asian kinsoku) | opf, opf-render, opf-pptx | none | todo | follow-up from [FF-44 script corpora](../font-fidelity-everywhere/script-corpora.md) (Findings, "Core line breaking has no dictionary word breaking and no kinsoku", open and measured); no PR yet. Post-release (decision recorded here, vetoable: it moves geometry, so it needs a core release and lockstep floors): README Definition of done 2 lets it ship open only as `descoped` with an issue, so before the final train it is either done or converted to `descoped` with that issue |
| RR-20 | Release-readiness note (FF-15), final lockstep release train, re-audit | opf and all | RR-01 to RR-19, RR-21 to RR-39 | todo | |

Descoped, declined or deferred by owner decision 2026-10-01 (not RR items; the
future-work ones have issues, filed under RR-18 and RR-00 scope 2): native
PowerPoint video (`p:video`) and preview playback
([opf-pptx#127](https://github.com/OpenPresentation/opf-pptx/issues/127));
chart data from external spreadsheets (`ChartDataSource`, a host
`dataResolver` hook; [opf#240](https://github.com/OpenPresentation/opf/issues/240));
navigation and motion (transitions, builds and reveals, links between slides;
[opf#250](https://github.com/OpenPresentation/opf/issues/250)); rich speaker
notes, plain-text notes stay ([opf#251](https://github.com/OpenPresentation/opf/issues/251));
the `world` region map chart, parked with an offline native map export as the
future work ([opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)).
Declined, no issue: a VS Code extension, and a language set per slide or per run.

## Acceptance criteria

**RR-01 Release.** opf-pptx 0.11.8 (carrying #126) and the CLI 0.9.2 are
published from merged `main` through the trusted-publishing workflows on core
0.11.4, with registry artifact and provenance verified. The CLI keeps
`engines.node` `24.x` (owner Node 24 decision; pptx-dev#26 is closed as
superseded by pptx-dev#32, and it concerned pptx-dev's own `@pptx/cli`). The
sites adopt the versions.

**RR-02 pptx.dev CI.** `master` is green on ubuntu and windows over repeated
runs, with no assertion relaxed and the original failures preserved. The open
checkboxes of opf#88 are each resolved or recorded as a separate issue.

**RR-03 FF review items.** Each of the ten items is `done` with dated evidence,
or stays `review` with exactly what is missing and the RR item that covers it.

**RR-04 Cross-platform.** The pairwise matrix (FF-09) runs in CI on ubuntu,
windows and macos through a packed TypeScript consumer (FF-10), including runs
with no system fonts, and export bytes do not depend on host fonts, OS, locale
or timezone (FF-11).

**RR-05 Native sample.** The FF-12 criteria hold: at most 12 decks opened
read-only, including CJK and RTL, `Presentation.Fonts` naming only the chosen
families. Supervisor-run; evidence merged under `docs/evidence/`.

**RR-06 Editor.** For each gallery dimension the editor switches the value,
applies it as a patch, undoes it exactly and refreshes the preview (FF-16), and
design-level options are editable.

**RR-07 Preview polish.** Code blocks highlight by language, the metric trend
renders, and all 54 background pattern presets draw in the preview and export
as the same native pattern fill (parity audit agrees).

**RR-08 Import details.** `fromPptx` restores author arrays, run `ColorRef`
colours (`var:` and scheme references), item descriptions and the bullets form,
or emits a specific diagnostic; export-then-import tests cover each.

**RR-09 Hard line breaks.** Rich text with hard line breaks (`a:br`) re-imports
as the one authored payload, not several paragraphs.

**RR-10 SVG images.** SVG pictures export as native PowerPoint SVG pictures
(`asvg:svgBlip`) with a raster fallback `a:blip`, import back to the SVG source,
and draw in the preview. A native open confirms the picture (supervisor).

**RR-11 Native header/footer.** Slide-number, date and footer content export as
native PowerPoint header/footer: slide master and layout placeholders of type
`sldNum`, `dt` and `ftr` on each slide, `p:hf` flags that match, so Insert >
Header & Footer owns them, and re-import keeps the OPF furniture. Preview,
export and re-import agree; native confirmation is supervisor-run.

**RR-12 Vector PDF.** The renderer writes a PDF whose text is vector and
selectable, using the bundled fonts, deterministically.

**RR-13 Raw signals.** `fromPptx` returns the layout and style signals of a
third-party deck (placeholder roles and geometry, theme and master styles,
shape order and kinds) as plain data with no network or model calls.

**RR-14 Understand this deck.** pptx.dev reconstructs a third-party PPTX into
structured OPF from the RR-13 signals with AI assistance and a review step the
user controls; nothing runs in the libraries.

**RR-15 Gate.** The browser-versus-Fontkit variable-font width gate is 0.15 px
(from 0.1 px) in opf-render, with the decision recorded in the test and the
docs; no other tolerance changes.

**RR-16 0.01 pt snap.** Either composed font sizes are quantized to 0.01 pt (rounding down) in
core with the golden hashes regenerated and the lockstep floor raised, or the
parity harness treats a difference below PowerPoint's own 0.01 pt resolution as
equal; the decision is recorded and the two `list-6x-heading-title-center`
layouts become `perfect`.

**RR-17 Font long tail.** FF-41 to FF-46, FF-05 and FF-13 are `done` or
explicitly descoped by the owner, per their font burndown criteria.

**RR-18 Hygiene.** One issue per descoped item (video, `ChartDataSource`) with
current behaviour, what full support needs and evidence; roadmap issues #87 and
#88 carry a current status comment; opf-render#24 and opf#213 point at their RR
items.

**RR-19 Housekeeping.** No stale worktrees, merged branches or scratch folders
remain from the program; user checkouts are never switched or cleaned by agents.

**RR-21 Slide management.** The editor deletes, duplicates, reorders (drag and
keyboard), hides and sections slides, and offers a slide sorter and an outline
view; each action is one patch with exact undo and the preview refreshes.

**RR-22 Autosave and restore.** The editor autosaves to browser storage,
restores the last session and warns before unsaved changes are lost; the three
sites adopt it without changing their look and without sending content anywhere.

**RR-23 Downloads.** The editor and the sites download the deck as vector PDF,
PNG and SVG next to PPTX, from the same rendering the preview uses.

**RR-24 Data grid.** A grid edits chart data and tables; table rows and columns
insert, delete and move as single undoable patches.

**RR-25 Editor tools.** Deck-wide find and replace (with undo as one patch),
image crop and focal point, and a usable mobile layout.

**RR-26 Conversions.** `@openpresentation/opf/convert` converts list and table,
timeline and table, metric set and table, promotes and demotes list levels,
parses quote attribution, turns an image into a slide image or background,
wraps content in a group or region and splits or merges slides. The functions
are pure and deterministic, and the editor applies each as one transaction.

**RR-27 CLI.** `opf render`, `opf export pdf|png|svg|pptx` and `opf import
deck.pptx` run offline on the supported Node versions, with deterministic
output and tests on ubuntu, windows and macos.

**RR-28 Player.** An embeddable `<opf-deck>` web component plays a deck
(slideshow, keyboard navigation, speaker view with plain-text notes) and the
openpresentation.org example pages use it. No transitions or builds (deferred).

**RR-29 Audit.** `opf audit` reports contrast, overflow, missing alt text,
reading order and font usage with stable rule ids and exit codes, and the editor
shows the same findings in a Review panel.

**RR-30 Markdown.** A core subpath and CLI convert Markdown and outlines to and
from OPF with a documented mapping and a round-trip test.

**RR-31 Diff, format and patch.** `opf diff` and merge report and combine
changes between two OPF files, `opf format` normalises a file, and one core
JSON-patch module is used by both the CLI and the editor.

**RR-32 Templates and variables.** A template is an incomplete OPF file.
Variables cover text, number, date and image or asset values (not only
colours) inside text and image fields. `opf fill` and decks from data fill a
template, the editor offers a fill UI, and validation reports unfilled
variables. The schema change is additive.

**RR-33 Numbered lists.** The spec has numbered lists (style, start value,
nesting) and preview, PPTX export (`a:buAutoNum`) and import agree.

**RR-34 Footnotes, citations and captions.** The spec has footnotes, citations
and captions; preview, export and import agree or report a specific diagnostic.

**RR-35 Chart options.** Charts take axis titles, legend position and data
labels; the preview and the native PPTX chart agree and re-import keeps them.

**RR-36 Single-series chart colour.** A single-series bar or column chart exports
with one series colour (the data points do not each get their own), the parity
harness counts `c:dPt` fills of classic chart series, and a native open confirms
the colour (supervisor).

**RR-37 Packed install on Windows.** The CLI's bin script installed from the
packed tarball runs on Windows: the staged bytes are the bytes npm installs, the
file is named when the installed runtime differs, and a Windows checkout packs
the published bytes (LF pinned for dist, src and scripts in opf-render).

**RR-38 Arabic Typesetting scale.** The preview draws Arabic Typesetting at
PowerPoint's size through a font policy `sizeAdjust` multiplier (0.64), with the
decision and measurement recorded; export is unchanged.

**RR-39 CJK and Thai line breaking.** Core line breaking uses dictionary word
breaking for Thai, Lao, Khmer and Myanmar and East Asian kinsoku (no closing
punctuation at the start of a line, no opening bracket at the end), and the
preview and export agree; a probe deck confirms PowerPoint's own breaks
natively (supervisor). Alternatively the item is `descoped` with an issue that
states the current behaviour, what full support needs and the evidence (README
Definition of done 2). It moves geometry, so it ships with a core release and
raised lockstep floors.

**RR-20 Readiness note.** A release-readiness note for the owner (FF-15) lists
what ships, what is descoped and the evidence; the final lockstep train is
published and verified; the audits are re-run on the published packages and the
re-audit result is linked.

## Progress log

Append-only. One dated line per state change.

- 2026-10-01: Program opened by the owner. Baseline: the font program's goal state stands (core 0.11.4 `e414bca`, opf-render 0.11.9 `2fbc0ab`, opf-pptx 0.11.7 `a9bcbd7`, opf-editor 0.10.6 `313774a`, pptx-gallery `d8f5ae6`: 818 of 819 gallery configs `works`, parity 739 / 111 / 0 of 850). Owner decisions recorded in the README: native header/footer wanted (RR-11); video and `ChartDataSource` descoped with issues; SVG images in scope (RR-10); AI reconstruction in pptx.dev, libraries deterministic (RR-13, RR-14); opf-render#24 gate widened to 0.15 px (RR-15). RR-00 (this tracker) is the PR that adds the program.
- 2026-10-01: RR-15 done. opf-render#87 (`9e5d616`) widened the variable-font native advance gate to 0.15 px as a blocking CI step; worst delta 0.1346 px on Linux and 0.0024 px on macOS over 356 retained rows; opf-render#24 closed.
- 2026-10-01: RR-01 progress: opf-pptx 0.11.8 and CLI 0.9.2 are merged and tagged ([opf-pptx#128](https://github.com/OpenPresentation/opf-pptx/pull/128) `875c944`, [opf#241](https://github.com/OpenPresentation/opf/pull/241) `73c7f15`) and publishing; the registry artifacts and provenance are not yet verified, so the item stays in-progress. [pptx-dev#26](https://github.com/Data-Advantage/pptx-dev/issues/26) is closed as superseded by pptx-dev#32 (the Node 24 decision is kept).
- 2026-10-01: RR-19 progress: 466 stale scratchpad worktrees removed across the seven repositories, 422 remote branches of merged or closed PRs deleted, and C:c removed. The item stays in-progress until the supervisor confirms no stale worktrees, branches or scratch folders remain.
- 2026-10-01: RR-03 in review ([opf#242](https://github.com/OpenPresentation/opf/pull/242)): FF-07, FF-22b, FF-29, FF-30, FF-31 and FF-39 are done; FF-08, FF-27, FF-37 and FF-58 stay in review. The two owner-facing questions are listed in the README under Open decisions.
- 2026-10-01: RR-06 progress: [opf-editor#59](https://github.com/OpenPresentation/opf-editor/pull/59) (`f4eaa56`) is merged: FF-16 is done and the decision on content-type conversion is "in scope" (a conversion API, no longer replacement only); design-level options, table style and cell merge and the accessible controls panel are in. The follow-up [opf-editor#60](https://github.com/OpenPresentation/opf-editor/pull/60) (image upload, every background form including the 54 patterns, every header/footer part) is merged too. The item stays in-progress until an editor release ships both; radial gradients are not offered because the OPF schema has none.
- 2026-10-01: RR-01 progress: opf-pptx 0.11.8 (`875c944`) and CLI 0.9.2 (`73c7f15`) are published and verified (gitHead equals the tag commit, SLSA provenance names the release workflow and tag, `npm audit signatures` clean). Node 20 is not restored for the CLI: `engines.node` stays `24.x` (owner Node 24 decision; pptx-dev#26 closed as superseded by pptx-dev#32). The release plan, compatibility matrix and docs follow in [opf#245](https://github.com/OpenPresentation/opf/pull/245); the three sites adopt the release in [openpresentation-site#59](https://github.com/Data-Advantage/openpresentation-site/pull/59), [pptx-gallery#79](https://github.com/Data-Advantage/pptx-gallery/pull/79) and [pptx-dev#67](https://github.com/Data-Advantage/pptx-dev/pull/67). opf-pptx 0.11.9 (RR-13 import signals) follows.
- 2026-10-01: FF-58 closed by the owner decision that the `world` region map is parked for post-v1 ([opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)): works denominator 818. The open question is removed from the README; the `PPTX_GALLERY_READ_TOKEN` item (FF-37) stays open.
- 2026-10-01: RR-16 in review ([opf#247](https://github.com/OpenPresentation/opf/pull/247), [opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91), [opf-pptx#135](https://github.com/OpenPresentation/opf-pptx/pull/135)). Decision (supervisor, vetoable): quantize composed font sizes to 0.01 pt (1/75 px) in core, trial sizes rounding down and floors up, and tighten the parity run-size tolerance from 0.005 pt to 0.001 pt. Parity on the 850 values: 741 perfect, 109 near, 0 mismatch (719 / 131 / 0 for the unsnapped core under the same exact tolerance; 22 values improve, the two `list-6x-heading-title-center` layouts among them, none regress). Example corpus: 318 of 805 slides change (303 by at most 0.018 px per size), 15 metric slides pick a neighbouring candidate (up to 2.2 px); renderer raster golden 316 of 805. Geometry change for the lockstep release; the item is done when the three PRs merge and the floors are raised with the release. Record: [rr-16-font-size-grid.md](rr-16-font-size-grid.md). opf-render#91 is merged. The core ecosystem CI pins render `f392fa6` (the RR-16 head with the golden) and PPTX `1ab1630` (the merged opf-pptx#135) rather than render main, because render main (RR-10, the preview draws SVG images, #88) and opf-pptx `test/svg-image-degrade.mjs` (a malformed SVG must show the placeholder in the preview) disagree today, independent of RR-16; repin once RR-10 reconciles them.
- 2026-10-01: RR-17 part A (Latin font long tail: FF-41, FF-42, FF-43) in review: [opf#249](https://github.com/OpenPresentation/opf/pull/249), [opf-render#92](https://github.com/OpenPresentation/opf-render/pull/92), [opf-editor#61](https://github.com/OpenPresentation/opf-editor/pull/61), [pptx-gallery#80](https://github.com/Data-Advantage/pptx-gallery/pull/80). Per-family fixtures in every host, the qualification report and the tracker-derived acceptance (41 qualified, 36 documented-visual); decisions for Aptos Narrow, Serif, Mono and Liberation are recorded as vetoable in the font burndown. FF-46 native checks of the Latin families are the supervisor's.
- 2026-10-01: Program scope 2 (owner approval, RR-00 scope 2 PR). Added RR-21 to RR-35 (editor slide management, autosave and restore, downloads, data grid, editor tools, conversions, CLI render/export/import, player and `<opf-deck>`, audit, Markdown, diff/format/patch, templates and variables, numbered lists, footnotes and captions, chart options), all in-progress. Owner declined a VS Code extension and a per-slide or per-run language (no issue). Owner deferred navigation and motion and rich speaker notes ([opf#250](https://github.com/OpenPresentation/opf/issues/250), [opf#251](https://github.com/OpenPresentation/opf/issues/251), out of v1). The `world` map chart is parked ([opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)): open decision 1 is settled and the in-scope gallery denominator is 818.
- 2026-10-01: RR-30 in review ([opf#268](https://github.com/OpenPresentation/opf/pull/268)): `@openpresentation/opf/markdown` (`markdownToOpf`, `opfToMarkdown`) and `opf from-md` / `opf to-md` with a documented dialect, lint-shaped diagnostics with line and column, and a read-back check that makes the writer's Markdown convert back to the same deck. All 126 example decks round trip (769 of 805 slides need no YAML); `docs/markdown.md`, `examples/markdown/` and the opf-author skill reference document it. Deterministic and offline; adds the `yaml` dependency to core.
- 2026-10-01: RR-31 in review: [opf#265](https://github.com/OpenPresentation/opf/pull/265) adds `@openpresentation/opf/patch` (the one RFC 6902 module with inverse patches and optional schema validation), `/diff` (`diffPresentations`, `mergePresentations` with conflict objects) and `/format` (`formatPresentation`), and the CLI commands `opf diff`, `opf merge` and `opf format` (`opf edit` uses the shared module); [opf-editor#66](https://github.com/OpenPresentation/opf-editor/pull/66) moves the editor session onto it (adds `move`/`copy`; undo/redo, events and error codes unchanged). Nothing is published; the editor needs the core release that contains `/patch` (its CI pins core to the opf PR head and runs `test:packed` non-blocking until then). Tests: RFC 6902 conformance, diff/merge/format over the 126 example decks, fuzz, CLI end to end, editor regressions.
- 2026-10-01: RR-04 in review ([opf#243](https://github.com/OpenPresentation/opf/pull/243), [evidence](../../evidence/rr-04-cross-platform-20261001/README.md)): the font-switch matrix runs against the published core 0.11.4, opf-render 0.11.9, opf-pptx 0.11.8 and opf-editor 0.10.6 from the npm registry in a TypeScript consumer on ubuntu, windows and macos (`published-matrix.yml`, about 7 to 8 minutes per OS, cached). 61 pairwise decks, 274 states, 26 chart paths; 300 of 300 PPTX/SVG/PNG digest entries identical across the three systems with an empty allow-list; a 17-child determinism grid per OS (time zones, locales, clocks, hostile defaults, no host fonts, decoy host fonts) found no difference and no nondeterminism, so no fix PRs were needed. Open: the installed FF-38 parity audit per OS and a required status check (repository setting).
- 2026-10-01: RR-05 right-to-left layout in review ([opf#259](https://github.com/OpenPresentation/opf/pull/259), [opf-render#98](https://github.com/OpenPresentation/opf-render/pull/98), [opf-pptx#142](https://github.com/OpenPresentation/opf-pptx/pull/142)): logical alignment, per-paragraph line directions, mirrored composition, `a:tblPr rtl`, reversed column charts, en-US Latin phrase runs. 39 of 44 sample decks byte-identical, parity `languages` unchanged (66/27/0). Follow-up native set and probe deck prepared for the supervisor.
- 2026-10-02: Burndown reconciled with GitHub (REST, all seven repositories, 2026-10-01/02 merges): 22 of 39 items closed. Done: RR-01 (opf-pptx 0.11.9 published and adopted by the three sites), RR-07, RR-08, RR-09, RR-10 and RR-11 (both also native-verified), RR-13, RR-21, RR-24 to RR-27, RR-29 to RR-32, RR-33 to RR-35 (v2 native run 2026-10-01 passed: F1 marker size, F2 chartex axis titles), and new RR-36 (single-series chart colour, native-verified) and RR-37 (Windows packed-install CRLF bin script). Review: RR-05 (core merged; [opf-pptx#142](https://github.com/OpenPresentation/opf-pptx/pull/142) and [opf-render#98](https://github.com/OpenPresentation/opf-render/pull/98) open; the `rr-05b-native` set passed 2026-10-02: alignment, bullets, table rtl, chart mirroring, `v2.0` bidi) and RR-12 ([opf#257](https://github.com/OpenPresentation/opf/pull/257) docs open). In progress with merged parts: RR-02 (pptx-dev master red again at `acabe5d`), RR-03, RR-04, RR-06 and RR-16 (waiting for the release), RR-14 (merged behind flags), RR-17 ([opf-render#102](https://github.com/OpenPresentation/opf-render/pull/102), [pptx-gallery#80](https://github.com/Data-Advantage/pptx-gallery/pull/80) open), RR-18, RR-22, RR-23 and RR-28 (site PRs [pptx-gallery#83](https://github.com/Data-Advantage/pptx-gallery/pull/83), [pptx-dev#70](https://github.com/Data-Advantage/pptx-dev/pull/70), [openpresentation-site#61](https://github.com/Data-Advantage/openpresentation-site/pull/61) are drafts). Added RR-38 (Arabic Typesetting preview scale, [opf#275](https://github.com/OpenPresentation/opf/pull/275) and [opf-render#109](https://github.com/OpenPresentation/opf-render/pull/109) open) and RR-39 (CJK and Thai line breaking in core, todo, post-release unless descoped with an issue per Definition of done 2). RR-20 now depends on RR-21 to RR-39. Nothing published after core 0.11.4, opf-render 0.11.9, opf-pptx 0.11.9 and opf-editor 0.10.6.
