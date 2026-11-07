---
type: changed
packages: [opf]
---
LH-102 follow-up (output-changing for short automatic bodies): an automatic stack of paragraphs and lists that fills too little of the body (LH-48 grows it, or cannot) now sits in the middle of the body under the headings instead of at its top. Promoted regions that each run the body's full height (`left`, `center+right`) and hold only paragraphs and lists now set their blocks as one band in the middle of the body. Both are kept only when no block reads smaller and nothing overflows. Seven corpus slides move, at the same sizes.
