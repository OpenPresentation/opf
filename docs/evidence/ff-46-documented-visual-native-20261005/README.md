# FF-46 / RR-17: native visual comparison of the script, visual and code-table families (2026-10-05)

Item: [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 3, follow-up to the draft
[opf#308](https://github.com/OpenPresentation/opf/pull/308). The supervisor ran this check natively (PowerPoint 365, Windows host,
build 16.0.20430). It covers 28 decks with 123 slides. Decks, PNGs and native read-outs are not committed; the comparison output is.

- Families (46, from the font tracker): the 41 `script-gap` script faces, `visual-gap` Cambria Math and Segoe UI Emoji, and `code-table`
  Symbol, Wingdings and Webdings. Didot (`visual-gap`) is Apple-only and is measured on the Mac mini instead (opf#322).
- Packages (published): `@openpresentation/opf` 0.12.1, `@openpresentation/opf-render` 0.12.0, `@openpresentation/opf-pptx` 0.12.3
  (fontkit 2.0.4, resvg-js 2.6.2). Export options: seed 1, date 2026-10-05.
- Decks: the 2026-10-02 FF-46 generator, limited to these families. It adds one "line breaks" slide per family and script (a full-width
  paragraph of the FF-44 corpus) and drops the out-of-scope families. Each slide's title is its first corpus sample, drawn bold.
  Its body holds the other samples, drawn regular. Code-table slides carry the FF-45 private-use and plain code forms. Emoji and math
  slides carry the FF-45 sequences.
- Previews: opf-render 0.12.0 (`prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto'})`), PNG at 1280 x 720,
  the same pixel size as the native export.
- Native read (read-only `Presentations.Open(path, -1, 0, 0)`, one child process per deck, 90 s deadline, no retries).
  - The reader collected `Presentation.Fonts`, the theme slots, per-run font names and run bounds, and `TextRange.Lines(i)` with its
    text and `BoundLeft` / `BoundTop` / `BoundWidth` / `BoundHeight`. It exported a 1280 x 720 PNG per slide.
  - All 28 decks exited 0 with no timeouts or dialogs, and every deck's SHA-256 matched the manifest.
- Real fonts measured in place, read from `%SystemRoot%\Fonts` and never copied, against the face the preview draws (fontkit 2.0.4, the
  renderer's shaper). The measurements cover advance widths per style on the FF-44 corpora, line breaks (core `wrapText` at
  61 widths), vertical metrics and corpus coverage. They are under `measurements` in [compare.json](compare.json).
- [compare.md](compare.md) and [compare.json](compare.json) are the output of the comparison tool, which reads files only.
  - Per deck: the gated name checks of the 2026-10-02 tool (fonts, themeSlots, presentationFonts, slideFamilies), line geometry, ink
    extents and image scores.
  - Per family: the proposal (documented-visual candidate or hold) with its reasons. The output holds no absolute paths.
- The tracker reads this run through `overrides.nativeEvidence` (`id: ff-46-documented-visual-native-20261005`) and
  `overrides.visualAcceptance`.

## Line breaks: what they mean here

opf-pptx 0.12.3 writes every laid-out line as its own single-line text box (`wrap="none"`, zero insets), so PowerPoint does not
re-wrap: all 390 text boxes read exactly one native line. "Line breaks" therefore means **where each native line ends relative to its
box**. The tool takes that from the `TextRange.Lines` bounds (0.5 pt tolerance) and also compares it with the preview PNG. The ink
measure is the horizontal ink extent of the same composed line in the native and the preview PNG, inside the line's band. A ratio
above 1 means the real font draws the line wider than the preview. A line composed to fill its box with the replacement's metrics then
overflows natively. Lines clipped at the slide edge in either PNG are left out of the ratios.

## Result

- **Names: 28 / 28 decks pass every gated check** (fonts, theme slots, `Presentation.Fonts`, slide families; 0 COM read errors). The
  name read-back of the 2026-10-02 run holds on opf-pptx 0.12.3.
- **Lines: 390 / 390 boxes read one native line.** 36 boxes run past their box natively. In 30 of them the preview line runs past the
  same box too: a composition overflow (below), not a font difference. The other 6 overflow only natively: 1 is Malgun Gothic (installed), and 5 are on the Korean, Bengali and Gujarati slides of families that are not installed, drawn with a substitute.
- Image scores (reported, not gated): 5 close, 8 review, 110 far. The preview draws open look-alikes, not the real faces.
- Cross-check with the 2026-10-02 native PNGs (same language deck and slide id; the old export was opf-pptx `a0ee3e5`): 71 close,
  4 review, 7 far. One old PNG could not be decoded. The far slides are Indic slides, where the composition differs between the two
  builds.

### Per family (19 installed on the native host, 27 not)

| Outcome | Families | Basis |
| --- | --- | --- |
| documented-visual candidate (11) | Arabic Typesetting, Cambria Math, Microsoft JhengHei, Microsoft YaHei, Segoe UI Emoji, SimSun, Sylfaen, Symbol, Webdings, Wingdings, Yu Gothic | Installed. Names pass. No native overflow where the preview fits. The real font is not wider than the replacement (native / preview ink median from 0.89 to 1.0097 on lines of at least 200 pt). There is no gap of 20 % or more without a preview size adjustment. Arabic Typesetting has the 0.64 adjustment: ink 0.98, against +56 % before the adjustment. |
| finding: real font wider than the replacement (4) | Malgun Gothic (ink 1.074; 1 box overflows by 15.2 pt), Nirmala UI (1.076; measured -6 % to -14 % across Devanagari, Bengali, Gujarati, Kannada, Malayalam, Telugu), Ebrima (1.074), MS Gothic (1.037) | A line composed to fill its box overflows natively by about 4 to 8 %. |
| finding: preview much wider, no size adjustment (4) | Angsana New (ink 0.700; measured +42 % / +50 % bold), DilleniaUPC (0.698; +55 % / +60 %), Sakkal Majalla (0.596; +25 %), Traditional Arabic (0.591; +28 %) | The preview draws 40 to 68 % wider than PowerPoint. A size adjustment like Arabic Typesetting's 0.64 is the candidate fix. |
| not measurable on this host (27) | Aparajita, Batang, BatangChe, DaunPenh, David, FangSong, Gautami, Gisha, Gungsuh, GungsuhChe, Kalinga, Kartika, Khmer UI, Latha, Mangal, Meiryo, MingLiU, Miriam, MS Mincho, Nyala, PMingLiU, Raavi, Shonar Bangla, Shruti, SimHei, Tunga, Vrinda | Not installed (Windows optional features, the supplemental fonts). PowerPoint drew a substitute, so the real face was not compared. The name checks pass. |

Notes:

- Sylfaen lacks the 14 Georgian Mtavruli capitals of the corpus, so PowerPoint falls back for them.
- Traditional Arabic lacks 12 Urdu letters.
- The code-table fonts on the host equal the verified 5.01 tables: every advance matches, and the preview covers every mapped code.
- Yu Gothic sits at the edge of the 1 % tolerance (1.0097).

**Not accepted by this run alone.** `documented-visual` also needs the family's own fixture in every host (node, browser, editor,
gallery editor). No proprietary script, emoji, math or code-table family has one yet: the script host fixtures cover the open route
faces. So the 11 candidates keep their status, with the native result recorded (`nativeVisual` in the tracker). They move once their
fixtures are in the host evidence. Nothing in the gate was relaxed.

### Composition overflow (not a font finding)

The decks were composed with core's default text measurement, as in the 2026-10-02 generator: neither `renderSvgDeck` nor `toPptx` was
given the font registry's measurement. That default underestimates Devanagari, the other Indic scripts, Ethiopic and Georgian. 30 line
boxes on the full-width "line breaks" slides run past their box, some off the slide, in both the preview and PowerPoint. This is an
exporter-input issue, independent of the font route, and it is recorded for triage.

## Reproduce

These are scratch tools, outside the repository, built and run on the Windows host:

- `gen/build.mjs`: decks, previews and the manifest.
- `measure.mjs`: in-place measurements.
- `native-read-deck.ps1` and `run-set.ps1`: the supervisor's native read.
- `compare.mjs`: this output. It reuses `compare-20261002.mjs` unchanged for the name checks.

No Office application was opened by an agent.

## Decisions and follow-up issues (2026-10-05, Windows supervisor, vetoable)

| Finding | Decision | Issue |
| --- | --- | --- |
| Angsana New, DilleniaUPC, Sakkal Majalla and Traditional Arabic draw 40 to 68 % wider in the preview; Malgun Gothic, Nirmala UI, Ebrima and MS Gothic draw 4 to 8 % wider natively | RR-38 `sizeAdjust` rows (and `lineAscent` where the line height differs), measured in place and verified natively; never relabelled `metric` | [opf#361](https://github.com/OpenPresentation/opf/issues/361) |
| The 11 passing families have no host fixtures of their own | Commission per-family fixtures in opf-render (node and browser), opf-editor and the gallery editor; the gate is unchanged | [opf#362](https://github.com/OpenPresentation/opf/issues/362) |
| 27 families are not installed on the native host | The owner installs the Windows supplemental fonts, then the same deck set is re-run; until then the families stay unmeasured | [opf#363](https://github.com/OpenPresentation/opf/issues/363) |
| 30 line boxes overflow in both the preview and PowerPoint (core's default measurement) | Composition uses the font registry's measurement by default when fonts are prepared; core's estimate stays the fallback | [opf#364](https://github.com/OpenPresentation/opf/issues/364) |
