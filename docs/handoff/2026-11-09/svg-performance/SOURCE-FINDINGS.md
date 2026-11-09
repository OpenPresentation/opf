# Read-only source findings at runtime58e

- toSvg(deck,n) composes only selected slides, but default calls perform whole-document format validation and variable resolution. Batch rendering validates once. The measured selected-default and selected-once cases keep equivalent standalone output.
- createDeckStore caches each slide/page and validates its first render. Its invalidate operation clears SVG/continuation caches but retains its validation flag; edits must use the actual update contract or explicitly validate a new document.
- Thumbnail cache keys include slide JSON, index, deck length and shared context. Metadata and sections affect context. Every supplied slide prints deck.slideCount, so16-to36 legitimately changes the original footers.
- Reused font handles bound per-face measurement entries to512, font subsets to256, and script-analysis profiles. Standalone SVG embeds used subsets; browser/shared-font output is a different storage scenario.
- font-registry.metrics resolves automatic BiDi direction and OpenType language before its measurement-cache lookup. A candidate is to defer pure analysis to a miss/outline upgrade, with an unambiguous automatic-direction key. Keep full shaping and face/size-adjust selection. Auto/explicit cache duplication may affect eviction and must be measured.
- The supplied deck has no image/src assets. Do not attribute its size or CPU cost to duplicated images.
