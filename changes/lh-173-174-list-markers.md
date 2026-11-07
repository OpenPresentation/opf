---
type: fixed
packages: [opf]
---
LH-173 and LH-174 (output-changing for a few slides): a step or column label never splits a word, and a list with icons on only some entries keeps one marker style.
    - A heading list's label (a step beside its badge, or a column of one entry with a description) whose widest word does not fit its box at 1.25 times the list size now steps down to the largest size at which the word fits. It never goes under the list size. The labels of sibling heading lists in a row share the smallest size (`ListFitOptions.headingMax`), so a six-step row with "Research" no longer draws "Researc/h". LH-48's growth now stops before a step that would break more words of a paragraph or of a list label or description.
    - In a list where only some entries have an `icon`, an entry without one keeps its bullet in the chip column, centered there, instead of an empty slot. This applies to stacked lists and ruled rows. Its marker moves in and its hanging indent is shortened by the same amount, so PowerPoint's native bullet lands where the preview draws it. `design.listBullet: "none"` still leaves the slot empty.
