# Shared vector outlines and accepted text placement

This is unpublished work on `codex/shared-metric-integration-20260910`, beyond core 0.9.0, renderer/PPTX 0.7.0 and editor 0.6.0. Check the [handoff](../handoff-2026-09-08.md) for exact source checkpoints and release gates.

## Contract

`TextMeasurement.outlineBounds(text, fontSize, resolvedStyle)` optionally returns a shaped vector outline rectangle relative to the left baseline origin, with positive y downward. `null` means no outline, such as spaces; an absent method means unavailable measurement. Core validates finite coordinates and nonnegative dimensions. The font registry measures outlines and advances from the same local font bytes and style resolution. Vector rectangles do not certify hinting, antialiasing, decorations, color glyphs or arbitrary rasterizers.

`placeTextLines` preserves nominal alignment when possible, moves a line horizontally to contain its outline, and shifts subsequent baselines together when tall outlines need separation. It returns absolute accepted origins, outline rectangles, occupied height and overflow. It never clips or edits text. Scalar/rich text and headings use this placement during fitting; the bounded search retains the selected minimum and tries at most 65 sizes. Rich-run font ratios remain tied to the original requested size. Width-only providers retain their earlier fitting behavior.

Pass the same `textMeasurement` and `textRasterPadding` to composition, renderer, explicit pagination, editor and PPTX export. Padding defaults to one reference pixel at a 720-pixel canvas short edge and scales with the canvas. It is an explicit layout input, not a relaxed validation tolerance or a promise about every device-pixel ratio. Zero disables that clearance. The `grid-score-v6` explanation reports outline availability and effective padding; scoring and strict overflow include placed scalar/rich text. Existing code, metric, quote, list, table, chart and timeline internals retain their previous models; their full ink coverage is still work.

Consumers use `fit.placement` without another measurement pass. SVG trace positions match painted origins. Native PPTX keeps editable line boxes and the accepted alignment anchors without autofit. Complete standard DrawingML heading tags recover title/subtitle/tag roles and current native text in line order. Renamed/reordered shapes remain supported; damaged, incomplete or ambiguous groups fall back to ordinary import with diagnostics. Tags contain no original heading text. Original whitespace, wrapping, formatting, layout and arbitrary Office structure are not recovered. Plain core wrapping still normalizes whitespace.

## Evidence and remaining gates

The original four Carlito portrait/right title failures were actual Edge ink: pixel (497,186), coverage 90/255, exceeded a cell ending at 496.8. The vector outline stayed within its advance. Switching Edge's text-rendering mode did not change that pixel. Shared clearance fixes all 24 cases with the unchanged 0.1-pixel mask gate; zero-clearance controls reproduce exactly the four failures on Node 20/24.

See [portable evidence](../evidence/text-placement/README.md) for versions, hashes, package/browser checks and retained failures. Native DrawingML geometry is checked independently of browser paint. A fresh PowerPoint COM connection was rejected with `0x80010001`; no current native save/reopen or raster result exists. Source quality, glyph appearance, multilingual shaping, native equivalence and public adoption need their own evidence. The unchanged default estimated corpus retains its existing unapproved baseline gate.
