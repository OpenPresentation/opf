Phase 2 of the shapes work (`docs/programs/shapes/`), integrated into one branch as phase 1 was in #1055. The four reviewed PRs are merged in order on a fresh `origin/main` (e815afee2), their meeting points are resolved so every intent survives, everything pinned is regenerated once, `origin/main` is merged again after #1061 (RR-103) landed (ec054470f, its deletions kept), and the combined result is checked against main, on Windows and in PowerPoint.

## Constituent PRs (merged in this order)

1. #1057 SH-04 (approved at a97420afb): overlay shapes and connectors (`slide.shapes`, one `OverlayShape` form with `connector`), front and back layers, connector `adjust`, pagination.
2. #1058 SH-05 (approved at aa1e1a44c): PPTX import of shapes, overlays and connectors; the back layer on import, PowerPoint's connector middles kept as `adjust`, the pattern tile origin at the slide's corner, arrowheads on open preset paths in both engines.
3. #1059 SH-07 (approved at 3b62193a7): native Mermaid diagrams, all 32 families allowlisted, `diagrams: "shapes"` the default.
4. #1060 SH-06 (approved at b8086ffbe): the shape picker, adjust handles, shape and overlay editing, MCP `search_shapes`, the skills.

Then `origin/main` again (#1061 RR-103). The four PRs stay open; close them when this merges.

## Conflicts and how they were resolved

Each merge commit's message records its resolution. SH-04 and SH-05 merged cleanly (SH-05 already held SH-04's final head).

- **#1059 SH-07** (`packages/pptx/src/index.js`, `collectSlideItems`): SH-05 moved the `grouped-text-reflow` diagnostic below the shape loop and limited it to groups whose members import as text; SH-07 exempted groups named `OPF diagram N`. Kept SH-05's place and rule and exempted only the groups SH-07's `importDiagramGroups` recognizes as intact. After the diagram pictures: SH-05's drawn-shape setup, then SH-07's intact diagram groups.
- **#1060 SH-06** (`docs/shapes.md`): kept SH-05's import section in full. Also removed the two vendor-name mentions SH-06 still had (the editor bullet and the shape picker's header comment), so the branch adds none.
- **origin/main, #1061 RR-103** (`spec/schemas/opf.schema.json`, `docs/shapes.md`, `docs/schema-reference.md`): RR-103's `ShapePreset` description; the property map without the vendor column, with phase 2's rows; `docs/schema-reference.md` regenerated with `scripts/generate-schema-docs.mjs`; the vendor API term left in "Rotation, flip and stacking" dropped. `git grep` finds no vendor name (RR-103's check).

## Where the items meet (decisions)

1. **One overlay form everywhere.** SH-05 holds SH-04's final head (a97420afb); SH-06 and SH-07 merged it at 8bff33fd7, which already has the single `OverlayShape` form (6b7582be6), `layer` and connector `adjust` (345a19f9b); the two later SH-04 commits are docs only. SH-05's importer, SH-06's overlay editor and SH-07's converter write and read that one form; their tests pass against the merged schema (pptx `sh-05-*`, `sh-07-native-diagrams`, editor `shape-overlays`, `shape-overlays-browser`, core `sh-04-overlays`, `sh-07-diagram-shapes`).
2. **One connector writer.** `connectorXml` (`packages/pptx/src/connectors.js`) writes every `p:cxnSp`: SH-04's overlay connectors and SH-07's glued diagram edges. Both glue by the native shape ids and core's connection site indexes (`shapeSites`; SH-07's custom-geometry nodes write a rectangle's four sites in `rectSites`' order). The output is unchanged byte for byte (SH-04's and SH-07's tests and the native-conformance corpus pass as they were).
3. **A native diagram imports back as its diagram, never as overlays.** Found here: SH-05's connector pass read an intact diagram group's glued straight edges as overlay connectors. `readDrawnShapes` now marks each grouped entry with its top-level group, and SH-05's connector and layer passes skip intact diagram groups. Tested alone and between back-layer and front overlays with their own connector (`packages/pptx/test/sh-phase-2-meeting-points.mjs`), and in PowerPoint (below).
4. **An edited diagram group falls back to SH-05's shapes.** Found here: SH-05 read members named `OPF ...` as OPF-written text, so an edited group's nodes came back as plain text blocks without their outlines. Diagram members (`OPF diagram N node ...`, `... edge ...`) are now drawn shapes like PowerPoint's own: the nodes import as overlay shapes with their presets, fills, lines and text, the glued edges as connectors between them, and `invalid-diagram-provenance` reports it (with `shape-property-dropped` for what OPF does not hold: text wrapping, a path with mixed fill modes).
5. **Open-path arrowheads.** SH-07's edges with arrowheads are custom geometry with the arrowheads as subpaths (decision 1), so PowerPoint draws pele's own heads; SH-04's connectors take `stroke.end` as `a:tailEnd`. On the `diagrams` and `shape-overlays` sheets both engines draw the same arrowheads; the SH-05 fixture's `curvedConnector4` draws its head in both.
6. **Pattern tile origin.** SH-05's change is in the shape fill only (`render/src/shapes.js`); backgrounds already tiled from the slide's corner, and pictures have no pattern fill. One example slide moves in the preview: `technical/shapes` #3, whose pattern now matches PowerPoint's (on main it drew out of phase). No template golden moves.
7. **The editor and the new default.** On a slide with a diagram, an overlay star inserted from the gallery, moved on the canvas and connected to the note with the Connect tool exports through the playground's Export menu as the diagram's native group (with its glued edge) beside the star and the connector; PowerPoint opens it. An end on a text block without a card is not glued (as SH-04 documents).
8. **`docs/shapes.md` is one page:** shape blocks, overlays and connectors, import, editing (with diagrams), native diagrams (new section linking `docs/diagrams.md`), then validation, loading, the preset geometry and the property map (with overlay layer, connector middle and native diagram rows). `docs/diagrams.md` no longer names an item in user text.
9. **Skills and MCP.** The skills are one update (author, edit, export, inspect, layout); the editing skill names editor 0.33 (the unreleased version these APIs ship in; SH-06 wrote 0.34). The MCP README's tool list has `search_icons` and `search_shapes`; `docs/mcp.md`'s `search_shapes` row drops the item name.
10. **Lazy engines.** `ensureShapes` loads the geometry for overlay shapes and connectors (SH-04) and, with `{ diagrams: true }`, for diagrams (SH-07; `toPptx` passes it for the default). The packed browser bundle exports all 136 core examples (the overlay and native-diagram decks included) byte-identical to Node.

## Pinned files regenerated

- **`scripts/catalog-free-budget.json`** (`--update`, after the main merge): SH-06's regeneration on its branch already covered SH-04's growth; against main, `format` +2,008 (62,835), `precompiled` +6,872 and `schema-engine-precompiled` +6,855 (the overlay form compiled once, about 38 KB raw), `schema`, `schemas` and `schema-engine-ajv` about +2 KB (the overlay vocabulary), `composition` +6,008 and every bundled entry about +7.5 to +9 KB (SH-04's overlay composition, routing and validation, SH-07's diagram allowlist and classes), `docs` +11.8 KB gzipped (the four branches' pages), and the new `shape-catalog` (3,784, SH-06's search). The integration itself adds about 100 bytes per bundled entry.
- **MCP budgets:** the bundled docs are 1,154,545 bytes under the one phase 2 budget of 1,160,000 (set by SH-04 for all four); the lean Worker is 7,996,321 bytes under 8,050,000. `mcp-workerd` passes.
- **Precompiled validator bound:** 1,806,916 bytes (main 1,768,114) under SH-04's 1,900,000.
- **Core composition goldens** (`OPF_UPDATE_GOLDENS=1`): no change.
- **Render layout-template goldens** (`--update`): 0 of 468 slides change; nothing to promote. Note: `packages/render/test/golden/notes/SH-phase-2.md`.
- **Chartex fixture and RR-54 locks:** `chartex.mjs`, `rr-54-chart-table-data`, `rr-54-data-hardening`, `rr-54-format-respelling` pass unchanged.
- **Gallery:** `rehash`, `build` and `render-previews --check` change nothing (30 previews match).
- **`generate-example-suite.mjs`:** writes nothing.

**The `golden` workflow must run** (`regenerate-goldens` label); `golden.mjs` and `golden-gate.mjs` were not run locally. Expected moves (every example's preview compared with main's): `technical/shapes.opf.json#2` (the pattern tile origin) and the new decks `technical/shape-overlays.opf.json` (6 slides) and `technical/shape-overlays-rtl.opf.json` (1). Nothing else moves in the preview; in the PPTX only `technical/diagrams` changes (7 slide parts: the native diagram groups).

## Catalog and programs

- `docs/programs/shapes/burndown.md`: SH-04 to SH-07 done with their PRs; new rows SH-08 (SmartArt import, todo), SH-09 (SmartArt export tier 1, spike running; PowerPoint never shows a cached SmartArt drawing, so nothing here depends on it), SH-10 (text in large shapes grows like body text), SH-11 (small shape text smaller in PowerPoint), SH-12 (Graphviz DOT, owner-approved), SH-13 (PlantUML, owner-approved); decisions: own render only, the PowerPoint export order (owner, 2026-11-06), no vendor names, SH-07's decisions 1 to 4, D2 recommended against (awaiting the owner), pagination of overlays; one log line per PR and one for this integration.
- `docs/programs/layout-harvest/burndown.md`: LH-182 (the tile motif through a doughnut hole) and LH-183 (Yu Gothic draws lighter in PowerPoint than the preview's stand-in), todo.
- Changelog: `changes/sh-phase-2-integration.md`.

## Verification (Windows, combined branch against main)

Worktrees: `C:/opf-work/sh-phase-2` (this branch) and `C:/opf-work/sh-phase-2-main` (main at ec054470f), both with `docs/evidence` checked out.

**Every package test, file by file** (`C:/opf-work/shapes/integration/logs/branch/`):

| Package | Combined | Failing here | Main | Verdict |
| --- | --- | --- | --- | --- |
| core | 264 of 264 | none (`script-width-estimates` runs with `docs/evidence`) | | pass |
| render | 169 of 169 | none | | pass |
| pptx | 220 of 221 | `keynote-registry-runtime.mjs` (EPERM creating a symlink) | fails on main the same way | environmental |
| editor | 141 of 142 | `codemirror-guard.mjs` (EPERM creating a symlink) | fails on main the same way | environmental |
| gallery | 14 of 14 | | | pass |
| cli | 29 of 29 | | | pass |
| mcp | 2 of 2 | | | pass (`mcp-workerd` too) |
| integration | 3 of 3 | | | pass |

SH-06's own `check:changed` failure on `tests pptx` and `tests editor` is these two symlink tests (they fail on main the same way here).

**Browser suites** (every command of each `test/browser-suites.json`, file by file after its setup, Edge through Playwright's `msedge` channel):
- render 26 of 28: `web-delivery` (needs Playwright's headless shell) fails on main the same way; `font-subsets-browser` fails on main the same way (`metrics-quotes-timeline#0`, also alone).
- pptx 2 of 2: `packed-bundle-browser` exports the 136 core examples byte-identical to Node, the overlay and native-diagram decks included.
- editor 74 of 90, then 76 with the toolbar fix below. The other 14 fail identically on main (run the same way in `C:/opf-work/sh-phase-2-main`): `layout-templates-browser`, `layout-editor-browser`, `source-pane-browser`, `playground-download`, `export-menu-browser`, `agent-handoff-browser`, `presenter-browser`, `rich-input-measured`, `rich-input-estimated`, `hang-indent-perf`, `startup-perf`, `selection-contrast`, `studio-kit`, `studio-perf` (LH-179's server and clipboard harness, perf budgets).
- **Regression found and fixed: editor `mobile-browser` and `mobile-touch-browser`** (both pass on main). SH-06 added Insert shape, Connect and the route select to the playground's slide toolbar: on a phone the row ran 46 pixels past the screen (the page scrolled sideways), and at 1,024 pixels the Redo button ran under the inspector's Content tab. Below 1,100 pixels the route select is left to the connector's Selected shape section (straight by default), on a phone the Connect tool is left out too, and the phone's action row shrinks to the screen; Insert shape stays. Both tests pass now, and `shape-overlays-browser` and `shape-editing-browser` still pass. Vetoable: a phone draws no connectors from the toolbar.

**Package checks** (`pnpm check:changed`, after the last change): build, Biome, typecheck, check:changes, catalog-free, diagram-doc-images, engines-range, examples, first-deck, examples-convert, gallery-editor-imports, registry-golden, runners, font-hotlinks, schema-docs, schema-strict, schema-examples, skill-glossary, spec, skill-commands, text and stability pass, and the opf, cli, mcp and render tests pass; failing: `check:browser-safe` (the Windows path separator; it fails on main the same way) and the pptx and editor runners, which stop at their first failure, `keynote-registry-runtime.mjs` and `codemirror-guard.mjs` (the symlink EPERM above). Every package was therefore run file by file as above; the editor's node tests again after the toolbar fix (140 of 142: `codemirror-guard`, and `styled-table`, which raced a rebuild of `dist/` and passes when run again).

**PowerPoint (COM only; read-only, no window; PowerPoint quit after each batch):**
- Every example (136 decks, 904 slides, the two new overlay decks included), SH-05's PowerPoint-authored fixture and its OPF round trip: all 138 open, export every slide at 1280 x 720 (912), save a copy through PowerPoint (`SaveCopyAs`) and reopen. No deck needed repair (`C:/opf-work/shapes/integration/ppt-open.json`).
- **Connectors glued** (`ConnectorFormat.BeginConnected`/`EndConnected`, `BeginConnectedShape`/`EndConnectedShape`): `shape-overlays` 19 of 19 at both ends, also after PowerPoint's re-save; `shape-overlays-rtl` 1 of 1; the meeting-point deck's two diagrams 4 of 4 glued edges node to node plus the overlay connector, also after the re-save (`integration/glue.json`, `meet/glue.json`, `meet/glue-resaved.json`).
- **Diagram groups come back as Mermaid**: `technical/diagrams` 7 of 7 and the meeting-point deck 2 of 2, from the export and from PowerPoint's re-saved copy, with no overlay shape or connector added and no provenance finding (`tools/diagram-import.mjs`).

**Sheets** (preview | PowerPoint, `C:/opf-work/shapes/integration/sheets/`): `shapes`, `shape-effects`, `shape-overlays`, `shape-overlays-rtl`, `diagrams`, `content-payload-matrix`, the meeting-point deck (`meet-1.png`) and SH-05's fixture round trip (`sheets-sh05/sh05-roundtrip-1.png`). PowerPoint draws what the preview draws on every slide: the overlays, badges, callouts and back panel, the routes (straight, elbow, curved, every site pair) with their arrowheads, the native diagrams (flowchart, sequence, mind map, timeline, pie, state) with their glued and freeform edges, the pattern fill in phase, the effects. The differences are glyph-only (the preview's stand-in for Aptos at display sizes) and, in `content-payload-matrix` #9, the media placeholder as on main. `content-payload-matrix` has no Mermaid diagram (its `diagram` is an SVG asset), so its export does not change.

**Editor:** SH-06's playground sessions re-run in Edge on the combined branch (`shape-editing-browser`, `shape-overlays-browser`, screenshots in `C:/opf-work/shapes/integration/editor/`), and a session on a diagram slide (decision 7; `editor/diagram-overlay-session.mjs`, `editor/sheet.png`).

## Not verified

- The render raster goldens (`golden.mjs`, `golden-gate.mjs`): the `golden` workflow must run.
- The editor's 14 browser suites that fail on main here too (LH-179) run only in CI.
- PowerPoint's repair prompt is inferred: every deck opened read-only through COM without an error (a deck that needs repair does not open that way); no window was shown.
- Accessibility Checker in PowerPoint: not run (UI control declined); the checks above are COM exports, COM properties and the PPTX XML.
- Whether a connector follows a shape moved in PowerPoint was not re-measured here (SH-04 measured 20 of 20 through COM; the glue is checked above).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
