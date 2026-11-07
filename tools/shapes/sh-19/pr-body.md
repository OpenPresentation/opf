SH-19 (option 2 of the owner's "Both, 1 then 2"): OPF's own designs ship as live, editable SmartArt on SmartArt layout definitions OPF authors, and OPF's interpreter of those definitions draws exactly what PowerPoint draws.

## The spike (COM)

Full answers: `C:/opf-work/shapes/sh-19/spike.md`.

- **Algorithms.** Every `alg` evaluates in an OPF-written `dgm:layoutDef`. Only `composite` with explicit `l/t/w/h` constraints (shares of the frame) is a closed form: every child within 0.0001 pt at any frame size, once a hidden full-frame child stops PowerPoint centering the drawing. `conn` between two centers (pads and thickness in mm) is exact. A turned shape is the largest-area rectangle at its angle inside its box (a square at 45 degrees). `lin`, `snake`, `cycle` and `pyra` each search or clamp beyond their spec description.
- **Composite placement** works: one `if func="cnt"` branch per entry count, one `forEach st=i cnt=1` per node.
- **Change Layout**: opens live on OPF's layout (title, description, category); switching to a built-in and back restores it; node edits keep OPF's size and rectangles; added and deleted nodes take the other counts' tables (`primFontSz` gives added nodes OPF's size).
- **Text**: `custT` run sizes hold, no rule shrinks them, margins are shares of the size.
- **Round trip**: SaveCopyAs keeps the part, rewritten (useDef data, defaults dropped, factors to four decimals) but the same definition.
- Format facts found: layout node and forEach names must be unique across the whole definition (a repeat silently falls back to Basic Block List); `hideLastTrans="0"` draws a loop's closing arrow; PowerPoint keeps the first definition of a `uniqueId` for its whole session, so each distinct table carries a digest in its `uniqueId`.

## What this adds

- **Core** `smart-art-layout.ts`: the definition model, OPF's interpreter (`evaluateLayoutDefinition`, `layoutArrangement`: nodes and arrows in the shape of a composed arrangement, edge-safe), the builder of composite tables (`compositeLayoutDefinition`), each OPF design for any count (`opfLayoutGeometry`, from the new `ComposedArrangement.layout` recipe), and the domain (`SMART_ART_OPF_DOMAIN`, `opfSmartArtUnavailable`). Composition also checks an OPF design's line breaks at 4% narrower and wider (`smartArt.stable`) and records its text density (`smartArt.ink`, `fill`).
- **PPTX** `smart-art-layouts.js`: the identity of each OPF layout (`urn:openpresentation.org/smartart/layout/<design>/<digest>`, "OPF Stepped Pyramid", "OPF Card Grid", "OPF Chevron Rows", "OPF Snaking Flow", "OPF Snaking Vertical Flow", "OPF Cycle Ring", "OPF Cycle Loop", "OPF Cycle Loop of Three Rows", "OPF Quadrants", and compact forms) and the XML writer. The export builds the definition from the composed design, evaluates it, and writes it (layout part, `r:lo`, the data model's `loTypeId`) only when the interpreter draws the design within 0.1 pt; text is anchored where OPF's composition starts each entry's first line. Every live SmartArt keeps SH-16's fallback. Designs inside a built-in layout's domain keep the built-in.
- **Import** maps OPF's `uniqueId`s back to their arrangement: from the `mc:Choice`, from the fallback alone, and after PowerPoint saved the file again.

## The gate

COM sweep of 480 decks (six arrangements, 1 to 8 entries, short/medium/long, 16:9/4:3/1:1, Arabic and Japanese, list blocks), each live and as native shapes, drawn by PowerPoint:

- With the domain open, all 310 OPF-layout instances laid out within 0.000 pt of the interpreter (after the `uniqueId` digest; before it, 49 were drawn with an earlier deck's tables). The pixel gate then set the domain: Latin, at most two stable lines an entry, text covering at most 7.5% of the frame; designs and counts as passed (stepped pyramid 1 to 8, card grid 1 to 6, chevron and flow rows 6 to 8, vertical-flow columns 5 to 6). Cycles, quadrants and the compact forms held their entries only above that density and stay native shapes for now; Japanese text sat 11 px off.
- With the domain: 30 decks live on OPF's layouts, 30 pass (0.000 pt, sizes equal, mean difference from the native export at most 0.8 at a quarter size, text ink within 1.08 px). The built-in layouts' 107 live decks are unchanged.
- COM checks on five designs: live nodes, node edit (size and rectangles kept), add and delete, Change Layout and back, SaveCopyAs and reopen, the unknown-namespace fallback, and OPF's import of the resaved files.

Evidence (gate table, preview | PowerPoint live | PowerPoint native export sheets labelled with design and layout, COM records): `C:/opf-work/shapes/sh-19/`.

## Pinned files

None of the pinned files moves: the preview geometry is unchanged, so the render layout-template goldens and the core composition goldens pass as they are, and the chartex fallback fixture's bytes are unchanged (no gallery layout is added). Budgets raised because they were exceeded by SH-19's code: the catalog-free `composition` entry (239,757 bytes gzipped, budget 246,950: the interpreter, the definition builder and the domain) and the MCP lean worker (8,075,721 bytes, limit 8,100,000, with a comment).

## Checks

- New tests: core `test/sh-19-smartart-layouts.test.mjs` (the interpreter against the COM fixture `test/fixtures/sh-19-com.json`, 177 shapes within 0.001 pt; every design back from its own definition at every count; the domain), render `test/sh-19-smartart-layouts.mjs` (the preview of seven OPF designs is the interpreter's drawing of their definitions), pptx `test/sh-19-smartart-layouts.mjs` (the parts, names, identity and digest, native fallbacks, import from the choice, the fallback and a resaved file). SH-09 and SH-17 tests updated for OPF's card grid now being live and the longer reason.
- `pnpm check:changed`, then every test file of pptx and render one by one, and the core and MCP suites. Failures that are environmental on this Windows machine (each also fails on main or needs files the sparse checkout leaves out): pptx `browser-check.mjs` (no built browser artifact) and `keynote-registry-runtime.mjs` (EPERM creating a symlink); render `browser-check.mjs` and `accepted-text-browser.mjs` (fails identically on origin/main); core `script-width-estimates.test.mjs` and `check:text` (docs/evidence not checked out); `check:browser-safe` (a Windows path in a script test this branch does not touch). The MCP app build needs the local `fileURLToPath` patch from #1070, not committed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
