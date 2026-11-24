---
type: changed
packages: [opf]
---
LH-102 (output-changing for short bodies of several paragraphs and lists on a layout): a layout body that still fills under half of its height after LH-48's three steps grows on by the type scale's steps up to 56 px, as the same body on a slide without a layout already did, while every block keeps its place, nothing overflows and it fills at most 60%; a body of short texts only (each of at most four words) grows on to 75 px, the display title's size a lone short text reaches. Paragraphs keep one size among themselves, as lists do. Two short lines on a `text` slide no longer stay at 37 px while one short line grows to display size. A layout whose regions may draw their content (badges, Basic Process, a diagram) keeps LH-48's three steps.
