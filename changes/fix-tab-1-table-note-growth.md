---
type: fixed
packages: [opf]
---
TAB-1 (output-changing for a `table` layout slide whose table and note fill half to three quarters of the body): a table and the note under it grow (LH-48) while they cover under three quarters of the body, and up to three quarters (`TABLE_NOTE_GROWN_TARGET`, the target LH-75 gives the same pair side by side). A table of two rows grew to its 32 px display size, but a third row, a longer note or a subtitle took the pair over half the body, where it kept its role sizes: the type dropped from 32 to 25 px (the note from 37 to 28 px) with a third of the body empty. A pair that already covers half the body or more and cannot grow keeps its place.
