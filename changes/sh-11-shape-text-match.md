---
type: fixed
packages: [opf, pptx]
---
SH-11 (output-changing for shape text in the `intense` style): a shape's text is fitted in the weight it is drawn in. The intense style draws bold text, but composition measured it in the regular weight, so its bold lines ran past the shape's text rectangle in the preview, and PowerPoint, which wraps the same bold runs itself, broke them elsewhere (15 of 80 intense shapes had another line count in PowerPoint 365; now none). The export already gives PowerPoint core's text rectangle for every preset (the frame, the adjust values and the padding as insets) and the fitted size on every run, and PowerPoint draws that size: a new test checks the rectangle and the size for all 187 presets.
