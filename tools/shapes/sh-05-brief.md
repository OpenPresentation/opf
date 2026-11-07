# SH-05: PPTX import of shapes

Follow `C:/opf-work/shapes/brief.md` (the general rules for a shapes item), `C:/opf-work/shapes/phase2-format.md` and `C:/opf-work/shapes/design.md`. Branch `codex/sh-05-shape-import`, worktree `C:/opf-work/sh-05-shape-import`. Create the branch from `origin/codex/sh-04-overlays-connectors` (SH-04's stage-1 format commit) rather than from main: `node scripts/agent-worktree.mjs add sh-05-shape-import`, then `git reset --hard origin/codex/sh-04-overlays-connectors` inside it. Merge that branch again whenever SH-04 pushes; its stage 2 adds the connector writer your round trip needs. Do not spawn sub-agents. Do not merge into main. Do not poll CI.

## Today's import

Read how the importer works:
- `packages/pptx/src/index.js` (the import entry);
- `import-signals.js`, which already classifies `p:sp`, `p:cxnSp` and `prstGeom`;
- `image-import.js`, `body-text-import.js` and the `*-provenance.js` readers.

The exporter marks what it wrote with provenance, so that its own output imports back as the OPF it came from. Keep that model.

## What to build

1. **The exporter's own shapes come back unchanged:**
   - SH-02 shape blocks with every property: preset and `adjust` (from `a:avLst` to fractions and degrees through SH-01's `adjustFromDrawingML`), `path` from `a:custGeom`, fill, opacity, `stroke`, `style`, SH-03's effects (from `a:effectLst` back to the OPF forms, shadow presets included), `rotate`, `flip`, text, `anchor`, `padding`, `textDirection`, `alt`, `decorative`, `hidden` and `link`;
   - lighter and darker theme colors (`a:lumMod`/`a:lumOff` back to `{ color, lighten|darken }`);
   - picture `stroke`;
   - SH-04's overlay shapes and connectors (the `from`/`to` ids, the route and the sites from `a:stCxn`/`a:endCxn`).

   Provenance tells you when a shape is a block and when it is an overlay.
2. **A PowerPoint-authored deck's shapes import:**
   - A free-positioned `p:sp` with preset or custom geometry and no OPF provenance becomes an overlay shape, placed by `x/y/width/height` fractions, with every mapped property.
   - A `p:cxnSp` becomes a connector, bound by `from`/`to` when its ends are connected.
   - Shapes inside `p:grpSp` are flattened, with their transforms applied.
   - A text-only `p:sp` keeps today's text import.
   - The excluded properties in `design.md` (3-D, `a:prstShdw`, fill overlay, wrap/columns/autofit, alt title, hover links, locks, black-and-white mode, custom data) are each reported as a finding (`opf/import-shape-property-dropped`, naming the property) and dropped.
3. **Fixtures:**
   - Build a PowerPoint-authored deck through PowerPoint COM: `Shapes.AddShape` over many `MsoAutoShapeType` values, adjustments, gradients, patterns, dashes, arrowheads, shadow, glow, soft edge, reflection, 3-D (it must produce a finding), `Shapes.AddConnector` with `BeginConnect`/`EndConnect`, groups, rotation and flips.
   - Save it under `packages/pptx/test/fixtures/` (keep it small).
   - Write the deck's own preview | PowerPoint sheet after the import, in `C:/opf-work/shapes/sh-05/sheet.png`: the imported OPF drawn by the preview against the original slide in PowerPoint.
4. **Round-trip tests:**
   - export, import and compare the OPF for `examples/technical/shapes.opf.json`, `examples/technical/shape-effects.opf.json` and SH-04's `shape-overlays.opf.json` (once SH-04 pushes it);
   - import the PowerPoint-authored fixture with its findings.

   Use pptx `test/sh-05-*.mjs`.
5. **Docs:** `docs/shapes.md` gets an import section listing what maps, what is dropped and the findings. Update the opf-export skill and the MCP bundled docs.
6. **Changelog** fragment `changes/sh-05-shape-import.md`.
7. **PR:** `SH-05: PPTX import of shapes`, its base `main`. It will contain SH-04's commits until SH-04 merges; say so in the body.

Report as `brief.md` says.
