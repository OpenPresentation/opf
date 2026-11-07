---
type: changed
packages: [opf]
---
LH-185: a flowchart or state diagram that does not fit at the readability floor is drawn in the other main direction (`LR` and `TB`, `RL` and `BT`) before it is scaled below the floor, whatever direction the source wrote; the source keeps its text, an `arrangement-adapted` info finding says how it is drawn, and `ComposedDiagram.direction` records it. Only when neither direction holds the labels at the floor is the diagram scaled as before, with a `text-overflow` finding that names the directions tried.
