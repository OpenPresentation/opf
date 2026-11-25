# Format requests (FR)

Opened 2026-11-25. Branches `codex/fr-<nn>-<slug>`, pull request titles `FR-<nn>: `. Items and status: [burndown.md](burndown.md). Every
decision, with who gave it: [decisions.md](decisions.md).

## Goal

The format changes the owner kept in his review of 2026-11-24 ship together as 0.37.0: ids on the document and on the things inside it,
links to a slide of the same deck, data sources and typed datasets, a metric computed from data with its change, a table color scale,
bands with the bullet chart and the gauge, an embed content kind, limits on a variable's value, and translated variables with localized
date names. Each change lands on `main` whole (schema, engines, docs, tests and conformance cases together), so `main` stays releasable.

The review page and the plan page were written when this release was still called 0.36. The owner then chose to ship the fixes now as
0.36.0 (from the Windows computer) and to build the format changes later as 0.37.0, so the review's "0.36" is this program's 0.37.0 and
its "0.37" (the three studies) is 0.38. Group letters, change numbers (CR 1 to CR 17) and question ids are unchanged. The review page,
the plan page and the analysis are private and outside this repository (the analysis is `C:\opf-work\t\format-requests-0.36.md` on the
supervisor's Windows computer and keeps its old file name), so the burndown and the decision log here are written to stand on their own.
The baseline is 0.36.0 on `main`.

On 2026-11-25 the owner said to start 0.37 now and that the supervisor "can make good decisions for open items too". An open decision
therefore does not stop work: the option the review marks as recommended is taken, written into [decisions.md](decisions.md) as a
supervisor decision on the owner's delegation, and built. The owner can overrule any of them; an overruled decision changes its row there
and the item that depends on it. Later on 2026-11-25 the owner answered most of the open questions on the review page himself; each row
in decisions.md says who gave its answer.

## Landing order

| Order | Group | Items |
| --- | --- | --- |
| 1 | A, ids | FR-01 (CR 7), FR-02 (CR 6), FR-03 (slide links, opf#1297) |
| 2 | B, data | FR-04 (CR 1 with CR 3), FR-05 (CR 2), FR-06 (CR 4), then FR-07 (CR 5) |
| 3 | D, embed | FR-08 (CR 11) |
| 4 | E, variables | FR-09 (CR 14), FR-10 (CR 15) |

Group 0 (the layout sweep, the Keynote fixes, the guardrails and the 0.35.1 leftovers) is the 0.36.0 release and is not an item here.

Nothing is cut. On 2026-11-25 the owner answered the release question with "one release, nothing may be cut", so 0.37.0 ships when
every item of the burndown is done. A change that PowerPoint does not accept is fixed before the release; it does not move to a patch.
The cut order this page had before (the gauge, the bullet chart, embed, the localized date names, the stale-data warning) no longer
applies.

## Definition of done

A change is done when every row below applies or is marked "not applicable" with the reason in its pull request.

1. **Schema.** `spec/schemas/` and the generated types (run the generators, never edit generated output), with the type test between core
   and the renderer.
2. **Validator and lint.** The validator, and any lint rule the change implies. Severities are fixed: errors for a duplicate item or row
   id, a link to an unknown slide, an unknown data source, and a data link to an unknown dataset or field; warnings for the rest
   (`variable-overflow`, `dataset-stale`, `datasource-credentials`, a metric whose typed value or change differs from its data, a cell
   that does not match its column type).
3. **Rendering** in `packages/render`.
4. **PowerPoint export and import** in `packages/pptx`, with what round-trips stated.
5. **The editor** (`packages/editor`): ids kept on edit, and a picker where the change needs one (a slide picker for links).
6. **The MCP server's schema, docs and tools, and the CLI.**
7. **Docs and at least one example deck.**
8. **A `changes/<slug>.md` fragment.**
9. **Conformance cases**, valid and invalid, for Core Reader and Core Writer. Only the errors get conformance cases; the suite treats
   warnings as advice.
10. **A Markdown and YAML round-trip test.**
11. **A native PowerPoint check** where the export changes: the pull request prepares the files under `C:\opf-work\037\<item>\ppt\` and
    the supervisor runs the check. No agent starts PowerPoint.

The release also needs an answer for what a 0.36 reader says about a 0.37 document: the validator names the release a field needs, from a
small table built with the schema (decision R8 in [decisions.md](decisions.md)).

## Invariants

- A deck without the new fields draws and exports exactly as before. A golden, a sealed fixture or a pin that moves is a stop and a
  report, never an edit; goldens are regenerated only by the `golden.yml` workflow.
- No aliases and no deprecated spellings before 1.0. A breaking change comes with an `opf fix` rewrite and the callers in this repository
  updated together. The one breaking change in 0.37.0 is CR 1's flat dataset (`source` becomes `datasource`, `query`, `retrieved` and
  the other keys); everything else only adds, so a deck saved by 0.35.1 or 0.36.0 stays valid.
- Engines never fetch data. A data source is described, never read, refreshed or resolved by an engine; a data link computes only from
  the rows embedded in the deck.
- Ids are opaque strings. Core never mints a random one (it has no clock and no randomness); a host mints its own, and `assignIds`
  numbers in order unless a host passes a generator. An id is a claim, not a credential.
- Colors come from the color scheme, never as raw colors. Engines print a number only through `format`; a column's `unit` is a label.
- The schema ids stay on openpresentation.org (decision R5).
- Generated files (schema bundles, types, the gallery and font trackers, layout previews, llms chunks, the MCP's bundled docs) are
  regenerated with their own generators and never edited by hand.

## Not in 0.37.0

Moved to studies for 0.38, each on its own page with pros and cons, decided later:

- CR 8, slide templates (with CR 10, beat guidance and slide takeaway; its study recommends shipping CR 10 in 0.37 anyway, so it can
  return as an item).
- CR 8, brand kits, and CR 17, brand constants (read together; the study recommends no brand kit record).
- CR 13, a variable computed from data (it can return beside CR 4, which shares the data link).

Cut to issues:

- CR 9, catalog records that build on another record: opf#1433.
- CR 12, locks and a fill-only template mode: opf#1434.
- CR 16, fill provenance on a filled deck: opf#1435.

Also outside: the repeat slide construct (CR 18, deferred 2026-11-20), comments exported as PowerPoint comments, and the editor features
STORYD's launch expects (comment anchors, transactions, proposals, merge, the asset store, server rendering), which are a parallel track
in [cloud-editor](../cloud-editor/README.md) and not format.

## Resume protocol

Read this file, [burndown.md](burndown.md) and [decisions.md](decisions.md), then, where you can reach them, the card of your item on
the review page and the analysis (`C:\opf-work\t\format-requests-0.36.md`). Work in your own worktree (`node scripts/agent-worktree.mjs add fr-<nn>-<slug>`)
from a fresh `origin/main`. Take an open decision from [decisions.md](decisions.md); if you must decide something new, add a row there
as a supervisor decision the owner can overrule. Run `pnpm check:changed` before you report. In the pull request that changes an item's
state, edit its row in the burndown and append a line to its progress log. Never edit a sealed fixture or a golden; if one moves, stop
and report it.
