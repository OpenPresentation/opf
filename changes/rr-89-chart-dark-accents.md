---
type: fixed
packages: [opf]
---
RR-89: `chartPaletteForFill` reads the palette in tiers of six (`CHART_SERIES_TIER_SIZE`) and keeps a colour apart from the colours of its own and earlier tiers only. The tints of `chartSeriesPalette` (series 7 to 12) no longer crowd the six accents, so on dark panels such as #1B1B1B and #011842 series 1 and 2 of the default scheme are again #2874A6 and #89B4DC instead of #2874A6 and #5884AA (7 lightness points apart, under the renderer's 9-point gate).
