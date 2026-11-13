---
type: fixed
packages: [render]
---
A tracked display line (LH-189) measured with the host's real fonts now starts at the position core computed instead of hanging from a middle or end anchor, so a browser draws a centered or right-aligned title, statement or figure exactly where the PNG, PDF and PowerPoint outputs put it (opf#1322). A browser counts the letter spacing after a line's last character toward the anchor, which moved such a line by half or one spacing: up to 1.9 px centered and 3.8 px right-aligned on a 252 px figure. Estimated widths keep the anchor, and the raster goldens do not change.
