# Native-app testing: burndown

Goal and boundary: [README.md](README.md). Decisions: [decisions.md](decisions.md). Status values: `open`, `in-progress`, `in review`,
`done`, `descoped`. Whoever changes an item's state edits its row and appends a line to the progress log in the same pull request.

| ID | Item | Done when | Status | PR |
| --- | --- | --- | --- | --- |
| NT-00 | Open the program: goal, definition of done, invariants, the owner's decisions | The program pages are merged | done | #1488 |
| NT-01 | The shared result format: per target, per file and per slide, whether it opened, the application's own import warnings, the slide picture's score, the object list in one vocabulary, and the round-trip result. A JSON schema, plus fixtures cut from the 0.36.0 round's real output | A Node test validates the fixtures; no application is needed | done | #1490; #1510 (with the additions of NT-01b: kinds `diagram` and `media`, alt text, `details`, edit cases) |
| NT-02 | The Keynote driver behind the five verbs, ported from the evidence branch's `kn-run`, `kn.applescript`, `knprobe.py` and `kn-close`. Before it merges, the format and the verbs are agreed with the Windows supervisor on opf#1468 | On the Mac it opens the smoke decks and writes the NT-01 format; the pure parts have tests that run in CI without Keynote | done | #1495. First run in Keynote on 2026-11-27 (Keynote 16.0, macOS 26.6.2): one file, then the smoke tier; the driver needed no fix |
| NT-03 | Known differences as data: one record per difference (id, feature, deck and slide, what a user sees, application versions first and last seen, whose it is, workaround, issue). Keynote's records are seeded from the export skill's table and the 0.36.0 round's findings index; the skill's Keynote table is generated from the data | The generated table replaces the hand-written one; a check fails when they drift | done | #1491 |
| NT-04 | Compare and classify: OPF's preview against the application's picture (Display P3 and alpha handled once, here), then every slide is same, known and still there, known and gone, or new; a labeled sheet only for "new" | Run on the 0.36.0 round's recorded Keynote output, it reproduces the round's Known list and flags its new findings | done | #1496, #1497, #1504 |
| NT-05 | One entry point, `pnpm native <target> [--tier smoke\|release\|full] [--decks …] [--baseline <version>]`; the tiers defined from the qualification manifest; the manifest refreshed (it is at 0.34.0) and given per-target expectations | `pnpm native keynote --tier smoke` runs end to end on the Mac | done | #1503 (tiers and per-target expectations), #1510 (the command). `pnpm native keynote --tier smoke --release 0.37.0` ran end to end on 2026-11-27 on the 0.37.0 candidate `4554407c9`: 13 of 13 files, 230 s in Keynote; 199 slides known and still there, 9 new, 1 not compared. After review nothing blocked under D1 (result on opf#1538); one Keynote limit on a new feature is opf#1541 |
| NT-06 | The LibreOffice runner writes the same result format and uses the same classify step | The nightly job's artifact is in the shared format | in-progress | #1498, #1499. The nightly of 2026-11-26 wrote the shared format (218 results, all valid). Open: the nightly running the classify step, `known/impress.json`, a probe for Impress |
| NT-07 | A changelog fragment that touches the exported file names its slide (`native: [deck#slide]`), or says `native: none` with a reason; a check warns when it is missing | `changes/README.md` documents it; the warning runs in `check:changed` | done | #1489 |
| NT-08 | The process in the docs: where a native run sits in `docs/release-process.md`, who starts it, what blocks | Merged; the dated handoff pages no longer carry the only description | done | #1510 |
| NT-09 | A Keynote export profile (opf#1298): safe typefaces and static slide numbers together, so a default-theme deck opens in Keynote on a Mac without Microsoft 365 with no missing-fonts warning ([D2](decisions.md#d2-what-a-keynote-user-gets-by-default)). This is export code, scheduled with the 0.37.0 work, and not started before NT-05 | The design is agreed on opf#1298 with the release supervisor; `pnpm native keynote --tier smoke` on a profile export shows no missing-fonts warning | in review | #1508 (`reader: "keynote"` built; rebased on 2026-11-27 with a `reader-keynote` corpus variant; held unmerged until its Keynote check, which has not run yet) |
| NT-10 | Stress decks in the corpus: the content-stress decks of the 0.36.0 round (long names, many entries, right-to-left mixes) and the other decks that known differences name, moved into the repository (D7) | Every known difference has a place in the release tier | in review | #1547 |
| NT-11 | Trim the smoke tier to its time budget and settle which variants each tier keeps (see the note under [D8](decisions.md#d8-the-keynote-gate-for-0370)) | Smoke fits its budget with the files #1508 adds, and each tier lists the variants it runs | open | |
| NT-12 | A coverage report and `check:native-coverage`: known places, schema locations, the earned place of each deck, and a time budget per tier | The check fails when a known difference has no place in the release tier, when a deck adds no coverage, or when a tier is over its budget | in review | #1545 |
| NT-13 | Per-slide export hashes in the release summary, and `--tier candidate` (the smoke tier plus the files with a changed slide) | A candidate run selects the changed slides from the hashes of the last release | in review | #1546 |
| NT-14 | LibreOffice reads the manifest's tiers instead of its own case list | The nightly's file list comes from `tiers` in the manifest | in review | #1544 |
| NT-15 | Keynote's import warnings read reliably (read for 54 of 119 files in the 0.36.0 round, not at all by the new runner) | A run records the warnings panel for every file it opens | open | |
| NT-16 | The PowerPoint driver for `pnpm native powerpoint` on Windows; item owner: the Windows release supervisor's session (branch `codex/nt-16-powerpoint-driver`) | `pnpm native powerpoint` writes the shared result files on the owner's Windows computer | in work | |

## Progress log

- 2026-11-25: program opened (NT-00, opf#1468). The owner took six decisions, D1 to D6, in the supervisor session; they are recorded in
  [decisions.md](decisions.md).
- 2026-11-25: NT-00 merged (#1488) and NT-01 merged (#1490): the shared result format, with fixtures from the 0.36.0 Keynote round.
- 2026-11-25: NT-02 in review as a draft (#1495): the Keynote driver behind the five verbs, tested without Keynote. Not run in
  Keynote yet; the first real run needs the owner's word. NT-03 (#1491) in review.
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
- 2026-11-25: NT-07 merged (#1489): a changelog fragment names the slides that show its change (`native:`).
- 2026-11-25: the release supervisor on Windows agreed the result format and the five verbs on opf#1468
  ([comment](https://github.com/OpenPresentation/opf/issues/1468#issuecomment-7174529699)), with the additions it asked for
  (NT-01b: 15 kinds with `diagram` and `media`, alt text, `details` on the result and the slide, edit cases beside `resave`).
  The Windows command that writes a run directory is the release supervisor's and comes after the 0.37.0 format changes.
- 2026-11-25: the Keynote export profile's design agreed on opf#1298 by the 0.37.0 release supervisor under the owner's
  delegation ([decisions.md](decisions.md#agreed-after-the-decisions)); NT-09 in review (#1508), held until one Keynote smoke
  run of profile exports.
- 2026-11-25: merged: NT-02 (#1495), NT-03 (#1491), NT-04c (#1504), NT-05a (#1503), NT-06 (#1498). NT-01b, NT-05b
  (`pnpm native`) and NT-08 go in one pull request. On the recorded 0.36.0 qualification run, `pnpm native keynote --from-run
  … --baseline 0.36.0` gives 591 slides known and still there, 3 not compared, 0 new (exit 0).
- 2026-11-25: nothing in this program has opened Keynote, PowerPoint or LibreOffice yet.
- 2026-11-26: the nightly of 2026-11-26 wrote the shared format for LibreOffice: 218 results (109 decks, opf and stock fonts), all valid;
  open, render and resave done, probe not run. Posted on opf#1468. Still open for NT-06: classify in the nightly, `known/impress.json`,
  a probe for Impress.
- 2026-11-27: first run in Keynote (owner: "Unlocked, go ahead"; the Keynote round's session gave the slot): one file, then
  `pnpm native keynote --tier smoke --release 0.37.0` on the candidate `4554407c9`. 13 of 13 files, 230 s; 199 known and still there,
  9 new, 1 not compared. After review nothing blocked (opf#1538); coverage-charts slides 21 and 22 are a Keynote limit (opf#1541).
  NT-02 and NT-05 done. v0.37.0 was released the same day.
- 2026-11-27: corpus study of the 0.36.0 round ([corpus-study.md](corpus-study.md)); the owner took option A (D7). The release
  supervisor's answer on the Keynote gate is recorded as D8. Items NT-10 to NT-16 opened; NT-10, NT-12, NT-13 and NT-14 are in review,
  NT-16 is in work on Windows.
- 2026-11-27: #1508 (NT-09) rebased on the candidate with a `reader-keynote` corpus variant; its Keynote check has not run yet.
