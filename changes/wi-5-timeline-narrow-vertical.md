---
type: changed
packages: [opf]
---
WI-5 (P22, output-changing for timelines in narrow cells): when an event has less than 8 ems of its label size (176 px at the 22 px label size) of width, the timeline is composed vertically, with the events stacked down the cell and the same markers, statuses and order, instead of wrapping one word per line around a horizontal connector (two- and three-column timelines, a timeline beside a list or a metric). Full-width timelines keep their alternating arrangement and sizes; a cell too short for the vertical stack still falls back to the previous search.
