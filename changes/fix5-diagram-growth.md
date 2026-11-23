---
type: fixed
packages: [opf]
---
C08, IM1 (output-changing for Mermaid, DOT and PlantUML diagrams with room to spare): a diagram's base type size started at the nominal 32 px and never grew, so a three-node flowchart drew as a strip of about 630 x 100 px in a full-width body (in `chart`, `chart-beside`, `hero` and `image`). The base size now starts at 1.5 times the nominal size (48 px, as an arrangement's text grows; never past the composition's `maxFontSize`) and steps down to the largest at which the drawing fits its block, so small diagrams fill more of their block. A diagram that already filled its block draws as before. The PPTX export draws the composed diagram, so its native shapes follow.
