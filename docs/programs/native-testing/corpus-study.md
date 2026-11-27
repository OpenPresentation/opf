# Native-test corpus study

Result summary of the study behind [decision D7](decisions.md#d7-the-size-of-the-corpus), 2026-11-27. Program: [README.md](README.md).

The numbers were computed by a subagent in the supervisor's session from the recorded 0.36.0 Keynote round and the 0.37.0 corpus. The
data and the scripts are not in this repository (evidence stays out of main). "Ran" below means computed from that data.

## The question

Keynote opened about 400 files (about 107 minutes) in one chain. How many files does a native run need, and when should each part run?

## The answer

Most of that run added nothing the 119 graded files of 0.36.0 had not already shown. Every finding of the round sits on 27 files, but a
set chosen from deck content alone catches only 72% of the reviewed findings, because the rest came from content-stress decks that lived
outside the repository. So: one trimmed corpus of about 80 files for every release, a changed-slides run for every candidate, and the
examples only on a new application version.

## Key numbers (ran)

| Measure | Value |
| --- | --- |
| Slides that showed no finding another file did not also show | 1,228 of 1,286 (95%) |
| Files with nothing unique | 100 of 119 |
| Files that hold every finding (122 units) | 27 files, 7.7 Keynote minutes |
| Files for full unit coverage (1,686 units) | 80 files, 17.2 minutes |
| Findings caught by choosing from deck content alone | 72% of reviewed, 77% of all; the other 28% came from stress decks |
| Known records no tier could reproduce | 17 of 64 (their decks exist only on the Mac); nine decks, 2.96 minutes, fix it |
| Variants | 23 of 27 showed nothing beyond their default; the three that did are `native-body` |
| Time model (584 opens) | 4.15 s per file plus 0.86 s per slide |
| Schema locations the 0.37.0 corpus covers | all 1,549 |

## Options

| | A: one manifest, trimmed | B: cover-selected | C: generated per-unit corpus |
| --- | --- | --- | --- |
| Candidate | smoke plus changed slides, 4 to 8 minutes | same | same |
| Release | about 80 files, about 18 minutes | about 40 files, about 10 minutes (inferred) | about 25 files, about 5.5 minutes (model) |
| Rarely | about 250 files, about 75 minutes | same | same |
| Risk | low; keeps all 64 records | merge errors move records | loses content stress; all places re-graded |
| Chosen | **yes (owner, 2026-11-27)** | later, as the coverage report shows | no |

## Not measured

- PowerPoint results.
- LibreOffice findings per deck (the nightly opens 218 files in about 17 minutes, report-only).
- Grades of the examples and of the 0.35.1 control; nobody has looked at them.
- Keynote warnings for 65 of 119 files (read for 54), so the warning counts are incomplete.
- Whether the 0.37.0 decks find more than the 0.36.0 ones, and Keynote time on another Mac.
- The `static`, `picture` and `shapes` variants in PowerPoint; the Windows supervisor has no record of them showing anything, which is an
  absence of evidence, not a measurement.
