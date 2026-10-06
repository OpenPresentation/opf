# FF-46 / RR-17: native visual comparison with the Windows supplemental fonts installed (2026-10-05)

Item: [opf#363](https://github.com/OpenPresentation/opf/issues/363). This follows up
[ff-46-documented-visual-native-20261005](../ff-46-documented-visual-native-20261005/README.md) (opf#357), where 27 of the 46
families were unmeasured because the real fonts were not installed on the native host.

**What changed:** the owner installed all 16 Windows `Language.Fonts.*` supplemental font packs (Features on Demand) on the native host.
- `System.Drawing.Text.InstalledFontCollection` now finds all 46 families (`host-fonts.json` of the run: 46 / 46 installed).
- The supervisor restarted PowerPoint and re-ran the second deck set **unchanged**, as a new attempt (`out-fonts-installed`; the
  first run's output is kept).
  - 48 decks and 123 slides, PowerPoint 365 build 16.0.20430.
  - All 48 exited 0, with no timeouts or dialogs, and every deck's SHA-256 matched the manifest.
- Decks, PNGs and native read-outs are not committed. The comparison output is.

Everything else is as in the 2026-10-05 run:
- **Packages (published):** `@openpresentation/opf` 0.12.1, `@openpresentation/opf-render` 0.12.0, `@openpresentation/opf-pptx`
  0.12.3. One family per deck. Composition with the font registry's measurement, except the 8 decks that fall back to core's
  ([opf-pptx#169](https://github.com/OpenPresentation/opf-pptx/issues/169)).
- **Previews:** 1280 x 720.
- **Native reader:** read-only, unchanged.
- **Comparison tool:** unchanged, with the same thresholds. It credits a native line only when PowerPoint's script font on it is the
  slide's intended family; every line of this run passes that check.
- **Real fonts:** all 46 measured in place from `%SystemRoot%\Fonts` (nothing copied) against the face the preview draws.
  - Measured: advances per style on the FF-44 corpora, line breaks, vertical metrics and coverage.
  - The newly installed files include `aparaj`, `batang.ttc`, `daunpenh`, `david`, `simfang`, `gautami`, `gisha`, `kalinga`,
    `kartika`, `KhmerUI`, `latha`, `mangal`, `meiryo`, `mingliu.ttc`, `mriam`, `msmincho`, `nyala`, `raavi`, `Shonar`, `shruti`,
    `simhei`, `tunga` and `vrinda`.
  - The measurements are under `measurements` in [compare.json](compare.json).
- **Line breaks:** as before, PowerPoint does not re-wrap the exported single-line boxes, so "line breaks" means where each native line
  ends relative to its box (`TextRange.Lines` bounds, with a 0.5 pt tolerance), plus the PNG comparison.

## Result

- **Names: 47 / 48 decks pass.** The Ebrima (Amharic) deck still lists Nyala in `Presentation.Fonts`: core's `Ethi` theme
  supplement names the language's font, not the selected Ebrima.
- **Lines: 399 / 399 boxes read one native line.** 31 boxes run past their box:
  - 8 are composition overflows, where the preview line runs past the same box too;
  - 23 overflow only natively.
- **Image scores** (reported, not gated): 2 close, 11 review, 110 far.
- **Consistency with the first run (`out`):**
  - The 19 families that were already installed give the same outcome in 18 cases, with identical ink ratios.
  - The exception is **Yu Gothic**. Its ink ratio moved from 1.0071 to 1.0105, across the 1.01 threshold: PowerPoint's
    `BoundWidth` of two lines on its line-breaks slide grew by 2.2 and 2.6 pt after the supplemental fonts were installed.
  - Under the unchanged gate Yu Gothic is now a finding, at the edge.

### Per family: 22 pass, 24 findings, 0 unmeasured (of 46)

Ink is the native / preview ink width median on lines of at least 200 pt. The corpus factor is the RR-38 basis (installed font's
advances over the replacement's, regular, FF-44 corpus); for the first set of findings it is from
[opf#361](https://github.com/OpenPresentation/opf/issues/361).

| Family | Outcome | Ink | Corpus factor | Basis or reason |
| --- | --- | ---: | ---: | --- |
| Aparajita | pass (new) | 0.911 | | |
| Arabic Typesetting | pass | 0.931 | 0.64 (in policy) | preview size adjustment 0.64 |
| Cambria Math | pass | 0.969 | | |
| David | pass (new) | 0.903 | | |
| FangSong | pass (new) | 0.995 | | |
| Gautami | pass (new) | 0.988 | | |
| Gisha | pass (new) | 0.962 | | |
| Kalinga | pass (new) | 0.889 | | |
| Microsoft JhengHei | pass | 0.997 | | |
| Microsoft YaHei | pass | 0.999 | | |
| MingLiU | pass (new) | 0.999 | | |
| Miriam | pass (new) | 0.900 | | |
| Nyala | pass (new) | 0.954 | | |
| PMingLiU | pass (new) | 0.996 | | |
| Segoe UI Emoji | pass | 0.946 | | |
| SimHei | pass (new) | 1.003 | | |
| SimSun | pass | 0.998 | | |
| Sylfaen | pass | 0.937 | | 14 Georgian Mtavruli capitals fall back natively |
| Symbol | pass | 0.897 | | code table equal to the verified 5.01 |
| Tunga | pass (new) | 0.960 | | |
| Webdings | pass | 0.909 | | code table equal to the verified 5.01 |
| Wingdings | pass | 0.891 | | code table equal to the verified 5.01 |
| Angsana New | finding | 0.697 | 0.703 | preview wider, no size adjustment |
| DilleniaUPC | finding | 0.639 | 0.640 | preview wider, no size adjustment |
| Sakkal Majalla | finding | 0.805 | 0.803 | preview wider, no size adjustment (+25 % measured) |
| Traditional Arabic | finding | 0.815 | 0.789 | preview wider, no size adjustment (+28 % measured) |
| DaunPenh | finding (new) | 0.567 | 0.557 | preview wider, no size adjustment |
| Shonar Bangla | finding (new) | 0.723 | 0.724 | preview wider, no size adjustment |
| Malgun Gothic | finding | 1.049 | 1.063 | real font wider; 2 boxes overflow natively by up to 130.8 pt (decomposed jamo) |
| Nirmala UI | finding | 1.027 | 1.067 | real font wider; 2 boxes overflow by up to 55.3 pt |
| MS Gothic | finding | 1.024 | 1.035 | real font wider; 1 box overflows by 35.8 pt |
| Ebrima | finding | 1.074 | 1.076 (Ethiopic, fallback face) | real font wider; the Nyala name finding |
| Batang / BatangChe | finding (new) | 1.056 | 1.157 / 1.186 | real font wider; 2 boxes overflow by up to 139.5 pt (decomposed jamo); BatangChe is fixed-pitch |
| Gungsuh / GungsuhChe | finding (new) | 1.056 | 1.158 / 1.186 | as Batang, up to 141.8 pt |
| Kartika | finding (new) | 1.094 | 1.188 | real font wider; 4 boxes overflow by up to 199.4 pt |
| Khmer UI | finding (new) | 1.117 | 1.119 | real font wider |
| Latha | finding (new) | 1.063 | 1.139 | real font wider; 3 boxes overflow by up to 89.2 pt |
| Mangal | finding (new) | 1.151 | 1.192 | real font wider; 3 boxes overflow by up to 180.4 pt |
| Meiryo | finding (new) | 1.018 | 1.024 | real font wider; 1 box overflows by 13.3 pt |
| MS Mincho | finding (new) | 1.005 | 1.035 | 1 box overflows natively by 35.8 pt where the preview fits |
| Raavi | finding (new) | 1.075 | 1.089 (HarfBuzz; fontkit cannot shape Noto Sans Gurmukhi) | real font wider |
| Shruti | finding (new) | 1.053 | 1.176 | real font wider; 2 boxes overflow by up to 167.0 pt |
| Vrinda | finding (new) | 1.074 | 1.057 | real font wider |
| Yu Gothic | finding (edge) | 1.0105 | 1.009 | at the 1 % threshold; it passed in the first run (1.0071) |

Where the ink ratio sits below the corpus factor on the "real font wider" rows (Batang, Kartika, Latha, Shruti), the
line-breaks paragraphs mix Latin and digits, which draw with the latin face on both sides.

No family is accepted by this run alone. `documented-visual` also needs the family's own fixture in every host
([opf#362](https://github.com/OpenPresentation/opf/issues/362)). The findings stay at their status for the owner decision on
`sizeAdjust` rows ([opf#361](https://github.com/OpenPresentation/opf/issues/361)). Nothing in the gate was relaxed.

The tracker reads this run through `overrides.nativeEvidence` and `overrides.visualAcceptance`
(`id: ff-46-documented-visual-native-20261005-fonts`). It supersedes the earlier run as the visual outcome for all 46 families, and the
earlier run stays native name evidence.

## Decisions and follow-up issues

| Finding | Follow-up |
| --- | --- |
| 16 more families need a `sizeAdjust` row on the RR-38 basis (factors above) | [opf#361](https://github.com/OpenPresentation/opf/issues/361) |
| The 22 passing families have no host fixtures of their own | [opf#362](https://github.com/OpenPresentation/opf/issues/362) |
| Supplemental fonts installed; all 46 measured | [opf#363](https://github.com/OpenPresentation/opf/issues/363) (this run) |
| Composition with core's measurement (8 decks) and 8 composition overflows | [opf#364](https://github.com/OpenPresentation/opf/issues/364), [opf-pptx#169](https://github.com/OpenPresentation/opf-pptx/issues/169) |
| Per-slide script fonts lost on export (why each family has its own deck) | [opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168) |
| The Ebrima (Amharic) deck lists Nyala (core `Ethi` supplement) | not filed yet |

No Office application was opened by an agent.
