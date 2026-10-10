# RR-05 / FF-12: bounded native font sample on the 0.18 packages (2026-10-10)

This re-runs the native sample of [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 1 on the published 0.18
packages. It uses the same twelve decks as [rr-05-ff-12-native-20261005](../rr-05-ff-12-native-20261005/README.md), which closed
FF-12 on 0.12. The cap is 12 decks.

**Result: PASS on all 12 decks.**
- No deck's `Presentation.Fonts` names a family outside the deck's chosen ones.
- Every Latin family the runs draw is listed.
- The theme slots of the slide master and the notes master equal the file's.
- No run names another family.
- `07-per-slide-override` reads Calibri, Georgia, Calibri and Courier New on its four slides.

The output is in [compare.md](compare.md) and [compare.json](compare.json).

## Host and method

- **Host:** Windows 11 (`Microsoft Windows NT 10.0.26200.0`), desktop PowerPoint 365 `Application.Version` 16.0 build 20430,
  Windows PowerShell 5.1.26100.9444, culture en-US.
- **Who ran what:** the supervisor session ran Office. An agent built the decks and scripts without opening Office.
- **Packages:** the decks were built from the published npm packages on Node 24.21.0:
  - `@openpresentation/opf` 0.18.1;
  - `@openpresentation/opf-render` 0.18.0;
  - `@openpresentation/opf-pptx` 0.18.0;
  - `@openpresentation/opf-editor` 0.18.0;
  - with `zipDate` 2026-10-10T00:00:00Z.

  The build is deterministic, and the sha256 of each deck is in [decks.json](decks.json). `run-deck.ps1` checked it before opening
  the deck.
- **Run limits:** each deck was read in its own `powershell.exe` with a 90 s deadline and no retries. Every read took 2 to 7 s
  ([run.json](run.json)).
- **The reader** (`native-read-deck.ps1`):
  - attaches with `GetActiveObject` and opens read-only with `Presentations.Open(path, -1, 0, 0)`;
  - reads `Presentation.Fonts`, then the theme font slots of the slide master and of the notes master, then every run's `Name`,
    `NameFarEast` and `NameComplexScript`, the tables, charts and notes;
  - exports slide PNGs, then closes with `Saved = -1`;
  - never saves, quits or kills PowerPoint.

## Results

| Deck | Covers | `Presentation.Fonts` (native) | Verdict |
| --- | --- | --- | --- |
| 01-carlito-code-chart-table-notes | Carlito with code, chart, table and notes | Carlito, Roboto Mono | PASS |
| 02-carlito-code-family-carlito | same, `fontScheme.code` Carlito | Carlito | PASS |
| 03-default-aptos | the default scheme | Aptos Display, Aptos, Roboto Mono | PASS |
| 04-ja-meiryo | re-run of `lang-ja-meiryo` | Meiryo | PASS |
| 05-ar-rtl | Arabic, right to left | Aptos Display, Aptos | PASS (Arabic Typesetting theme-only) |
| 06-monospace-consolas | monospace scheme | Consolas | PASS |
| 07-per-slide-override | Calibri deck, Georgia slide 2, Courier New slide 4 | Calibri, Georgia, Courier New | PASS |
| 08-cjk-in-latin | Japanese and Chinese inside a Latin deck | Aptos Display, Aptos | PASS (Meiryo theme-only) |
| 09-ko-malgun | Korean | Malgun Gothic | PASS |
| 10-hi-mangal | Hindi | Aptos Display, Aptos | PASS (Mangal theme-only) |
| 11-he-rtl | Hebrew, right to left | Aptos Display, Aptos | PASS (David theme-only) |
| 12-serif-georgia | serif scheme | Georgia | PASS |

The result is the same as on 0.12.
- PowerPoint leaves a theme-only East Asian or complex-script family out of `Presentation.Fonts` when the deck's Latin family is
  different. This is the reading accepted on 2026-10-05.
- `compare.mjs` reports those families as "soft" (allowed to be absent), for East Asian and complex script alike.
- The chosen script family is still proven: the theme slots and the runs read it back.

## Harness notes

- **Exit codes.** Every `run.json` records `exitCode: null`. `run-deck.ps1` did not cache the child process handle, so PowerShell
  reported no exit code. `compare.mjs` counts a run as successful only when its status is `completed` and its read-out JSON exists,
  parses and reached `stage: done`. A missing read-out still fails. `run-deck.ps1` now caches the handle (`$null = $p.Handle`), which
  was checked against a child that exits with 3.
- **Theme references.** PowerPoint reports a run slot that follows the theme as a reference: here only `+mn-cs`, on 134 runs of these
  decks.
  - `compare.mjs` resolves references through the read-out's slide-master theme slots, then judges the resolved name.
  - Every `+mn-cs` here points at the complex-script slot that a Latin deck leaves empty by design (FF-05 / FF-49). It is counted per
    deck under `themeReferences` and does not fail (supervisor decision, 2026-10-10).
  - A reference that cannot be resolved would fail. There were none.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the comparison.
- [decks.json](decks.json): the set. For each deck it lists the sha256, the expected, required and soft families, the theme slots
  written to the master and notes-master themes, the export diagnostics and the validation warnings.
- [run.json](run.json): one record per deck, plus the host.

The decks, the raw read-outs and the PNGs are not committed.
