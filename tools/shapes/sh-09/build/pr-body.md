SH-09 (tier 1 of the SmartArt work): pyramids and matrices that the PPTX export writes as **live SmartArt** where PowerPoint lays them out exactly as OPF's preview draws them, and as the same drawing in native shapes everywhere else (owner's export order: live SmartArt, then native shapes, then a picture).

## What it adds

- **Format and core.** A layout region's `arrangement: "pyramid" | "matrix"` (`spec/schemas/layout.schema.json`, `layout-template.ts`). Composition draws the region's lone list of one level as a diagram, in the first design that holds every entry at one text size (from 1.5 times the list's role size down to the role size, or the list's size when smaller; never below), without a word cut and with the ink inside the outline:
  - `smartart`: PowerPoint's Basic Pyramid (`pyramid1`: level i of n is H/n tall and W·i/n wide, the apex on top) or Basic Matrix (`matrix3`, exactly four entries: rounded squares 0.39 of a centered square over a diamond), measured through COM, only inside the SmartArt domain;
  - `opf`: OPF's own design where PowerPoint's does not hold the entries or lies outside the domain: a stepped pyramid with each entry beside its level (start-aligned), or four quadrants filling the region;
  - `cards`: a matrix of other than four entries, as a grid of cards (the grid shape with the largest text); never an empty quadrant.
  - A list no design holds, or with nested entries, descriptions, icons or numbering, stays a list. Cards and lists report the new info finding `opf/arrangement-adapted`.
  - New module `arrangements.ts` (geometry, paint, `SMART_ART_DOMAIN`, `smartArtUnavailable`, `smartArtScript`), `SlideComposition.arrangements` (with `design`, `align`, `paint`, `text`).
- **Gallery.** Layouts `pyramid` (column: title over the pyramid) and `matrix` (row: the title beside the square), index, previews; 32 layouts.
- **Preview.** `renderArrangements` draws the diamond and the nodes (primary fill, 1.5 pt background outline) under the entries, which are centered in the color that reads on the primary.
- **PPTX export** (`src/smart-art.js`, option `smartArt: "live" | "shapes"`, CLI `--smart-art`):
  - live: a `p:graphicFrame` SmartArt with OPF's data model (`loTypeId`, OPF's own `qsTypeId`/`csTypeId`, one point per entry with `custT="1"` and an explicit run `sz`, `lang`, centered paragraphs at core's pitch, `cxn` in entry order), OPF-authored colors and quick style parts covering `node0`, `node1`, `bgShp`, `revTx` and the transition labels, a drawing part from core's geometry, and **no layout part** (`r:lo=""`). No Microsoft layout definition XML anywhere.
  - native shapes (OPF's design, card grids, `"shapes"`, or PowerPoint's design outside the domain, with the info finding `pptx/smartart-unavailable` and its reason): `diamond`, `trapezoid` (core's `adj`) and `roundRect` under the measured lines, tagged `OPF_ARRANGEMENT_V1`.
  - full provenance: `OPF_SMARTART_V1` on the frame (the authored list and node texts).
- **Import.** An unchanged OPF SmartArt is its list on its layout again; an edited one (`smartart-edited`) and a PowerPoint-authored pyramid1/matrix3 read the data model (points in `cxn` order, run bold/italic/underline/strike) as a list on `default:pyramid`/`default:matrix`. The layout part is never read or stored. Native-shape arrangements import as the layout's drawing.
- Docs `docs/smartart.md` (tiers, geometry, domain, gate, what PowerPoint does on edit, the layout relationship), `docs/shapes.md`, `docs/layout-templates.md`, skills opf-author, opf-layout and opf-export, MCP doc list, changelog fragment, burndown.

## The gate and the domain

COM sweep of 112 decks (pyramid 1 to 8, matrix 1 to 4; short, medium, long; 16:9, 4:3, 1:1; an Arabic and a Japanese case of each), each exported live and as native shapes. Latin decks use Source Sans 3 (bundled by OPF and installed here), so both engines draw one font.

- **Domain** (from the first pass: 38 live decks, all with every node rectangle within 0.000 pt of core's, sizes equal and no visible shape difference; 33 within SH-07's native gate against OPF's native export; the five others were Arabic ×2, Japanese and two four-quadrant matrices of wrapped entries): Latin text only, pyramid 1 to 5 levels at 1.1 to 2.3 : 1, matrix of 4 at 0.8 to 1.2 : 1, at most 2 lines an entry and 6 in all, stable line breaks.
- **Final sweep, which design drew:** live SmartArt **20** (all pass), OPF design **60**, card grid **27** (matrices of 1 to 3 entries), list **5** (pyramids of 6 to 8 long levels on 4:3 and 1:1, with `opf/arrangement-adapted`). In every native-shape instance the shapes match the preview (mean difference at most 1.15 inside the shapes outside the text, no visibly different block).
- **Preview vs PowerPoint text:** PowerPoint draws the text of the live SmartArt and of OPF's native export 4 to 7 px higher than the preview at these sizes (24 to 36 pt): OPF's text model puts every baseline 1 em under the line top, PowerPoint at a face-dependent height. It is the same for every OPF text box (not SmartArt's), below SH-07's 1.5 px at diagram-label sizes and above it here, so the text criterion is applied against the native export; the preview offset is in the gate table. Proposed as a follow-up item.

Layout relationship: `r:lo=""`, dangling `r:lo` and no `r:lo` all open live in PowerPoint (layout resolved, node edit, Change Layout). `r:lo=""` is the only form that is schema-valid (the attribute is required) and names no missing relationship. The Open XML SDK validator and LibreOffice are not installed here and were not run.

Node edit (COM): PowerPoint keeps OPF's explicit size on every node and keeps the node rectangles; Change Layout switches to Basic Block List.

## Pinned files that move (not regenerated here)

- render template goldens (`packages/render/test/golden/layout-templates-*.json`): 24 new entries for `pyramid` and `matrix` (the test's count is updated to 32 templates); regenerate with the `regenerate-goldens` label.
- the chartex fallback archive fixture (`packages/pptx/test/fixtures/chartex-fallback-main.json`): every PPTX now carries two more slide layouts.
- Core composition goldens (`template-goldens-0.19.json`) were regenerated in this branch: 24 entries added for `pyramid` and `matrix`, none of the other templates changed.

LH-37 note: node text is centered on purpose (it is diagram text in a shape, as SmartArt draws it), not a centered body.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
