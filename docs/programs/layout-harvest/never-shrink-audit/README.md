# "Never shrinks text": how OPF sizes text today

> **Status (2026-11-07).** This is the audit as written; the line numbers are from `a34478680`. The owner chose follow-ups 1 to 4, 8 and 9 for v0.33.0: RR-104 (follow-up 2, [opf#1081](https://github.com/OpenPresentation/opf/pull/1081), merged), LH-185 (follow-up 8, [opf#1080](https://github.com/OpenPresentation/opf/pull/1080), merged), SH-11 (follow-up 9, [opf#1088](https://github.com/OpenPresentation/opf/pull/1088), merged), and LH-184 (follow-up 3, [opf#1082](https://github.com/OpenPresentation/opf/pull/1082)) and LH-186 (follow-ups 4 and 1, [opf#1087](https://github.com/OpenPresentation/opf/pull/1087)), both folded into the v0.33.0 integration PR. Still open: follow-ups 5, 6, 7 and 10, SH-10, and [opf#1089](https://github.com/OpenPresentation/opf/issues/1089) (native-body rewrap, 0.34; diagnosis in [issue-1089-native-body-diagnosis.md](issue-1089-native-body-diagnosis.md)). The LH-186 before/after review is in [lh-186-review/](lh-186-review/).

Checked on 2026-11-07 against `origin/main` at `a34478680` (SH-19), in the checkout `C:/opf-work/never-shrink-text`. Line numbers are from that commit. Evidence came from reading the code, from probes that compose slides and export PPTX (scripts in [probes/](probes/), run from a checkout's `packages/javascript` or `packages/pptx`, with the absolute output paths of the machine they ran on; the exported decks are in [powerpoint/](powerpoint/)), from 272 PPTX exports of the example decks, and from PowerPoint 16.0 driven over COM. No code was changed.

Sizes are reference pixels on the 1280 x 720 slide (1 px = 0.75 pt), as composition states them.

## Summary

**"Never shrinks text" is not what the engine does in general.** It holds for three narrower things:

1. **Arrangement and growth choices never make text smaller.** Every alternative composition (rule sets, step badges, tracks, LH-48 growth, LH-83 recomposition) is compared with the base composition, block by block, and dropped if any block reads smaller. This is the wave 3 size guard: `shrinks()` at composition.ts:4616, applied in `growBody` at 4649 and documented at 4704-4710.
2. **LH-48 growth only grows.** `grownRoleSize` (composition.ts:1950) returns `max(size, min(size * growth, display))`.
3. **SmartArt-style arrangements (SH-09 to SH-19)** keep one size for every node. That size runs from 1.5 times the list's size down to the list's size, never below (`ARRANGEMENT_GROWTH = 1.5`, arrangements.ts:59; floor rule at composition.ts:9485-9495). When the entries don't fit, the next design is tried (PowerPoint's, OPF's own, then cards), and finally the plain list with `opf/arrangement-adapted`.

**The base fitter does shrink.** Every body block starts at its role size and steps down the type scale until it fits. The floor is `composition.minFontSize`, 16 px (12 pt) by default, not the role size:
- `fitText` and `fitAtSizes`: composition.ts:1764 and 1787.
- The LH-17/LH-149 type scale: 16, 17, 18, 20, 21, 23, 24, 26, 28, 30, 32 px (composition.ts:6535).
- The schema says the same: `minFontSize` "Overflow is diagnosed when text cannot fit at this size" (opf.schema.json:5015). The list `columns` description says "shrinks towards minFontSize" (opf.schema.json:3100).

Measured on this commit:

| Probe (16:9, automatic layout) | Role size | Composed size | Finding |
| --- | --- | --- | --- |
| 3-item list | 32 px | 37 px (grew, LH-48) | none |
| 6-item list | 32 | 32 | none |
| 14-item list | 32 | **24** (18 pt) | none |
| 30-item list | 32 | **16** (12 pt, the floor) | `text-overflow` |
| 14-item list, `columns: "auto"` | 32 | **20**, in 3 columns | none |
| 12-word paragraph | 28 | 56 (statement) | none |
| 160-word paragraph | 28 | **26** | none |
| 500-word paragraph | 28 | **16** | `text-overflow` |
| 4-row table | 25 | 25 | none |
| 14-row table | 25 | **18** | none |
| 30-row table | 25 | **16** | `text-overflow` |
| 15-node Mermaid flowchart | 32 (labels) | **5.2** (scaled picture) | `text-overflow` |

**What happens past the floor.** Text is drawn overflowing, with a `text-overflow` or `small-cell` finding. The slide is not paginated: `paginateSlide` is an explicit authoring transform, and rendering "never changes slide count" (pagination.ts:177). The layout only changes in these cases:
- LH-83: a layout template that set a body role at the floor is recomposed as the automatic grid when that reads better (`recomposeAtFloor`, composition.ts:5304).
- Lists use columns only with `columns: "auto"`/1/2/3 or a region's `listColumns` (composition.ts:7547-7553).
- Arrangements adapt as described above.
- `paginate` splits with a 24 px floor by default (pagination.ts:184). A 30-item list became 5 pages at 26 px.

**Export holds the composed sizes exactly.** Every run gets an explicit `sz`, and no exported file contains `normAutofit`:
- 136 example decks × 2 body-text modes = 272 exports, with zero `normAutofit` in slides, layouts or masters.
- Probe sizes came through exactly: list 2775/1800, table 1350, chart 1500 (hundredths of a point).

One latent path in `textBoxOptions` still asks for shrink (Exception 6).

**The honest label** for the Composition engine is something like: *"grows short content to fill the slide and changes the arrangement rather than set text smaller; dense content fits down to a 12 pt readability floor, never below, and is flagged past it."* "Never shrinks text" is true of the arrangement choices and of export, not of fitting.

## Text kinds

"Floor" is the smallest size composition sets. "Overflow" is what happens when the text does not fit at the floor.

| Text kind | Role size | Ceiling (growth) | Floor | When it doesn't fit | PPTX export |
| --- | --- | --- | --- | --- | --- |
| Title | 54 px (40.5 pt) | 75 px on message slides (cover, section, closing; `HEADING_DISPLAY_SIZES`, composition.ts:1927) | Not traced in depth; headings keep their role-size line count (composition.ts:5119) | `text-overflow` when furniture leaves too little room (composition.ts:6110) | Explicit `sz` (4050 = 54 px); native mode: one text box, `noAutofit` |
| Paragraph (prose) | 28 px (21 pt) (composition.ts:1615) | Lone block: 43 px (`LONE_DISPLAY_SIZES.text`, 1.54×, composition.ts:1915). Body of 2+ blocks: up to 3 type-scale steps, capped at display size, while it fills ≤ 60% (`LONE_TARGET`). Statement slides go further (probe: 56 px) | 16 px `minFontSize`, on the type scale | Overflows with `text-overflow`; LH-83 recomposition on templates | measured: one text box per line, `sz` from the fit, no autofit element; native: `defRPr sz` plus `noAutofit` (native-body.js:145, 153) |
| List | 32 px (24 pt) | Lone list: 37 px (1.16×) | 16 px | Columns only if asked; then overflow | As for paragraph |
| Arrangement (pyramid, matrix, cycle, chevrons, flow, vertical flow) | The list's size | **1.5×** (arrangements.ts:59) | The list's role size, or the list's fitted size when that is smaller (composition.ts:9485-9495) | Next design: SmartArt → OPF → cards → list, with `arrangement-adapted` (composition.ts:9601, 9622, 9708) | Live SmartArt: run `sz` plus `custT="1"` (smart-art.js:353, 381) and `noAutofit` in the drawing (smart-art.js:429); OPF layouts carry `primFontSz` (smart-art-layouts.js:325). Native shapes: `noAutofit` (diagram-shapes.js:742, 945) |
| Table | 25 px (18.75 pt) | 32 px (`tableGrowth`, LH-48) | 16 px; the whole table shrinks together (composition.ts:4136) | `text-overflow` | Per-cell and per-run `sz` (index.js:3888, 3906) |
| Quote body | 40 px; 32 px beside other blocks | 56 px | 28 px when `bodyLines` caps its lines; else 16 px (composition.ts:1962) | `text-overflow` (composition.ts:2189) | Explicit `sz` |
| Code | 22 px | 32 px | 16 px | `text-overflow` | Explicit `sz` |
| Metric value | Role `METRIC_ROLE_VALUE_SIZE`; display 232 px | 232 px | Display headroom is spent first, then the role size (LH-112, LH-135) | `text-overflow` | Explicit `sz` |
| Chart text | 20 px (15 pt) | none | Shrinks for a small chart box, never below 16 px (`chartTextSize`, chart-axis.ts:57) | Chart findings | One `sz` for every `c:txPr` (index.js:3575-3580); 1500 in the probe |
| Diagram labels (Mermaid, DOT, PlantUML via pele) | 32 px (`DIAGRAM_NOMINAL_SIZE`) | 32 px (a small diagram is drawn larger, but labels stay ≤ 32) | 16 px; secondary labels 75% of it | **The floor layout is scaled down as a picture, below the floor** (diagram.ts:298-301): probe 5.2 px, with `text-overflow` (composition.ts:7199) | SVG picture plus PNG fallback, or native shapes (SH-07) with `sz` (≥ 1 pt), `wrap="none"`, `noAutofit` |
| Shape text (SH-02/04) | 28 px | **None: never grows (SH-10)** | 16 px (`fitShapeText`, composition.ts:5969-5975) | `text-overflow` (composition.ts:5974) | Every run `sz` (index.js:3158-3176); `wrap="square"`, `noAutofit`, padding insets (shape-blocks.js:165-172) |
| Header/footer, slide number | About 13 px, fits toward the floor (composition.ts:1446) | none | 16 px | Error "Change the header/footer or slide design" (composition.ts:1587) | Native placeholders: runs have no `sz` and inherit the master's `defRPr sz`, which is the fitted size (native-furniture.js:162-188; index.js:4203) |
| Captions, footnotes | `max(0.6 × 25 px, floor)`; footnotes `max(13 px, floor)` (annotations.ts:297, 357) | none | 16 px | `text-overflow` | `sz` from the fit (annotation-export.js:48, 60) |
| Eyebrow/tag, pill, list descriptions | 22 px; 20 px; 0.82 of the entry | none | 16 px | — | Explicit `sz` |
| Speaker notes | — | — | — | — | **No `sz`**: inherit 12 pt from the notes master (index.js:2797; vendor-compat.js:34) |

## Exceptions and findings

Each one is labeled *by design*, *bug*, *latent bug* or *gap*.

1. **Body fitting shrinks to the 16 px floor, not to the role size.** *By design (WI-4, LH-17, LH-149, RR-90), but it contradicts the "never shrinks text" label.* `fitText` (composition.ts:1764), `fitAtSizes` (1787) and the type scale (6535) all step down from the role size. A dense list loses 25% (32 → 24 px) without a finding. `opf/text-shrunk` (info) fires only under 70% of the role size (validation-rule-info.ts:497). Prose and lists below 0.7 × role is 19.6 / 22.4 px, so a 32 px list can reach 23 px silently.
2. **`columns: "auto"` gives smaller text than one column.** *Likely bug.* A 14-item list fits at 24 px in one column. With `columns: "auto"` it lands at 20 px in three columns, because when the largest count doesn't fit at the starting size, "every column shrinks to one shared size" (composition.ts:7547-7551). The region's tool, meant to avoid shrinking, ends up smaller. Fix: choose the column count (1 to 3) whose fitted size is largest.
3. **Diagrams are scaled below the floor.** *By design, with a finding.* Of all text kinds, only these labels are drawn below `minFontSize`; the probe reached 5.2 px (diagram.ts:298-301; composition.ts:7193-7199). The finding suggests another slide or direction, but nothing adapts automatically: no pagination, no `TB`/`LR` retry.
4. **Shape text shrinks to the floor but never grows (SH-10).** *By design for the shrink, documented (docs/shapes.md:28: "from the body size down to the composition's `minFontSize` and never below it"); the missing growth is the gap SH-10 files.* `fitShapeText` (composition.ts:5969-5975) sets `start = max(floor, contentNominalSize('text') * scale)` (28 px) and `floor = minFontSize` (16 px), then calls `fitContent(..., start, floor, ...)`. So a shape's text fits down below its 28 px role size exactly as a paragraph does, with `text-overflow` only past the floor (5974). Overlay shapes (SH-04) share the same fitter. `fitShapeText` starts at the prose size and only fits down (composition.ts:5971-5973). A short "Hi" in a large rectangle stays at 28 px. LH-48 never sees shapes.
5. **Small shape text draws smaller in PowerPoint (SH-11).** *Gap, as filed.* Export writes the composed `sz`, `wrap="square"`, `noAutofit` and padding insets (shape-blocks.js:165-172). No code shrinks the size. The likely cause is that core's `textBox` differs from PowerPoint's preset text rectangle (the shape is written at the full `box`, shape-blocks.js:165), so PowerPoint wraps narrower. That is an export geometry match problem, not a sizing rule.
6. **`textBoxOptions` asks for shrink-on-overflow.** *Latent bug.* `fit: "shrink"` at index.js:4800 makes PptxGenJS write a bare `<a:normAutofit/>`. Callers that don't override `fit` are the estimated-font heading fallback (index.js:2714), the plain-text fallback (2750) and `addTextPayload`/`addListPayload` (2921-2928, 3028, 3061). The unsupported-content placeholder also passes `fit: "shrink"` (4641). None of these was reached in 272 example exports, and the tests only cover the measured and native paths. If one is reached, PowerPoint opens the box at OPF's size (see below) and shrinks it on the first edit, which is a silent behavior change. Fix: `fit: "none"` there, plus a test that searches every export for `normAutofit`.
7. **Arrangement floor follows the list's fitted size.** *By design.* When the list itself had already shrunk below its role size, the arrangement's floor is that smaller size (composition.ts:9488-9489). So "never below the role size" in docs/smartart.md:364 is stricter than the code.
8. **Pagination floor (24 px) is below the prose role size (28 px).** *By design* (pagination.ts:184). Pages of prose can be set at 24 to 26 px.
9. **Chart text shrinks for small boxes.** *By design* (chart-axis.ts:57; render/src/charts.js:303). It never goes below the floor.
10. **Footer runs and notes carry no run `sz`.** *By design.* Footer runs inherit an explicit master `defRPr sz` set to the fitted size. Notes inherit 12 pt from the notes master. Neither depends on PowerPoint's autofit.
11. **Import ignores `fontScale`.** *Gap.* `fromPptx` keeps the run `sz` and records only an `autofit: "shrink"` signal (import-signals.js:355). Shape import drops autofit with a finding (shape-import.js:540). A PowerPoint box that shows 13 pt because of `fontScale="55000"` imports as 24 pt text that overflows in OPF.
12. **Editor and renderer** have no fitting of their own. They draw core's sizes (render/src/charts.js:303 reads `chartTextSize`). *Not an exception.*

## PowerPoint's "Shrink text on overflow"

This is how it behaves, checked over COM on PowerPoint 16.0 (Microsoft 365, Windows). Evidence: [powerpoint/](powerpoint/) `autofit*.pptx` and `af-*.pptx` (written by [probes/make-autofit.mjs](probes/make-autofit.mjs)).

**How it is stored.** `<a:bodyPr><a:normAutofit fontScale="85000" lnSpcReduction="10000"/></a:bodyPr>`. The runs keep their authored `sz` (2400 stayed 2400). PowerPoint draws them at `sz × fontScale`, with line spacing reduced by `lnSpcReduction`. The scale is a **cached result** that PowerPoint writes when it fits the box.

**It does not fit on open.** A file with a bare `<a:normAutofit/>` (as PptxGenJS writes it) opened with AutoSize = "shrink on overflow", yet the text stayed at 24 pt, overflowing 806 pt of text in a 389 pt box, both with and without a window. It shrank only after the text was edited (24 → 20.4 pt, `fontScale 85000`, `lnSpcReduction 10000`). A generator must therefore compute and write `fontScale` itself, or the file opens overflowing.

**How far it goes.** It tightens line spacing first (up to `lnSpcReduction="20000"`), then scales the font:

| Lines of text | Saved `fontScale` | Drawn size |
| --- | --- | --- |
| 14 | 85000 | 20.4 pt |
| 20 | 55000 | 13 pt |
| 30 | 55000 | 13 pt |
| 45 | 32500 | 8 pt |
| 70 | 25000 | 6 pt, still overflowing |

There is no readability floor: it went to 6 pt and stopped at 25%. Its fit is also not tight: 20 lines at 55% filled only 64% of the box.

**What it does well.** It keeps the author's layout and live-refits as people type, both shrinking and growing back up to 100% of `sz`. For hand-edited slides that is the right tool, and it is why it feels good in PowerPoint. What it never does is change the layout, add columns or split the slide, so dense content becomes small text.

**How it compares with OPF.**

| | PowerPoint shrink on overflow | OPF composition |
| --- | --- | --- |
| Changes layout to keep text large | No | Yes: designs, columns, growth, LH-83 recomposition, pagination when run |
| Lower limit | 25% of `sz` (6 pt from 24) | `minFontSize` (12 pt by default), then a finding |
| Grows short text | No (at most 100% of `sz`) | Yes, up to the display sizes (1.16× to 1.5×) |
| Refits on edit in PowerPoint | Yes | No: fixed sizes; added text overflows |
| Same result in every viewer | Depends on each viewer applying the cached `fontScale` (not verified here for Keynote, Google Slides or LibreOffice) | Yes: explicit `sz` |

### Options OPF could offer users

These are proposals, not built. Each keeps OPF's composed look as the default.

1. **`autofit: "edit"` (export option, low risk).** Write OPF's fitted size as `sz`, as today, plus a bare `<a:normAutofit/>` on body text boxes and placeholders. The file opens exactly as OPF composed it, because PowerPoint does not refit on open (verified). When someone later adds text in PowerPoint, it shrinks instead of overflowing. It cannot grow back above OPF's size, since `fontScale` caps at 100%. It is best suited to native mode, where the body is one editable box. Measured mode writes a box per line, where it does little.
2. **`autofit: "native"` (export option, medium risk).** Write the role size as `sz` and OPF's fit as `fontScale = fitted / role`, for example `fontScale="75000"` for a 24 px fit of a 32 px list. PowerPoint then shows OPF's size on open and refits live in both directions up to the role size. The renderer and the importer must apply `fontScale` (follow-up 6). Other viewers' handling of `fontScale` needs checking before this is a default.
3. **`composition.overflow: "shrink"` (composition option, a deliberate opt-in).** "Keep this layout, shrink text to fit" for authors who prefer PowerPoint's behavior. It would skip the arrangement changes, keep fitting down past the 16 px floor to an author-set minimum, and export with option 2 so PowerPoint keeps fitting. It should still report `opf/text-shrunk`.
4. **Keep the default.** Most generated decks should stay as they are: explicit sizes and layout changes. Options 1 and 2 only change what happens after export, when a person edits in PowerPoint.

## Docs and tests

**Where the rule is stated.**
- Accurately, for arrangements: docs/smartart.md:32, 39, 59-60, 364; layout.schema.json:430; skills/opf-layout/SKILL.md:37; changes/sh-09, sh-17 and sh-18.
- Accurately, for the guard and growth: docs/layout-templates.md:161, 478-503; docs/dynamic-composition.md:63.
- Accurately, for the floor: docs/validate.md:895 ("shrinks text to the readable minimum and then reports what still does not fit"); docs/content-payloads.md:236-240 (tables shrink together); skills/opf-layout/SKILL.md:42; skills/opf-layout/references/geometry.md:71, 86, 136; opf.schema.json:3100, 5015.
- Export: packages/pptx/README.md:32, 544-547 ("no autofit"); skills/opf-export/SKILL.md:86.

**Mismatches.**
- docs/programs/shapes/README.md:67 says "Text inside a shape never shrinks below what composition gives it". That is true of export, but composition itself fits shape text down to the floor, as docs/shapes.md:28 correctly states. The two shape docs read as if they disagree.
- docs/smartart.md:364 says "OPF never shrinks text below the role size". The arrangement floor follows the list's fitted size when that is smaller (Exception 7).
- The "Diagrams in OPF" page's "never shrinks text" overstates the engine (Summary).
- No doc states the 1.5× ceiling for LH-48 body growth. Its real ceilings are the per-kind display sizes: 1.16× for a list, 1.54× for prose, 1.28× for a table.
- docs/validate.md:919's `opf/min-font-size` uses an 11 pt threshold (`minFontSizePt`), separate from `minFontSize` (16 px = 12 pt). Two floors with different units invite confusion.

**Tests.**
- Arrangements, never below the list's role size: packages/javascript/test/sh-09-arrangements.test.mjs:75, 116; sh-17-arrangements.test.mjs:122, 171; sh-18-cycle.test.mjs:139-189.
- The guard: layout-interactions.test.mjs:204 and the lh-* / wave-* suites.
- Growth caps: lone-fill.test.mjs:14; lh-09-statements.test.mjs:78-91.
- Shrinking toward the floor: rr-90-table-type-size.test.mjs:22; body-type-scale.test.mjs:32; sh-02-shape-blocks.test.mjs:93.
- No autofit on the measured and native paths: packages/pptx/test/accepted-text.mjs:41; native-body-export.mjs:62-63; native-title-and-bodies.mjs:34-35; sh-02-shape-blocks.mjs:40; sh-07-native-diagrams.mjs:79; scripts/test-ecosystem.mjs:68 and the other ecosystem scripts.

**Test gaps.**
- No test asserts the 1.5× arrangement ceiling.
- No test checks that every exported run, or its paragraph default, carries `sz`.
- No test checks the absence of `fontScale`.
- No test reaches the `fit: "shrink"` fallbacks (Exception 6).
- No test covers `columns: "auto"` against one column (Exception 2).

## Proposed follow-ups

1. **Relabel the rule in user-facing docs** (the "Diagrams in OPF" page, docs/programs/shapes/README.md:67, docs/smartart.md:364): "grows to fill, changes the arrangement before it sets text smaller, never below the 12 pt readability floor".
2. **Fix the latent `normAutofit`** (Exception 6). Set `fit: "none"` in `textBoxOptions` (index.js:4800) and at 4641, and add an export-wide test that fails on any `normAutofit` and any `fontScale`, across the example decks in both body-text modes.
3. **Make `columns: "auto"` pick the count with the largest fitted size**, never smaller than one column (Exception 2; composition.ts:7547-7553).
4. **Try layout changes before shrinking**, so "never shrinks" becomes closer to true. When a block would fit down more than one type-scale step, compose `columns: "auto"` for long lists and a wider region or LH-83's automatic grid for templates. Pick whichever keeps the largest text, using the existing guard (`shrinks`, `bodyReadability`). This is the layout harvest direction ("never shrink text").
5. **Raise the visibility of shrinking.** Lower the `opf/text-shrunk` threshold from 70% to, say, 85% (one full type-scale step), or add a deck-level stat of how many blocks sit below their role size. Today a 32 → 23 px list is silent.
6. **Read `fontScale` on import** (Exception 11). Use `sz × fontScale` as the composed size, or keep `sz` with a finding, so PowerPoint decks with shrink-on-overflow don't import overflowing.
7. **Add the PowerPoint autofit options** above. Start with option 1 (`autofit: "edit"`), which needs no renderer change. Verify `fontScale` handling in Keynote, Google Slides and LibreOffice before option 2.
8. **Adapt diagrams instead of scaling them below the floor** (Exception 3). Retry the other direction (`LR` ↔ `TB`) and give the diagram a full-slide region before scaling, or offer a `paginate` hint.
9. **SH-10:** let shape text grow like a lone block (LH-48 caps). **SH-11:** match the exported text rectangle to core's `textBox` (insets from the preset's `rect`), and check it with COM.
10. **Test the 1.5× arrangement ceiling and per-run `sz`** in packages/javascript and packages/pptx.
