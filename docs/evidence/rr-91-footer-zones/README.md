# RR-91 evidence: footer zones

`deck-lone.opf.json` (a `left` source footer only) and `deck-both.opf.json` (the same `left` footer plus a
`{{slide.number}} / {{deck.slideCount}}` `right` zone), slide 2 of each, rendered with the workspace CLI
(`opf convert deck.opf.json "s{n}.png"`, `@openpresentation/opf` redirected to the workspace core). `before-*` is `main`
at `c9677634`; `after-*` is this branch.

- Lone `left`: was a 332 px box inset at x = 91 that wrapped the source onto four lines upward; now it starts at the
  content inset (x = 58, the title's edge), spans the content width and takes two lines.
- `left` + `right`: the left zone takes the free centre; the number ends on the right content edge (x = 1222, was 1190).
