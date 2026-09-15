# Work and publication checkpoint — September 14, 2026

The user requested focused commits, pushed branches and maintained PRs as work
progresses. Commit each coherent implementation or evidence milestone, push it
promptly, and update its existing PR. Preserve incomplete work in a clearly
documented draft with its failing checks; merge and publish only after its
acceptance requirements pass. Do not accumulate an unrecorded working tree
while moving on to another feature.

## Merged and deployed

- Website: [PR29](https://github.com/Data-Advantage/openpresentation-site/pull/29)
  adds editable homepage JSON;
  [PR30](https://github.com/Data-Advantage/openpresentation-site/pull/30)
  adds JSON/preview editing in both directions on `/` and `/playground`;
  [PR32](https://github.com/Data-Advantage/openpresentation-site/pull/32)
  adds contextual catalog dropdowns; and
  [PR33](https://github.com/Data-Advantage/openpresentation-site/pull/33)
  adds code-editor behavior. All are merged. Local `main` and remote `main`
  match at `8d8fc5ec30b3c61f7602b8ec6d5928981bc07efc`; its Vercel deployment
  status was freshly verified successful.
- Partner demo: [core PR80](https://github.com/OpenPresentation/opf/pull/80)
  is merged at `19e1a7f41ae4e687cdf347e4350109394d81eb5a`, with the demo and
  offline fallback preserved. The 12 untracked local demo copies on the
  furniture branch match `origin/main` byte for byte; they are not unpublished
  work and are retained without duplication.

## Pushed draft work

- [Core PR79](https://github.com/OpenPresentation/opf/pull/79): measured shared
  headers/footers, layout, pagination, source preservation and evidence.
- [Renderer PR20](https://github.com/OpenPresentation/opf-render/pull/20):
  rendering from shared accepted furniture geometry.
- [Editor PR17](https://github.com/OpenPresentation/opf-editor/pull/17):
  source-aware furniture editing and undo.
- [PPTX PR34](https://github.com/OpenPresentation/opf-pptx/pull/34): furniture
  provenance and export, including corrected slide-master declarations.
- [Renderer PR21](https://github.com/OpenPresentation/opf-render/pull/21),
  stacked on PR20: prepared source-preserving shaping, compressed-font and
  collection handling, DFont extraction, and fixed variable instances.

Fresh GitHub inspection confirms successful checks on core PR79 at `eee3060`,
renderer PR20 at `3d4fa8c`, editor PR17 at `40023fb` and PPTX PR34 at `1363a65`.
Renderer PR21's completed `a5f3ec6` CI passes Mac/Windows shaping and all earlier
Linux checks, including the 805-slide regression and coordinated packages.
Both Linux source and fresh installed variable browser gates then fail the
unchanged 0.1px advance tolerance. The complete reports remain preserved; pixel
comparisons match within each platform. Passing diagnostics do not establish
native font fidelity.

Renderer `1b17e70` separates browser versions and kerning settings in the native
diagnostic. The later implementation commit `489273e` corrects fixed-point
coordinate normalization, axis endpoint defaults and exact tags; evidence
commit `e293b55` preserves its independent reference, source and installed
results. Both commits are pushed. All 188 FreeType instance coordinates,
143,207 CFF2 glyph diagnostics and the unchanged 805-slide regression pass.
Fresh packages verify 37 shipped hashes and TypeScript consumers. The September
15 follow-up `1b3da21` corrects CFF2 advances before positioning; `41311de` adds
reviewed glyph-paint diagnostics and complete retained evidence. Both are
pushed. All 356 default Fontkit Mac browser cases now pass; five optional
HarfBuzz TrueType width comparisons still fail.

The pushed renderer checkpoint `74f0b8b` adds a reproducible native portability
report with source-identity and sample-coverage guards. Completed `41311de` CI
passes Mac/Windows shaping diagnostics and earlier Linux acceptance, then
fails both Linux variable-font gates on five Fontkit TrueType cases. All Linux
CFF2 and prepared HarfBuzz cases pass. Three-platform glyph diagnostics support
sampled instance selection, but the native advance comparison proves some
platform widths cannot share one prediction within the precision target.
The complete failures, raw reports, primary-source hashes and reviewed images
are retained. The next paint experiment must use accepted per-glyph positions
without losing logical text or editing/export semantics. No runtime policy,
tolerance, publication or production-site behavior changed. See
[font-shaping.md](font-shaping.md) for exact evidence and remaining font/native
acceptance requirements.

Implementation fixes, test/evidence improvements and integration documentation
are recorded as separate focused commits. All 22 local branch tips across the
seven repositories were compared directly with GitHub with no unpushed commits;
the subsequent renderer checkpoint was also pushed. The only retained untracked
files are the 12 demo copies already merged into core `origin/main`.

## September 15 commit and PR audit

All 22 local branch tips across seven repositories were compared directly with
GitHub again, with no unpushed commits. Website PR29/30/32/33 are merged and the
Vercel deployment for `8d8fc5e` is successful. The 12 local demo files still
match merged core `origin/main` byte for byte. Gallery and pptx.dev have clean
working trees and unchanged default branches.

The pending renderer work is now recorded in two focused, pushed commits:

- `e46a850`: prepared SVG glyph painting, retained logical text, public types,
  Node controls and API documentation.
- `e6bc0c1`: a separate browser acceptance command and complete retained
  evidence, including its failure. Renderer PR21 remains a draft.

The local Node suite passes, including 650 supported runs, 13 explicit
coverage rejections and the unchanged 805-slide regression. The browser
experiment keeps source text, glyph IDs and exact advances in all 650
supported cases. Five full-slide controls preserve selection and native-font
independence of visible ink. However, 54 cases differ from an independent
Canvas pixel reference (maximum alpha difference 4/255 against a zero
requirement). Caret geometry, editing/undo, fresh installed painting and native
export remain unaccepted. The new browser command is not yet in the installed
or CI matrices. [Complete renderer evidence](https://github.com/OpenPresentation/opf-render/tree/e6bc0c19cf1177c1f5ac1d0f24dc2592b772f11f/docs/evidence/shaped-paint-draft-20260915)
preserves these limits and the original observations.

Completed renderer CI at `74f0b8b` passes Mac/Windows shaping jobs and fails
the Linux source and fresh installed variable-font gates. The new renderer
commits have separate pending CI; they do not convert those prior failures
into acceptance. Core PR79, renderer PR20, editor PR17 and PPTX PR34 have
successful checks at the audited heads, with their separate native/release
requirements still open. No package release or site adoption of these drafts
occurred during this audit.

## Composed painting follow-up

Two more focused renderer commits are pushed to PR21: `75a20ab` composes glyph
transforms before rasterization, and `dcd77ea` adds fresh-package/CI checks and
retained evidence. Source and fresh installed painting now match all RGBA
channels exactly in 650 supported cases, with 13 explicit coverage rejections.
Five reviewed slide PNGs match between source and installed packages; the
public TypeScript interfaces and all 37 shipped-file hashes pass.

The complete installed command remains nonzero at the separate native
variable-font gate. Three source-editor probes preserve live edits and undo,
but broader caret/selection, IME, bidi and installed editor acceptance remain
open. The new three-platform CI is pending at its own head. Core checks at
`3a78463` completed successfully. No draft was merged or published.

[Composed painting evidence](https://github.com/OpenPresentation/opf-render/tree/dcd77ea88313aaf43c1f5da11ac7347d7001d9c1/docs/evidence/composed-glyph-paint-20260915)
retains the precision probe, old sequential-transform differences, corrected
type-fixture failure, final native failure and complete source/installed
reports. The next steps are recorded in the font-shaping plan.

## Rich input browser and installed follow-up

Editor [PR18](https://github.com/OpenPresentation/opf-editor/pull/18) is now pushed
in two focused commits: `90e57c3` fixes source corruption caused by native
textarea line-ending normalization, and `b6e0fe9` adds actual browser and
installed-package regression coverage. Both the Node and browser tests fail
against the pre-fix editor and pass against the fix. The new browser checks
preserve original mixed endings, runs, links, source offsets, live draft
isolation, pointer selection, formatting, undo, metadata and simulated
composition. Ten workflows pass in all three rendering modes from checkout
and fresh candidate installations; 79 installed runtime files match their
staged packages. Existing coordinated package tests and all eight installed
browser suites also pass. Detailed evidence is linked from
[the new checkpoint](../evidence/rich-input-and-platform-ci-20260915/README.md).

The follow-up browser commit passed CI run `34950054828`, including all
three new browser commands. PR18 merged into main at `7b5d75f`; furniture
continuation `8e184ee` incorporates it and passes source/syntax checks plus ten
measured browser workflows. Core coordinated CI pins that commit and adds
the installed rich-input fixture; those new CI runs remain pending. The standalone
registry-predecessor layout failure remains separate from coordinated
candidate acceptance. No new package was published.

Renderer `dcd77ea` CI completed: Mac/Windows shaping jobs pass, while Linux
fails the native variable-font source and fresh-installed metric checks.
The failure is retained, with exact measurements, in the checkpoint above.
All three platform painting reports pass 650 supported cases with zero RGBA
differences and thirteen explicit coverage rejections; the five slide hashes
match each other and the previously reviewed images. Linux native Fontkit has
five metric failures (maximum 0.134625px), while native HarfBuzz passes there;
the earlier Mac report has the opposite backend outcome. Prepared painting
does not replace the native metric requirement.

## Still outstanding

The website JSON control has not yet been extracted into the reusable
`opf-editor` package. OPF has strict document validation and composition
diagnostics, but no unified agent-facing `opf lint` contract/repair command.
The shared furniture and font drafts have not been published as new package
versions or adopted by the production sites. Native Office compatibility
remains a separate gate under its existing recovery constraints.

`pptx-gallery` and `pptx-dev` had no local changes and matched their remote
default branches (`main` and `master` respectively). Every existing local
branch tip in the seven repositories was compared directly with GitHub before
the new checkpoint commits, with no unpushed commits found.
