---
type: changed
packages: [mcp, render]
---
The OPF viewer (`show_deck`) is redrawn to the openpresentation.org design system:
    - In a client that sends the standard MCP Apps style variables, surfaces, text, borders and fonts follow the client (light and dark); the accent and status colors stay OPF colors.
    - A 48px bar (Undo, Redo, view switch, Design, Find, full screen, Send; Send is filled only while there are unsent edits) and a 28px status footer (the verdict, which opens the Review panel when there are issues; the slide navigator; where the edits are; the version). Inline, the view is as tall as the slide needs; below 860px, Both stacks the slide over the source. The thumbnail strip keeps the open slide in view, and a slide-shaped placeholder shows until the deck is drawn.
    - Undo stops at the deck as opened. The source pane Copy works without the clipboard permission; Download and the editor Export menu (PowerPoint, PDF, SVG and PNG slides, OPF source, made on the user machine) show only where the client saves files (`ui/download-file`). The viewer page grows from about 8.5 to 10 MB (2.8 MB compressed).
    - `@openpresentation/opf-render/export-browser`: `toPng` and `toPdf` take `svgSource: "data"`, which hands the SVG to the browser as a `data:` URL for a page whose Content-Security-Policy allows no `blob:` image; a `blob:` URL that does not load is retried as `data:`.
    - `show_deck` asks the model to leave `view` and `slide` out unless the user asked for the source or one slide.
