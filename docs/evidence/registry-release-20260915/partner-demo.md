# Five-minute partner demo

Use the published sites; no account or API key is needed for these browser workflows.

1. Open [openpresentation.org](https://www.openpresentation.org/). In the left JSON panel, change the first slide's title. The preview on the right follows the edit. Invalid intermediate JSON stays in the editor while the last valid slide remains visible.
2. Click the `layout` field. Show the current layout, compatible placeholder groups, search and all available choices. Choose `text-1x`, then undo. Catalog choices come from document, host and standard context; remote catalog URLs are not fetched automatically.
3. Edit the title or text directly in the slide preview. Show the corresponding JSON change, then undo. Existing styling and source formatting remain intact.
4. Open [the playground](https://www.openpresentation.org/playground), load **Full feature tour**, and edit a table cell in the preview. Show validation feedback and JSON source updates. Use **Broken deck (see errors)** to demonstrate actionable validation, then return to a valid example.
5. Open [pptx.gallery's editor](https://www.pptx.gallery/opf-editor/index.html) or [pptx.dev's inspector](https://www.pptx.dev/inspector). Preview a deck, make an edit, export an editable PowerPoint file, reimport it, and undo the import. The tests cover these browser flows offline after loading.

The release includes core/CLI lint, a reusable JSON code editor with contextual choices, shared preview/export geometry and 33 verified bundled font faces. Prepared HarfBuzz shaping, variable-font matching, shared furniture, selectable/vector PDF and unresolved native Office/font compatibility remain separate roadmap items. Browser and ZIP/XML acceptance does not promise a lossless round trip for arbitrary PowerPoint files.
