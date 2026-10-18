# RR-90 evidence: table type size

`deck.opf.json` (slides 2 and 3), rendered with the workspace CLI (`opf convert deck.opf.json "s{n}.png"`,
`@openpresentation/opf` redirected to the workspace core). `before-*` is `main` at `c9677634`; `after-*` is this branch.

- Table cells were 15 px floored to 16 px (12 pt) beside 24 pt bullets and left half the slide empty; they are now 25 px
  (18.75 pt), and a table that does not fit shrinks as a whole toward `minFontSize`.
- The chart text size is a renderer constant (`opf-render` `charts.js`) and is not part of this change.
