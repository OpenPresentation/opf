# Estimated rich text spacing

Without an explicit measurement provider, SVG now paints adjacent formatted runs in one text element per estimated line. Natural SVG advances replace guessed fragment positions. Explicit providers and accepted placement retain their absolute origins. Authored text, whitespace, line breaks, run offsets, links, colors, script shifts and edit paths are preserved. The editor must support traced `tspan` elements as well as separate `text` elements.

The immutable renderer predecessor is `44ff76fe19ae9de80d2aaa962aa7e43fabce02bc`. The same 126-deck source digest contains 805 slides. All 188 changed slides were inspected in the 24 paired sheets; six representative pairs were also inspected at full size. The remaining 617 hashes match. A later explicit normal-style correction leaves all reviewed sheet and full-size pixels unchanged. The separate `test/golden/opf-examples-png.rich-flow.sha256.json` checkpoint preserves older baselines.

`../rich-flow-before` retains actual offline Chromium evidence: the two gallery specimens previously had maximum run gaps of 105.890686 and 18.801758 pixels. `../rich-flow-node24` records corrected gaps of 0.000122 and 0 pixels with measured-provider controls unchanged. `../rich-flow-cases-node20` and `../rich-flow-cases-node24` record 30 browser cases across both modes, three alignments, repeated/edge whitespace, blank lines/CRLF, links/decorations, script shifts and an italic-first/normal-following control. That last control exposed inherited italics during development; explicit normal style fixes it without changing measured markup.

This accepts the spacing change, not general slide quality. Existing sparse cards, small/narrow lists, table whitespace, low contrast text, a missing nested-list marker glyph and estimated wrapping remain visible. No content or font-size changes conceal those issues. Browser shaping, raster behavior, exact font coverage and native PowerPoint fidelity remain distinct checks.

Reproduce with coordinated source dependencies and supported Node 20 or 24:

```sh
npm run build
npm run test:rich-flow-browser
npm run test:rich-spacing-browser
npm test
```

To rebuild review sheets, extract the predecessor's `dist` and `test/golden.mjs` with `git archive` into `artifacts/rich-flow-before-runtime`, then run its golden generator with `OPF_GOLDEN_OUT=artifacts/rich-flow-golden-before` and `--update`. Generate the current candidate with `node test/golden.mjs --update`, then run `node test/rich-flow-review-sheets.mjs`. Candidate generation does not promote a baseline. `report.json` binds the source digest and all paired image hashes.
