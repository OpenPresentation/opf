---
type: changed
packages: [opf]
---
FA-37 (breaking): the layout words that follow the deck's direction are `start` and `end`, not `left` and `right`, with no alias: `design.titleAlignment` and `design.contentAlignment`; `design.chartPrimary` (`none`, `top`, `bottom`, `start`, `end`); header and footer zones (`design.footer.start`, `.center`, `.end`); promoted slide regions (`start`, `end`, `start+center`, `center+end`, `top:start`, ...; Markdown `region=start`); `caption.align` and a table cell's `style.align`; an image's `placement.edge` and an overlay band's `edge`. A layout region may not be named `start` or `end`. Layout words and coordinates are logical (they run from the edge the deck starts on, including an overlay shape's `x`); what names pixels of a picture or parts of a plot stays physical (`ImageFocus`, `ImageCallout`, a chart's `legend` and data label `position`, the `left` and `right` of cell borders, cell and shape padding). To migrate, rename those keys and values; validation says `"left"` is not allowed, did you mean `"start"` ([0.34 migration](../docs/migrations/0.34.md)). Engine API: `resolveDesignHints` and `SlideComposition.design` report the document's words; the new `itemAlignment()` gives the engine's alignment for one; composed header and footer parts carry a `zone` of start, center or end; `captionSettings().align` is the document's word. PPTX files exported before 0.34 import with the old words in their OPF tags read as the new ones. The editor's pickers, region layouts and source completions use the new words.

The breaking `left` → `start` and `right` → `end` enum replacements are declared at these schema paths:

- `layout.schema.json:$defs.DesignHints.properties.titleAlignment`
- `layout.schema.json:$defs.DesignHints.properties.contentAlignment`
- `layout.schema.json:$defs.DesignHints.properties.chartPrimary`
- `opf.schema.json:$defs.Design.properties.titleAlignment`
- `opf.schema.json:$defs.Design.properties.contentAlignment`
- `opf.schema.json:$defs.Design.properties.chartPrimary`
- `opf.schema.json:$defs.Overlay.properties.edge`
- `opf.schema.json:$defs.ImagePlacement.properties.edge`
- `opf.schema.json:$defs.Caption.oneOf.2.properties.align`
- `opf.schema.json:$defs.TableCellStyle.properties.align`
- `theme.schema.json:properties.design.properties.titleAlignment`
- `theme.schema.json:properties.design.properties.contentAlignment`
