# SH-27 local evidence

The whole ellipse remains at y = -0.1. Its top is 72 pixels above a 720-pixel-high slide, and the slide viewport crops its drawing. The local browser image shows the selected star with the same negative Y and its top cropped while the editor continues normally.

Focused schema/core, editor undo/resize/detach, SVG and native PPTX byte/current-position import controls pass. The real browser suite passes all 34 checks, including entering -10% Y and dragging past the slide edge. Root inspected both PNGs. No actual PowerPoint opening or native visual qualification was performed for this change.

raw.zip preserves the original 11 files byte for byte, including SVG font-license whitespace and Windows log line endings. manifest.json seals every member. Run verify.mjs with Node after installing the workspace. render.mjs records the public API reproduction; it regenerates local artifacts explicitly and does not replace the sealed archive.

The first focused run had two test-authoring errors, recorded inside the raw archive, corrected without changing production behavior. Required mapped check and independent review are pending.
