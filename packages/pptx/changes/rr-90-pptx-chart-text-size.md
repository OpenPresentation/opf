---
type: changed
---
RR-90: chart axis, label and legend text is written at core's `chartTextSize` for the chart's box, the size the preview (opf-render 0.22.2) draws: 20 px at the 1280 x 720 reference (15 pt on a 13.33 x 7.5 in slide), shrunk only for a small box and never below `composition.minFontSize`, on core's 0.01 pt grid. It was 14 px floored at 16 px (12 pt). The local chart text constant is gone. Chart parts of exported decks change (only text sizes, `sz`); archives of chart decks are byte-different (fixtures `rr-54-unchanged.json` and `chartex-fallback-main.json` re-pinned). Needs opf-render 0.22.2 for the preview to match; the development pin is now 0.22.2.
