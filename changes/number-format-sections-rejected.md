---
type: changed
packages: [opf]
---

A number format with a `;` (Excel's `positive;negative;zero` sections, such as `"+0%;-0%"`) is now an `opf/number-format-invalid` error with a hint that says to write one pattern, instead of printing the second section as literal text in both engines. The chart docs now say plainly that an anchored shape is centered on its chart point (`offset` clears it), that a vertical `flip` turns a shape's text upside down as PowerPoint does, and that highlighting one pie or doughnut slice gives every other slice one muted neutral.
