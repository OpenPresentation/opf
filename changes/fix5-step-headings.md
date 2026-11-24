---
type: fixed
packages: [opf]
---
PR2 (output-changing for a row of steps where only some steps have a description): a step written as a one-entry numbered list without a description drew as a plain line at the list size beside its siblings' bold headings, so the row read as two kinds of steps. It now draws as a heading too (bold, a step up, no marker), at the size its siblings' headings share. A row where no step has a description is unchanged. A step with a very long description still makes the row give up its badges when the badges would cost the text a size (the guarded rule `step-badges`).
