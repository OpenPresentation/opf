# FF-05: native read of per-slide script-font masters (2026-10-05)

Item: [opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168) (a per-slide East Asian or complex-script font is
lost on export), fix [opf-pptx#170](https://github.com/OpenPresentation/opf-pptx/pull/170) (one slide master and theme per script
profile).

- **Host:** Windows 11, PowerPoint 365 (`Application.Version` 16.0, build 20430), run on 2026-10-05. The owner had installed the 16
  Windows `Language.Fonts` supplemental packs before the run, so all 27 supplemental families were present.
- **Protocol:** each deck was opened read-only in the running PowerPoint with `Presentations.Open(path, -1, 0, 0)`, one child
  `powershell.exe` per deck, 90 s deadline, no retries. Nothing was saved, PowerPoint was not quit and no process was killed.
- **Result:** all 7 reads finished (`stage: done`, exit code 0, no timeout; [run.json](run.json)). Every `after` deck passes, the two
  `before` decks of the changed pairs show the expected opf-pptx#168 baseline, and the single-profile control reads the same before
  and after.
- **Not committed:** decks, PNGs and the per-deck native read-outs. The comparison output, the run log and a deck list are.

## Builds

| Side | opf-pptx | Note |
| --- | --- | --- |
| before | [#165](https://github.com/OpenPresentation/opf-pptx/pull/165) head `3fb1387` (`codex/rr-17-pptxgenjs-plus`) | the base of the fix |
| after | [#170](https://github.com/OpenPresentation/opf-pptx/pull/170) head `d65390a` (`codex/rr-17-per-slide-script-fonts`) | the fix |

Export options: seed 1, timestamp and zip date 2026-10-05T00:00:00Z. The set (`per-slide-script-fonts`) was rebuilt on this PC from
the orphan branch `codex/probe-sets-20261005` (`cb12612e`); its manifest matched the Mac's committed manifest byte for byte (7 / 7
decks), and the Mac's zip copy (sha256 `b5389d24…`) matched deck for deck. [decks.json](decks.json) lists the 7 decks with sha256,
the package facts and a summary of each native read; every sha256 was re-checked against the deck read.

## Result

| Deck | Masters | Result | Native read |
| --- | ---: | --- | --- |
| `a-three-profiles-before` | 1 | BASELINE (expected fail) | slides 2 and 3 read `NameComplexScript` `+mn-cs` (slide 1's theme, no cs slot) instead of Traditional Arabic / Nirmala UI |
| `a-three-profiles-after` | 3 | PASS | designs 1 ea Meiryo; 2 cs Traditional Arabic; 3 cs Nirmala UI; slides on designs 1, 2, 3 |
| `a2-thai-repro-before` | 1 | BASELINE (expected fail) | slide 2 `NameComplexScript` reads Angsana New, expected DilleniaUPC |
| `a2-thai-repro-after` | 2 | PASS | slide 2 `NameComplexScript` = DilleniaUPC (design 2, cs DilleniaUPC): the opf-pptx#168 acceptance |
| `b-single-profile-before` / `-after` | 1 | PASS, before = after | byte-identical files (sha256 `b09a366fd1e3…`); equal native reads |
| `c-mixed-default-after` | 2 | PASS | slides on masters [1, 2, 1, 2]; design 1 ea Meiryo, design 2 ea MS Mincho |

Details per deck (slide-level problems, `Presentation.Fonts`, the designs' theme fonts): [compare.md](compare.md) and
[compare.json](compare.json), written by the set's `compare.mjs` from the read-outs and the manifest.

**The open question of opf-pptx#168 is answered:** a second and a third slide master, each with its own theme, read cleanly in
PowerPoint. Every deck read to `stage: done`, every design reports its own theme fonts, each slide sits on the expected design,
and `Presentation.Fonts` lists no empty name and no phantom font (nothing outside the families the deck names) in any deck.

## Reading notes

- **Accepted RR-05 reading:** families named only in a theme slot are not listed in `Presentation.Fonts`. For example
  `a-three-profiles-after` lists only `["Meiryo"]` although its designs 2 and 3 name Traditional Arabic and Nirmala UI, and
  `c-mixed-default-after` lists MS Mincho but not Meiryo. The check allows omissions and fails only on an extra or empty name.
- `a2-thai-repro-before` lists DilleniaUPC in `Presentation.Fonts` although its slide 2 runs read Angsana New: the name is in the
  package, the slide does not draw with it. This is part of the baseline, not a pass.
- Speaker notes: the one notes master keeps the presentation theme, so the Arabic notes of `a-three-profiles` slide 2 read slide 1's
  slots (`Meiryo` / `+mn-cs`) before and after. The `after` export reports `script-font-notes-not-exported` for them; the notes reads are
  listed for the record and are not a pass criterion.
- The check is a name read-back. It says which family PowerPoint selects for each run and slot, not how the glyphs look.

## Files

- [compare.md](compare.md), [compare.json](compare.json): the set's comparison output, unchanged except that host paths would be
  replaced by `<set>` (none occurred).
- [run.json](run.json): one entry per deck (child process, timeout flag, exit code), re-indented from the PowerShell output.
- [decks.json](decks.json): the builds and, per deck, file name, bytes, sha256, slide masters, docProps "Fonts Used", count of
  runs with explicit `ea` / `cs` (0 everywhere), and the native read summary (`stage`, PowerPoint version, `Presentation.Fonts`, each
  design's minor theme fonts, each slide's design index).
