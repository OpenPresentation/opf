# RR-93a evidence: tag alignment and rich numeric cells

`deck.opf.json` is the repro. Rendered with the workspace CLI (`opf convert deck.opf.json "s{n}.png"`), with
`@openpresentation/opf` redirected to the workspace core. `before-*` is `main` at `c9677634` (the before deck drops
`style.bold` from the 987 cell, which `main` does not accept); `after-*` is this branch.

- Slide 1 (`metrics` layout, `tag`): the tag was centred over a left-aligned title; it now follows the title.
- Slide 2 (table): rich cells in the numeric Revenue column were left-aligned and the column header too; the
  numeric column now keeps its right alignment, and `style.bold` bolds 987 while keeping its `#,##0` format.
