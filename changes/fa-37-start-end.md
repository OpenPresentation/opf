---
type: changed
packages: [opf, render, pptx, editor, gallery, cli, mcp]
---

FA-37 (breaking): the layout words that follow the deck's direction are `start` and `end`, not `left` and `right`. They always were logical (in a right-to-left deck the `left` region was drawn at the right); now the name says so. Renamed in documents and records, with no alias: `design.titleAlignment` and `design.contentAlignment` (`start`, `center`, `end`; deck, slide, theme and layout records); `design.chartPrimary` (`none`, `top`, `bottom`, `start`, `end`); the header and footer zones (`design.footer.start`, `.center`, `.end`); the promoted slide regions (`start`, `end`, `start+center`, `center+end`, `top:start`, `middle+bottom:center+end` and the rest of the 48 keys; Markdown `region=start`); `caption.align` and a table cell's `style.align`; an image's `placement.edge` and an overlay band's `edge` (`start`, `end`, `top`, `bottom`). A layout region may not be named `start` or `end` (it may be named `left` or `right`). One rule now covers direction, stated in `Language.direction` and the docs: layout words and layout coordinates are logical (they run from the edge the deck starts on, including an overlay shape's `x`), and coordinates and sides that name pixels of a picture or parts of a plot stay physical in every language (`ImageFocus`, `ImageCallout`, a chart's `legend` and data label `position`, the `left` and `right` of cell borders, cell padding and shape padding). To migrate a deck, rename those keys and values; validation names each old word with the new one (`"left"` is not allowed, did you mean `"start"`). The vocabulary preserves the existing logical layout geometry. Engine API: `resolveDesignHints` and `SlideComposition.design` report the document's words; the new `itemAlignment()` gives the engine's alignment for one; composed header and footer parts carry `zone: 'start' | 'center' | 'end'`; `captionSettings().align` is the document's word. Typed legacy PPTX provenance adapts the earlier vocabulary: PowerPoint keeps the OPF tags of such a file through edits and saves, so the importer reads the old words in them (zones, regions, alignments, edges and paths) and returns the document in the new ones. The editor's pickers, region layouts and source completions use the new words.

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
