---
type: changed
packages: [opf]
---
LH-69 (output-changing for slides with promoted regions): a promoted region (a slide key such as `top:left`) whose one block is a plain text of at most four words that is no sentence now draws as a tile, as Claude Design draws "Product", "Engineering" and "Operations" over a list: a card in the theme's card surface filling the region, the text bold at its foot at the start edge, every tile of the slide at one size (up to 56 px, at most three lines, words whole). No icon is drawn for a text that has none. The blocks beside the tiles grow with LH-48 as they would without them, and the tiles (the new guarded rule `placed-tiles`) are kept only when no block reads smaller than on the settled slide without them, at its exact size. A short sentence keeps its bold heading. Five of 1,040 corpus slides change, none smaller and none with a new finding.
