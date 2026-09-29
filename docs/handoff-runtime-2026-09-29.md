# September 29 runtime and release checkpoint

The delivery goal remains open, and work has resumed.
This checkpoint separates accepted source, installed-package checks, native
compatibility and publication. No package or website was released by this review.
The September 17 published train remains core 0.11.0, CLI/render 0.9.0,
PPTX 0.9.1 and editor 0.8.0 on Node 24.x. See the [published compatibility
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

## Formatted furniture blocks another release

Current unreleased PPTX source passes its full portable suite with accepted
core `061499d53aabefb266dd4f7f5c5bd85f6d24c425` and renderer
`6c7d7818e40d0f9c519e4b34f7a24e9150c1787f`. The retained full-suite run with
registry core 0.11.0/render 0.9.0 fails `test/furniture-fields.mjs:38`:
a requested `{current} / {total}` yields only the live slide number, without
` / 3`. Published core 0.11.0 does not expand the new format; accepted core
contains that later FF-27 implementation. This is an unreleased capability versus
dependency-floor mismatch, not evidence that published PPTX 0.9.1 fails its own
released suite.

Before publishing any package in the new contract, prepare and accept the
complete candidate set:

1. Select a core build containing the required composition, field ranges, date
   and pagination-total behavior. Set compatible dependent minimum versions and
   verify them through fresh isolated candidate tarball installs; do not retain
   a full support claim for an older allowed core floor.
2. Add installed public API coverage for formatted numbers, prefix/suffix,
   hidden title slides, fixed/current dates, diagnostics, deterministic output and
   edited reimport. Existing bare-number/literal-date furniture fixtures do not
   prove these cases.
3. Verify installed preview/browser text with the same host date and final slide
   count when claiming the full preview/export workflow. Renderer host-date support
   is a separate capability prerequisite. Complete the required cross-OS CI,
   visual review and separate native/font gates for the release scope.
4. After those candidate gates pass, publish in dependency order and verify each
   exact registry artifact and supported dependency floor before downstream
   publication. Verify the complete registry set before updating consumers and
   production. Selected registry tests, source links and old immutable CI sibling
   pins are different evidence sets.

No target package versions, lowered tolerances or release exception are selected
by this checkpoint. Native field update/save/reopen remains a separate gate.

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

[Draft app #58](https://github.com/Data-Advantage/pptx-dev/pull/58), head
`fe581ec627de6568ad8bb98856835ee5a1862f43`, preserves the local preset source guard.
Undo binds to exact source, format and document generation, commits pending
preview edits, invalidates after local replacement/import and preserves source
bytes and EditorSession history. Independent review and local Node 24 checks
passed: 716 units, 13 standalone controls and 49 browsers without retries, plus
build/typecheck. Existing lint findings remain unchanged. The original Linux and
Windows [CI run](https://github.com/Data-Advantage/pptx-dev/actions/runs/36551435303)
failed before startup with the account restriction; neither job executed a step.
It stays draft pending fresh required CI and application acceptance.
The candidate covers anonymous/local source boundaries. Unbusy asynchronous
account replacements can still reach the source through a later effect and
need a separate synchronous invalidation guard and held-response test.
The September 21 canonical 34/39 and Windows 38/39 results remain separate failed
gates; smaller later checks cannot replace them.

The Windows supervisor retains sole desktop Office control and owns its native
branches and evidence. The owner's [core #148](https://github.com/OpenPresentation/opf/pull/148), accepted as
`0e81a407f57e5106ad607a9617c571d86b5428da`, preserves the Calibri control: the
native font collection still includes an empty name and Aptos. Its precise
cause remains open; this task did not repeat Office testing. The latest accepted parity measurement in core #147 is
5/900 perfect, zero near and 895 mismatches on its documented graph; it is not an
overall completion percentage. Physical glyph identity, font allowlists,
embedding and native wrapping remain unresolved. Preserve the renderer 0.1px and
native tab 0.02pt gates. Native `p:hf` stays roadmap work.
