# Native-app testing: burndown

Goal and boundary: [README.md](README.md). Decisions: [decisions.md](decisions.md). Status values: `open`, `in-progress`, `in review`,
`done`, `descoped`. Whoever changes an item's state edits its row and appends a line to the progress log in the same pull request.

| ID | Item | Done when | Status | PR |
| --- | --- | --- | --- | --- |
| NT-00 | Open the program: goal, definition of done, invariants, the owner's decisions | The program pages are merged | in review | |
| NT-01 | The shared result format: per target, per file and per slide, whether it opened, the application's own import warnings, the slide picture's score, the object list in one vocabulary, and the round-trip result. A JSON schema, plus fixtures cut from the 0.36.0 round's real output | A Node test validates the fixtures; no application is needed | open | |
| NT-02 | The Keynote driver behind the five verbs, ported from the evidence branch's `kn-run`, `kn.applescript`, `knprobe.py` and `kn-close`. Before it merges, the format and the verbs are agreed with the Windows supervisor on opf#1468 | On the Mac it opens the smoke decks and writes the NT-01 format; the pure parts have tests that run in CI without Keynote | open | |
| NT-03 | Known differences as data: one record per difference (id, feature, deck and slide, what a user sees, application versions first and last seen, whose it is, workaround, issue). Keynote's records are seeded from the export skill's table and the 0.36.0 round's findings index; the skill's Keynote table is generated from the data | The generated table replaces the hand-written one; a check fails when they drift | open | |
| NT-04 | Compare and classify: OPF's preview against the application's picture (Display P3 and alpha handled once, here), then every slide is same, known and still there, known and gone, or new; a labeled sheet only for "new" | Run on the 0.36.0 round's recorded Keynote output, it reproduces the round's Known list and flags its new findings | open | |
| NT-05 | One entry point, `pnpm native <target> [--tier smoke\|release\|full] [--decks …] [--baseline <version>]`; the tiers defined from the qualification manifest; the manifest refreshed (it is at 0.34.0) and given per-target expectations | `pnpm native keynote --tier smoke` runs end to end on the Mac | open | |
| NT-06 | The LibreOffice runner writes the same result format and uses the same classify step | The nightly job's artifact is in the shared format | open | |
| NT-07 | A changelog fragment that touches the exported file names its slide (`native: [deck#slide]`), or says `native: none` with a reason; a check warns when it is missing | `changes/README.md` documents it; the warning runs in `check:changed` | open | |
| NT-08 | The process in the docs: where a native run sits in `docs/release-process.md`, who starts it, what blocks | Merged; the dated handoff pages no longer carry the only description | open | |
| NT-09 | A Keynote export profile (opf#1298): safe typefaces and static slide numbers together, so a default-theme deck opens in Keynote on a Mac without Microsoft 365 with no missing-fonts warning ([D2](decisions.md#d2-what-a-keynote-user-gets-by-default)). This is export code, scheduled with the 0.37.0 work, and not started before NT-05 | The design is agreed on opf#1298 with the release supervisor; `pnpm native keynote --tier smoke` on a profile export shows no missing-fonts warning | open | |

## Progress log

- 2026-11-25: program opened (NT-00, opf#1468). The owner took six decisions, D1 to D6, in the supervisor session; they are recorded in
  [decisions.md](decisions.md).
