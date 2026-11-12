---
type: changed
packages: [mcp, render]
---

The OPF viewer (`show_deck`) is redrawn to the openpresentation.org design system, the playground's bar and status footer, in one palette:

    - The viewer's own chrome and the editor's parts read the same `--opf-ui-*` tokens. In a client that sends the standard MCP Apps style variables, the surfaces, text, borders and fonts follow the client (light and dark); the accent and status colors stay OPF's.
    - The bar is one 48px row down to a 640px frame: Undo and Redo as icon buttons, a view switch with the accent rule under the selected view, Design, Find, full screen and Send. Send is filled only while there are edits that have not been sent, and is off until the first edit; outside Claude it reads "Send to the assistant".
    - A 28px status footer: the verdict (`Valid OPF`, or the issue count, which opens the Review panel), the slide navigator (previous, `01 / 16`, next; it no longer takes a third of the thumbnail row), where the edits are (`Edits not shared yet`, `Claude has your edits`, `Sent to Claude`) and the version.
    - Inline, the view is as tall as the deck's slide needs instead of a fixed 600px. In a frame narrower than 860px, Both stacks the slide over the source.
    - The thumbnail strip keeps the open slide in view (a scrolling wrapper used to defeat the strip's own scrolling) and is more compact.
    - Undo stops at the deck as it was opened (a YAML or Markdown deck could be undone to an empty one). The source pane's Copy works without the clipboard permission, and its Download shows only where the client saves files (`ui/download-file`).
    - Export: the editor's Export menu in the bar, in a client that saves files for the viewer (`ui/download-file`). PowerPoint (editable), PDF, SVG and PNG slides and the OPF source are made in the viewer, on the user's machine, and handed to the client. The viewer page grows from about 8.5 MB to 10 MB (2.8 MB compressed).
    - Until the deck is drawn, a slide-shaped placeholder holds its place; a deck that cannot open says so there. The slide has the same 16px on every side.
    - `@openpresentation/opf-render/export-browser`: `toPng` and `toPdf` take `svgSource: "data"`, which hands the SVG to the browser's image decoder as a `data:` URL instead of a `blob:` URL, for a page whose Content-Security-Policy allows no `blob:` image (an MCP App's sandbox). A `blob:` URL that does not load is retried as `data:`.
    - `show_deck` asks the model to leave `view` and `slide` out unless the user asked for the source or one slide.
