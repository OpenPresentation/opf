# FF-05: PowerPoint check of per-slide script fonts (opf-pptx#168)

A slide whose own font scheme selects East Asian / complex-script fonts other than the first slide's was drawn in the
first slide's script fonts: runs name no `ea`/`cs` (FF-05, PowerPoint lists an explicit run `ea`/`cs` as an empty-name
font) and the only theme was built from slide 1. The fix gives each further script profile its own slide master (a copy
of master 1 and its layout) whose theme is the presentation theme with that slide's script slots and per-script entry.
This set checks what only PowerPoint can: that the decks open without repair, that each slide's script text reads its
own family (`NameFarEast` / `NameComplexScript`), that `Presentation.Fonts` lists no empty name (FF-05 stays fixed),
and that a single-profile deck is unchanged.

## Contents

- `decks/<id>-after.pptx`: opf-pptx `codex/rr-17-per-slide-script-fonts` (the fix). `decks/<id>-before.pptx`: opf-pptx
  `codex/rr-17-pptxgenjs-plus` `3fb1387` (#165, the base of the fix). Commits and sha256 per file are in `manifest.json`.
- `a-three-profiles`: three slides, latin Arial; slide 1 Japanese with East Asian Meiryo, slide 2 Arabic with
  complex-script Traditional Arabic (and speaker notes), slide 3 Hindi with complex-script Nirmala UI (inline font
  schemes). After: 3 slide masters. Before: 1 (the baseline: slides 2 and 3 read slide 1's slots).
- `a2-thai-repro`: the opf-pptx#168 repro (Thai; slide 1 `angsana-new`, slide 2 `dilleniaupc`). After: 2 masters; the
  issue's acceptance is slide 2 `NameComplexScript` = DilleniaUPC with no empty name in `Presentation.Fonts`.
- `b-single-profile`: Japanese (Meiryo through the language) with per-slide Latin-only schemes: one profile, so before
  and after are **byte-identical** (same sha256) and must read the same.
- `c-mixed-default`: Japanese deck default (Meiryo) on slides 1 and 3, `ms-mincho` on slides 2 and 4. After: 2
  masters, slides 1/3 on master 1 and 2/4 on master 2.
- `manifest.json`: per deck the OPF document, `expect.fonts` (every family the deck names: `Presentation.Fonts` may list
  only these, never an empty name; per the accepted RR-05 reading PowerPoint may omit theme-only script families),
  `expect.slides[i]` (`master`, the script sample, `slot` = `nameFarEast` or `nameComplexScript`, expected `family`),
  and per file the package facts (masters, themes, docProps "Fonts Used", 0 runs with explicit `ea`/`cs`).
- `native-read-deck.ps1`: reads ONE deck read-only in the running PowerPoint (`Presentations.Open(path, -1, 0, 0)`):
  `Presentation.Fonts`, every design with its master's theme fonts (`ThemeFontScheme`, latin / complex script / East
  Asian), each slide's design, every text run's `Name` / `NameFarEast` / `NameComplexScript`, the notes body runs, and a
  1280 x 720 PNG per slide; closes the deck. It never saves, quits or kills PowerPoint.
- `run-set.ps1`: runs the reader once per deck in its own `powershell.exe` with a 90 s deadline (only that child is
  stopped on timeout); no retries; `out/run.json` records each run.
- `compare.mjs`: checks `out/*.json` against the manifest and writes `out/compare.md` / `out/compare.json` (no npm
  install needed).

## Run (supervisor, Windows with desktop PowerPoint 365)

```powershell
# 1. Start PowerPoint by hand (no deck open). 2. In this folder:
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1
node compare.mjs
```

Fonts needed on the host: Arial, Meiryo, MS Mincho, Traditional Arabic, Nirmala UI, Angsana New, DilleniaUPC, Georgia,
Aptos (all ship with Windows or its supplemental font features). A missing family is a host finding, not a deck
failure: record it. Watch the first deck: if PowerPoint shows a repair or protected-view dialog, note it (deck and
text), dismiss it and let the run continue; a repair prompt on any `after` deck is a FAIL. `-Only <id>` reads one
deck's before/after pair. Never rerun a failed deck in place: preserve `out/` and report.

## Expected result

- Every deck opens without a repair prompt and reads `stage: done`.
- `after` decks PASS: no empty name in `Presentation.Fonts`, nothing outside `expect.fonts`; on every slide the runs
  holding the script sample read the expected family; each slide sits on the expected design (master) and the deck
  has as many designs as masters.
- `before` decks of `a` and `a2` show `BASELINE (expected fail)` from slide 2 on (they read slide 1's family): the
  opf-pptx#168 defect, kept as evidence.
- `b-single-profile`: both files PASS and `before = after` PASS (same bytes, same native read).
- Notes: the one notes master keeps the presentation theme, so the Arabic notes of `a-three-profiles` slide 2 read
  slide 1's slots (`script-font-notes-not-exported` is reported on export); `compare.md` lists the notes reads for the
  record, they are not a pass criterion.
- Evidence: copy `out/compare.md`, `out/compare.json` and `out/run.json` (no decks, PNGs or absolute paths) to
  `docs/evidence/ff-05-per-slide-script-fonts-native-<yyyymmdd>/` in core with a README, and link it from opf-pptx#168.

Rebuild (not needed): `node build.mjs <opf-pptx base checkout> <opf-pptx fix checkout>` (each with `npm ci` and a
built `dist/`).
