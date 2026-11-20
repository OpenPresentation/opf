---
type: fixed
packages: [render]
---
`toPng` and the raster PDF no longer fail on some slides with Devanagari, Thai and other complex-script text when the deck is drawn without a fonts handle (`toPng(deck)`, the documented default). A list item, or a paragraph that mixes the script with Latin words, was drawn as a span that carries `xml:space`; the cluster pinning that keeps such text shaped then wrote the attribute a second time on the piece it emitted, the SVG was no longer XML, and the conversion ended with `png-render-failed` ("attribute 'space' is already defined"). The piece now writes the attribute once. Decks converted with `opf convert` or with `loadFonts()` were not affected.
