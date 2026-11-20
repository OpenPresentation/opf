---
type: fixed
packages: [render, cli]
---
The vector PDF export's `pdf-font-embedded` note has a message, as every other PDF note has: it names the face, whether it was embedded as a subset of the glyphs the PDF draws or whole (its fsType forbids subsetting), its size in bytes, and the preview-and-print restriction when the font sets one. A report built from the notes, such as `opf convert deck.pdf`, showed `pdf/pdf-font-embedded` with an empty message.
