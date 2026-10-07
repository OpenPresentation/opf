---
type: added
---
FA-09: chart alt text. The chart options panel gains an "Alt text" field and a "Decorative (no alt text)" box for the selected chart; `readChartOptions` reports `state.alt` and `state.decorative`, and `prepareChartOptions` / `setChartOptions` take `alt` (trimmed; empty removes it) and `decorative` as one validated, undoable patch. The Review panel's quick fix for `audit/chart-text-alternative` types the alt text onto the chart with chart-specific help text, and find and replace searches `chart.alt` like image alt text. Needs the core release that adds `Chart.alt`.
