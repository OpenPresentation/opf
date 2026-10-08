---
type: added
---
FA-27: table alt text. The table section of the design controls gains an "Alt text" field and a "Decorative (no alt text)" box for the selected table (also for a table that shows a shared dataset); `readTableAlt` reports `{ alt, decorative }` and `prepareTableAlt` / `setTableAlt` (`@openpresentation/opf-editor/tables`) take `alt` (trimmed; empty removes it) and `decorative` as one validated, undoable patch, like `setChartOptions`. Find and replace searches `table.alt` like chart and image alt text. Needs the core release that adds `Table.alt`.
