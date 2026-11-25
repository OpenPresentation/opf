# Native-app testing: burndown

Goal and boundary: [README.md](README.md). Decisions: [decisions.md](decisions.md). Status values: `open`, `in-progress`, `in review`,
`done`, `descoped`. Whoever changes an item's state edits its row and appends a line to the progress log in the same pull request.

| ID | Item | Done when | Status | PR |
| --- | --- | --- | --- | --- |
| NT-00 | Open the program: goal, definition of done, invariants, the owner's decisions | The program pages are merged | done | #1488 |
| NT-01 | The shared result format: per target, per file and per slide, whether it opened, the application's own import warnings, the slide picture's score, the object list in one vocabulary, and the round-trip result. A JSON schema, plus fixtures cut from the 0.36.0 round's real output | A Node test validates the fixtures; no application is needed | done | #1490 |
| NT-02 | The Keynote driver behind the five verbs, ported from the evidence branch's `kn-run`, `kn.applescript`, `knprobe.py` and `kn-close`. Before it merges, the format and the verbs are agreed with the Windows supervisor on opf#1468 | On the Mac it opens the smoke decks and writes the NT-01 format; the pure parts have tests that run in CI without Keynote | in review | #1495 (draft) |
| NT-03 | Known differences as data: one record per difference (id, feature, deck and slide, what a user sees, application versions first and last seen, whose it is, workaround, issue). Keynote's records are seeded from the export skill's table and the 0.36.0 round's findings index; the skill's Keynote table is generated from the data | The generated table replaces the hand-written one; a check fails when they drift | in review | #1491 |
| NT-04 | Compare and classify: OPF's preview against the application's picture (Display P3 and alpha handled once, here), then every slide is same, known and still there, known and gone, or new; a labeled sheet only for "new" | Run on the 0.36.0 round's recorded Keynote output, it reproduces the round's Known list and flags its new findings | in review | 04a #1496, 04b #1497, 04c branch `codex/nt-04c-classify` |
| NT-05 | One entry point, `pnpm native <target> [--tier smoke\|release\|full] [--decks …] [--baseline <version>]`; the tiers defined from the qualification manifest; the manifest refreshed (it is at 0.34.0) and given per-target expectations | `pnpm native keynote --tier smoke` runs end to end on the Mac | in-progress | 05a branch `codex/nt-05a-manifest`, 05b branch `codex/nt-05b-native-command` |
| NT-06 | The LibreOffice runner writes the same result format and uses the same classify step | The nightly job's artifact is in the shared format | in-progress | #1498, #1499 |
| NT-07 | A changelog fragment that touches the exported file names its slide (`native: [deck#slide]`), or says `native: none` with a reason; a check warns when it is missing | `changes/README.md` documents it; the warning runs in `check:changed` | in review | #1489 |
| NT-08 | The process in the docs: where a native run sits in `docs/release-process.md`, who starts it, what blocks | Merged; the dated handoff pages no longer carry the only description | in review | branch `codex/nt-08-process-docs` |
| NT-09 | A Keynote export profile (opf#1298): safe typefaces and static slide numbers together, so a default-theme deck opens in Keynote on a Mac without Microsoft 365 with no missing-fonts warning ([D2](decisions.md#d2-what-a-keynote-user-gets-by-default)). This is export code, scheduled with the 0.37.0 work, and not started before NT-05 | The design is agreed on opf#1298 with the release supervisor; `pnpm native keynote --tier smoke` on a profile export shows no missing-fonts warning | open | |

## Progress log

- 2026-11-25: program opened (NT-00, opf#1468). The owner took six decisions, D1 to D6, in the supervisor session; they are recorded in
  [decisions.md](decisions.md).
- 2026-11-25: NT-00 merged (#1488) and NT-01 merged (#1490): the shared result format, with fixtures from the 0.36.0 Keynote round.
- 2026-11-25: NT-02 in review as a draft (#1495): the Keynote driver behind the five verbs, tested without Keynote. Not run in
  Keynote yet; the first real run needs the owner's word. NT-03 (#1491) and NT-07 (#1489) in review.
- 2026-11-25: the result format and the five verbs posted to the Windows supervisor on opf#1468 for agreement; not agreed yet.
- 2026-11-25: NT-04 in three parts: 04a (#1496, pictures), 04b (#1497, the round trip), 04c (branch `codex/nt-04c-classify`,
  classify, the summary and the 0.36.0 Keynote baseline). NT-05 in two parts: 05a (branch `codex/nt-05a-manifest`, the tiers
  and per-target expectations in the manifest) and 05b (branch `codex/nt-05b-native-command`, `pnpm native`).
- 2026-11-25: acceptance on the recorded 0.36.0 Keynote round. The picture scores are within 0.00001 of the round's on 841
  slides. The object table equals the round's in every cell but one, a table-cell link the round's script did not read.
  Classified against the known data and the 0.36.0 baseline, the recorded round gives 0 new. As a regression detector with
  0.35.1 as the baseline it flags 152 of 250 matrix slides, finds the import failure and two of the three highlight-legend
  slides, and does not see the one-space shift; this is why a change names its slides in its fragment (`native:`).
- 2026-11-25: NT-06 in progress. The LibreOffice runner writes the shared format (#1498). A defect found on the way is fixed
  (#1499): the fontconfig file of `opf-preview-fonts` was not well-formed XML since v0.34.0, so the nightly's `opf` font profile
  ran with stock fonts. Open: the shared classify step for Impress, `known/impress.json`, and reading the first nightly artifact.
- 2026-11-25: NT-08 in review: [docs/native-testing.md](../../native-testing.md) describes the process and the gate of decision
  D1; `docs/release-process.md` places the Keynote run between the dry run and the real run.
