# FF-46: native read of the theme script supplement fix (2026-10-05)

Item: [opf#375](https://github.com/OpenPresentation/opf/issues/375) (the theme script supplement names Office's default, Nyala,
instead of the deck's selected Ethiopic family, Ebrima), fix [opf#377](https://github.com/OpenPresentation/opf/pull/377) (core
`resolveScriptFonts`: when the design font scheme sets an explicit `complexScript` slot, or is a `cs` scheme for the deck's
language, the supplement of a latin-slot script, `Ethi`, `Armn` or `Geor`, names that scheme's family). The defect was the one
failing deck, `scripts-40-amharic-ebrima`, of the one-family-per-deck run in
[ff-46-documented-visual-native-20261005](../ff-46-documented-visual-native-20261005/README.md).

- **Host:** Windows 11, PowerPoint 365 (`Application.Version` 16.0, build 20430), run on 2026-10-05. The owner had installed the 16
  Windows `Language.Fonts` supplemental packs before the run, so all 27 supplemental families were present.
- **Protocol:** each deck was opened read-only in the running PowerPoint with `Presentations.Open(path, -1, 0, 0)`, one child
  `powershell.exe` per deck, 90 s deadline, no retries. Nothing was saved, PowerPoint was not quit and no process was killed.
- **Result:** all 22 reads finished (`stage: done`, exit code 0, no timeout; [run.json](run.json)). The five changed decks show the
  opf#375 baseline before and pass after; the six controls are byte-identical before and after and read the same. **This resolves
  opf#375 natively once opf#377 merges.**
- **Not committed:** decks, PNGs and the per-deck native read-outs. The comparison output, the run log and a deck list are.

## Builds

| Side | core | opf-pptx |
| --- | --- | --- |
| before | `main` `b66ea0c0` (0.12.2) | `main` `7c93a1b` (0.12.3) |
| after | [opf#377](https://github.com/OpenPresentation/opf/pull/377) head `d9d7880a` (`codex/ff-46-ethiopic-supplement`) | `main` `7c93a1b` (0.12.3) |

The fix is in core; opf-pptx writes the supplement as core resolves it and is the same build on both sides. Export options: seed 1
and a fixed timestamp. The set (`ff46-ethiopic-supplement`) was rebuilt on this PC from the orphan branch
`codex/probe-sets-20261005` (`cb12612e`); its manifest matched the Mac's committed manifest byte for byte (22 / 22 decks), and the
Mac's zip copy (sha256 `6ad30fd1…`) matched deck for deck. [decks.json](decks.json) lists the 22 decks with sha256, the file's
script entry and a summary of each native read; every sha256 was re-checked against the deck read.

## Result

Changed decks (BASELINE before, PASS after):

| Deck | Theme supplement before / after | `Presentation.Fonts` before | `Presentation.Fonts` after |
| --- | --- | --- | --- |
| `ethi-amharic-ebrima` | `Ethi` Nyala / Ebrima | Ebrima, Nyala | Ebrima (Nyala removed) |
| `ethi-amharic-ebrima-inline` | `Ethi` Nyala / Ebrima | Ebrima, Nyala | Ebrima |
| `ethi-amharic-noto` | `Ethi` Nyala / Noto Sans Ethiopic | Noto Sans Ethiopic, Nyala | Noto Sans Ethiopic |
| `armn-armenian-noto` | `Armn` Sylfaen / Noto Sans Armenian | Noto Sans Armenian, Sylfaen | Noto Sans Armenian (Sylfaen removed) |
| `geor-georgian-noto` | `Geor` Sylfaen / Noto Sans Georgian | Noto Sans Georgian, Sylfaen | Noto Sans Georgian (Sylfaen removed) |

`ethi-amharic-ebrima-inline` is built exactly like the FF-46 deck `scripts-40-amharic-ebrima` (language `am`, design
`fontScheme = {major: 'Ebrima', minor: 'Ebrima', complexScript: {major: 'Ebrima', minor: 'Ebrima'}}`), so it is the acceptance
deck for opf#375. `ethi-amharic-ebrima` is the same choice through the `languages: ["Amharic"]` path.

Controls (byte-identical before and after, equal native reads, PASS on both sides):

| Deck | Why it does not change | `Presentation.Fonts` |
| --- | --- | --- |
| `jpan-japanese-msgothic-inline` | inline `eastAsian` MS Gothic on a Japanese deck: the `Jpan` entry already follows the slot | MS Gothic |
| `ethi-amharic-default` | Aptos deck, the language's own Nyala | Aptos Display, Nyala, Aptos |
| `ethi-amharic-nyala` | the scheme equals the language default | Nyala |
| `armn-armenian-sylfaen` | the scheme equals the language default | Sylfaen |
| `geor-georgian-sylfaen` | the scheme equals the language default | Sylfaen |
| `latin-english-control` | English: the vendored Office entries, no supplement | Aptos Display, Aptos |

In every deck with an expected family the runs holding the script sample read it in `Name`, and no deck lists an empty name in
`Presentation.Fonts`.
Details per deck: [compare.md](compare.md) and [compare.json](compare.json), written by the set's `compare.mjs` from the read-outs
and the manifest.

## Reading notes

- **Accepted RR-05 reading:** families named only in a theme slot need not be listed in `Presentation.Fonts`; the check fails only on
  an extra or empty name. The baseline failure is such an extra name: the theme-only supplement family (Nyala or Sylfaen) that the
  deck did not choose.
- The Noto families are not part of Windows or its supplemental packs. PowerPoint reports the selected name whether or not the face is
  installed, so these decks check names, not which face drew the glyphs.
- The check is a name read-back (`Presentation.Fonts`, the master theme fonts, each run's `Name` / `NameFarEast` /
  `NameComplexScript`); the `themeScript` values are file facts read from the package, not from PowerPoint.

## Files

- [compare.md](compare.md), [compare.json](compare.json): the set's comparison output, unchanged except that host paths would be
  replaced by `<set>` (none occurred). The before = after rows of the controls are in `compare.md` only.
- [run.json](run.json): one entry per deck (child process, timeout flag, exit code), re-indented from the PowerShell output.
- [decks.json](decks.json): the builds and, per deck, file name, bytes, sha256, whether the pair changed, the theme script entry
  (major / minor), and the native read summary (`stage`, PowerPoint version, `Presentation.Fonts`, each design's minor theme fonts,
  each slide's design index).
