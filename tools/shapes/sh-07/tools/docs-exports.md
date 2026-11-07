## Exports

| Output | What you get |
| --- | --- |
| SVG preview | The diagram as vector shapes and text in the slide's colors and fonts |
| PNG | The preview rasterized |
| PDF | Vector; the diagram's labels stay selectable text |
| PPTX, `diagrams: "picture"` (the default) | A native SVG picture with a PNG fallback: crisp at any size, recolorable as a picture in PowerPoint, `alt` as the picture's description. `fromPptx` brings it back as a `diagram`. |
| PPTX, `diagrams: "shapes"` | Native PowerPoint shapes, connectors and text in one group, drawn from the preview's own geometry, `alt` as the group's description. `fromPptx` brings an unchanged group back as a `diagram`. |

### Native shapes in PowerPoint

`diagrams: "shapes"` writes each diagram as editable PowerPoint shapes that look like the preview:

```js
const bytes = await toPptx(deck, { diagrams: "shapes" });
await convert(deck, "deck.pptx", { diagrams: "shapes" });
```

```sh
opf convert deck.opf.json deck.pptx --diagrams shapes
```

The shapes are built from pele's laid-out drawing, the same geometry the preview draws, never a second layout or PowerPoint's connector routing:

- **Nodes** are shapes. An outline that is exactly a PowerPoint preset is that preset (`rect`, `roundRect`, `ellipse`, `diamond`, `hexagon`, `parallelogram`, `trapezoid`, `triangle`, checked against the [shape geometry](shapes.md)); any other outline (a cylinder, a flag, a stick figure, a pie slice) is a freeform of its exact path.
- **Labels** are real text in the deck's fonts at the preview's size, weight, color and baseline, with no wrapping and no autofit. A node's label is the node's own text, so it moves with the node; other labels are text boxes.
- **Edges** keep their exact path and arrowheads. A straight edge without arrowheads is a PowerPoint connector glued to the connection sites of the nodes it touches, so it follows a node you move. Every other edge is a freeform of its line and its arrowheads: PowerPoint opens a connector only with one of its preset routes (a connector of freeform geometry makes the file unreadable), and its largest line end is about a fifth shorter than pele's arrowhead, so a glued connector would not look like the preview.
- **Fills and lines** keep their colors, opacity, gradients, widths, dashes, caps and joins.
- Everything is one group named `OPF diagram N`, with the diagram's `alt` as its description.

A diagram family is written as shapes only after PowerPoint's drawing of it has been compared with the preview, source by source. Every family below passed: in PowerPoint 365 for Windows, with the docs' examples and a harder source per family (more nodes, long labels, right to left where the family has a direction), each slide rendered through PowerPoint and compared with the preview at 320 by 180 and at 1280 by 720.

| Family | Written as shapes | Family | Written as shapes |
| --- | --- | --- | --- |
| Flowchart | yes | Architecture | yes |
| Sequence | yes | Kanban | yes |
| Class | yes | Packet | yes |
| State | yes | Radar | yes |
| Entity relationship | yes | Treemap | yes |
| Gantt | yes | Venn | yes |
| Pie | yes | Ishikawa | yes |
| Quadrant | yes | Requirement | yes |
| Mind map | yes | Wardley map | yes |
| Timeline | yes | Tree view | yes |
| User journey | yes | Event modeling | yes |
| XY chart | yes | Railroad | yes |
| Sankey | yes | Cynefin | yes |
| Git graph | yes | Use case | yes |
| C4 | yes | Swimlane | yes |
| Block | yes | Agent flow | yes |

The list is core's `DIAGRAM_SHAPE_FAMILIES` (from `@openpresentation/opf/composition`). A diagram stays the picture, with the info finding `pptx/diagram-shapes-unavailable` naming its family and the reason, when:

- its family is not in that list (a new pele diagram type, until it has been compared);
- its drawing uses something PowerPoint has no native form for: a clip path, a mask, a filter, a pattern, an embedded image, text on a path, or right-to-left text (whose placement PowerPoint decides by its own bidirectional layout).

What differs from the preview is what differs for all the deck's text: the preview draws Aptos with a metric-compatible stand-in, so glyph shapes differ slightly while every line starts, ends and sits where the preview puts it.

**Editing and import.** The shapes are ordinary PowerPoint shapes: restyle, move or retype them as you like. `fromPptx` reads an unchanged group back as the diagram, with its Mermaid source and the group's current description as `alt`. Once a member is moved, resized, retyped, added or removed, the group imports as its shapes and reports `invalid-diagram-provenance`: the edit is kept and the source is not reconstructed. To keep the source as the truth, edit it in OPF and export again. With `provenance: false` (`--provenance none`) the group carries no source and imports as its shapes.

PowerPoint's own "Convert to Shape" on a picture diagram also gives shapes, but that is PowerPoint's conversion, not an OPF export, and it does not map back to the diagram. See the [compatibility matrix](compatibility-matrix.md).
