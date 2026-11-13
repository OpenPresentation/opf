---
type: changed
packages: [pptx]
---
RR-105 (opf#1293): PPTX export writes a theme font reference (`+mj-lt`, `+mn-lt`, and the East Asian and complex-script slots where they hold the same family) wherever a run's family is its theme's heading or body family, on slides, in tables and in SmartArt text, so Design > Variants > Fonts and applying another theme restyle the deck. The deck looks the same and imports as the same document. When the theme's heading and body fonts are changed in PowerPoint, import returns the new faces as the deck's font scheme (`design.fontScheme`, a catalog scheme keeping its id) and the slides as authored, so the text follows them instead of every run gaining a direct family. Other families, bold faces written under their own names, chart text (which names the deck's body face itself) and the safe-typeface option keep working as before.
