# Offline gallery artwork and bounded image fallbacks

Unpublished source milestone on `codex/shared-metric-integration-20260910`:

| Repository | Source checkpoint |
| --- | --- |
| OpenPresentation/opf | `6cf9d138383846e14770bc6a5289f17fb0f5beb0` |
| OpenPresentation/opf-render | `5257b906fe3fd28ea19a4367474f9c594712a270` |
| OpenPresentation/opf-pptx | `7ed519de3daadb49123baf574bab89fd817d411a` — unchanged |
| OpenPresentation/opf-editor | `b30c25c5af426590857f1a84c54b775056fee5ca` — unchanged |

The [summary](summary.json) lists every artifact's exact SHA-256 and byte count. All packages and public deployments remain at the previously verified published set. These are Windows linked-source checks, not clean candidate installations or fresh registry evidence. No golden baseline is promoted.

## What changed

Eighty gallery decks now contain original, MIT-licensed abstract brand marks, icons, cover illustrations and watermarks as embedded PNG data URIs. The build-time generator uses Node built-ins without fonts, external artwork or network requests. It creates fictional demonstration artwork, not photographs or third-party logos.

The source guard compares all 100 gallery decks against core `48d2b328fdeb36e52dbf5cc1c8e765a54d2e5066`. Exactly 400 asset source/type/provenance records change. Original text and alt descriptions, values, metadata, geometry, colors and authored opacity remain intact. The 240 remaining photo/video/data resource references are inventoried in the artwork reports; they are not resolved or silently replaced. Not every asset registry entry appears on a slide.

SVG unresolved images now emit a path-specific `unresolved-asset` diagnostic with a reason and full description. A status label is shown only when it fits above the readability floor; smaller regions show an icon with the full accessible description. Strict asset mode rejects these sources. Caller metadata survives asset alias chains. Both Node and browser entrypoint declarations expose the diagnostic union.

Visual review exposed header icons being cropped into bars by content-picture crop mode. Header/footer images and watermarks now fit their entire artwork within their regions. Content picture crop mode and explicit background fit remain separate. This is SVG behavior; it does not certify corresponding native regions.

## Checks and observations

- Both Node 20.20.2 and 24.20.0 pass 470 core tests and preservation/typecheck/lint/example checks. Core check reports retain the ancillary runtime snapshot taken before the final SVG fit correction; the core runtime itself matches this checkpoint.
- Both runtimes pass renderer syntax/package checks, missing-image guards, code/metric checks and checks after the golden gate. **The full renderer command exits 1** at the changed-corpus gate. It is not a passing full suite.
- Full PPTX, code/metric and six actual browser suites pass on both runtimes with the final renderer. The existing corpus structural test still explicitly substitutes images; it is not source-image evidence.
- Separate artwork checks independently decode all 400 new PNGs with Sharp. Exact repeat-generation bytes match across Node versions for all six palettes and both watermark modes.
- Separate real Edge tests decode all 400 actual source images offline, verify their descriptions, export their exact PNG bytes in PPTX, and reimport them on the same isolated slide. No image resolver or substitute is used. The entire reports agree across runtimes after excluding the Node version.
- Six additional actual browser fixtures per runtime cover wide, portrait and tiny light/dark slides. All 18 status labels/icons remain within their panels at the recorded 0.1 reference-pixel tolerance, with exact bundled font bytes, full descriptions queryable by image role, the selected font floor and original watermark opacity. This does not test screen-reader speech or final faded-decoration contrast.

The offline Edge 152.0.4191.66 text-rectangle audit covers 100 decks and 720 slides. Text runs change from 11,691 to 10,276. Findings change from 942 to 28: the removed 914 are missing watermark (610), header (224) and background (80) labels replaced by real artwork. The 28 remaining non-placeholder finding identities are exactly retained. This change of text population is not a claim that faint decorative text became readable or that arbitrary content meets WCAG. See [before](contrast-before.json) and [current](contrast-current.json) reports for conservative sampling, font and opacity limitations.

## Raster review

All 805 historical images and both sets of 805 current images were hash-verified: 2,415 checks. Current manifests match across runtimes. The [review](raster-review.json) records 642 changed rasters and the current source digest `3a1ed8ad00b30863b5852197a85602263a2238c613020fb891d933f86e124c4b`.

All 17 final overview sheets and six full-size rasters were inspected. Header icons are complete, decorative opacity is retained, covers render offline, and still-missing photos have explicit readable status labels. The full-size selection includes wide/portrait covers, a dark theme, background artwork and two unresolved photos. Sparse layout, mixed alignment and density, unresolved chart data and unfinished media remain visible quality limitations. Overview inspection cannot establish glyph-level readability; detailed corpus acceptance remains open.

`rasters/current/` preserves all 805 current PNGs and a browsable index. `rasters/before/` preserves the 642 changed historical PNGs. For a complete historical directory, use current bytes for the other 163 unchanged entries and the historical candidate manifest. No artifacts from another computer are required to reconstruct the two review sets.

## Reproduction and open gates

Fetch the four GitHub source checkpoints into sibling directories named `opf`, `opf-render`, `opf-pptx` and `opf-editor`, install the locked dependencies, build core and link the source packages using its documented ecosystem workflow. Use the recorded Node versions, npm 11.16.0 and pnpm 10.33.2. Run the following from the core checkout, with separate output paths:

```sh
node scripts/test-gallery-artwork.mjs ../reports/artwork.json
node scripts/test-gallery-images.mjs ../reports/gallery-images.json
node scripts/audit-svg-contrast.mjs ../reports/contrast.json
node scripts/review-gallery-artwork.mjs <historical-golden> <current-node24-golden> <current-node20-golden> ../reports/review
```

From the renderer, run `npm test` and `node test/image-placeholders-browser.mjs ../reports/browser.json`. The copied `run-image-checks.mjs` can be placed in the sibling repositories' parent directory to reproduce the recorded command matrix; it creates a new candidate, never promotes one. The contrast audit and full renderer command deliberately retain nonzero results while their findings/gate are unresolved.

No new native PowerPoint application test passed here. The preceding chart fixture failed before opening because COM rejected the connection with `RPC_E_CALL_REJECTED`. Earlier native table/metric evidence remains historical; no Office application or user presentation was closed during this milestone. Exact PNG embedding/reimport does not prove native appearance, complete region support, editability or browser/native raster equivalence.

Next investigate the 28 remaining rectangle findings and the existing native metric tab/portrait ink failures, complete the missing resource/native-region work, resume native chart edit/save/reopen/reimport, and finish detailed corpus acceptance plus coordinated candidate CI/PR review. Release preparation, immutable released refs, fresh registry checks and public deployments follow those gates. The larger shared-layout, deterministic repair/Auto arrange and open-font objective remains active.

The recorded GitHub audit found zero open PRs and zero open Dependabot security alerts across all seven repositories at its timestamp; deferred major-version issues remain deferred. Security alerts were not disabled.
