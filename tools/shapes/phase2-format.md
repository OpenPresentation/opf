# Shapes phase 2: the format contract (SH-04 defines it; SH-05, SH-06 and SH-07 build on it)

The names below are binding. SH-04 lands them in `spec/schemas/opf.schema.json`, core types, validation and `docs/shapes.md`. If SH-04 finds a real problem with one, it changes the name in its first push and writes it down here under "Changes". Agents that build on SH-04 read this file again when they start.

## Overlay shapes: `slide.shapes`

`shapes` is an array on a slide. It is drawn over the composed slide (above content and furniture, below nothing), in array order: later entries are on top. Each entry is one of:

**1. An overlay shape.** It has the shape block vocabulary of SH-02, exactly as a shape block has it:
- geometry: `shape` (preset name) or `path` (custom outline), and `adjust`;
- paint: `fill`, `opacity`, `stroke` and `style`;
- the SH-03 effects: `shadow`, `innerShadow`, `glow`, `softEdge`, `reflection` and `blur`;
- transform: `rotate` and `flip`;
- text: `text`, `anchor`, `padding` and `textDirection`;
- accessibility and behavior: `alt`, `decorative`, `hidden` and `link`;
- `id`: optional, needed to be a connector end.

Each overlay shape also has exactly one placement:
- `x`, `y`, `width`, `height`: fractions 0 to 1 of the slide canvas, measured from the top-left corner in a left-to-right deck. In a right-to-left deck `x` counts from the right edge, mirrored the way the rest of OPF mirrors start and end.
- `at: { block: <id>, edge: "top" | "bottom" | "start" | "end" | "center", offset?: <px>, width?: <px or fraction>, height?: <px or fraction> }`: placed against a composed block's box, so it follows the block when composition moves it.
  - `edge` places the shape outside that edge of the block, centered along it; `center` places it on the block's center.
  - `offset` is the gap in reference pixels, the short edge being 720.
  - `width` and `height` default to the preset's natural proportions at 15% of the block's shorter side.
  - A missing block is a finding, `opf/shape-anchor-missing`, and the shape is not drawn.

**2. A connector.** It is an entry with `connector`:
- `connector: { from: <id>, to: <id>, route: "straight" | "elbow" | "curved", fromSite?: <int>, toSite?: <int> }`;
- the usual `stroke` (arrowheads through `stroke.start` and `stroke.end`), `alt`, `decorative`, `hidden` and an optional `id`.

`from` and `to` each name a block id on the slide (the block's composed box, taken as a `rect`, or the shape block's own preset) or an overlay shape id. Sites:
- Connection sites come from SH-01's `presetGeometry(...).connectionSites`. A block that is not a shape uses the rectangle's four sites.
- With no `fromSite` or `toSite`, the pair of sites that face each other is chosen automatically: the shortest route whose segments leave each shape outward.
- Core computes the route geometry once, as a polyline for straight and elbow, and a cubic for curved, matching PowerPoint's `straightConnector1`, `bentConnector3` and `curvedConnector3` with their adjust values. Both engines draw that geometry.
- The PPTX export writes `p:cxnSp` with `a:stCxn` and `a:endCxn` pointing at the native shapes' ids and site indexes, so a connector in PowerPoint follows a shape when the user moves it.
- An unknown end is a finding, `opf/connector-end-missing`.

Composed output: `geometry.overlayShapes`, a list in draw order of `ComposedShape` (the same type as a shape block item, with `box` and `path`) and `ComposedConnector`:

```
{ kind: "connector", path, from: { ref, site, point }, to: { ref, site, point },
  route, preset: "straightConnector1" | "bentConnector3" | "curvedConnector3",
  adjust, box, flip, stroke }
```

`ref` is the item path or the overlay index the end attaches to, so the PPTX writer can resolve shape ids.

## Native diagrams (SH-07): `diagrams: "picture" | "shapes"`

`diagrams` is a PPTX export option (`toPptx(deck, { diagrams })`, the CLI `--diagrams`), default `"picture"`. With `"shapes"`, a diagram of a family that passed its PowerPoint comparison is written as native `p:sp` nodes and `p:cxnSp` edges, and so are its labels. They are built from pele's own laid-out geometry, the preview's drawing (one geometry, not PowerPoint's routing):
- the nodes are SH-02 shapes (presets where pele's node shape has one: `rect`, `roundRect`, `ellipse`, `flowChartDecision` and so on; otherwise `custGeom`);
- the edges are connectors drawn as custom geometry following pele's path, with `stCxn` and `endCxn` set when the path ends on a node site.

They are grouped in one `p:grpSp` named after the diagram, with the diagram's `alt` and the `OPF_DIAGRAM_V1` provenance kept, so import still reads the Mermaid source. A family that has not passed stays a picture, with an info finding `opf/diagram-shapes-unavailable` naming the family. Core exposes the per-family allowlist; SH-07 fills it from its comparisons.

## Changes

(SH-04 records any rename here.)

SH-04, stage 1 (2026-11-06). Everything above stands except:

1. **Overlay shape entries** of `geometry.overlayShapes` are `ComposedOverlayShape`: a shape block item (`ComposedItem` with `field: "shape"`, `type: "shape"`, `box`, `text`, `textStyle`) plus `kind: "shape"`, `index` (the entry's index in `slide.shapes`), `id?` and `attachedTo?: { id, ref, edge }` for an `at` shape (`edge` physical: top, bottom, left, right, center). Its `shape` is SH-02's `ComposedShape` (with `box` and `paths`), so engines draw it with the shape block code unchanged. `path` is the OPF path `slides.N.shapes.I`, as on every item.
2. **`ComposedConnector.path`** is the OPF path `slides.N.shapes.I` (as on every composed item), not path data: the route is `paths[0]`, a `ComposedShapePath` (`d` in slide coordinates, `fill: "none"`, `stroke: true`, `open: true`, `ends` with the arrowhead directions), so SH-02's stroke drawing applies as is. `bounds` is the route's bounding box.
3. **`flip`** is `flipH?: true` and `flipV?: true`, as on `ComposedShape`; the frame also has **`rotate?: 90 | 270`** (PowerPoint writes a connector that leaves its start vertically as a quarter-turned frame). `box` is the unrotated `a:xfrm` box (`a:off`, `a:ext`).
4. **`adjust`** is OPF fractions (`{ adj1: 0.5 }`) and **`avLst`** the DrawingML integers (`{ adj1: 50000 }`), as on `ComposedShape`.
5. **`preset`** also takes `bentConnector2` and `curvedConnector2`: an elbow or curve between perpendicular sites (one horizontal, one vertical) is PowerPoint's two-segment connector; `bentConnector3`/`curvedConnector3` stay for sites on one axis (adj1 0.5 between facing sites, beyond 0 to 1 for a U when both face the same way).
6. **`ref`** is always a string: the composed item path of a block (`slides.0.blocks.1.shape`, the item the export writes as one native shape), a group's path (`slides.0.blocks.2`), or an overlay shape's path (`slides.0.shapes.3`). Each end also has `id` (as authored), `target` (`block`, `group` or `shape`), `site`, `point` and `angle` (the site's outward direction).
7. **Connector defaults**: `route` defaults to `straight`; the line is 2 reference pixels in the slide's `text` color with no arrowheads.
8. **Validation**: both placements or none, a partial `x`/`y`/`width`/`height`, and a `fromSite`/`toSite` the shape does not have are `opf/schema` errors (semantic). `opf/shape-anchor-missing` and `opf/connector-end-missing` are errors; a connector end naming another connector is `opf/connector-end-missing` too. Overlay ids share the slide and payload id namespace.
9. **`at.width`/`at.height`**: a number up to 1 is a fraction of the block's width (height), above 1 reference pixels. `at.offset` may be negative (the shape overlaps the block). The schema defs are `OverlayShape`, `OverlayAnchor` and `Connector` (see 10).

Core exports (`@openpresentation/opf/composition`): `connectorRoute`, `chooseConnectorSites`, `shapeSites`, `rectSites`, `frameToSlide`, `slideBlockIds`, `overlayIssues`, `hasOverlayShapes`, `isOverlayConnector`, the constants `CONNECTOR_ROUTES`, `CONNECTOR_STANDOFF` (24), `CONNECTOR_STROKE_COLOR`, `CONNECTOR_STROKE_WIDTH` (2), `OVERLAY_ANCHOR_SHARE` (0.15), `OVERLAY_EDGES`, and the types `ComposedOverlayEntry`, `ComposedOverlayShape`, `ComposedConnector`, `ConnectorEnd`, `ConnectionSite`, `ConnectorFrame`, `ConnectorPreset`, `ConnectorRoute`, `ConnectorRouteGeometry`, `OverlayEdge`, `OverlayIssue`.

SH-04, stage 2 (2026-11-06):

10. **Schema form (type change)**: `slide.shapes` items are one def, `OverlayShape`, which also has `connector?: Connector`; the `OverlayConnector` def is gone. The generated type is `Slide.shapes?: OverlayShape[]` (was `(OverlayConnector | OverlayShape)[]`): an entry with `connector` is a connector. A connector entry with a shape-only key (`text`, `x`, `fill` ...) is an `opf/schema` error (semantic). Why: the `anyOf` made the precompiled validators compile the whole shape vocabulary twice (+96 KB raw); one def is +38 KB. `OverlayShape.text` is `$ref: #/$defs/ContentPayload/properties/text`. The stage-1 change to union error matching (src/union-errors.ts) is reverted: without the union it is not needed. The composed types (`ComposedOverlayShape`, `ComposedConnector`, `ConnectorEnd`) are unchanged.
11. **Pagination**: an overlay shape placed by fractions is on every page of a split slide (as the headings), an `at` shape on the page its block lands on, a connector on the page that holds both ends. A connector whose ends land on different pages is on no page: `PaginatedPage.diagnostics` gets `{ code: "connector-split", path: "slides.N.shapes.I", message }` on the first page holding its `from` end (new type `PaginationDiagnostic`). Overlay ids take page ids (`stamp--2`) like payload ids, and `at.block` and connector ends follow the renamed ids.

SH-07 (2026-11-06), native diagrams, as built (branch codex/sh-07-native-diagrams):

12. **The finding** is the PPTX diagnostic `diagram-shapes-unavailable` (info; `{code, path, family, message}`), which `convert` and the CLI report as `pptx/diagram-shapes-unavailable` like every exporter finding: an `opf/` rule id is a validation rule, and `validate` cannot see an export option.
13. **The allowlist** is `DIAGRAM_SHAPE_FAMILIES` (core `@openpresentation/opf/composition`, pele type names, frozen). All 32 built-in families passed the PowerPoint comparison; the list is all 32.
14. **Edges**: PowerPoint refuses a `p:cxnSp` of custom geometry (the whole file is "corrupted and unreadable", measured in PowerPoint 365 with the simplest one-segment path, inside and outside a group), and its largest line end (`lg`/`lg`) is about 20% shorter than pele's arrowhead. So a straight edge without arrowheads is a `straightConnector1` glued with `a:stCxn`/`a:endCxn` to the SH-01 sites it touches (it follows a moved node in PowerPoint, checked through COM), and every other edge is one `p:sp` of custom geometry: its exact line and its arrowheads as subpaths. Of 136 edges in the corpus, 12 are glued connectors.
15. **The group** is `OPF diagram N` (the picture's name), its `descr` the alt text; in full provenance its `OPF_DIAGRAM_V1` manifest adds `shapes: true` and `signature` (the members' names, frames and text), and import returns the diagram only while that signature holds.
16. **Core additions**: `paintDiagram(diagram, palette, size, { classes: true })` keeps pele's classes; `ensureShapes(input, { diagrams: true })` / `shapesPending(input, { diagrams: true })` load the preset geometry for a deck with diagrams; export option `diagrams` on `ExportOptions`/`ConvertOptions` and `--diagrams` in the CLI.

SH-04, stage 2 additions (2026-11-06, from SH-05's import review):

12. **`layer: "front" | "back"`** on overlay shapes (default `front`). `back` draws above the slide background, the watermark and the deck logo and below all content and furniture; `front` is the behavior above. Array order stacks within a layer. `ComposedOverlayShape.layer` is always set (`"front"` or `"back"`; type `OverlayLayer`, constant `OVERLAY_LAYERS`). The PPTX writes back-layer shapes into the shape tree after the background, watermark and logo and before the content shapes; front-layer shapes and connectors after everything. Connectors are always front, also when an end is a back shape (glued to it, drawn over the content). `layer` on a connector is an `opf/schema` error (a shape-only key).
13. **Connector `adjust`** (entry level, as on shapes; OPF fractions): `adj1` of the route's three-segment preset (`bentConnector3` for elbow, `curvedConnector3` for curved) replaces the automatic middle; the sites are chosen as before. It has no effect on the two-segment presets (perpendicular sites) or a straight line. Validated as a shape's adjust against `connectorAdjustPreset(entry)` (`straightConnector1`, `bentConnector3` or `curvedConnector3`): an unknown name is `opf/shape-adjust-unknown`, a value out of range `opf/shape-adjust-range`. `connectorRoute(route, from, to, scale, adjust?)` takes it as a fifth argument. A connector takes `id`, `connector`, `adjust`, `stroke`, `alt`, `decorative`, `hidden` and `extensions`.
14. **Example**: `shape-overlays-rtl.opf.json` embeds the `noto-sans-arabic` font scheme in `catalogs.default` (as `language-and-writing.opf.json` does), so it validates and draws alike with and without a registered catalog.
