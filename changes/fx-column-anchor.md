---
type: fixed
packages: [gallery]
---
The `two-column` and `three-column` layouts set a column's content in the middle of its box instead of at its foot. Their records had `anchor: "bottom"`, which stranded a short block (a few words, a picture or a chart beside text) alone at the bottom of an empty full-height box; the records now say `anchor: "middle"`. The boxes, their equal height and the hug-and-center behavior of short body text are unchanged.
