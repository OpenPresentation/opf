# Shapes (SH)

Opened 2026-11-05 (design owner-approved that day). Branches `codex/sh-<nn>-<slug>`, PR titles `SH-<nn>: `. Items and status:
[burndown.md](burndown.md).

## Goal

A deck draws PowerPoint's preset shapes, its own outlines, lines and connectors, with every fill, line and effect PowerPoint has, from one
definition that both engines read: the preview evaluates the geometry to SVG and the PPTX export writes native DrawingML (`a:prstGeom`
with its `a:avLst`, `a:custGeom`, `a:ln`, `a:effectLst`, `p:cxnSp`), so PowerPoint draws its own shape and the two match. Shapes fit
the deck: with no fill, line or effects a shape takes the theme's style, and text inside a shape is fitted by OPF's composition under
the never-shrink rule. Phase 2 makes diagrams native shapes and opens shapes to import, the editor and agents.

## Principles

- Preset names are DrawingML's own (ECMA-376 `ST_ShapeType`, 187 presets: `rightArrow`, `chevron`, `wedgeRectCallout`,
  `flowChartDecision`), as OPF already names pattern presets.
- One geometry definition (`spec/reference/preset-geometry.json`, from Apache POI's presetShapeDefinitions) drives both engines.
- OPF units: widths in reference pixels at a 720-pixel short edge, fractions 0 to 1, degrees. Never EMU or 60000ths in the format.
- Colors are `ColorRef`s everywhere, extended with `{ "color": <ColorRef>, "lighten": 0..1 }` and `{ "color": <ColorRef>, "darken": 0..1 }`
  (exported as `a:lumMod` and `a:lumOff`, PowerPoint's "Lighter 40%").
- PowerPoint's autofit is never written; text fits by OPF's measured fonts.
- Pre-1.0: renames and removals land without aliases or deprecations (the picture `border` became `stroke`).

## Property map

The owner-approved map of every property (OPF key, DrawingML element) is in [docs/shapes.md](../../shapes.md) and
[docs/shape-effects.md](../../shape-effects.md); in short:

| Area | OPF | PowerPoint (DrawingML) |
| --- | --- | --- |
| Geometry | `shape` (a preset), `adjust` (fractions, DrawingML guide names), `path` (SVG path data) | `a:prstGeom`, `a:avLst`, `a:custGeom` |
| Fill | `fill`: `"none"`, a ColorRef, `{ gradient }` (linear, radial, rectangle, shape), `{ pattern }`; `opacity` | `a:noFill`, `a:solidFill`, `a:gradFill`, `a:pattFill`, `a:alpha` |
| Line | `stroke`: color or gradient, width, dash (presets or an array), cap, join and miter limit, compound, alignment, arrowheads, sketch | `a:ln` and its children, `ask:lineSketchStyleProps` |
| Style | `style`: none, subtle, moderate, intense | `p:style` |
| Effects | `shadow` (presets soft, hard, perspective, or an object), `innerShadow`, `glow`, `softEdge`, `reflection`, `blur` | `a:effectLst` |
| Transform | `rotate`, `flip` | `a:xfrm rot`, `flipH`, `flipV` |
| Text | `text`, `anchor`, `padding`, `textDirection` | `p:txBody`, `a:bodyPr` |
| Accessibility and links | `alt`, `decorative`, `hidden`, `link` | `p:cNvPr descr`, `a16:decorative`, `hidden`, `a:hlinkClick` |
| Overlay and connectors (SH-04) | slide-level `shapes`, placed by fractions or attached to a block; `connector: { from, to, route, stroke }` | `a:xfrm`, `p:cxnSp`, `a:stCxn`, `a:endCxn` |
| Pictures | an image's `shape` takes every preset; its line is `stroke` | `a:blipFill` in `a:prstGeom`, `a:ln` |

Excluded on purpose, documented as such: 3-D (`a:scene3d`, `a:sp3d`), the preset shadow element (`a:prstShdw`, covered by the `shadow`
presets), fill overlay, wrap, columns and autofit, the alternative-text title, hover links, locks, black-and-white mode, custom data.
Import reports them as findings.

## Definition of done

1. **Geometry (SH-01).** Every one of the 187 presets evaluates (guides, adjust values, paths, text rectangle, connection sites) in an
   edge-safe module, `@openpresentation/opf/shape-geometry`, and matches PowerPoint's own drawing.
2. **Shape blocks (SH-02).** A shape is a content kind with the full fill, stroke, style, text, transform and accessibility vocabulary,
   drawn by both engines from core's composed geometry; ColorRefs take lighter and darker forms; a picture's mask takes every preset;
   the geometry loads lazily in browsers and edge runtimes (`ensureShapes`).
3. **Effects (SH-03).** The six effects draw in the preview as PowerPoint draws them and export as a native `a:effectLst`.
4. **Overlay shapes, connectors and native diagrams (SH-04).** Slide-level shapes over the composed slide, connectors between blocks or
   shapes with automatic connection sites, and Mermaid diagrams exported as native shapes where a diagram family passes its PowerPoint
   comparison.
5. **Import (SH-05).** PPTX import reads preset and custom shapes, fills, lines, effects and connectors back into the vocabulary above,
   reporting what is excluded.
6. **Editor and agents (SH-06).** The editor picks shapes, drags adjust handles and edits every property; the MCP has `search_shapes`;
   the skills teach shapes.

## Invariants

- Both engines draw the same thing; a geometry change belongs in core and both engines read it.
- PPTX writes native DrawingML, never a picture of a shape.
- Text inside a shape never shrinks below what composition gives it.
- Decks without shapes do not load the geometry (the catalog-free budget's `shape-engine-lazy` entry stays tiny).
- Every format change updates the schema, the docs, the skills, the MCP's bundled docs and the editor together.

## Resume protocol

Read this file and [burndown.md](burndown.md), then `docs/shapes.md` and `docs/shape-effects.md`. Work in your own worktree
(`node scripts/agent-worktree.mjs add sh-<nn>-<slug>`), compare every drawing with PowerPoint through COM (open read-only, export each
slide at 1280 x 720, quit), and update the item's row and the progress log in the PR that changes its state.
