# SH-07: native Mermaid diagrams in PowerPoint (`diagrams: "shapes"`)

Follow `C:/opf-work/shapes/brief.md` (the general rules for a shapes item), the diagrams part of `C:/opf-work/shapes/phase2-format.md`, and `C:/opf-work/shapes/design.md`. Branch `codex/sh-07-native-diagrams`, worktree `C:/opf-work/sh-07-native-diagrams`. Create the branch from `origin/codex/sh-04-overlays-connectors` (SH-04's stage-1 commit) rather than from main: `node scripts/agent-worktree.mjs add sh-07-native-diagrams`, then `git reset --hard origin/codex/sh-04-overlays-connectors` inside it. Merge that branch again whenever SH-04 pushes; you need its stage-2 connector writer before your PowerPoint comparisons. Do not spawn sub-agents. Do not merge into main. Do not poll CI.

## Owner direction (2026-11-06; binding)

- **Look first.** Editable shapes are preferred over pele's picture only if they look as good: "the pele stuff looks awesome".
- **WYSIWYG.** The preview stays what it is (pele's drawing), and the PPTX must match it.
- **The option.** The export takes `diagrams: "picture" | "shapes"`. The shapes are built from pele's own laid-out geometry: one geometry for the preview and the PPTX, never PowerPoint's connector routing or a second layout.
- **The gate.** A diagram family writes shapes only after its PowerPoint-rendered comparison with the preview passes. Until then it stays a picture and reports the info finding `opf/diagram-shapes-unavailable`.

## What to build

1. **The option.** Add `diagrams` to `toPptx` (and `exportDeck`), the CLI `--diagrams picture|shapes`, the types, and the MCP export tool if it has export options. The default is `"picture"`. Today's picture path (SVG with a PNG fallback, `OPF_DIAGRAM_V1`) stays unchanged.
2. **A converter from pele's drawn SVG to DrawingML,** inside the PPTX package. It takes the same SVG the preview draws (the resolved palette and fonts):
   - `rect` (with `rx`), `circle`, `ellipse`, `polygon`, `polyline`, `line` and `path` become `p:sp`:
     - `rect`, `roundRect`, `ellipse` and the like are written as `a:prstGeom` when the outline is exactly that preset, checked against SH-01's `presetGeometry`;
     - any other outline is written as `a:custGeom`.
   - Fill, stroke, dash, opacity, markers and arrowheads become SH-02's `a:ln` and arrowheads.
   - Transforms are flattened.
   - `text` and `tspan` become real text, as text boxes or the shape's own text: the measured font, size, weight, color and anchor, with no autofit and no wrapping that pele did not do. Text that cannot be matched keeps the family on the picture path.
   - Edges become `p:cxnSp`: a custom geometry that follows pele's exact path, with `a:stCxn`/`a:endCxn` to the node shapes when an end touches a node's connection site (SH-01 sites), so the edge follows the node in PowerPoint. Use whatever pele's SVG gives you to tell nodes from edges and labels (classes, ids, group structure); read pele's output for each family. Where an end cannot be bound, the edge is still a connector shape with its exact path, unbound.
   - Gradients, clip paths, patterns and filters are written natively where DrawingML has them. A family that needs something with no native form stays a picture.
   - Everything goes into one `p:grpSp` named after the diagram, with the diagram's alt as its description and `OPF_DIAGRAM_V1` provenance. Import must still read the Mermaid source back, so check `diagram-provenance.js` and its import path.
3. **The comparison.** For every family in `docs/diagrams.md` (32 rows), take the docs' example sources plus one harder source per family (more nodes, long labels, right to left where it applies):
   - Export with `diagrams: "shapes"`, render through PowerPoint COM, and compare with the preview: a sheet with preview | PowerPoint | difference, a numeric score (mean absolute difference and the hot-pixel share, the same metrics as the earlier verification tools in `C:/opf-work/harvest/wave8/verify/w8/tools/`), and your own visual check of text positions and edge paths.
   - A family passes when every source scores within the threshold you set from the clean families, and you see no visible difference beyond antialiasing. Record the threshold.
   - Put the passing families in core's allowlist (one exported constant), and the failing ones in the PR with the reason for each.
4. **Docs:** `docs/diagrams.md` (the export section: the option, the allowlist table, what stays a picture and why), the opf-export skill, and the MCP bundled docs.
5. **Tests:**
   - pptx `test/sh-07-*.mjs` covers the converter per primitive, the allowlist gate, the finding and the group with its provenance;
   - an import round trip shows that the Mermaid source comes back.
6. **Evidence:** `C:/opf-work/shapes/sh-07/`, with one sheet per family and a summary table.
7. **Changelog** fragment `changes/sh-07-native-diagrams.md`.
8. **PR:** `SH-07: native Mermaid diagrams in PowerPoint`, its base `main`. It will contain SH-04's commits until SH-04 merges; say so in the body.

Report as `brief.md` says, plus the per-family table (passed or not, with the score and the reason).
