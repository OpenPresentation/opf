---
type: changed
---
RR-90 (adopts core RR-90, RR-91 and RR-93a, opf#717; test and baseline changes only, no renderer code): the tests that encoded the old core geometry now expect the new one. The tag follows `titleAlignment` (`item-alignment`, `design-preview`), header and footer zones sit on the content inset (`design-fields`), and a styled table's text is drawn at the 25 px body size (the `table-styled` digest of `chart-table-data`). The template goldens select a new baseline, `layout-templates-rr90-first-use-layout.json`, whenever core draws table text at the body size; the 40 changed slides are all table slides (`table`, `table-beside` and their paginated pages). The ordinary example baseline follows core's fixture (`golden-override`), which core regenerates.
