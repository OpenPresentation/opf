---
type: fixed
packages: [render]
---
`toPng` no longer fails on some slides with Devanagari and other complex-script text when the deck is drawn without a fonts handle (`toPng(deck)`, the documented default). A list item, or a paragraph that mixes the script with Latin words, was drawn as a span that carries `xml:space`; the cluster pinning that keeps such text shaped then wrote the attribute a second time on the piece it emitted, the SVG was no longer XML, and the conversion ended with `png-render-failed` ("attribute 'space' is already defined"). The piece now writes the attribute once. The released 0.34.2 fails the same way. Decks converted with `opf convert` were not affected.
