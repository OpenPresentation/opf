# SH-04: overlay shapes and connectors

Follow `C:/opf-work/shapes/brief.md` (the general rules for a shapes item), the format contract `C:/opf-work/shapes/phase2-format.md` (the overlay and connector part is yours), and `C:/opf-work/shapes/design.md`. Branch `codex/sh-04-overlays-connectors`, worktree `C:/opf-work/sh-04-overlays-connectors`. Do not spawn sub-agents. Do not merge. Do not poll CI.

Phase 1 (SH-01 geometry with connection sites, SH-02 shape blocks, SH-03 effects) is on main. Reuse it: an overlay shape is SH-02's shape vocabulary with a placement, drawn by the same render and PPTX code paths. Do not fork them.

## Stage 1: the format and core. Push, report, and stop.

Other agents start from your branch once this stage is pushed: SH-05 (PPTX import), SH-06 (editor) and SH-07 (native diagrams).

1. **Schema:** `spec/schemas/opf.schema.json` gets the slide `shapes` array, the overlay placement forms (`x/y/width/height`, `at`) and `connector`, with descriptions and examples.
2. **Core types and validation**, including:
   - unknown ids;
   - a shape with both placements, or with none;
   - a connector whose `fromSite` is out of range;
   - the new findings `opf/shape-anchor-missing` and `opf/connector-end-missing` in the findings registry.
3. **Composition:** `geometry.overlayShapes` with `ComposedShape` and `ComposedConnector`:
   - placement by fractions and by `at`, right to left included;
   - automatic connection-site choice;
   - route geometry for straight, elbow and curved, matching PowerPoint's `straightConnector1`, `bentConnector3` and `curvedConnector3` with their `adj` values.

   The overlay draws over the composed slide and never moves content.
4. **Core tests:** a focused `test/sh-04-overlays.test.mjs`.
5. **Commit and push** to `origin codex/sh-04-overlays-connectors`. Open a draft PR titled `SH-04: overlay shapes and connectors`.
6. **Write any rename** under "Changes" in `phase2-format.md`.
7. **Report:** the commit SHA, and the exact type names and fields of `ComposedShape` and `ComposedConnector` as built. Then STOP. I will continue you with stage 2.

## Stage 2 (after I message you): engines, evidence, PR

1. **Render:** draw `geometry.overlayShapes` (shapes through SH-02's drawing, connectors as paths with SH-02's stroke, so arrowheads, dash, compound and sketch all apply) in SVG, PNG and PDF.
2. **PPTX:**
   - Overlay shapes are native `p:sp`.
   - Connectors are `p:cxnSp` with a preset connector geometry, `a:stCxn`/`a:endCxn` set to the native ids, and the site `idx` of the shape at each end. A block that ends a connector must therefore get a stable native id; text boxes, pictures and shape blocks all qualify.
   - Check through COM that moving a connected shape in PowerPoint keeps the connector attached: read `ConnectorFormat.BeginConnectedShape`, `EndConnectedShape` and the site indexes. That is the acceptance test "a connector between two blocks follows them".
3. **Example** `examples/technical/shape-overlays.opf.json`, covering:
   - callouts and badges placed by fractions;
   - a shape attached to a picture block;
   - straight, elbow and curved connectors between blocks and overlay shapes, with arrowheads;
   - one right-to-left slide.

   Put the preview | PowerPoint sheet in `C:/opf-work/shapes/sh-04/sheet.png`.
4. **Docs:** `docs/shapes.md` (overlays and connectors), the opf-author and opf-layout skills, and the MCP bundled docs.
5. **Tests:** render and pptx `test/sh-04-*.mjs`, plus a changelog fragment `changes/sh-04-overlays-connectors.md`.
6. **PR:** mark it ready, run the checks, and report as `brief.md` says.
