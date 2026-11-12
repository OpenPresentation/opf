# Decisions made for the owner on 2026-11-07 (all vetoable)

The owner was away and asked the supervisor to decide and keep going. Each line can be reversed. Most also appear in the relevant burndown progress log and PR body.

## Release and process
- Everything goes into v0.33.0 that is reviewed by the integration cut (the owner's words: "put it all in v.33"). The rest goes into v0.34.0.
- Batching: reviewed PRs are folded into wave integration PRs to save CI (the owner asked: "can't you batch changes more effectively").
- Release blockers: PowerPoint defects on Windows or Mac in supported features. LibreOffice results do not block.
- `.mcpb` attached to the GitHub release (sites inventory, A7): moved to 0.34.0, so the 0.33.0 release pipeline isn't touched right before it runs.

## Qualification (RR-105, RR-106)
- RR-105 Windows findings:
  - Finding 6 (flipped shape text) and finding 3 (academy example): fixed for 0.33.
  - Finding 5 (histogram rounding, Pareto axis): fixed by the charts work.
  - Finding 2 (native-body card overflow) and finding 4 (small-run title offset): fixed in #1114 for 0.34.
- Academy example (#1095): the chart-pointing ring and arrow are removed, and the highlighted bar carries the emphasis. Overlays can't anchor to a data point; that's #1113.
- LibreOffice is "experimental" in all public wording; promotion is the owner's call. The nightly LibreOffice leg is non-blocking and lives in `nightly.yml`.
- The default export does NOT switch to `charts: "picture"` for LibreOffice; the docs tell LibreOffice users about that option instead.
- `opf-preview-fonts` ships the fontconfig aliases (#1132).
- Approved public LibreOffice wording (plain text, no badge): "Opening OPF's PPTX in LibreOffice Impress is experimental; OPF checks it nightly in LibreOffice 26.8 on Linux. With OPF's open fonts, or a `typefaces: "safe"` export, text, lists, images, tables and common charts open complete and inside their boxes. Treemap, waterfall, funnel and box-and-whisker charts need `charts: "picture"`."

## Layout harvest
- LH-184:
  - Two columns at the same size beat three narrow ones.
  - One column wins only within the 70-character measure, or when it's at least 10% larger.
  - A 14-item long list becomes 2 columns at 23 px rather than 1 column past the measure at 24 px.
- LH-186: a long agenda on `agenda-split` moves to the automatic grid at the larger size, and its step badges and side title give way. Condition (met in #1133): the paginated FAQ pages keep columns.
- LH-75:
  - A table beside its note may wrap a cell onto two whole-word lines instead of stepping down.
  - The table and note then grow together.
  - b15 s23 and s41 stay open.
- LH-138: the closing's contacts stay a stacked list at 37 px, not a 19 px row.
- LH-149: dense comparison options stay at 18 px.
- LH-171: a list whose labels are short phrases (6 words or fewer) is ruled when a sibling list is.
- LH-173: a step label steps down by the least amount that keeps its word whole.
- LH-174: an entry without an icon keeps a bullet, centered in the chip column.
- LH-46 ships in a modest form: a lead over a balanced grid, at the same size. Cards would cost a half step on cardless decks, and growth doesn't fire at 66% fill.
- LH-102: grow first (automatic bodies up to 56 px), then center. Where LH-48's 60% target blocks growth, it only centers.
- LH-69:
  - No placeholder icon on tiles.
  - A short sentence keeps its bold heading.
  - Decks with cards keep their cards.
- LH-73: the caption form is not built, because Claude Design's caption sets the text at about half the size.
- LH-61: closed; nothing is left.
- LH-30: color variables and built-ins don't count toward "all unfilled".
- LH-187: side-portrait team cards take their whole cell, with the portrait up to 0.6 tall for its width.

## Charts
- LH-175: keep every series as clustered columns, rather than drawing a Pareto chart of the first series only.
- LH-176: the preview follows PowerPoint's 150% gap rule.
- RR-105 finding 5: the preview follows PowerPoint's rounding.
- LH-182: fill the hole rather than move the motif.
- LH-93: the set takes its narrowest plot width.
- LH-110: number words are labeled in digits.

## Shapes and diagrams
- SH-10:
  - Text only grows (up to 43 px, filling at most 60% of the text box).
  - Siblings take the smallest size any of them reached.
- SH-12 (DOT):
  - DOT's default ellipse draws as a stadium shape.
  - DOT colors, fonts and sizes are ignored; the deck decides.
  - `dir=back` reverses the edge.
  - Arrow types map to arrowhead, circle, cross or none.
  - Layout engines other than dot are refused.
- SH-13 (PlantUML):
  - `group` becomes a box with a note.
  - `==` dividers become notes over every participant.
  - Use-case boundaries are one level deep.
  - Gantt days are numbered from 1 without `Project starts`.
  - Styling is ignored.
- SH-08:
  - Nested entries keep their level.
  - The inverted pyramid imports as an ordered list (#1128 tracks a direction option).
  - Large front overlays count as the slide's body, so the title sits on top (`OVERLAY_BODY_SHARE = 0.2`).
  - Overlay text keeps OPF's sizes.

## Sites
- Reword the banned vendor name in openpresentation.org's frozen schema copies (0.28.0 to 0.32.1), and remove it from the opf-v0.11.1 release notes. The owner's "appears nowhere" rule wins over the site's freeze rule.
- Remove every support, gap and "in progress" status statement on pptx.gallery (the owner's no-badge rule).
- Add a pptx.gallery shapes browser (#171) for 0.34.
- The pptx.gallery deployed-asset check retries a bounded number of times and never follows a redirect (#170, merged).

## SH-21 continuation (vetoable)

- Add `org-chart`, `hierarchy` and `venn` as region arrangements and same-named gallery records. Trees use the existing list-entry `level` for one root and parent depths; Venn remains flat. Unsupported forests/depth jumps preserve the complete list with a finding, and assistants retain reported diagram adaptation.
- Preserve the base list size or grow it. When measured native tree/Venn geometry cannot hold the labels, retain every list entry rather than reducing text. Basic Venn uses the measured one-to-seven set count, inside labels through four sets and outside labels after four.
- For these newly supported native layouts, retain the prior overlay adaptation when a cached drawing contains additional nonempty labels beyond the data entries. This preserves presentation-only text; same-count stale caches do not override authoritative node text. The synthetic extra-label Venn and genuine native fixture are separate regression controls.
- Keep all new live domains unavailable until product exports, parent/node edits and save/reopen pass the unchanged native gate. Measured rectangles alone do not qualify an editable layout.

- Final sampler maintenance (vetoable): append new layouts after the existing49 slides, preserving all existing authored content and native witness ordinals. Refresh all referenced layout records through `updateFromCatalog`/`applyPatch` and `embed`; this sampler presents the current catalog rather than freezing obsolete record revisions. The maintained updater refuses unknown/duplicate layout references, validates standalone portability and is idempotent.

- v0.34 bundle ceilings (vetoable): retain the core catalog-free generator and its3% rule, and give reviewed MCP unminified/minified/gzip/public-doc assertions the same3% headroom rounded to1000bytes. Exact source measurements and unchanged data exclusions are in [mcp-size-budget-034.md](mcp-size-budget-034.md). No public page or baseline tolerance is reduced to pass.

## 2026-11-08 coordinator continuation (vetoable)

- Continue native Preview qualification through the existing bot/opf-v0.33.0 bump PRs202/172, normally merging their approved maintenance defaults. Keep both byte-preservation attribute additions. Retain the reviewed fail-closed deployment tests; the old missing-token green-skip expectation is obsolete under the owner-approved CI/CD contract. Local Next builds pass; preserve Windows OpenNext symlink EPERM and require real Linux packaging before acceptance.
- Diagnose DEV201 with one bounded, opt-in failure-only observation run under the existing full Ubuntu compatibility workload; retain all four alias/export assertions, navigation order and240-second budget. Local032/033 Edge controls are evidence only, without a claimed Linux fix. Review the concrete diagnostic patch before any push/run; raw browser headers/storage are not republished as public evidence.
- Chart references remain proposal-only at the owner-requested design gate. The new dedicated agent independently recommends native category-position spans, explicit per-axis values/styles and shared combo bounds; none is approved or implemented. The full revised JSON/defaults/import/overlay tradeoff proposal is issue1139 comment6725049107.
- Preserve integration baseline9of44 failures and all first failures. Restore sparse test evidence only from exact Git blobs, redoing materialization after a merge reapplies sparse patterns. Strengthen current-catalog/localized-language compatibility controls in an isolated RR20 PR; never waive tests or claim the combined candidate green.
- 2026-11-12 (RR-105 core review): the LH-110 decision above ("number words are labeled in digits") is superseded. v0.34.0 removes title and subtitle inference of reference lines and period bands altogether; reference lines are explicit `chart.referenceLines` with verbatim author labels (`changes/lh-110-explicit-chart-reference-lines.md`, `docs/chart-options.md#explicit-reference-lines`).
- 2026-11-12 (RR-105 core review): the LH-75 entry above is completed by the 2026-11-08 growth decision (layout-harvest burndown): a table and note that already fit side by side may grow until a cell takes three whole-word lines and the pair covers 75% of the body; initial placement keeps two lines and 60%.
