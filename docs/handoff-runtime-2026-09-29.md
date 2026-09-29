# September 29 runtime and release checkpoint

The delivery goal remains open, and work has resumed.
This checkpoint separates accepted source, installed-package checks, native
compatibility and publication. No package or website was released by this review.
Official npm latest metadata checked on September 29 still reports the
September 17 train: core 0.11.0, CLI/render 0.9.0, PPTX 0.9.1 and editor 0.8.0
on Node 24.x. See the [published compatibility
matrix](compatibility-matrix.md) and [earlier checkpoint](handoff-2026-09-29.md).

## Accepted portable fixes

[PPTX #82](https://github.com/OpenPresentation/opf-pptx/pull/82) preserves native
chart cache positions and trailing gaps. Missing values remain null and actual
zero and explicit empty labels remain distinct; malformed or excessive caches
reject before dense allocation. Accepted commit
`7fca9a2eb5088ee2325fb686d1ff84332af2b8d9` has the same tree as reviewed
`1c60887793067d8c830a289d8bf0e3405f9749c2` and its original tested merge.
Original [Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36546748615)
passed, as did original accepted-main [postmerge CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36548215070). Each platform ran 44 public cache controls against a fresh packed
consumer and again in the source suite. All 36 shipped files bind to reviewed
source; Windows CRLF conversion is recorded explicitly.

This fixes one import boundary. Scientific-notation parsing, exporter/workbook
missing-value behavior, category disagreement, scatter labels and broader chart
parity remain open. The renderer scale repair is still only in draft #42; the
renderer/PPTX chart pair cannot be accepted solely because #82 passed.

[PPTX #81](https://github.com/OpenPresentation/opf-pptx/pull/81), accepted as
`c749c356b4fb5a5b5dfa77db8f1f7dd3c7daef63`, also passed its original automatic
[postmerge Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36542244211).
Its valid inline-layout regression ran in source; that older packed subset did
not yet include the layout fixture. Selected installed tests are not a complete
fidelity gate.

[PPTX #83](https://github.com/OpenPresentation/opf-pptx/pull/83) preserves current
media caption characters across soft wraps and exact full-tag CR/LF boundaries.
Cleared captions use linked-text/empty-text fallback instead of inventing a URL
caption. Compatible older soft/end tags remain readable. Accepted commit
`357171a5ceb798ccd550207ec365b08a694c5d6d` has the exact reviewed and tested tree
of `08815c76ab9494cfad98e18149c003385306882b`, which integrates #82.
Original [combined Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36548912840)
passed with all nine installed fixtures, including 37 media groups, 11 layout
intent groups and 44 cache controls. Original [postmerge CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36550576333)
also passed on both platforms, with all shipped files and fixtures bound to the
accepted tree. Six bounded before/after media images were reviewed;
full-tag source fidelity, references-only semantic LF and ordinary native fallback
have distinct limits. This does not restore arbitrary native formatting/geometry
or certify desktop Office. Owner #78 merged earlier; the owner closed #80
unmerged, and its branch remains preserved.

The [compact receipts](evidence/runtime-pr-review-20260929/README.md) bind accepted
source and original outcomes. All source fixes above remain unpublished.

## Installed furniture checkpoint and wrapped-date follow-up

Core [#150](https://github.com/OpenPresentation/opf/pull/150) accepted the current
renderer/editor/PPTX checkpoint and candidate-only formatted-furniture fixture.
Core [#151](https://github.com/OpenPresentation/opf/pull/151) accepted this runtime
handoff. Their combined main at `ea32a63111c6d06be333e20fb31db22ab2d7b7a1` passed
both original [core](https://github.com/OpenPresentation/opf/actions/runs/36554712162)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36554712113)
checks. The earlier #150 ecosystem push run was cancelled after #151 landed;
its later skipped stages remain recorded as skipped, not passed.

Core [#152](https://github.com/OpenPresentation/opf/pull/152), accepted as
`de88f4e0607ef099f41c96331b1c353502ba7cec`, adds three installed-browser workflows
for wide/portrait decks and actual pagination. Six PPTX exports check the same
explicit host date and final slide total as composition and actual SVG text.
The fixture also checks title-footer hiding, exact source ranges, literal edits,
undo/redo and a date-only update that leaves document history unchanged.
Its original [core](https://github.com/OpenPresentation/opf/actions/runs/36555305435)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36555305454)
checks passed, as did accepted-main [core](https://github.com/OpenPresentation/opf/actions/runs/36556931351)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36556931527).
Both accepted-main runs bind the reviewed tree; core passed 707 tests. The three
original CI screenshots were reviewed, and the postmerge images are byte-identical.
The initial local test-parser failure is retained separately. Its correction
changed no runtime code or field/source contract.

A separate portrait `minFontSize: 32` (reference pixels) probe exposed an unedited roundtrip loss:
a current date spanning two accepted lines became static PPTX text without a
warning, then imported as a literal instead of `date: true` with its format.
[PPTX #84](https://github.com/OpenPresentation/opf-pptx/pull/84), accepted as
`f91fbf82f7407b669ae159435aa4d7925ac51832`, now diagnoses dropped native field
ranges and recovers unchanged supported wrapped-date intent through bounded full
provenance. All 41 other files and 19 directory entries in the original probe remain
byte-identical; only two furniture manifest tag files change. Current edited or cleared text wins.
Old unmarked, references-only and provenance-off exports remain conservative.
The PPTX words remain static: this does not restore native live-date refresh or
arbitrary formatting/geometry.

The repair passed 20 focused source and fresh installed controls, including the
original package comparison, plus its full portable suite. Original
[Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36556325988)
and original accepted-main [Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36557698682)
both passed 19 new source cases per platform against that workflow's recorded
older sibling graph. The accepted commit and all shipped files bind to the
reviewed tree. These passes are distinct from the current coordinated graph. The follow-up
candidate uses accepted #84 with the current renderer/editor pins, adds 19
installed wrapped-date mutation controls and expands the
[browser fixture](../scripts/test-furniture-fields-browser.mjs) to four workflows.
The [compact acceptance record](evidence/wrapped-furniture-20260929/README.md)
binds fresh local package checks, 805-slide goldens, 707 core tests and all four
passing browser workflows. The wrapped screenshot was reviewed as legible. These
local results describe the candidate before GitHub acceptance; the associated pull
request records fresh combined-head CI and review. They are not a published or
native compatibility claim.

## Release holds

The retained dependency-floor finding from the earlier PPTX #83 checkpoint remains:

Current unreleased PPTX source passes its full portable suite with accepted
core `061499d53aabefb266dd4f7f5c5bd85f6d24c425` and renderer
`6c7d7818e40d0f9c519e4b34f7a24e9150c1787f`. The retained full-suite run with
registry core 0.11.0/render 0.9.0 fails `test/furniture-fields.mjs:38`:
a requested `{current} / {total}` yields only the live slide number, without
` / 3`. Published core 0.11.0 does not expand the new format; accepted core
contains that later FF-27 implementation. This is an unreleased capability versus
dependency-floor mismatch, not evidence that published PPTX 0.9.1 fails its own
released suite.

Before publishing any package in the new contract:

1. Select the complete candidate set and compatible minimum dependency versions;
   verify fresh isolated tarball installs at those floors. Preserve the accepted
   formatted-field, provenance, source-preservation and browser controls.
2. Finish the required cross-OS CI and visual review on that exact set, plus the
   separate native field refresh/save/reopen and physical-font gates for the
   release scope. Shared host-date forwarding now has installed integration
   evidence; it is not a missing renderer implementation.
3. Only after candidate acceptance, publish in dependency order, verify each exact
   registry artifact and supported floor, then verify the complete registry set
   before downstream consumers or production change. Historical registry fixtures
   and older CI sibling pins remain separately identified evidence.

No target versions, lowered tolerances or release exception are selected here.
All accepted source fixes above remain unpublished.

## Remaining PRs and ownership

Core #128 has a reviewed provenance correction and a main integration at
`e46c278e5dcbe2e2385f7a30c1b9d60aa62d13d4`. All three original workflows passed,
but the actual external gallery comparison was skipped because its checkout
token is absent. A separate local comparison passed against clean gallery
`58aa122690489a9206e1b583e5d9eea5e8cfd84e`. Keep the gallery #46 publisher-first
hold and require the external CI comparison; do not label the skipped step green.

Data-Advantage Actions remain unable to start due to a payment failure or spending
limit restriction. The observed annotation does not identify which. An account
administrator must restore execution before app #57 and the other held app/site/
gallery changes can obtain fresh required checks. No unchanged failed run is
retried to manufacture acceptance.

PPTX #77 remains a substantive theme draft: accepted main does not contain its
changes, a read-only merge preview found 17 conflict regions, and per-reference
acceptance remains unfinished. Its old CI pass does not certify current-main
integration. Broader master/theme writing overlaps deferred scope; do not merge
it as routine cleanup. Keep the five geometry drafts coordinated: core #94,
renderer #27, PPTX #42, editor #25 and site #40. Never merge only the site half.

[Draft app #58](https://github.com/Data-Advantage/pptx-dev/pull/58) is now at
`19ad2441ef0fe28365799f4ba1993b0b659040be`, a normal fast-forward from
`fe581ec627de6568ad8bb98856835ee5a1862f43`. The source/history guard binds preset
undo to exact source, format and document generation, commits pending preview
edits, and invalidates after local replacement/import. The newer guard for
accepted asynchronous replacements invalidates the old group synchronously when
handoff, thread load, agent finish or account save supplies a replacement;
pending, cancelled, null and failed responses do not. Source bytes and public
EditorSession history remain part of the contract.

Independent local Node 24 checks passed 737 units, 13 standalone controls and
49 browser tests without retries, plus build/typecheck; existing lint findings
remain baseline-equivalent. The original predecessor
[CI run](https://github.com/Data-Advantage/pptx-dev/actions/runs/36551435303) and
original [new-head CI](https://github.com/Data-Advantage/pptx-dev/actions/runs/36555556882)
were denied on both platforms by the account restriction before any step or test
ran. Those denials are preserved; local results do not replace fresh required CI.
The PR remains draft. Signed-in UI, deferred source effects, broader stale-response
ordering and production acceptance remain separate requirements.
The September 21 canonical 34/39 and Windows 38/39 results remain separate failed
gates; smaller later checks cannot replace them.

The Windows supervisor retains sole desktop Office control and owns its native
branches and evidence. Core [#148](https://github.com/OpenPresentation/opf/pull/148),
accepted as `0e81a407f57e5106ad607a9617c571d86b5428da`, retains the Calibri control.
The subsequent explicit-slot control in accepted
[#149](https://github.com/OpenPresentation/opf/pull/149), commit
`b5a88a58147bced0ff8b4e94f631d207bd48e122`, still observes an empty name and Aptos
in the native font collection after filling the four empty theme slots with
Calibri. Empty slots are unnecessary for that observation; its cause remains
open. Reported names and an orderly native lifecycle do not prove physical glyph
identity, an allowlist or embedding success. This task did not repeat Office testing.
The latest accepted parity measurement in core #147 is 5/900 perfect, zero near
and 895 mismatches on its documented graph; it is not an overall completion
percentage. Physical fonts, embedding and native wrapping remain unresolved.
Preserve the renderer 0.1px and native tab 0.02pt gates. Native `p:hf` stays roadmap
work, and the Windows owner retains all desktop Office decisions.
