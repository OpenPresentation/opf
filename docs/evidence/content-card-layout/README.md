# Shared content cards and contrast regression

This is an **unpublished linked-source milestone** on `codex/shared-metric-integration-20260910`.

| Repository | Source checkpoint |
| --- | --- |
| OpenPresentation/opf | `cc3c8131a14d7945c28e89f2819e4beeaa89cd51` |
| OpenPresentation/opf-render | `053edb1797fd367ae401885fc1d2a8667f212e2d` |
| OpenPresentation/opf-pptx | `b9885ab6601c1bdecc7e3b5547baa33a2a467735` |
| OpenPresentation/opf-editor | `125782eb537a3a37f61dfba661f66cb9658a33f4` |

[The summary](summary.json) binds 730 artifacts to their SHA-256 and byte counts. Published versions, release refs, public deployments and the approved golden baseline remain unchanged. This evidence does not establish clean candidate installation or registry behavior.

## Behavior

Card borders previously occupied the accepted payload bounds. Core now keeps the visible allocation in `item.frameBox` and measures `item.box` inside it, using 12 reference pixels of padding at a 720-pixel canvas short edge, capped at one quarter of either frame dimension. The rounded interior participates in candidate scoring (`grid-score-v5`), final measurement, strict overflow and pagination. Headings stay unframed. Explicit outer regions and track weights remain authoritative; automatic candidates may change. No authored gallery source or readability floor changed.

Renderer and editor resolve the same design flag, including a slide's explicit `false` override. SVG uses the shared outer frame and inner payload geometry. PPTX exports editable rounded frames, with package checks for bounds, corner radius, color and alpha.

Reimport initially created unwanted “PowerPoint shape” text for these new frames. Native tags now identify unchanged, empty generated cards and report `content-card-reflow`. Their frame styling and placement are not reconstructed. Names alone do not hide shapes. Changed text, alt metadata, geometry, fill or missing tags take the ordinary native import path; this preserves text or an unsupported-shape description, not arbitrary frame appearance or metadata. Preserve the original PPTX for those details.

## Checks

- Node 20.20.2 and 24.20.0 each pass 473 core tests plus typecheck, lint and example validation. Focused tests cover padding during strict overflow, nested/explicit geometry, source-preserving pagination and public declarations.
- Both runtimes pass the full PPTX and editor commands, code/metric checks and the PPTX browser harness. Native package fixtures cover eight wide/portrait/card/alpha combinations, local false overrides, and five edited/untagged-frame guards.
- **Both full renderer commands exit 1 at the unapproved corpus gate.** Checks after that gate were executed separately and pass; these are not passing full renderer runs.
- Five additional actual offline browser suites per runtime cover code rendering/editing, bounded image fallbacks, ordinary metrics and card-enabled metrics. The six card workflows cover wide/portrait layouts, all alignments, field edits, undo/redo, pagination, export, reimport and undo of import. Eight scalar/blank cases and two invalid edits remain unframed controls. Runtime and browser bundle hashes are recorded.

Core package-check reports include an ancillary consumer snapshot; only their core runtime is asserted current. Renderer reports assert core and renderer runtime. PPTX and editor reports assert the linked libraries; final browser reports additionally fingerprint editor runtime. The report files preserve their original scope and bytes.

## Contrast evidence

The original [28 rectangle findings](../gallery-artwork-images/contrast-current.json) remain intact. Independent glyph masks refine them to **23 passes and five failures** on both runtimes: three bullet markers in the identity-incident brief and two metric trend labels in the kiosk and water-utility decks. The original rectangle-minimum pixel itself was outside the glyph in every case, but five glyphs touched the same border elsewhere. A rectangle false positive must not be treated as a whole-glyph pass.

The final targeted glyph regression checks **all five actual prior glyph failures** against unchanged source bytes. All pass: bullet contrast is 10.3547 and both trend labels are 17.0629, against a 4.5 threshold. The other 23 original rectangle findings are not individually remapped after reflow; the separate complete current audit checks the resulting gallery.

Both final [Node 20](contrast-node20.json) and [Node 24](contrast-node24.json) rectangle audits cover 100 decks, 720 slides and 10,313 text runs, with **zero findings**. Reports match after removing the Node version. This is conservative color sampling in the recorded Windows Edge environment, not a universal accessibility certification. Text-run counts differ from the previous 10,276 because wrapping changes.

Glyph masks use the union of white-on-black and black-on-white support, retaining completely invisible text and antialiased edges. One passing control and two intentionally failing invisible controls accompany each run. Every changed visible pixel inside the DOM text bounds plus a one-pixel guard must belong to the independent masks. Redraw differences outside both the text geometry and its masks are recorded separately. Raw full/background/isolated/both-mask screenshots are preserved for every baseline and final case.

Font hashes describe the installed bundled Roboto faces, not every glyph's font file. Other requested families may use host-installed fonts or fallback. These probes do not certify shaping, glyph coverage, font substitution or equivalence with another browser/OS/native rasterizer. The corpus uses the renderer's current default measurement behavior; the separate editor workflows supply the recorded font measurement provider.

## Visual review and open gates

All 2,415 previous/current Node24/current Node20 corpus hashes verify, and the two current manifests match. The authored corpus digest remains `3a1ed8ad00b30863b5852197a85602263a2238c613020fb891d933f86e124c4b`. Exactly 213 card-enabled slides change; 592 are unchanged. All nine [before/after pair sheets](review/review.json), four full-size payload examples and three targeted actual browser slides were inspected.

The new `rasters/current/` contains the 213 changed images. All previous rasters, and unchanged current rasters, remain available in [the prior portable evidence](../gallery-artwork-images/rasters/current/). The manifest records every image hash; no old-machine file is required.

The padding improves border separation. The full-size review also preserves clear counterexamples to a “polished ecosystem” claim: some charts still say “No chart data,” rich text has awkward spacing with current default font measurement, and large cards can contain excessive whitespace. These need further layout/font/data work. No baseline is promoted by this review.

No new real PowerPoint application check passed in this milestone. The existing rejected COM connection, metric tab-position/portrait ink counterexamples, chart native edit/save/reopen gate and missing macOS evidence remain open. A read-only connected-document session inventory found no available session. No user Office process or presentation was closed.

The [fresh GitHub audit](github-audit.json) found zero open PRs and zero open Dependabot security alerts across all seven repositories. Integration PRs, coordinated clean candidates, review/release gates and eventual registry/public adoption remain unfinished.

Reproduce using adjacent GitHub checkouts at the source checkpoints. Run the recorded package/browser commands with the pinned runtimes. Archived runner scripts were executed from the parent directory containing the four checkouts; place them there before running them. The baseline glyph harness is stored as historical bytes; the current `scripts/review-contrast-glyphs.mjs` accepts the original rectangle report, a new output directory, and optionally a prior glyph report to recheck its actual failures. `scripts/review-content-cards.mjs` accepts previous/current/second-runtime corpus directories and a new review output directory. Never overwrite earlier evidence or promote the golden candidate merely to make a test pass.
