# SH-09 spike: live SmartArt export from OPF

Date: 2026-11-06. PowerPoint (Microsoft 365, Windows 11) through COM only, visible and minimized, quit after each batch. The evidence and scripts are in this folder (`scripts/`, `q1/` to `q5/`). The `*-ctrl` and `q5/omit-*` controls copy a PowerPoint layout part into local research files only; nothing proposes shipping it.

## Summary

1. **Q1, no.** PowerPoint never shows the cached drawing. In all ten candidate layouts it lays the SmartArt out again from the data and layout parts on open. `SaveCopyAs` and a node edit write a fresh drawing.
2. **Q2, partial.** An OPF-written package opens as live SmartArt, and layout switching works.
   - A stub layout part (built-in `uniqueId`, empty body) is not resolved: PowerPoint falls back to Basic Block List.
   - Leaving the layout part out resolves the built-in layout from the data's `loTypeId`, but the package then breaks the rule that the four `dgm:relIds` attributes are required.
3. **Q3.** On a text edit PowerPoint keeps the node rectangles, but autofit shrinks one shared font size for all nodes, in whole points. Colors and fonts follow the theme. An explicit run `sz` that OPF writes in the data model is kept, and skips autofit.
4. **Q4, high cost.**
   - Basic Pyramid (row height H/n, row width W·i/n) and Basic Matrix (a fixed 2x2) are exact closed forms.
   - Basic Chevron Process, and possibly Basic Cycle, are likely matchable after fitting.
   - Basic Process and Vertical Process have geometry that depends on the text.
   - Basic Venn has special cases per node count.
   - The two org charts and Hierarchy need a tree engine per layout.
5. **Recommendation.** "OPF writes the drawing" is not feasible. Tier 1 is feasible only per layout, with OPF reproducing PowerPoint's layout and writing an explicit font size, and a COM sweep as the gate. Tier 2 stays the default.

## Format facts

- **Slide:** a `p:graphicFrame` with `a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"` and `dgm:relIds r:dm r:lo r:qs r:cs`.
- **Parts:**
  - the data model is required;
  - the layout, quick style and colors parts are optional to PowerPoint: when one is absent, PowerPoint resolves it from the ids in the data model; when it is present, PowerPoint uses its content;
  - the drawing part (`…/2007/relationships/diagramDrawing`, linked through `dsp:dataModelExt@relId`) is ignored on open and rewritten on save.
- **Data model:** the `doc` point needs `loTypeId`, `qsTypeId` and `csTypeId`. `parTrans`, `sibTrans` and `pres` points are optional, because PowerPoint regenerates them.

## Design sketch for SH-09 (gated layouts only)

- **Mapping:**
  - pyramid content goes to `pyramid1`;
  - a 2x2 grid of at most 4 items goes to `matrix3`;
  - later, a linear step flow goes to `chevron1`, and a cycle of 3 to 8 items to `cycle2`;
  - everything else goes to tier 2.
- **What OPF writes:**
  - the data model with an explicit `sz` on every node (OPF's fitted size);
  - OPF-authored quick style and colors parts, or none;
  - no Microsoft layout definition;
  - a drawing part from OPF's own geometry, for other consumers.
- **Gate:** a COM sweep from 1 node to the maximum, with short, medium and long text, at three frame aspect ratios. Node rectangles within 0.1 pt, equal font sizes, and a pixel diff within the native gate. Any miss sends the layout to tier 2.
- **SH-08 import:**
  - read the data model (points, `cxn` order, run properties) and map `loTypeId` to OPF content;
  - take geometry from the drawing part;
  - never store or reuse the layout part.
- **Alternative:** an OPF-authored `layoutDef` (tested: "OPF Row") opens live with no Microsoft XML. It still needs OPF to match PowerPoint's constraint solver: a 0.47 pt row residual, a height clamp and a 10 pt inset.

Full per-question evidence tables: see the agent hand-back in the session transcript (2026-11-06) and the `*-probe.json`, `q3/q3-results.json` and `q4/geometry-<k>.csv` files here.
