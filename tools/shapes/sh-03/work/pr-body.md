SH-03 of the OPF shapes work: the six shape effects in both engines, as two self-contained modules that the shape block (SH-02) calls.

## What it adds

- **`packages/pptx/src/effects.js`**: `effectsXml(effects, resolveColor, { scale }) → '<a:effectLst>…</a:effectLst>'` (or `''`). Exact DrawingML units (EMU at 9525 a reference pixel times the slide scale, 60000ths of a degree kept in 0 to 21600000, 1/100000 alpha and sizes), children in `CT_EffectList` order (blur, glow, innerShdw, outerShdw, reflection, softEdge), out-of-range input clamped. `resolveColor` may return a hex (an alpha byte multiplies the opacity) or a color element such as `<a:schemeClr val="accent1"><a:lumMod …/></a:schemeClr>`, to which `a:alpha` is appended.
- **`packages/render/src/effects.js`**: `effectsSvg(effects, outline, resolveColor, { id, scale }) → { defs, attributes, wrap(geometry, text), empty }`. SVG filters (feGaussianBlur, feOffset, feFlood, feComposite, feMorphology plus a blur cut for a round pen, a faded mask and a mirrored `<use>` for the reflection).
- **The three `shadow` presets**, written as `a:outerShdw` (never `a:prstShdw`): `soft` = PowerPoint's Outer "Offset: Bottom" (black, 60% transparent, blur 4 pt, 3 pt at 90°); `hard` = a crisp offset (black, 75% transparent, no blur, 6 pt at 45°); `perspective` = "Perspective: Below" (black, 85% transparent, blur 12 pt, 25 pt at 90°, sx 90%, sy −19% from the bottom). Defaults for the object forms and the presets are the same table in both modules; the pptx test asserts the two are equal.
- `docs/shape-effects.md`: keys, units, presets, DrawingML mapping, how PowerPoint draws them, remaining differences, what is excluded.

## How PowerPoint draws them (measured, then matched)

From PowerPoint for Windows renders through COM, with the edge profiles fitted:
- every blur radius r is a Gaussian of σ = r/3 (outer and inner shadow, blur, reflection);
- glow = outline grown 0.45 r, blurred 0.165 r, behind the shape; soft edge = outline shrunk 0.91 r, blurred r/3, as a mask;
- inner shadow lies along the edges the angle points at;
- order: inner shadow → soft edge → blur on the fill and outline (never on the text) → glow → text on top → outer shadow cast by all of it (glow and text included: a no-fill shape casts its text's shadow) → reflection of everything (shadow and glow included) about the shape's bottom edge, faded linearly over `size` of its height;
- the shadow follows the drawn alpha (not the bounding box) and keeps its direction when the shape turns (`rotWithShape="0"`).

SVG's feMorphology pen is square; the preview grows and shrinks with the union of a square pen and a blur cut at the straight-edge level, close to PowerPoint's round pen (tuned on rectangles, ellipses and rounded outlines).

## Evidence

`C:/opf-work/shapes/sh-03/sheet.png`: 48 pairs (preview | PowerPoint) for every effect, preset and combination at several settings, on rectangles, ellipses, rounded rectangles, a rotated shape, no-fill outlines, half-transparent fill and text. Mean absolute difference per channel under 3/255 on every pair (most under 1.5). The same SVG in Edge (Chromium) matches PowerPoint as closely as the resvg PNG. Remaining differences: a large glow is a little rounder at a rectangle's corners, an ellipse's soft edge is a little narrower at its ends, and PowerPoint's own slight slant on a blurred shape's right edge is not copied.

## Wiring

The shape block (SH-02, `codex/sh-02-shape-block`) was not on origin when this was finished, so the `drawEffects` call sites are left to the integration step:
- render: `const fx = effectsSvg(shape.effects, { ...box, rotate }, colorToCss, { id, scale })`; put `fx.defs` in the slide's defs and draw `fx.wrap(geometryMarkup, textMarkup)` with both already rotated/flipped.
- pptx: `effectsXml(shape.effects, ref => colorElementOrHex, { scale })` into `p:spPr` after `a:ln` (and before `a:scene3d`).

## Tests

- `packages/render/test/shape-effects.mjs`: filter structure and order, units and scale, presets, reflection and scaled-shadow transforms, and a resvg raster check of each effect.
- `packages/pptx/test/shape-effects.mjs`: exact XML, schema order, units, color handling, clamping, and parity with the preview's tables.
- `pnpm check:changed`: render tests passed; the pptx suite run file by file: all pass except `keynote-registry-runtime.mjs` (EPERM creating a symlink on this Windows machine, environmental) and `check:text` (needs `docs/evidence`, absent in the blobless worktree). No shared pinned files move (no goldens, budgets or fixtures touched; nothing calls the modules yet).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
