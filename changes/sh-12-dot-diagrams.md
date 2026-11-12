---
type: added
packages: [opf, render, pptx, editor]
---
SH-12: Graphviz DOT diagrams. A `diagram` takes `syntax: "dot"` (`Diagram.syntax` is now `"mermaid" | "dot"`), and a Markdown ```` ```dot ```` fence is one. OPF reads DOT itself (no Graphviz code ships) and lays it out as a flowchart, so a DOT diagram is painted in the deck colors and fonts, previewed and exported as native PowerPoint shapes (SH-07), and `fromPptx` reads an unchanged group or picture back as its DOT source. `rankdir`, node shapes, edge styles, arrowheads, `dir`, `minlen`, labels, records, `strict` and `subgraph cluster_*` are drawn; a graph whose `layout` names another engine (neato, fdp, sfdp, circo, twopi, osage, patchwork) or an HTML table label is refused with a finding at its line and column. Core exports `dotToMermaid`, `DOT_SHAPES` and `DOT_LAYOUT_ENGINES` from `@openpresentation/opf/composition`; the editor offers the `dot` fence; a `dot` code block is written to Markdown as an `opf-block`.
