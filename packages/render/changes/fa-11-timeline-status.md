---
type: added
---
FA-11: the SVG preview draws `TimelineEvent.status` from the deck's colors through core's `timelineMarkerShapes` and `timelineTextColor`: `done` is a filled marker in the primary color, `current` a filled marker inside a ring with a bold label, and `planned` a hollow outlined marker with muted text kept at 4.5:1 or more. Events without a status render byte-identically, so no golden moves. With `trace`, a status marker carries `data-opf-timeline-status` and `data-opf-timeline-shape` (`marker` or `ring`).
