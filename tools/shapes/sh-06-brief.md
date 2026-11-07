# SH-06: shapes in the editor, the MCP and the skills

Follow `C:/opf-work/shapes/brief.md` (the general rules for a shapes item) and `C:/opf-work/shapes/design.md`. Branch `codex/sh-06-editor-shapes`, worktree `C:/opf-work/sh-06-editor-shapes`. Do not spawn sub-agents. Do not merge. Do not poll CI.

Phase 1 is on main:
- SH-01's `@openpresentation/opf/shape-geometry`, with `PRESET_SHAPES`, `presetAdjustments` and `presetGeometry(...).handles`;
- SH-02's shape blocks, with their whole vocabulary;
- SH-03's effects.

The editor already edits picture `stroke`, the result of the wave 8 integration's `design-controls` change. Read how LH-166 added icon editing to the editor (`git log --grep LH-166`) and follow its patterns: commands, the playground, and browser tests.

## Part A: shape blocks (now, from main)

1. **A shape picker** in the editor and playground: insert a shape block, and change a block's preset.
   - Search all 187 presets by DrawingML name and by common words (arrow, callout, star, flowchart...).
   - Group them like PowerPoint's Insert > Shapes gallery: Lines, Rectangles, Basic Shapes, Block Arrows, Equation Shapes, Flowchart, Stars and Banners, Callouts, Action Buttons.
   - Each tile shows a thumbnail drawn from `presetGeometry`.
2. **Adjust handles on the canvas.** Drag the yellow handles that `presetGeometry(...).handles` describes. Each drag writes `adjust` as fractions and degrees through an undoable editor command, keeping each handle's range.
3. **Every shape property in the editor's design controls:**
   - `fill`: none, color, gradient with type, angle and stops, and pattern;
   - `opacity`;
   - `stroke`: color or gradient, width, dash (presets and custom), cap, join, miterLimit, compound, align, start and end arrowheads, and sketch;
   - `style`;
   - the six effects, with the shadow presets;
   - `rotate` and `flip`;
   - `text`, `anchor`, `padding` and `textDirection`;
   - `alt`, `decorative`, `hidden` and `link`;
   - `{ color, lighten|darken }` colors, as PowerPoint's theme-color tints.

   Every edit goes through the editor's command, undo and proposal machinery, with no ad hoc mutation.
4. **MCP:** a `search_shapes` tool (query → presets, each with its DrawingML name, category, adjust handles and their defaults, and a small SVG). Add it to the MCP's tools list, docs and tests; keep `packages/mcp` edge-safe.
5. **Skills:** opf-author teaches when and how to use shape blocks, with a short worked example; opf-inspect teaches `search_shapes`.

## Part B: overlay shapes and connectors (after SH-04's format lands)

SH-04 defines slide-level `shapes` (overlays and connectors) in `C:/opf-work/shapes/phase2-format.md`. When I message you that its format commit is pushed:
1. Merge `origin/codex/sh-04-overlays-connectors` into your branch.
2. Add overlay editing:
   - insert, move and resize an overlay shape on the canvas (it writes `x/y/width/height` fractions, or keeps `at`);
   - draw a connector between two blocks or overlays (pick its ends; route straight, elbow or curved);
   - layer order: bring forward and send backward, as array order.

Until that message, finish Part A and keep it committed and pushed.

## Evidence and tests

- **Playground session in Edge** (Playwright): pick a shape by search, insert it, drag an adjust handle, style it (gradient, dash, arrowheads, a shadow), undo and redo, export the PPTX, and open it in PowerPoint through COM. Save screenshots and the preview | PowerPoint sheet in `C:/opf-work/shapes/sh-06/`.
- **Editor browser tests** for the picker, the handles and the property controls; MCP tests for `search_shapes`.
- **Changelog** `changes/sh-06-editor-shapes.md`.
- **PR:** `SH-06: shapes in the editor, the MCP and the skills`. Report as `brief.md` says.
