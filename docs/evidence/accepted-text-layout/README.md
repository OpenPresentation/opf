# Accepted text fits and measured rich-text spacing

This is an **unpublished linked-source checkpoint** on `codex/shared-metric-integration-20260910`. Renderer source is `3068c0ecd7f453c00de3cd72a7a98979e31d14d5`; core runtime is the prior card source `cc3c8131a14d7945c28e89f2819e4beeaa89cd51` (repository checkpoint `2d7a47ccbfc1b02f7784e85364ad7c048c4d07f4`). PPTX `b9885ab6601c1bdecc7e3b5547baa33a2a467735` and editor `125782eb537a3a37f61dfba661f66cb9658a33f4` are unchanged. [The summary](summary.json) records 545 artifacts and their exact hashes. No version, approved baseline, registry installation or deployment advances.

## Implementation and checks

SVG now consumes composition's accepted fit and resolved style for plain/rich text, titles, subtitles and tags. It no longer fits those payloads a second time against the final rounded box. Existing composition diagnostics remain authoritative, including strict rejection. Input documents are unchanged. This does not change core's plain-text whitespace normalization or make estimated widths font-accurate.

Node 20.20.2 and 24.20.0 each pass 24 accepted-fit cases covering wide/portrait dimensions, all alignments, cards, scalar/rich text, style resolution, exact positions and strict overflow. The regression counts measurement and style-resolution calls to reject a second pass. Both runtimes pass the full PPTX/editor commands and later renderer checks. **Both full renderer commands still exit 1 at the unapproved corpus source gate.** Logs retain that result; checks after it were run separately.

Each runtime also passes six other browser suites: the two-gallery-slide spacing comparison, shared code rendering, image placeholders, code editing, ordinary metrics and card metrics. A separate real Edge run passes all 46 existing rich-text canvas checks, including formatting, typing, draft/session undo, cancellation, concurrent edits, composition-event guards and blank-line caret placement. This harness dispatches DOM input/composition events; it does not certify native keyboard IME behavior. The code/metric suites retain their actual browser control workflows and export/reimport checks.

Package reports fingerprint the relevant linked core/renderer/PPTX runtime files; browser reports additionally fingerprint editor runtime or the exact bundle input files. These are source checks, not clean packed candidates or registry E2E.

## Exact-font spacing and paint

The controlled comparison uses the unchanged Operating Model slides from the compliance-readiness and water-utility decks. Both modes draw the same pinned Carlito regular/bold/italic/bold-italic bytes. The estimated control registers those bytes under the authored Aptos names to isolate width estimation; measured mode explicitly selects the renderer's visual substitution policy. This is not a comparison against proprietary Aptos or an assertion that every default browser uses Carlito.

| Deck | Estimated maximum run-boundary error | Measured maximum run-boundary error |
| --- | ---: | ---: |
| Compliance readiness | 105.8907 reference pixels | 0.0094 |
| Water utility | 18.8018 reference pixels | 0.0764 |

Both measured cases pass the 0.1-pixel advance/boundary gates, preserve rich source offsets, and make no external requests. Reports agree across runtimes. The two measured full-slide screenshots were inspected. The renderer README and export skill now show matching measurement and raster font inputs. SVG embedding alone does not configure Node's raster font files. The current editor playground already supplies measured fonts; that source inspection is not a fresh public deployment verification.

The broader 24-case actual Edge test passes every accepted-line, advance and origin check. It retains **four failing paint cases**: portrait/right headings, with and without cards and scalar/rich body content. The final title line paints one pixel at `(497,186)` with mask coverage `90/255`, beyond a cell ending at x=496.8. The test exits 1 and is exposed as `npm run test:text-browser -- <new-output-directory>`. No SVG-only offset, clipping or tolerance expansion hides it.

All 96 per-item white-on-black masks per runtime are preserved, including nonblank-mask guards. Pixel centers use the original 0.1-reference-pixel threshold with a 1e-9 arithmetic epsilon to avoid rejecting exactly-on-threshold floating-point sums. Font-wide DOM text rectangles are reported separately; their ascent/descent/bearings are not actual ink. Twenty fixtures pass the paint gate. Carlito is an explicit Aptos visual substitute; these observations do not establish font compatibility, arbitrary shaping/bidi support or native raster equivalence.

## Corpus review

All 2,415 previous/current-Node24/current-Node20 image hashes verify. Current manifests agree; the authored source digest remains `3a1ed8ad00b30863b5852197a85602263a2238c613020fb891d933f86e124c4b`. Exactly 102 slides change and 703 remain identical. Both before/current rasters for the changed slides are included.

The [fit review](fit-review/fit-review.json) regenerates all 102 pairs from the prior renderer Git commit and current source. Composition is identical. Only 86 title and 28 subtitle paint records change; accepted font sizes replace the second fit's often one-pixel-smaller result. Normalized words remain unchanged. All five pair sheets and four selected full-size rasters were inspected. The corpus still uses estimated measurement and default raster fallback: the full-size roadmap slide retains visibly awkward rich spacing. Sparse cards, unresolved chart/media references and chart label/semantic limitations remain. **No baseline was promoted.**

## Remaining gates and reproduction

The fresh seven-repository GitHub audit records zero open PRs and zero open Dependabot security alerts. This checkpoint has not opened integration PRs. The connected PowerPoint session inventory is empty. No new Office application verification was attempted; earlier COM rejection, metric tab/ink counterexamples and card/chart native edit/save/reopen checks remain open. No Office process or user presentation was closed.

Use adjacent GitHub checkouts at the source revisions above. The archived package/browser runners expect the parent directory containing those four repositories. `scripts/review-accepted-text.mjs` verifies the three complete corpus directories and creates comparison sheets; renderer `test/review-text-fits.mjs` retrieves the prior source from Git and reproduces its changed rasters. `scripts/run-rich-text-browser.mjs` executes the existing rich editor harness with local intercepted font fixtures. Use new output directories. All recorded artifacts were checked against their actual staged Git blobs before committing.

Next unify ink bounds and whitespace handling in shared layout, make measured-font preparation easier for ordinary callers, resolve missing chart data and chart semantics, then complete native/clean-candidate/review/release and eventual registry/public-adoption gates. Deterministic repair, Auto arrange, complete font compatibility and missing macOS evidence remain part of the full active goal.
