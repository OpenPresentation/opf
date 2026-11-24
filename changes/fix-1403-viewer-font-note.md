---
type: fixed
packages: [pptx, mcp, opf]
---
The MCP viewer's PowerPoint export now lists the fonts a viewer's PowerPoint may not have (Roboto, Aptos and the like) among its export notes, as `opf convert` reports them in `pptx/typeface-not-office-safe` (opf#1403). The export still succeeds; the note is information. `@openpresentation/opf-pptx` exports `typefacesNotOfficeSafeMessage(families)`, the sentence of that finding, and the command line and the viewer both use it.
