---
type: added
---
RR-93: table cells take a `bold` style, so a number cell can be bold without rich runs, which dropped the column's number format and alignment. `setTableCellStyle(editor, tablePath, cell, { bold: true })` sets it (`null` removes it, a non-boolean is refused), a table style keeps it, and the design panel's table section has a Bold checkbox beside the cell fill and alignment. Needs core 0.22.0 (`TableCellStyle.bold`); the core floor is now `^0.22.0`.
