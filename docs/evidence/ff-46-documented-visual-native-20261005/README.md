# FF-46 / RR-17: native visual comparison of the script, visual and code-table families (2026-10-05)

Item: [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 3, follow-up to the draft
[opf#308](https://github.com/OpenPresentation/opf/pull/308).

- **Run:** supervisor-run on a Windows host (PowerPoint 365, build 16.0.20430): 48 decks, 123 slides.
- **Result:** all 48 decks exited 0, with no timeouts or dialogs, and every deck's SHA-256 matched the manifest.
- **Not committed:** decks, PNGs and native read-outs. The comparison output is committed.

**This is the second deck set; it supersedes the first.**
- The first set put several script families in one deck, each slide with its own font scheme.
- opf-pptx 0.12.3 loses a per-slide East Asian or complex-script font on export
  ([opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168)). The slot comes only from the theme, which is built
  from slide 1, and run-level `a:ea` / `a:cs` are stripped (FF-05).
- Set 1's flaw: on every later slide PowerPoint drew the script text in the first slide's family (for example DilleniaUPC as
  Angsana New, Traditional Arabic as Arabic Typesetting), so 22 families' native results were misattributed.

The second set has **one family per deck**:
- The family's font scheme is the deck's `design.fontScheme`, so the theme's latin, ea and cs name it.
- Sakkal Majalla has three decks (Arabic, Urdu, Persian) and Sylfaen two (Armenian, Georgian).
- The comparison credits a native line to a family only when PowerPoint's script font on that line (`NameFarEast` for Japanese,
  Chinese and Korean, `NameComplexScript` otherwise) is the slide's intended family. Every line of this run passes that check.

- **Families** (46, from the font tracker): the 41 `script-gap` script faces, `visual-gap` Cambria Math and Segoe UI Emoji, and
  `code-table` Symbol, Wingdings and Webdings. Didot (`visual-gap`) is Apple-only and is measured on the Mac mini instead
  (opf#322).
- **Packages (published):** `@openpresentation/opf` 0.12.1, `@openpresentation/opf-render` 0.12.0, `@openpresentation/opf-pptx`
  0.12.3 (fontkit 2.0.4, resvg-js 2.6.2). Export options: seed 1, date 2026-10-05.
- **Decks:** per family, its FF-44 corpus slides (the title is the first sample, drawn bold; the body holds the other samples, drawn
  regular), plus one "line breaks" slide per family and script: a full-width paragraph of the script's corpus.
  - Code-table decks carry the FF-45 private-use and plain code forms.
  - Emoji and math decks carry the FF-45 sequences.
- **Composition:** the preview and the export are composed with the font registry's text measurement, so lines are laid out with the
  faces the preview draws.
  - opf-pptx 0.12.3 throws `missing-glyph` with that measurement on 8 decks: Ebrima, both Sylfaen decks, the three code-table
    decks, Segoe UI Emoji, and emoji in an Aptos deck. Its measurer has no glyph fallback
    ([opf-pptx#169](https://github.com/OpenPresentation/opf-pptx/issues/169)).
  - Those decks are composed with core's default measurement; `compare.json` records `composition` per deck.
- **Previews:** opf-render 0.12.0 (`prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto'})`), PNG at
  1280 x 720, the same pixel size as the native export.
- **Native read:** read-only `Presentations.Open(path, -1, 0, 0)`, one child process per deck, 90 s deadline, no retries.
  - It read `Presentation.Fonts`, the theme slots, per-run font names and run bounds, and `TextRange.Lines(i)` with its text and
    `BoundLeft` / `BoundTop` / `BoundWidth` / `BoundHeight`.
  - It exported a 1280 x 720 PNG per slide.
- **Real fonts:** measured in place from `%SystemRoot%\Fonts`, never copied, against the face the preview draws (fontkit 2.0.4, the
  renderer's shaper).
  - Measured: advance widths per style on the FF-44 corpora, line breaks (core `wrapText` at 61 widths), vertical metrics and
    corpus coverage.
  - The measurements are under `measurements` in [compare.json](compare.json).
- **Comparison:** [compare.md](compare.md) and [compare.json](compare.json) are the output of the comparison tool, which reads files only.
  - Per deck: the gated name checks of the 2026-10-02 tool (fonts, themeSlots, presentationFonts, slideFamilies), the native script
    font per line, line geometry, ink extents and image scores.
  - Per family: the outcome with its reasons.
  - No absolute paths.
- **Tracker:** reads this run through `overrides.nativeEvidence` (`id: ff-46-documented-visual-native-20261005`) and
  `overrides.visualAcceptance`.

## Line breaks: what they mean here

opf-pptx 0.12.3 writes every laid-out line as its own single-line text box (`wrap="none"`, zero insets), so PowerPoint does not
re-wrap. All 399 text boxes read exactly one native line. "Line breaks" therefore means **where each native line ends relative to
its box**:
- The tool takes it from the `TextRange.Lines` bounds, with a 0.5 pt tolerance, and compares it with the preview PNG.
- The ink measure is the horizontal ink extent of the same composed line in the native and the preview PNG, inside the line's band.
- A ratio above 1 means the real font draws the line wider than the preview. A line composed to fill its box with the
  replacement's metrics then overflows natively.
- Lines clipped at the slide edge in either PNG are left out of the ratios.

## Result

- **Names: 47 / 48 decks pass every gated check** (fonts, theme slots, `Presentation.Fonts`, slide families; 0 COM read errors).
  - The exception is `scripts-40-amharic-ebrima`. `Presentation.Fonts` lists Nyala besides Ebrima: core's `resolveScriptFonts`
    gives Amharic the per-script theme supplement `Ethi` = Nyala, the language's script font, although the deck selects Ebrima
    (see the decisions table).
- **Lines: 399 / 399 boxes read one native line.** 30 boxes run past their box natively.
  - 7 are composition overflows, where the preview line runs past the same box too. 4 are on decks composed with core's default measurement (Ebrima, Georgian Sylfaen). 3 are on the line-breaks slides of Vrinda and Raavi, where the preview's own drawn line exceeds the composed width.
  - 23 overflow only natively: Malgun Gothic 2, Nirmala UI 2 and MS Gothic 1 among the installed families. The rest are on families
    that are not installed, drawn with a substitute.
- **Image scores** (reported, not gated): 2 close, 11 review, 110 far. The preview draws open look-alikes, not the real faces.
- **Cross-check:** against the 2026-10-02 native PNGs (same deck and slide id: the code-table and emoji/math decks, whose ids did
  not change; the old export was opf-pptx `a0ee3e5`), 38 of 38 slides are close.

### Per family: 11 pass, 8 findings, 27 unmeasured

| Outcome | Families | Basis |
| --- | --- | --- |
| pass (11) | Arabic Typesetting, Cambria Math, Microsoft JhengHei, Microsoft YaHei, Segoe UI Emoji, SimSun, Sylfaen, Symbol, Webdings, Wingdings, Yu Gothic | The real font is installed and drew the slide's script text. Names pass, and there is no native overflow where the preview fits. The real font is not wider than the replacement (native / preview ink median 0.89 to 1.0071 on lines of at least 200 pt). There is no gap of 20 % or more without a preview size adjustment (Arabic Typesetting has its 0.64 adjustment: ink 0.93). |
| finding: preview wider than the real font, no size adjustment (4) | Angsana New (ink 0.697; measured +42 % / +50 % bold), DilleniaUPC (0.639; +55 % / +60 %), Sakkal Majalla (0.805; +25 %), Traditional Arabic (0.815; +28 %) | The preview draws 23 to 56 % wider than PowerPoint. |
| finding: real font wider than the replacement (4) | Malgun Gothic (ink 1.049; 2 boxes overflow by up to 130.8 pt, on the line-breaks paragraph whose decomposed conjoining jamo PowerPoint draws far wider), Nirmala UI (1.027; 2 boxes, up to 55.3 pt), MS Gothic (1.024; 1 box, 35.8 pt), Ebrima (1.074 on Ethiopic, drawn by Noto Sans Ethiopic in the preview; also the Nyala name finding) | A line composed to fill its box overflows natively by about 2 to 7 %. |
| unmeasured (27) | Aparajita, Batang, BatangChe, DaunPenh, David, FangSong, Gautami, Gisha, Gungsuh, GungsuhChe, Kalinga, Kartika, Khmer UI, Latha, Mangal, Meiryo, MingLiU, Miriam, MS Mincho, Nyala, PMingLiU, Raavi, Shonar Bangla, Shruti, SimHei, Tunga, Vrinda | Not installed on the native host (Windows optional features, the supplemental fonts). PowerPoint drew a substitute, so the real face was not compared. |

Notes:

- Sylfaen lacks the 14 Georgian Mtavruli capitals of the corpus, so PowerPoint falls back for them.
- Traditional Arabic lacks 12 Urdu letters.
- The code-table fonts on the host equal the verified 5.01 tables: every advance matches, and the preview covers every mapped code.

**Not accepted by this run alone.** `documented-visual` also needs the family's own fixture in every host (node, browser, editor,
gallery editor). No proprietary script, emoji, math or code-table family has one yet: the script host fixtures cover the open
route faces. So the 11 passing families keep their status, with the native result recorded (`nativeVisual` in the tracker). They
move once their fixtures are in the host evidence. Nothing in the gate was relaxed.

## Reproduce

These are scratch tools, outside the repository, built and run on the Windows host:

- `gen/build.mjs`: decks, previews and the manifest.
- `measure.mjs`: in-place measurements.
- `native-read-deck.ps1` and `run-set.ps1`: the supervisor's native read.
- `compare.mjs`: this output. It reuses the 2026-10-02 name checks unchanged and adds the native script-font attribution.

No Office application was opened by an agent.

## Decisions and follow-up issues (2026-10-05, Windows supervisor, vetoable)

| Finding | Decision | Issue |
| --- | --- | --- |
| Angsana New, DilleniaUPC, Sakkal Majalla and Traditional Arabic draw 23 to 56 % wider in the preview; Malgun Gothic, Nirmala UI, Ebrima and MS Gothic draw 2 to 7 % wider natively | RR-38 `sizeAdjust` rows (and `lineAscent` where the line height differs), measured in place and verified natively; never relabelled `metric` | [opf#361](https://github.com/OpenPresentation/opf/issues/361) |
| The 11 passing families have no host fixtures of their own | Commission per-family fixtures in opf-render (node and browser), opf-editor and the gallery editor; the gate is unchanged | [opf#362](https://github.com/OpenPresentation/opf/issues/362) |
| 27 families are not installed on the native host | The owner installs the Windows supplemental fonts, then the same deck set is re-run; until then the families stay unmeasured | [opf#363](https://github.com/OpenPresentation/opf/issues/363) |
| Composition with core's default measurement overflowed 30 line boxes in set 1; set 2 composes with the registry's measurement and 7 remain (4 on the decks that fell back to core's measurement, 3 on Vrinda and Raavi line-breaks slides) | Composition uses the font registry's measurement by default when fonts are prepared; core's estimate stays the fallback | [opf#364](https://github.com/OpenPresentation/opf/issues/364) |
| A per-slide font scheme's East Asian / complex-script font is lost on export (set 1 superseded) | Fix in the exporter; until then one script family per deck for native evidence | [opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168) |
| `toPptx` with the registry's text measurement throws `missing-glyph` on mixed-script and symbol text (8 decks) | Fix in the exporter (measure with glyph fallback, as the preview does) | [opf-pptx#169](https://github.com/OpenPresentation/opf-pptx/issues/169) |
| The Ebrima (Amharic) deck lists Nyala in `Presentation.Fonts`: the language's `Ethi` supplement ignores the deck's selected script family | To decide: core's supplement should follow the selected family when the scheme names one | not filed yet |
