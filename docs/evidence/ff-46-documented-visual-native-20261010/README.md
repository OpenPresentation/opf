# FF-46 / RR-17: native visual comparison on the 0.18 packages, one family per deck (2026-10-10)

This re-runs [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 3 on the published 0.18 packages. The earlier run is
[ff-46-documented-visual-native-20261005-fonts](../ff-46-documented-visual-native-20261005-fonts/README.md), called "set 2" below.
Both runs use the same host, with the Windows supplemental fonts installed, so all 46 real fonts are present.

**Result:**

| | Pass | Finding | Fail | Total |
| --- | ---: | ---: | ---: | ---: |
| Families | 21 | 24 | 1 | 46 |
| Decks | 24 | 25 | 1 | 50 |

- The fail is Ebrima: `Presentation.Fonts` also lists Nyala, as in set 2.
- 589 of 589 exported line boxes read one native line.
- 45 boxes run past their box only natively, and 12 overflow in the preview too.
- Image scores (reported only): 78 close, 32 review, 0 far.

The font tracker still reads set 2. This run confirms set 2's outcomes on 0.18 and adds two new findings. It is not wired into
`visualAcceptance`, so no tracker status changes here. Documented-visual still waits on the per-family host fixtures
([opf#362](https://github.com/OpenPresentation/opf/issues/362)) and the size-adjust rows
([opf#361](https://github.com/OpenPresentation/opf/issues/361)).

## Host and method

- **Host:** Windows 11 (`Microsoft Windows NT 10.0.26200.0`), PowerPoint 365 16.0 build 20430, culture en-US. The supervisor ran
  Office; an agent built the decks and scripts.
- **Packages (published):** `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0 and `@openpresentation/opf-pptx`
  0.18.0, on Node 24.21.0.
- **Decks: one family per deck, 50 decks.**
  - The 41 script families. Sakkal Majalla has Arabic, Urdu and Persian decks; Sylfaen has Armenian and Georgian decks; BatangChe and
    GungsuhChe now have their own decks.
  - Wingdings, Webdings and Symbol, as code-table text in a Calibri deck.
  - Segoe UI Emoji and Cambria Math, plus an emoji-in-Aptos probe that is not counted for any family.
  - Each deck uses the family's catalog font scheme. A family without a catalog scheme names itself in the Latin pair and the script
    slot.
  - Slide 1 holds the family's FF-44 corpus samples as single lines; slide 2 is a wrapping paragraph.
  - The sha256 values are in [decks.json](decks.json) and were checked before every read.
- **Previews:** opf-render 0.18.0 `toSvg` and `toPng` at 1280 x 720, on the gallery font host (office pack, all scripts, visual
  substitution). They are not committed.
- **Native reader:** read-only (`Presentations.Open(path, -1, 0, 0)`), one child process per deck with a 90 s deadline and no retries.
  It reads `Presentation.Fonts`, both masters' theme slots, every run's names, `TextRange.Lines()` bounds and slide PNGs at
  1280 x 720. Each deck took at most 2.9 s.
- **Comparison** (`compare.mjs`, with the set-2 tolerances):
  - **Names, gated:** as FF-12, plus the script runs must name the deck's family.
  - **Lines:** each box must read one native line, with no native-only overflow beyond 0.5 pt.
  - **Ink:** the native / preview ink width of the same composed line, median over lines of at least 200 pt. It is a finding above
    1.01 (the real font is wider) or below 0.80 (the preview is wider).
  - **Image scores:** reported only.

## Per family

Set-2 ink is the long-line median of the 2026-10-05 run.

| Family | Outcome | Ink (native / preview) | Set 2 | Set-2 ink | Against set 2 | Reasons |
| --- | --- | ---: | --- | ---: | --- | --- |
| Angsana New | finding | 0.711 | finding | 0.697 | same | ink 0.7112: the preview is wider |
| Aparajita | pass | 0.937 | pass | 0.911 | same | - |
| Arabic Typesetting | pass | 0.908 | pass | 0.931 | same | - |
| Batang | finding | 1.065 | finding | 1.056 | same | 3 boxes overflow only natively (max 144.78 pt); ink 1.0649: the real font is wider |
| BatangChe | finding | 1.060 | finding | 1.056 | same | 3 boxes overflow only natively (max 185.78 pt); ink 1.0605: the real font is wider |
| Cambria Math | pass | 0.987 | pass | 0.969 | same | - |
| DaunPenh | finding | 0.558 | finding | 0.567 | same | ink 0.5579: the preview is wider |
| David | pass | 0.910 | pass | 0.902 | same | - |
| DilleniaUPC | finding | 0.645 | finding | 0.639 | same | ink 0.6452: the preview is wider |
| Ebrima | fail | 1.070 | finding | 1.074 | same (the Nyala name was the set-2 finding too; this compare fails a name extra) | Presentation.Fonts also lists Nyala; 2 boxes overflow only natively (max 67.28 pt); ink 1.0704: the real font is wider |
| FangSong | pass | 1.008 | pass | 0.995 | same | - |
| Gautami | pass | 0.988 | pass | 0.988 | same | - |
| Gisha | pass | 0.966 | pass | 0.962 | same | - |
| Gungsuh | finding | 1.058 | finding | 1.056 | same | 3 boxes overflow only natively (max 143.53 pt); ink 1.0581: the real font is wider |
| GungsuhChe | finding | 1.066 | finding | 1.056 | same | 3 boxes overflow only natively (max 185.78 pt); ink 1.0663: the real font is wider |
| Kalinga | pass | 0.892 | pass | 0.889 | same | - |
| Kartika | finding | 1.151 | finding | 1.094 | same | 4 boxes overflow only natively (max 199.41 pt); ink 1.1513: the real font is wider |
| Khmer UI | finding | 1.112 | finding | 1.117 | same | ink 1.1119: the real font is wider |
| Latha | finding | 1.091 | finding | 1.063 | same | 5 boxes overflow only natively (max 123.53 pt); ink 1.0905: the real font is wider |
| Malgun Gothic | finding | 1.036 | finding | 1.049 | same | 3 boxes overflow only natively (max 136.03 pt); ink 1.0358: the real font is wider |
| Mangal | finding | 1.158 | finding | 1.151 | same | 4 boxes overflow only natively (max 192.03 pt); ink 1.1579: the real font is wider |
| Meiryo | finding | 1.030 | finding | 1.018 | same | 2 boxes overflow only natively (max 26.91 pt); ink 1.0297: the real font is wider |
| Microsoft JhengHei | pass | 1.010 | pass | 0.997 | same | - |
| Microsoft YaHei | finding | 1.012 | pass | 0.999 | **new finding** | ink 1.0118: the real font is wider |
| MingLiU | pass | 0.999 | pass | 0.999 | same | - |
| Miriam | pass | 0.929 | pass | 0.900 | same | - |
| MS Gothic | finding | 1.037 | finding | 1.024 | same | 2 boxes overflow only natively (max 35.78 pt); ink 1.037: the real font is wider |
| MS Mincho | finding | 1.036 | finding | 1.005 | same | 2 boxes overflow only natively (max 35.78 pt); ink 1.0361: the real font is wider |
| Nirmala UI | finding | 1.070 | finding | 1.027 | same | 4 boxes overflow only natively (max 47.66 pt); ink 1.0697: the real font is wider |
| Nyala | pass | 0.951 | pass | 0.954 | same | - |
| PMingLiU | pass | 0.999 | pass | 0.996 | same | - |
| Raavi | finding | 1.087 | finding | 1.075 | same | ink 1.0865: the real font is wider |
| Sakkal Majalla | pass | 0.816 | finding | 0.805 | now passes | - |
| Segoe UI Emoji | finding | 1.000 | pass | 0.946 | **new finding** | 1 boxes overflow only natively (max 75.78 pt) |
| Shonar Bangla | finding | 0.737 | finding | 0.723 | same | ink 0.7371: the preview is wider |
| Shruti | finding | 1.084 | finding | 1.053 | same | 2 boxes overflow only natively (max 167.03 pt); ink 1.084: the real font is wider |
| SimHei | pass | 1.008 | pass | 1.003 | same | - |
| SimSun | pass | 1.008 | pass | 0.998 | same | - |
| Sylfaen | pass | 0.841 | pass | 0.937 | same | - |
| Symbol | pass | 1.002 | pass | 0.896 | same | - |
| Traditional Arabic | finding | 0.796 | finding | 0.815 | same | ink 0.7963: the preview is wider |
| Tunga | pass | 0.950 | pass | 0.960 | same | - |
| Vrinda | finding | 1.078 | finding | 1.074 | same | ink 1.0775: the real font is wider |
| Webdings | pass | 1.000 | pass | 0.908 | same | - |
| Wingdings | pass | 1.001 | pass | 0.891 | same | - |
| Yu Gothic | finding | 1.008 | finding | 1.010 | same | 2 boxes overflow only natively (max 10.53 pt) |

## What changed since set 2

- **Two new findings:**
  - **Microsoft YaHei.** Ink is 1.0118, just over the unchanged 1.01 bound; it was 0.999 in set 2. No line overflows natively.
  - **Segoe UI Emoji.** Ink is 1.000, but one wrapped line of the new emoji paragraph (slide 3, a slide set 2 did not have) runs
    75.8 pt past its box natively, with ink 1.054 on that line.
- **Sakkal Majalla now passes, on ink only (0.816, inside the 0.80 bound).** It stays under
  [opf#361](https://github.com/OpenPresentation/opf/issues/361):
  - the set-2 tool also flagged its +25 % corpus width gap;
  - the preview is still about 18 % wider than PowerPoint.
- **Korean overflow.** Batang, BatangChe, Gungsuh, GungsuhChe and Malgun Gothic overflow by up to 136 to 186 pt natively. These are
  the known findings (set 2; opf#382 measured 1.06 to 1.10), larger here because of how the deck is built:
  - Only the three lines of the wrapping paragraph overflow, and each carries the decomposed-jamo sample.
  - The preview fills those lines to the box edge.
  - PowerPoint's `Lines().BoundWidth` puts them at 1.13 to 1.21 of the box, while their ink is only 1.06 to 1.085 of the preview.
    This matches opf#361: PowerPoint draws decomposed conjoining jamo far wider than fontkit composes them.
  - The first comparison of this run also reported "a run names another family" on these decks. That was an artifact of unresolved
    `+mn-cs` theme references, now resolved (see below). Every run names its deck's family.
- **Everything else matches set 2:**
  - the #361 families (Angsana New, DilleniaUPC, Traditional Arabic, Malgun Gothic, Nirmala UI, Ebrima, MS Gothic);
  - the opf#382 findings (DaunPenh, Shonar Bangla, the four Batang and Gungsuh faces, Khmer UI, Kartika, Latha, Mangal, Shruti, Raavi,
    Vrinda, MS Mincho, Meiryo, Yu Gothic);
  - the 21 passing families, which passed in set 2 too.
- **The emoji-in-Aptos probe** reports ink 1.077. PowerPoint draws emoji in a default Aptos deck with its own emoji font, and the probe
  counts for no family.

## Harness notes

- **Exit codes.** Every `run.json` records `exitCode: null`: `run-deck.ps1` did not cache the child's process handle. A run counts as
  successful only when its status is `completed` and its read-out parsed and reached `stage: done`. `run-deck.ps1` now caches the
  handle.
- **Theme references.** PowerPoint reports run slots that follow the theme as `+mn-cs`.
  - `compare.mjs` resolves them through the read-out's slide-master theme slots, then judges the resolved name.
  - A reference to a complex-script slot left empty by design (FF-05 / FF-49) is counted and does not fail (supervisor decision,
    2026-10-10).
  - Unresolvable references would fail; there were none.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the comparison. It has per-deck names, lines (every box's native line
  bounds), ink rows and image scores, and per-family outcomes.
- [decks.json](decks.json): the set, with sha256 values, expected fonts, theme slots, the slide layout and the export diagnostics.
- [run.json](run.json): one record per deck, plus the host.

The decks, previews, native PNGs and raw read-outs are not committed.
