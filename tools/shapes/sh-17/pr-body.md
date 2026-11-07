## SH-17: live SmartArt for chevrons and process flows

Three more diagram layouts, built on SH-09's design (a region's `arrangement`, PowerPoint's geometry fitted in core, a per-instance domain, OPF's own design elsewhere) and SH-16's fallback picture.

**Arrangement names** (region `arrangement`, gallery layout ids, no collision with the `process` layout or the `steps` region): `chevrons`, `flow`, `vertical-flow`. Each layout's region is named `stages`.

| Arrangement | PowerPoint layout | PowerPoint's design | OPF's own design |
| --- | --- | --- | --- |
| `chevrons` | Basic Chevron Process (`chevron1`) | n chevrons, w = s(n) W, h = min(0.4 w, H), step 0.9 w | PowerPoint's proportions (step 0.9 w, the point at most 0.2 w deep), 1 to 4 full-width rows, a row breaking after a point |
| `flow` | Basic Process (`process1`) | n boxes (`roundRect` 10000), w = s(n) W, h = min(0.6 w, H), step 1.4 w, a `rightArrow` 0.212 w x 0.248 w, 0.1 w after each box | PowerPoint's proportions (room 0.4 w, its 0.212 x 0.248 arrow), 1 to 4 full-width rows that snake, a down arrow from each row's end to the next |
| `vertical-flow` | Vertical Process (`process2`) | n boxes, h = s(n) H, w = min(1.8 h, W), step 1.5 h, a `rightArrow` turned 90 degrees in each gap | PowerPoint's proportions (room 0.5 h, its arrow), 1 to 4 columns that snake, a right arrow at the end where a column stops |

### The fitted model

PowerPoint sizes these layouts with a binary search on one scale and keeps the last step that fits, so a node is not the closed form (two chevrons at 800 pt are 420.31 pt wide, not 421.05) but a multiple of 1/8192 of the frame that depends only on the node count. The COM sweep (`AddSmartArt`, 1 to 10 nodes, 20 frames from 250 x 120 to 800 x 540 pt per layout) gives `SMART_ART_SCALES` (in 1024ths): chevrons 1024, 538, 365.5, 276.5, 222.5, 186, 160, 140.25; boxes in a row 1024, 426.5, 269, 196.75, 155, 128, 108.875, 94.75; boxes in a column (of the height) 1024, 409.5, 256, 186, 146.25, 120.375, 102.375, 89. One node squeezed by the frame's other side is 1023/1024. Core places every node and arrow of every measured frame within 0.0001 pt (fixture `sh-17-powerpoint-geometry.json`), except frames where the 8 pt test letter did not fit a node and its text grew it.

Text margins: a chevron 0.315 em at its start and 0.105 em elsewhere in its own text rectangle; a box 0.3 em in the roundRect's. The arrows are the primary lightened 40% (`sibTrans2D1` in OPF's colors part), without a line.

### The domain and the gate

222 decks (each arrangement 1 to 8 entries, short/medium/long, 16:9, 4:3, 1:1, plus Arabic and Japanese), each exported live and as shapes and drawn by PowerPoint through COM. First pass: 88 live, 74 passed; 7 boxes nearly full of text were laid out again by PowerPoint (0.22 and 5.3 pt off) and 7 frames dense with large text drew the SmartArt more than a mean of 1 from the native export. Domain (core `SMART_ART_DOMAIN`): Latin left-to-right text; 1 to 6 chevrons or boxes in a row at 1.1 to 2.3 : 1; 1 to 4 boxes in a column at 0.55 to 1.2 : 1; at most 2 lines an entry and 6 in all with stable breaks (SH-09's); **fill** (no entry's lines over 95% of its node's text height) and **ink** (the text at most 8% of the frame), both new and only for these three.

Final pass: **63 live SmartArt, all pass** (node rectangles and arrows within 0.000 pt, sizes equal, no visibly different shape block, within SH-07's gate of the native export: max mean 0.86, text within 1.49 px); 151 OPF's own design (no visibly different block in any; mean at most 2.7 outside the text, antialiasing); 8 lists (7 or 8 long chevrons and 8 long boxes on 1:1, vertical flows of 6 to 8 long entries on 4:3 and 1:1), which no design holds at the list's size, with `opf/arrangement-adapted`.

COM checks on six live instances: `HasSmartArt`, the layout name, every entry a node; a node edit keeps OPF's size in every node and every rectangle; Change Layout to Basic Block List keeps the nodes. With the `mc:Choice` requiring an unknown namespace, PowerPoint draws SH-16's fallback (mean 1.3 from the preview over the slide). Import: OPF's frame, the fallback picture alone, native shapes, and PowerPoint-authored chevron1, process1 and process2 files come back to the same layout and list (data model only, no layout part stored).

OPF's own design (review): the text grows to the largest size every node holds (1.5 x the role size at most, never below it), then each node takes the height that text needs (PowerPoint's proportion at least), centered; every wrapped row spans the region. A compact form (rooms of gaps, smaller arrows) is drawn only where no proportioned design holds the entries. The 63 live decks are byte-identical to the first final pass.

### Shared code (SH-18 works on Basic Cycle at the same time)

New geometry lives in `packages/javascript/src/linear-arrangements.ts`. Shared lines touched: one entry each in `ARRANGEMENTS`, `ARRANGEMENT_MAX`, `SMART_ART_LAYOUTS`, `ARRANGEMENT_TEXT_MARGIN`, `SMART_ART_DOMAIN`; `ArrangementPaint.arrow`; optional `ComposedArrangement.arrows` and `margins`; one `isLinearArrangement` branch in `arrangedList`; `smart-art.js` arrows (drawing, native shapes, adjustments, `sibTrans2D1` colors), the outline text and `LAYOUT_CATEGORY`. SH-09's core test now checks its own entries of the shared records.

### Pinned files that move (not regenerated here)

- render layout-template goldens: 78 new samples (the three layouts x 1 to 6 blocks x short and long, and their paginated pages), none changed;
- the chartex fallback fixture: every export carries three more slide layouts;
- the MCP docs budget (`mcp.test.mjs`: 1,196,689 bytes against 1,190,000) and the lean MCP server bundle (`mcp-workerd.test.mjs`: 8,050,149 bytes against 8,050,000);
- the catalog-free budget (`scripts/catalog-free-budget.json`: composition 230,861 bytes gzipped against 230,828).

Core composition goldens were regenerated here: 36 new entries, none changed.

### Tests

- New: `packages/javascript/test/sh-17-arrangements.test.mjs` (every measured frame of the fixture within 0.01 pt, the scales, shapes, OPF's designs, composition, the domain), `packages/render/test/sh-17-arrangements.mjs`, `packages/pptx/test/sh-17-smartart.mjs` (live parts, round trip from the frame and the fallback alone, PowerPoint-style data models and an edited node, native shapes, the domain fallback, mirrored chevrons).
- Every test file of core, render, pptx, gallery, cli, mcp and editor run one by one on Windows, plus `design-menu-browser.mjs` after a build (35 layouts). Failures, each compared with main: `script-width-estimates`, cli `image-placeholder-count`, `check:text` (docs/evidence is not in this blobless checkout); render and pptx `browser-check`, pptx `keynote-registry-runtime`, editor `codemirror-guard`, `check:browser-safe` (Windows: symlinks, paths, the browser harness; main fails the same); editor `browser-canvas`/`browser-schema` (browser pages, not node tests); and the pinned files below.
- SH-09's and SH-16's tests pass unchanged except that SH-09's core test now checks only its own entries of the shared records. The editor's `source-read-text.golden.json` moves in two entries: the nearest layouts to a mistyped id now include `chevrons`.
- `pnpm check:changed`: green apart from the environmental and pinned items above. On Windows the MCP app build (`packages/mcp/scripts/build-app.mjs`, from #1070) passes `new URL(...).pathname` (`/C:/...`) to esbuild and fails; it was patched locally to run the checks and is not part of this PR.

Evidence (sheets, gate table, COM records): `C:/opf-work/shapes/sh-17/` on the comparison machine.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
