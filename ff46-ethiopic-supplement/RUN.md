# FF-46: PowerPoint check of the theme script supplement (opf#375)

An Amharic deck that selects Ebrima exported the theme entry `<a:font script="Ethi" typeface="Nyala"/>` (the language's
catalog default), and PowerPoint's `Presentation.Fonts` listed Nyala beside Ebrima (the one failing deck of the 48-deck
one-family-per-deck run, opf#357). The fix is in core (`resolveScriptFonts`, branch `codex/ff-46-ethiopic-supplement`):
when the design font scheme sets an explicit `complexScript` slot (the form of the native deck) or is a `cs` scheme for the deck's language, the supplement of a latin-slot script (Ethi, Armn,
Geor) names that scheme's family. opf-pptx writes the supplement as core resolves it and is unchanged.

## Contents

- `decks/<id>-before.pptx`: built with core `main` b66ea0c0 (0.12.2). `decks/<id>-after.pptx`: core `d9d7880a` (the fix).
  Both with opf-pptx `main` 7c93a1b (0.12.3), seed 1 and a fixed timestamp. sha256 and the file's script entry per deck are in
  `manifest.json`.
- Changed decks (before differs from after):
  - `ethi-amharic-ebrima`: the opf#375 repro. Amharic, inline `cs` scheme Ebrima (`languages: ["Amharic"]`). Theme cs, ea and latin all
    read Ebrima. Before: `Ethi` = Nyala. After: `Ethi` = Ebrima. **Acceptance: `Presentation.Fonts` lists only Ebrima.**
  - `ethi-amharic-ebrima-inline`: **built exactly like the Windows deck `scripts-40-amharic-ebrima`**: language `am`, design
    `fontScheme = {major: 'Ebrima', minor: 'Ebrima', complexScript: {major: 'Ebrima', minor: 'Ebrima'}}`. This is the acceptance deck:
    `Presentation.Fonts` lists only Ebrima after (Ebrima and Nyala before).
  - `ethi-amharic-noto`, `armn-armenian-noto`, `geor-georgian-noto`: the same class on the catalog Google-labelled schemes
    (`noto-sans-ethiopic`, `noto-sans-armenian`, `noto-sans-georgian`). Before: Nyala / Sylfaen / Sylfaen. After: the scheme family.
    Expected `Presentation.Fonts`: the one Noto family. The Noto families are not installed on a stock Windows host: PowerPoint
    still reports the selected name (a substitution is a host finding, as in the earlier runs).
- Controls (before and after are **byte-identical**, same sha256, and must read the same): `ethi-amharic-default` (Aptos deck, the
  language's own Nyala), `ethi-amharic-nyala`, `armn-armenian-sylfaen`, `geor-georgian-sylfaen` (a scheme that equals the
  language default), `jpan-japanese-msgothic-inline` (inline `eastAsian` MS Gothic on a Japanese deck: the `Jpan` entry already follows the
  slot, so nothing changes), `latin-english-control` (English: the vendored Office entries, no supplement).
- `manifest.json`: per deck the OPF document, `expect.fonts` (the families the deck chose; `Presentation.Fonts` may list only
  these and never an empty name; per the accepted RR-05 reading PowerPoint may omit theme-only script families), `expect.family`
  (the `Name` of the runs holding the script sample) and the file facts.
- `native-read-deck.ps1`, `run-set.ps1`: the same read-only readers as the other probe sets (`Presentations.Open(path, -1, 0, 0)`;
  `Presentation.Fonts`, every design's theme fonts, every run's `Name` / `NameFarEast` / `NameComplexScript`, a 1280 x 720 PNG per
  slide). One child `powershell.exe` per deck, 90 s deadline, no retries; PowerPoint is never saved, quit or killed.
- `compare.mjs`: checks `out/*.json` against the manifest and writes `out/compare.md` / `out/compare.json` (no npm install).

## Run (supervisor, Windows with desktop PowerPoint 365)

```powershell
# 1. Start PowerPoint by hand (no deck open). 2. In this folder:
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1
node compare.mjs
```

## Expected result

| Deck | before | after |
| --- | --- | --- |
| `ethi-amharic-ebrima`, `ethi-amharic-ebrima-inline` | `Presentation.Fonts` = Ebrima, Nyala: **BASELINE (expected fail)**, the opf#375 defect | Ebrima only: PASS |
| `ethi-amharic-noto`, `armn-armenian-noto`, `geor-georgian-noto` | the Noto family plus Nyala / Sylfaen: BASELINE | the Noto family only: PASS |
| the six controls | PASS | PASS, read equal to before |

Every deck opens without a repair prompt and reads `stage: done`. If a `before` deck of a changed pair does not list the extra
family, say so: the baseline did not reproduce and the result is recorded as is, not adjusted.

Evidence afterwards: copy `out/compare.md`, `out/compare.json` and `out/run.json` (no decks, PNGs or absolute paths) to
`docs/evidence/ff-46-theme-supplement-native-<yyyymmdd>/` in core with a README, and link it from opf#375.

Rebuild (not needed): `OPF_CORE_DIST=<core dist> node --import <core>/scripts/register-local-opf.mjs build.mjs before|after <opf-pptx checkout>`
for each side (core `dist` dirs from the two commits; opf-pptx with `npm ci` and a built `dist/`), then
`node build.mjs manifest <core before sha> <core after sha>`.
