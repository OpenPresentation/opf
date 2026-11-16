---
type: added
packages: [opf, gallery, mcp, editor]
---
The Lucide icon set records its former icon names (`renamed`, from the aliases `lucide-static` ships: 293 of them, about 10 KB), read from the set index the lazy loader already fetches. `opf/icon-unknown` for an old name such as `lucide:triangle-alert` or `lucide:alert-triangle` now says the icon was renamed and to write `lucide:triangle-exclamation-point`, suggests it first and offers the replace fix, without loading any icon or keywords. An old name still does not draw (OPF has one name for each icon). `search_icons` (MCP) and the editor icon search find a renamed icon by its former name. Tabler ships no rename list.
