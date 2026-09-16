# Deferred shaping and rich-source implementation

Status: roadmap work as of September 15, 2026. The owner requested that all
validated work be merged, all incomplete work be preserved in the roadmap,
and the PR queue be closed out. Core83, renderer21, editor21 and PPTX35 are
therefore being merged as documentation/evidence changes. Their prototype
runtime is not being promoted into main or published.

## Recoverable implementation

All four repositories retain a remote `codex/archive-shaping-20260915` branch.
The immutable checkpoints below contain the complete implementations, source,
distributions, tests, fixtures, licenses, reports and integration histories.
The original PRs retain the review discussion. No history was force-pushed.

| Repository | Complete archived checkpoint |
| --- | --- |
| opf | [`36ff66b3d62b`](https://github.com/OpenPresentation/opf/tree/36ff66b3d62b39d7d27dcda022b7e79e541bd603) |
| opf-render | [`343fb84223f4`](https://github.com/OpenPresentation/opf-render/tree/343fb84223f4383ffe546157c6989ccc505c0acb) |
| opf-editor | [`ae4cc6426b04`](https://github.com/OpenPresentation/opf-editor/tree/ae4cc6426b04c7ca428c1b4acacea2e11d99fa84) |
| opf-pptx | [`fbe9a73d012d`](https://github.com/OpenPresentation/opf-pptx/tree/fbe9a73d012dbd51d65a39251e405e488651a70b) |

[Archive manifest](../evidence/final-handoff-20260915/archive-checkpoints.json)
records each validated main base as well. Read archived code with `git show`
or a separate checkout. Resume from current main and port bounded changes;
do not blindly merge the archive or revive old package/runtime configuration.

## Work retained

- Core: joint shaping across compatible rich runs, original run-relative source
  spans and explicit tab advances. This changes the geometry consumer contract.
- Renderer: opt-in HarfBuzz, bounded font-container preparation and selected
  instances, accepted glyph painting, caret metadata and source groups.
- Editor: prepared carets, visible-line navigation, whole-source grapheme
  boundaries, nested SVG text traversal, selection and exact-source undo.
- Converter: rich source groups, native run formatting and literal tab stops.

## Evidence and blockers

The archived coordinated graph passes local core types/tests, library suites,
805 slides across 126 decks, fresh candidate installs, 81 CLI checks, eight
general installed browser suites, seven JSON workflows, twenty prepared-caret
workflows, thirty-nine rich-input workflows, and eight measured/painted pixel
and copy comparisons. Published-registry checks also pass within their older
released scope. These successes do not close the failures below.

1. Renderer Linux source and installed variable-font acceptance still fails
   the unchanged 0.1px gate. Source Serif SmText Bold measures
   334.06213682353496px versus Chromium334.193115234375px. The
   [latest archived run](https://github.com/OpenPresentation/opf-render/actions/runs/35019414738)
   retains this result. [The requested rounding experiment](https://github.com/OpenPresentation/opf-render/tree/9764ad8f9a7fd497ca2fcea190669cf74d2e2503/docs/evidence/rejected-truetype-rounding-20260915)
   fixes five Linux failures but causes five macOS failures. Some native
   platform widths differ by more than twice the tolerance; one shared width
   cannot satisfy both. No offsets, platform guesses or relaxed assertions
   were shipped. Track the supported metric/paint contract in
   [renderer issue24](https://github.com/OpenPresentation/opf-render/issues/24).
2. Archived editor [CI35019417054](https://github.com/OpenPresentation/opf-editor/actions/runs/35019417054)
   fails `test/packed-install.mjs:72`: the rich-input runner passes thirteen
   workflows, but the aggregate assertion expects ten. Repair this stale
   coverage assertion and rerun the complete packed command when resuming.
   It is separate from native font fidelity; do not count this run as green.
3. Native PowerPoint Header/Footer objects (Insert → Header & Footer, notes
   master, `p:hf` date/slide-number/footer — not `OPF_FURNITURE_V1` slide
   shapes), tab positions, image opening, provenance edit/save/reopen,
   notes-master ordering and font identity remain in
   [issue87](https://github.com/OpenPresentation/opf/issues/87) and the
   [native acceptance plan](powerpoint-acceptance.md). Tagged-shape furniture
   in PPTX 0.8.1 does not close this item. The Linux 0.1px / issue24 gate
   above is unchanged.

Original failing logs are retained in the final handoff evidence directory and
in the renderer/editor roadmap PRs. Moving work into the roadmap does not
change any measurement, tolerance, capability claim or published version.

## Re-entry acceptance

Start with a supported font/paint contract or a narrowly supported subset.
Use the same accepted run for layout, visible glyph placement and editing;
preserve original Unicode, UTF-16 spans, rich styles, font bytes/licenses,
logical selection/copy and editable export semantics. Keep native text,
prepared paths and native Office claims separate. Resolve geometry API and
package dependencies together. Test source, actual packed consumers, intended
registry predecessors/successors, offline browser workflows and supported
platforms; review full-slide ink as well as widths. Retain failures and
unsupported coverage explicitly. Publish new versions only after that declared
scope passes. No new package version is published by the roadmap PRs.
