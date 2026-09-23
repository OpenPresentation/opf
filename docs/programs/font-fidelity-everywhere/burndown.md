# Font fidelity everywhere: burndown

Goal and resume protocol: [README.md](README.md).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged after
independent review and green CI, evidence linked), `blocked` (reason in notes).
Every item's criteria must all hold before it is `done`.

## Summary

| Status | Count |
| --- | --- |
| done | 2 |
| review / in-progress | 5 |
| todo | 10 |

## Items

| ID | Item | Repo | Depends on | Status | Evidence / PR |
| --- | --- | --- | --- | --- | --- |
| FF-00 | Program tracker and agent entrypoints | all | none | review | this PR; sibling `AGENTS.md` PRs |
| FF-01 | Exporter master bullets follow the theme body font | opf-pptx | none | done | [opf-pptx#57](https://github.com/OpenPresentation/opf-pptx/pull/57), `7b34f557` |
| FF-02 | Embed harness records pre-edit, post-text and post-edit font observations | opf-pptx | none | in-progress | branch `codex/native-font-embed-baseline-20260923` |
| FF-03 | Read-only native font inventory worker | opf-pptx | none | in-progress | branch `codex/native-font-inventory-readonly-20260923` |
| FF-04 | Native inventory of the unedited fixture, with and without temporary fonts | opf-pptx / opf | FF-03 | todo | |
| FF-05 | Aptos root cause determined | opf | FF-02, FF-04 | todo | [research brief](#research) |
| FF-06 | Font-flow map across all 14 dimensions and environments | opf | none | in-progress | mapping brief (to be committed here) |
| FF-07 | Exporter writes chosen fonts into theme and run East Asian/complex-script slots | opf-pptx | FF-05, FF-06 | todo | |
| FF-08 | Exporter leaks no hard-coded or default font in any part | opf-pptx | FF-06 | todo | |
| FF-09 | Offline pairwise matrix across the 14 gallery dimensions | opf (ecosystem) | FF-06, FF-07, FF-08 | todo | |
| FF-10 | Matrix in CI on ubuntu, windows, macos via a packed TypeScript consumer | opf | FF-09 | todo | |
| FF-11 | Export determinism independent of host fonts, OS, locale and timezone | opf-pptx / opf | FF-06 | todo | |
| FF-12 | Native PowerPoint sample of the matrix, including CJK and RTL | opf-pptx / opf | FF-03, FF-09 | todo | |
| FF-13 | Font-embed attempt from merged main, audited | opf-pptx / opf | FF-02, FF-07 | todo | |
| FF-14 | Evidence bundles, compatibility matrix and handoff merged | opf | FF-12, FF-13 | todo | |
| FF-15 | Release-readiness note for the release owner (no publishing) | opf | FF-14 | todo | |
| FF-R0 | Prior: mixed-size table edit/save/reopen and first embed attempt | opf, opf-pptx | none | done | [opf#114](https://github.com/OpenPresentation/opf/pull/114), [opf#115](https://github.com/OpenPresentation/opf/pull/115) |

## Acceptance criteria

**FF-00 Program tracker.** This README and burndown are merged in core. Core
`AGENTS.md` links them under "Active programs". opf-pptx, opf-render and
opf-editor each have an `AGENTS.md` pointing here, with accurate toolchain
commands. The resume protocol works from a fresh clone.

**FF-01 Master bullet font.** The slide master `bodyStyle` bullets use
`+mn-lt`. Only those nine elements change across the example corpus, import
round-trips are unchanged, and CI is green. (Done: PowerPoint's
`Presentation.Fonts` for fixed output is verified under FF-04/FF-12.)

**FF-02 Embed harness observations.** `native-font-embed.ps1` records
`Presentation.Fonts` after open, after the text sets and after the font
property sets, plus per-range `Font2` `Name`, `NameAscii`, `NameOther`,
`NameFarEast` and `NameComplexScript` before and after the edits. All are
staged begin/success pairs recorded as observations. The post-edit gate,
allowlist and single `SaveAs($savedPath,24,-1)` are unchanged. Offline controls
and PS 5.1 `-PureRegression` pass on Linux and Windows CI. Independent review
passes.

**FF-03 Inventory worker.** `native-font-inventory.ps1` opens one PPTX
read-only, with no `SaveAs` and exactly one owned close, and records
`Presentation.Fonts` plus per-run font slots for every text range, within
bounds. It supports `-WithoutTemporaryFonts` and control decks. An offline
exclusive-create audit binds hashes, lifecycle, stage pairing and `error:null`.
Controls, pure regression and CI wiring are included. Independent review
passes.

**FF-04 Native inventory.** Root runs FF-03 once per condition, in fresh
directories, on the unedited Carlito fixture with and without temporary fonts,
and on one control deck. Audits pass and the evidence bundle is merged. The
result states whether `Aptos` appears before any edit.

**FF-05 Root cause.** A merged note names the Aptos source, backed by FF-02 and
FF-04 evidence that discriminates the hypotheses (edit-inherited empty
`ea`/`cs`, listed at open, font-registration specific). If evidence is
inconclusive, the note lists the next discriminating experiment, and the item
stays open.

**FF-06 Font-flow map.** A merged doc maps, for each of the 14 dimensions and
for code, chart, table and notes text, where fonts are chosen, defaulted or
hard-coded, and how each reaches the preview and each PPTX part. It records CI
environment coverage per repo and proposes the pairwise sample.

**FF-07 Script-slot fonts.** For each language in the language catalog sample,
the exporter writes the chosen font (or the catalog's script font for that
language) into theme `ea`/`cs` and run `ea`/`cs`/`lang` as appropriate, so no
empty slot is left for PowerPoint to fill. Offline tests assert the slot
inventory. There are no regressions in the example corpus beyond documented,
intended part changes.

**FF-08 No leaked defaults.** A typeface inventory over every XML part of every
matrix deck contains only chosen fonts, theme references, empty values
explicitly allowed by FF-05's findings, and documented per-script theme
supplements. This includes `docProps/app.xml` handling.

**FF-09 Offline matrix.** A pairwise sample covers every value class of all 14
dimensions plus code, chart, table and notes content. For each deck: export,
inventory the typefaces and assert they equal the chosen fonts; validate the
package; render the preview before and after the switch and assert it
re-rendered with the new fonts. It is deterministic, and runtime is bounded for
CI.

**FF-10 Cross-OS CI.** FF-09 runs on ubuntu, windows and macos, through a
packed install consumed from a TypeScript project, with `tsc --noEmit` on the
consumer and the published types. It is required on core PRs that touch the
matrix or sibling pins.

**FF-11 Determinism.** Exporting the same deck under different `TZ`, `LANG`
and locale settings, and with no system fonts available, produces
byte-identical PPTX on all three OSes. Any unavoidable variance (for example
`docProps` timestamps) is pinned or documented and excluded from the
comparison with justification.

**FF-12 Native sample.** Root opens a bounded sample (at most 12 decks,
including CJK and RTL) read-only with FF-03. Each deck's `Presentation.Fonts`
is a subset of its chosen fonts. Evidence is merged.

**FF-13 Embed attempt.** One supervised attempt from merged main, in a fresh
directory, is audited pass or fail. If it passes, the OPC audit shows exactly
the chosen fonts embedded.

**FF-14 Published.** Evidence bundles pass their verifiers. The compatibility
matrix and handoff state exactly what is and is not guaranteed.

**FF-15 Release note.** A merged note lists which merged changes a release
would ship and which consumer repos must follow. It is handed to the release
owner, with nothing published.

## Research

- Aptos origin brief (hypotheses H1 to H3, experiments E0 to E7) from 2026-09-23.
  It is stored outside git with the root workspace, and a summary will be
  committed with FF-05.

## Progress log

Append one dated line per state change. Newest last.

- 2026-09-22: FF-R0 done. Mixed-size edit/save/reopen passed (opf#114). First
  Carlito-only embed attempt failed closed on `Aptos` (opf#115).
- 2026-09-23: Program opened. FF-01 merged (opf-pptx#57). FF-02, FF-03 and
  FF-06 started by parallel agents. FF-00 in review.
