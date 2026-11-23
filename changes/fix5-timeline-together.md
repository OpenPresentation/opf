---
type: fixed
packages: [opf]
---
TLN-1 (output-changing for lone timelines): a timeline alone in its region no longer draws as a thin strip of small dots in the middle of an empty body with its lead at the top of the slide and its note at the foot. A lone timeline now tries one more step of the type scale (its `when` and `what` labels up to 33 and 37 px, where every label keeps its line), a grown band draws its markers and the gaps around them in proportion to its labels, and on the timeline layout (or any layout whose row holds only that timeline) the row hugs the grown timeline when the body is centered (LH-102), so a lead above it and a note below it sit with it in the middle of the body. LH-102 also measures a timeline by what it draws, not by the top of its cell. Stacked bands (two or more timelines in a region) keep their sizes and markers.
