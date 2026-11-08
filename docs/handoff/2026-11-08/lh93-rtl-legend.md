# LH-93 RTL header legend order

The actual negative-RTL native sheet shows the preview's Expansion/Current sequence reversed from PowerPoint's Current/Expansion sequence. Core mirrored every entry independently, while the exporter mirrored only the overall native legend box. Data, colors, negative category gutter and saved import were already correct.

Vetoable decision accepted by the coordinator: mirror the overall header legend box, retain authored series order left-to-right inside it, and preserve RTL caption/axes and glyph shaping. Wrapped rows retain the same relative offsets, row heights and type; no data or series reorder, no speculative native paragraph-direction dependency. Explicit legend positions and LTR output are unaffected.

Four independent core translation/wrapped/size cases fail first for the intended item-order assertion and pass afterward. Existing15chart-layer tests and negative-axis controls pass. Five genuine CLI before/after cases retain whole native PPTX bytes; the RTL preview alone changes. Four LTR/authored-option/ordinary preview controls are byte-identical. The frozen original native sheet is retained as the observed defect; final current-clean-producer native acceptance remains owed to the coordinator. No Office by this agent and no folded source modified.

Final source6ee1cb75dc760a46c9f6d91eed7c2cedb547d765; [104-file raw receipt and genuine sheets](../../programs/layout-harvest/lh93-rtl-legend-2026-11-08/README.md). Single mapped256.9s passes10/13steps; inherited composition budget, sparse input(recovered) and10core failures remain explicit. Format-only97563measurements independently reproduce on approved-before source; NEWderived correction is assigned separately. Current cleanCLI packet C:/opf-work/lh93-rtl-legend-clean, all five after outputs identical, negative-RTL PPTX SHA2566782e12f1e30915f02ac52bc0a8cca5f14398a11e6466dd10564d5e50e5e50e2. Native acceptance owed; no Office.

