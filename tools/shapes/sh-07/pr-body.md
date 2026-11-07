SH-07 of the shapes program: native Mermaid diagrams in PowerPoint.

**This branch contains SH-04's commits** (overlay shapes and connectors, `codex/sh-04-overlays-connectors`, stage 1 and stage 2) until SH-04 merges; the SH-07 change is the last commits on top.

## What it does

- **The option, and the new default (output-changing).** `toPptx(deck, { diagrams: "shapes" | "picture" })`, `convert`/`exportDeck` option `diagrams`, CLI `opf convert ... --diagrams shapes|picture`. **The default is `"shapes"`** (the owner's rule: a family switches to shapes by default once its comparison passes): every diagram of an allowlisted family exports as native shapes; `"picture"` opts out and gives exactly the earlier SVG picture with PNG fallback and `OPF_DIAGRAM_V1`; a family outside the allowlist, right-to-left text or a drawing with no native form stays the picture with the info finding.
- **The converter** (`packages/pptx/src/diagram-shapes.js`) reads the SVG the preview draws (core `paintDiagram` in the slide's palette and fonts, now with `{ classes: true }` to keep pele's classes) and writes one `p:grpSp` named `OPF diagram N`, `descr` = alt:
  - `rect` (with `rx`), `circle`, `ellipse`, `polygon`, `polyline`, `line`, `path` become `p:sp`; an outline that is exactly a preset is `a:prstGeom` (rect, roundRect, ellipse, diamond, hexagon, parallelogram, trapezoid, triangle), the polygons checked against SH-01's outline (core `presetMask`); every other outline is `a:custGeom` of its exact path (arcs as cubics). Transforms (nested `g`, nested `svg` viewports) are flattened; a rotated preset keeps `a:xfrm rot`.
  - Fill and stroke with alpha (fill-opacity, stroke-opacity, group opacity), linear gradients as `a:gradFill` (stops moved onto the shape's box), width, cap, join, miter and dash (`a:custDash`; a capped dash is written one width longer, since PowerPoint draws custom dashes without SVG's cap extension, measured).
  - Text is real text: font, size, weight, style, color, anchor; no wrap, no autofit. PowerPoint puts the first baseline of exactly spaced lines at 0.75 of the pitch below the text top (measured for Aptos, Arial, Georgia, Segoe UI, Cambria at pitches of 1.35 to 2 sizes, in text boxes and in rect, roundRect and custom shapes with insets), so every body is written with exact spacing (at least 1.4 sizes) and placed by that rule. A node's label is the node's own text (insets from the preset's text rectangle, through core `composeShape`); other text is text boxes.
  - Edges: see the decision below.
  - A clip path, mask, filter, pattern, image, `use`, text path, positioned tspan with dx/dy, or right-to-left text has no native form: the diagram stays a picture.
- **The gate.** Core exports `DIAGRAM_SHAPE_FAMILIES` (`@openpresentation/opf/composition`). A diagram outside it, or one the converter refuses, stays the picture and reports the info diagnostic `diagram-shapes-unavailable` (`{ path, family, message }`), which `convert`/the CLI report as `pptx/diagram-shapes-unavailable`.
- **Provenance and import.** The group's `OPF_DIAGRAM_V1` manifest has `shapes: true` and a signature of the members (names, frames, text). `fromPptx` returns the Mermaid source (and the group's current description as `alt`) for an unchanged group, also after a PowerPoint save (checked through COM SaveCopyAs on four families); an edited group imports as its shapes with `invalid-diagram-provenance`; `provenance: false` imports the shapes.
- Core: `ensureShapes(input, { diagrams: true })` so the preset geometry is loaded in a browser when diagrams become shapes.

## Decisions (vetoable)

1. **Edges are connectors only when straight and without arrowheads.** PowerPoint 365 refuses a `p:cxnSp` of custom geometry: the whole file is "corrupted and unreadable" (tested with the simplest one-segment path, inside and outside a group; a preset connector in the same file opens). And its largest line end (`lg`/`lg`) is about 20% shorter than pele's arrowhead (measured), so a preset connector with a native arrowhead would not look like the preview. So a straight edge without arrowheads is a `straightConnector1` glued with `a:stCxn`/`a:endCxn` to the SH-01 site it touches (it follows a moved node in PowerPoint, checked through COM), and every other edge is one `p:sp` of custom geometry with its exact line and arrowheads. 12 of the corpus's 136 edges are glued connectors. Look first, per the owner direction.
2. **The finding is `pptx/diagram-shapes-unavailable`**, not `opf/...`: exporter findings carry the exporter's prefix, and `validate` cannot see the export option.
3. **Right-to-left text keeps a diagram a picture** (PowerPoint's bidirectional layout decides its placement).

## The comparison in five designs

All 64 sources again in a light theme (classic, forest-green, Aptos), a serif font scheme (minimal, burnt-orange, Georgia), a non-Aptos deck (bold, deep-purple, Segoe UI), and ten Japanese sources for the families that take labels (flowchart, sequence, mind map, timeline, kanban; classic, steel-blue, Yu Gothic, ja-JP). Same thresholds. Each cell: the whole-slide result ("over (a,b)" names the sources over), then the worst mad (320) and hot (1280); the geometry outside every text body passes in every cell.

| Family | default | light | serif | segoe | japanese |
| --- | --- | --- | --- | --- | --- |
| agentflow | pass (mad 0.13, hot 0 %) | pass (mad 0.13, hot 0 %) | pass (mad 0.17, hot 0 %) | pass (mad 0.2, hot 0 %) |  |
| architecture | pass (mad 0.47, hot 0 %) | pass (mad 0.44, hot 0 %) | pass (mad 0.53, hot 0 %) | pass (mad 0.83, hot 0.03 %) |  |
| block | pass (mad 0.42, hot 0 %) | over (a) (mad 0.5, hot 0 %) | pass (mad 0.55, hot 0 %) | pass (mad 0.92, hot 0.08 %) |  |
| c4 | pass (mad 0.92, hot 0 %) | over (b) (mad 1.05, hot 0 %) | over (b) (mad 1.13, hot 0 %) | over (b) (mad 1.9, hot 0.17 %) |  |
| class | pass (mad 0.27, hot 0 %) | pass (mad 0.3, hot 0 %) | pass (mad 0.46, hot 0.03 %) | over (a) (mad 0.41, hot 0.11 %) |  |
| cynefin | pass (mad 0.39, hot 0 %) | pass (mad 0.42, hot 0 %) | pass (mad 0.87, hot 0 %) | pass (mad 0.13, hot 0 %) |  |
| er | pass (mad 0.36, hot 0 %) | pass (mad 0.41, hot 0 %) | pass (mad 0.45, hot 0 %) | pass (mad 0.58, hot 0 %) |  |
| eventmodeling | pass (mad 0.64, hot 0 %) | pass (mad 0.75, hot 0.06 %) | pass (mad 0.71, hot 0 %) | over (b) (mad 1.34, hot 0.17 %) |  |
| flowchart | pass (mad 0.19, hot 0 %) | pass (mad 0.23, hot 0 %) | pass (mad 0.3, hot 0 %) | pass (mad 0.44, hot 0.03 %) | pass (mad 0.43, hot 0.5 %) |
| gantt | pass (mad 0.49, hot 0 %) | pass (mad 0.61, hot 0 %) | pass (mad 0.69, hot 0 %) | over (b) (mad 1.03, hot 0.14 %) |  |
| gitgraph | pass (mad 0.45, hot 0 %) | pass (mad 0.48, hot 0 %) | pass (mad 0.64, hot 0 %) | pass (mad 0.78, hot 0 %) |  |
| ishikawa | pass (mad 0.75, hot 0 %) | pass (mad 0.81, hot 0 %) | pass (mad 0.61, hot 0 %) | over (b) (mad 1.22, hot 0.17 %) |  |
| journey | pass (mad 0.49, hot 0 %) | pass (mad 0.56, hot 0 %) | pass (mad 0.59, hot 0 %) | pass (mad 0.82, hot 0.06 %) |  |
| kanban | pass (mad 0.95, hot 0 %) | pass (mad 0.96, hot 0 %) | over (b) (mad 1.13, hot 0 %) | over (b) (mad 2.16, hot 0.42 %) | over (b) (mad 1.91, hot 1.39 %) |
| mindmap | pass (mad 0.48, hot 0 %) | pass (mad 0.53, hot 0 %) | pass (mad 0.54, hot 0 %) | pass (mad 0.67, hot 0.03 %) | over (b) (mad 1.43, hot 1.86 %) |
| packet | pass (mad 0.43, hot 0 %) | pass (mad 0.52, hot 0 %) | pass (mad 0.55, hot 0 %) | pass (mad 0.59, hot 0.03 %) |  |
| pie | pass (mad 0.79, hot 0 %) | pass (mad 0.83, hot 0.03 %) | pass (mad 0.94, hot 0 %) | over (b) (mad 2.02, hot 0.39 %) |  |
| quadrant | pass (mad 0.3, hot 0 %) | pass (mad 0.38, hot 0 %) | pass (mad 0.43, hot 0 %) | pass (mad 0.49, hot 0 %) |  |
| radar | pass (mad 0.4, hot 0 %) | pass (mad 0.45, hot 0 %) | pass (mad 0.44, hot 0 %) | pass (mad 0.53, hot 0.06 %) |  |
| railroad | pass (mad 0.17, hot 0 %) | pass (mad 0.19, hot 0 %) | pass (mad 0.21, hot 0 %) | pass (mad 0.27, hot 0.03 %) |  |
| requirement | pass (mad 0.37, hot 0 %) | pass (mad 0.41, hot 0 %) | pass (mad 0.64, hot 0 %) | pass (mad 0.54, hot 0.03 %) |  |
| sankey | pass (mad 0.69, hot 0 %) | pass (mad 0.54, hot 0 %) | pass (mad 0.87, hot 0 %) | pass (mad 0.88, hot 0.03 %) |  |
| sequence | pass (mad 0.58, hot 0 %) | pass (mad 0.68, hot 0 %) | pass (mad 0.64, hot 0 %) | over (b) (mad 0.83, hot 0.11 %) | over (b) (mad 1.24, hot 0.5 %) |
| state | pass (mad 0.21, hot 0 %) | pass (mad 0.23, hot 0 %) | pass (mad 0.39, hot 0.03 %) | pass (mad 0.44, hot 0 %) |  |
| swimlane | pass (mad 0.26, hot 0 %) | pass (mad 0.32, hot 0 %) | pass (mad 0.44, hot 0 %) | pass (mad 0.35, hot 0 %) |  |
| timeline | pass (mad 0.39, hot 0 %) | pass (mad 0.39, hot 0 %) | pass (mad 0.43, hot 0 %) | over (a) (mad 1.17, hot 0.42 %) | pass (mad 0.76, hot 0.39 %) |
| treemap | pass (mad 0.85, hot 0 %) | over (b) (mad 1.26, hot 0 %) | pass (mad 0.83, hot 0 %) | over (b) (mad 1.24, hot 0 %) |  |
| treeview | pass (mad 0.32, hot 0 %) | pass (mad 0.36, hot 0 %) | pass (mad 0.48, hot 0 %) | pass (mad 0.52, hot 0 %) |  |
| usecase | pass (mad 0.28, hot 0 %) | pass (mad 0.27, hot 0 %) | pass (mad 0.31, hot 0 %) | pass (mad 0.53, hot 0.03 %) |  |
| venn | pass (mad 0.38, hot 0 %) | pass (mad 0.35, hot 0 %) | pass (mad 0.33, hot 0 %) | pass (mad 0.33, hot 0 %) |  |
| wardley | pass (mad 0.24, hot 0 %) | pass (mad 0.24, hot 0 %) | pass (mad 0.33, hot 0 %) | pass (mad 0.32, hot 0 %) |  |
| xychart | pass (mad 0.43, hot 0 %) | pass (mad 0.53, hot 0 %) | pass (mad 0.48, hot 0 %) | pass (mad 0.63, hot 0.03 %) |  |

**Decision 4 (vetoable): all 32 families stay in `DIAGRAM_SHAPE_FAMILIES`.** In every design the geometry outside the text passes the same limits (worst geometry mad 1.81, light treemap-b; geometry hot <= 0.03 %), and every label box lands where the preview puts it. Every "over" is in text glyphs, checked on the sheets: the preview draws Aptos, Segoe UI and Yu Gothic with stand-in fonts (OPF bundles none of them), PowerPoint draws the real fonts, so glyph shapes, word spaces and weight differ (Yu Gothic Regular is lighter in PowerPoint). The deck's other native text has the same difference in PowerPoint, and `diagrams: "picture"` keeps the pixel copy. The two text-offset overs (light block-a 2.06 px, Segoe class-a 2.9 px) are ink-centroid shifts of the stand-in glyphs, aligned on the zoomed crops. Segoe cynefin: the preview's Segoe stand-in has no U+2192, so both engines draw the placeholder there. **Strict reading of "fails a design"** would drop block, c4, class, eventmodeling, gantt, ishikawa, kanban, mindmap, pie, sequence, timeline and treemap and keep the other 20; that is a one-line change of the constant if you prefer it.

## The comparison in the default design

Every family in `docs/diagrams.md` (32): the guide's example where it has one (else core's test source) and one harder source (more nodes, long labels, flowchart right to left), 64 sources, the diagram alone on a slide of the default design. Exported with `diagrams: "shapes"`, rendered by PowerPoint 365 for Windows through COM at 1280 x 720, compared with the preview PNG: mad and hot share (as the wave-8 tools), also at full size, the difference outside the text, and each text's ink offset.

Threshold, set from the clean families (agentflow, block, flowchart, railroad, tree view, use case: worst mad 0.42, mad at 1280 0.69, hot 0 %, text offset 1.22 px): every source has hot <= 0.5 % at both sizes, mad <= 1.0 (320 x 180) and <= 2.0 (1280 x 720), median text offsets <= 1.5 px, and a visual check shows nothing beyond antialiasing and the glyphs of the preview's metric-compatible stand-in for Aptos. **All 32 families pass**; the allowlist is all 32. Highest: kanban-b mad 0.95 (text-heavy; its geometry outside text differs by 0.01), c4-b 0.92, treemap-b 0.85 (sub-pixel placement of many 1.5 px borders); hot 0 % everywhere.

| Family | mad (320) | hot | mad (1280) | geometry mad | text dy / dx px | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Flowchart | 0.19 | 0 % | 0.49 | 0.18 | 0.45 / 0.22 | pass |
| Sequence | 0.58 | 0 % | 1.37 | 0.58 | 0.43 / 0.15 | pass |
| Class | 0.27 | 0 % | 0.71 | 0.15 | 0.56 / 0.49 | pass |
| State | 0.21 | 0 % | 0.56 | 0.15 | 0.42 / 0.66 | pass |
| Entity relationship | 0.36 | 0 % | 0.82 | 0.23 | 0.26 / 0.18 | pass |
| Gantt | 0.49 | 0 % | 1.08 | 0.27 | 0.47 / 0.29 | pass |
| Pie | 0.79 | 0 % | 1.39 | 0.17 | 0.55 / 0.29 | pass |
| Quadrant | 0.3 | 0 % | 0.73 | 0.18 | 0.71 / 0.04 | pass |
| Mind map | 0.48 | 0 % | 1.08 | 0.19 | 0.55 / 0.6 | pass |
| Timeline | 0.39 | 0 % | 0.7 | 0.14 | 0.61 / 0.08 | pass |
| User journey | 0.49 | 0 % | 1.08 | 0.43 | 0.24 / 0.19 | pass |
| XY chart | 0.43 | 0 % | 0.59 | 0.31 | 0.74 / 0.47 | pass |
| Sankey | 0.69 | 0 % | 0.85 | 0.54 | 0.22 / 0.39 | pass |
| Git graph | 0.45 | 0 % | 0.55 | 0.28 | 0.14 / 1.11 | pass |
| C4 | 0.92 | 0 % | 1.66 | 0.33 | 0.29 / 0.38 | pass |
| Block | 0.42 | 0 % | 0.69 | 0.23 | 0.51 / 0.78 | pass |
| Architecture | 0.47 | 0 % | 0.71 | 0.31 | 0.58 / 0.38 | pass |
| Kanban | 0.95 | 0 % | 1.77 | 0.01 | 0.69 / 0.18 | pass |
| Packet | 0.43 | 0 % | 1.02 | 0.48 | 0.33 / 0.41 | pass |
| Radar | 0.4 | 0 % | 0.73 | 0.33 | 0.04 / 0.63 | pass |
| Treemap | 0.85 | 0 % | 1.44 | 1.15 | 0.23 / 0.17 | pass |
| Venn | 0.38 | 0 % | 0.64 | 0.46 | 0.56 / 0.33 | pass |
| Ishikawa | 0.75 | 0 % | 1.44 | 0.13 | 0.51 / 0.74 | pass |
| Requirement | 0.37 | 0 % | 1.03 | 0.2 | 0.32 / 0.33 | pass |
| Wardley map | 0.24 | 0 % | 0.92 | 0.5 | 0.73 / 0.37 | pass |
| Tree view | 0.32 | 0 % | 0.68 | 0.03 | 0.52 / 0.46 | pass |
| Event modeling | 0.64 | 0 % | 0.95 | 0.28 | 0.31 / 0.44 | pass |
| Railroad | 0.17 | 0 % | 0.48 | 0.33 | 1.22 / 0.14 | pass |
| Cynefin | 0.39 | 0 % | 1.04 | 0.12 | 0.12 / 0.11 | pass |
| Use case | 0.28 | 0 % | 0.41 | 0.18 | 0.44 / 0.17 | pass |
| Swimlane | 0.26 | 0 % | 0.84 | 0.45 | 0.56 / 0.24 | pass |
| Agent flow | 0.13 | 0 % | 0.19 | 0.06 | 0.4 / 0.13 | pass |

Evidence (local): one sheet per family (preview | PowerPoint | difference x4), `summary.md` and the tools, in `C:/opf-work/shapes/sh-07/`.

## Tests

- `packages/pptx/test/sh-07-native-diagrams.mjs`: the converter per primitive (presets, custom geometry, arcs, dash with caps, alpha), transforms and nested viewports, text baselines and runs, node labels in preset text rectangles, glued straight connectors and arrowed freeform edges, gradients, the unsupported cases, the export group with its tag and unique ids, the allowlist gate and finding, the default picture, the import round trip, the edited group and the untagged export.
- `packages/javascript/test/sh-07-diagram-shapes.test.mjs`: the allowlist, `paintDiagram` with classes (same drawing otherwise), the `diagrams` option checks.
- `packages/cli/test/convert.test.mjs`: `--diagrams` reaches `toPptx`, a wrong value and the pptx-only message.

Checks on Windows: `pnpm check:changed` (typecheck, build, examples, catalog-free, diagram doc images, stability and the rest pass); every pptx test file run one by one (250 pass, including `browser-check` after `build:browser-check`); core and CLI suites. Failures there are not from this change: `biome.json` schema 2.5.12 vs the installed Biome 2.6.4 and `pagination.ts:339` (SH-04), the SH-04 example `shape-overlays-rtl` (core `examples.test.mjs`, render `examples-portable.mjs`), `docs/evidence` not in the blobless worktree (`check:text`, `script-width-estimates`, CLI `image-placeholder-count`), Windows paths and symlinks (`check:browser-safe`, `keynote-registry-runtime`), and the evidence scripts that need arguments or Node 24.

Pinned files: none in the repository moves (no render goldens; the catalog-free budget, the chartex fixture, the PPTX determinism fixtures and the rr-54 locks pass unchanged; `check:examples-convert` and `check:stability` pass). What changes is the PPTX output of every deck with a diagram, for example `examples/technical/diagrams.opf.json`, `examples/technical/content-payload-matrix.opf.json` and `examples/markdown/diagrams.opf.md`, and the sites' PPTX downloads of such decks. Two tests learned the new default: `native-conformance.mjs` treats a diagram node or edge label like a shape block (its text sits at insets in the preset's text rectangle), and `diagram.mjs` now tests the picture path with `diagrams: "picture"`. `packed-bundle-browser.mjs` caught that the browser build must load the preset geometry under the default too (fixed: browser and Node exports are byte-identical again).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
