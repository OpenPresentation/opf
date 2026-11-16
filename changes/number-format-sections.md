---
type: added
packages: [opf]
---

A `NumberFormat` takes Excel's `positive;negative;zero` sections (one to three, each an ordinary pattern), so a signed delta is `"+0%;-0%"` (`+12%`, `-5%`) and a loss in brackets `"0;(0)"`. The negative section formats the absolute value and carries its own sign; the section is chosen by the value's sign, as Excel does (`-0.4` under `0;(0)` is `(0)`). Four or more sections, an empty section or a section without a numeric part is `opf/number-format-invalid`; there is no text section, color or condition. The preview, the table cells and the variables use the sections, and the PPTX export writes them as real Excel sections in the chart's `c:numFmt` `formatCode`. Before, the second section printed as literal text.
