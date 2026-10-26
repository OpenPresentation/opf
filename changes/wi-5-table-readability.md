---
type: changed
packages: [opf, render, pptx]
---
WI-5 (P20 and N2, output-changing for every table): column widths come from content and a line breaks only between words. Each column is at least as wide as its longest unbreakable word at the table's type size, short columns keep the width their text asks for and the rest is shared evenly (`TableLayout.columnWidths`); when even the longest words do not fit, the whole table shrinks within the readability floor before any word is split (`TableLayout.splitsWords` is true only at the floor). "Completi/on", "Escalatio/n rate" and "Participa/nt" in narrow peer-column tables no longer break. A table draws horizontal rules only by default, a rule under every row and over the first, with no vertical grid; an explicit cell border (including left and right) is still drawn. The PPTX export writes the same column widths (`a:gridCol`) and the same horizontal-only borders. The `TableCellStyle.borders` description says so.
