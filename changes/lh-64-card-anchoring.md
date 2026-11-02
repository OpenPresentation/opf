---
type: changed
packages: [opf, gallery]
drawing: ["layouts:pillars", "layouts:two-column", "layouts:three-column"]
---
LH-64 and LH-04, content cards in template regions: a row of cards (a grid row of one region, or the lone blocks of regions side by side) no longer always fills its cell. In a `middle` or `bottom` region, a row of body text only (paragraphs and plain lists; a picture, metric or labeled list item keeps the foot anchor of LH-22) hugs its tallest text with one card height and centers in the region when that text fills under 45% of a filled card, and starts every text at the card's top when the texts are longer and more than 1.5x apart in height. In a `top` region, cards of measured blocks hug the tallest of their row, so an auto row of cards (the implicit row of extra blocks) is no longer trimmed by the half-gap card offset and its text keeps the starting size. Pillars, two-column and three-column slides of short text draw a centered row of hugging cards instead of tall cards with the text at their foot; comparison stays without cards, since its dense options would fall under 20 px on cards.
