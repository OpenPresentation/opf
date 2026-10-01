# Script shaping corpora and per-family qualification (FF-44, RR-17)

Program: font-fidelity-everywhere item FF-44, carried by [RR-17](../release-readiness/burndown.md). Source of the numbers:
[docs/evidence/script-corpora-20261001](../../evidence/script-corpora-20261001/README.md) (committed JSON; nothing here is a native
PowerPoint claim). Code: [opf-render](https://github.com/OpenPresentation/opf-render) `test/fixtures/script-corpora.json`,
`scripts/script-corpora.mjs`, `scripts/measure-script-references.mjs`, `test/script-corpora*.mjs`
([opf-render#93](https://github.com/OpenPresentation/opf-render/pull/93)).

The Latin-only corpus of FF-40 could say nothing about Arabic joining, Devanagari conjuncts or CJK punctuation. This corpus does: short,
original text per script, one shaping behaviour per sample, run through every bundled open face that serves the script, in the places the
preview is drawn and measured. It does **not** qualify a family for native PowerPoint: that is FF-46 and RR-05, run by the supervisor
(see [Native check](#native-check)).

## What the corpus is

- **30 scripts, 140 samples.** Every script of the 93 catalog languages (Arabic, Armenian, Bengali, Cyrillic, Devanagari, Ethiopic,
  Georgian, Greek, Gujarati, Gurmukhi, Simplified and Traditional Han, Hebrew, Japanese, Khmer, Kannada, Korean, Malayalam, Odia, Tamil,
  Telugu, Thai, Latin) and every script slot the renderer designates a face for (Lao, Myanmar, Sinhala, Tibetan, Mongolian, Syriac, Thaana).
  A test fails when a catalog language's script or tag, or a script slot, has no group.
- **Behaviours**, one per sample: joining, ligatures (lam-alef, khanda ta, Armenian ech-yiwn), marks and diacritics (harakat, niqqud,
  Vietnamese and Yoruba stacks, combining dakuten, conjoining Hangul jamo), conjuncts and reph, vowel placement (pre-base vowels, split
  Tamil vowels, Thai sara am), subjoined and stacked consonants (Khmer coeng, Myanmar medials, Tibetan stacks, Thai pali), tone marks,
  digits in the script's own numerals, script punctuation, bidirectional mixing with Latin and digits, mixed Latin, and long text without spaces
  (Thai, Lao, Khmer, Japanese, Chinese).
- **Source.** Original text written for this corpus: short phrases, common words (days, months, numerals, language and country names,
  greetings) and the catalog's own font-scheme sample strings. No third-party prose is copied; the UDHR translations were considered and
  rejected (the Unicode UDHR project no longer hosts them, and the OHCHR reuse terms were not verified). The samples are chosen to
  exercise shaping, not to carry meaning: the corpus makes no claim of editorial or translation quality, and the file says so.
  License MIT, like the repository.
- **Latin languages** (57 of the 93) are covered by 14 samples of the characters they add to the alphabet (Vietnamese, Yoruba, Igbo, Hausa and
  Fulfulde, Turkish and Azerbaijani, Central European, Romanian and Albanian, Baltic, Maori, Uzbek and Berber, Kurmanji, Somali, Western European)
  and 9 Cyrillic and 4 Greek samples.

## What each sample is held to

1. **Coverage.** The face has a glyph for every letter of the sample's own script (BMP and beyond); Latin, digits and punctuation in mixed
   samples must exist in some bundled face (the glyph-fallback chain, Noto Sans). Result: complete for all 63 faces (regular and bold of 29 families, Noto Sans Mongolian regular only
   plus Noto Sans' four styles).
2. **Shaping, as the renderer measures it.** opf-render's own measurement (fontkit 2.0.4 with the Mongolian lookup guard, the mark-positioning
   retry and the OpenType language system of the sample's `lang`) shapes every sample in every face; none throws.
3. **Agreement with HarfBuzz.** harfbuzzjs 1.6.2 (MIT, a dev dependency of the tests only) shapes the same text with the same language. The advance
   width at 100 px agrees to 0.011 px for **381 of the 391 face-samples**; the other ten are recorded, bounded fontkit limits (below). Shaping applied (the glyph run
   differs from the nominal one) wherever the category says it must (joining, conjuncts, vowel placement, tone marks), and marks keep a zero
   advance in both shapers.
4. **Browser.** Chromium (Edge 154) loads the same pinned bytes as `@font-face` and sets every sample at 100 px with its `lang`: the natural
   advance agrees with HarfBuzz and with the renderer within 0.1 px (maximum 0.056 px), and 104 right-to-left samples display right to left.
   CI runs this (`npm run test:script-corpora-browser`).
5. **The real pipeline.** Every corpus sample is also a slide title rendered by the product (composition, script itemization, SVG with `textLength` pins): in Chromium the natural advance of each of the 229 pinned runs equals its accepted advance within 0.1 px (the three runs of the recorded fontkit limits are bounded), and 22 right-to-left title lines paint right to left (`test/script-corpora-slides-browser.mjs`).
6. **Raster.** resvg-js (the PNG path) draws each regular-weight sample next to a reference drawn from HarfBuzz glyph outlines: 88 agree
   within 2 percent ink width; the scripts in [Raster limit](#raster-limit-resvg-js) do not.
7. **Host loading.** For every script, a document in its language whose text is a corpus sample loads exactly the pinned package with
   `scripts: 'auto'` (the editor's and the gallery host's selection), renders strictly, draws the designated family and rasterizes.
8. **Catalog samples.** The 60 non-Latin `textSample` strings of the font-scheme catalog (what the gallery shows) are covered by the script faces.

## Results per script

| Script | Languages (corpus tags) | Samples | Faces (400 and 700 where shipped) | Own-script coverage (BMP) | Samples equal to HarfBuzz (0.011 px) | Browser | Raster (resvg) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arab | 5 | 12 | Noto Sans Arabic, Noto Naskh Arabic, Noto Nastaliq Urdu | 99.8% ; 99.8% ; 23.7% | 68 of 72 | 72 of 72 within 0.1 px | agrees (24) |
| Hebr | 1 | 6 | Noto Sans Hebrew, Noto Serif Hebrew | 100.0% ; 100.0% | 24 of 24 | 24 of 24 within 0.1 px | agrees (6) |
| Deva | 3 | 9 | Noto Sans Devanagari | 100.0% | 18 of 18 | 18 of 18 within 0.1 px | limited (9 of 9 deviate) |
| Beng | 2 | 6 | Noto Sans Bengali | 100.0% | 12 of 12 | 12 of 12 within 0.1 px | limited (5 of 6 deviate) |
| Guru | 1 | 3 | Noto Sans Gurmukhi | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | limited (3 of 3 deviate) |
| Gujr | 1 | 3 | Noto Sans Gujarati | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | limited (3 of 3 deviate) |
| Orya | 1 | 3 | Noto Sans Oriya | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | limited (3 of 3 deviate) |
| Taml | 1 | 5 | Noto Sans Tamil | 100.0% | 10 of 10 | 10 of 10 within 0.1 px | limited (3 of 5 deviate) |
| Telu | 1 | 4 | Noto Sans Telugu | 99.0% | 8 of 8 | 8 of 8 within 0.1 px | limited (3 of 4 deviate) |
| Knda | 1 | 3 | Noto Sans Kannada | 98.9% | 6 of 6 | 6 of 6 within 0.1 px | limited (3 of 3 deviate) |
| Mlym | 1 | 4 | Noto Sans Malayalam | 100.0% | 8 of 8 | 8 of 8 within 0.1 px | limited (3 of 4 deviate) |
| Sinh | 0 | 3 | Noto Sans Sinhala | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | limited (3 of 3 deviate) |
| Thai | 1 | 7 | Noto Sans Thai | 100.0% | 14 of 14 | 14 of 14 within 0.1 px | limited (3 of 7 deviate) |
| Laoo | 0 | 2 | Noto Sans Lao | 100.0% | 4 of 4 | 4 of 4 within 0.1 px | limited (1 of 2 deviate) |
| Khmr | 1 | 4 | Noto Sans Khmer | 100.0% | 8 of 8 | 8 of 8 within 0.1 px | limited (3 of 4 deviate) |
| Mymr | 0 | 3 | Noto Sans Myanmar | 100.0% | 2 of 6 | 6 of 6 within 0.1 px | limited (2 of 3 deviate) |
| Tibt | 0 | 2 | Noto Serif Tibetan | 100.0% | 4 of 4 | 4 of 4 within 0.1 px | agrees (2) |
| Mong | 1 | 3 | Noto Sans Mongolian | 100.0% | 3 of 3 | 3 of 3 within 0.1 px | agrees (3) |
| Ethi | 1 | 3 | Noto Sans Ethiopic | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | agrees (3) |
| Armn | 1 | 3 | Noto Sans Armenian | 100.0% | 6 of 6 | 6 of 6 within 0.1 px | agrees (3) |
| Geor | 1 | 2 | Noto Sans Georgian | 100.0% | 4 of 4 | 4 of 4 within 0.1 px | agrees (2) |
| Syrc | 0 | 2 | Noto Sans Syriac | 84.9% | 2 of 4 | 4 of 4 within 0.1 px | agrees (2) |
| Thaa | 0 | 2 | Noto Sans Thaana | 100.0% | 4 of 4 | 4 of 4 within 0.1 px | agrees (1) |
| Jpan | 1 | 7 | Noto Sans JP | 100.0% of JIS X 0208 | 14 of 14 | 14 of 14 within 0.1 px | agrees (7) |
| Hans | 1 | 4 | Noto Sans SC | 91.6% of GB 2312 | 8 of 8 | 8 of 8 within 0.1 px | agrees (4) |
| Hant | 1 | 4 | Noto Sans TC | 99.3% of Big5 levels 1 and 2 | 8 of 8 | 8 of 8 within 0.1 px | agrees (4) |
| Kore | 1 | 4 | Noto Sans KR | 100.0% | 8 of 8 | 8 of 8 within 0.1 px | lang ignored (about 1.5% narrower) |
| Cyrl | 8 | 9 | Noto Sans | 99.5% | 36 of 36 | 36 of 36 within 0.1 px | agrees (9) |
| Grek | 1 | 4 | Noto Sans | 100.0% | 16 of 16 | 16 of 16 within 0.1 px | agrees (4) |
| Latn | 57 | 14 | Noto Sans | 92.7% | 56 of 56 | 56 of 56 within 0.1 px | agrees (14) |

"Own-script coverage" is the share of the Unicode script's assigned letters, marks and digits in the Basic Multilingual Plane (Unicode of
Node's ICU) that the regular face has a glyph for; CJK faces are held to their national charset, decoded from the WHATWG encodings
(JIS X 0208, GB 2312, Big5 levels 1 and 2, KS X 1001). The full figures, with the first missing code points, are in
`qualification.json`. Gaps worth knowing: Noto Nastaliq Urdu is an Urdu-only face (24 percent of Arabic); Noto Sans Syriac lacks the
Syriac Supplement block; Noto Sans Tamil, Myanmar and the Latin, Cyrillic and Greek blocks lack only code points outside the BMP or
very recent additions. Noto Sans JP and Noto Sans KR cover almost none of the other locales' national charsets (JP: 65 percent of GB
2312, KR: 56 percent), so a Chinese ideograph beside Japanese text draws with Noto Sans SC by glyph fallback, as FF-19 designed it.

## Per proprietary family: the replacement against the installed original

The proprietary script fonts that are installed on the measuring host (Windows 11 with Microsoft 365) were read **in place** (never
copied; `references.json` holds numbers and file hashes only). Each corpus sample of the family's script was shaped with fontkit in the
original and in the family's designated open replacement at 100 px; the delta is `replacement / original - 1` of the advance width.
Line height is `ascent - descent + lineGap` from the `hhea` table in em (core composes lines at a fixed 1.22 of the font size, so these
matter for the baseline and the glyph size, not for the line pitch).

| Original (installed) | Script | Preview replacement | Weights measured | Samples | Mean width delta (replacement vs original) | Max absolute delta | Line height (hhea ascent + descent + lineGap, em): original / replacement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Yu Gothic | Jpan | Noto Sans JP | 400/700 | 7 | -1.4% / -1.2% | 4.1% / 3.9% | 1.60 / 1.45 |
| MS Gothic | Jpan | Noto Sans JP | 400 | 7 | -5.0% | 16.2% | 1.00 / 1.45 |
| Microsoft YaHei | Hans | Noto Sans SC | 400/700 | 4 | -1.3% / -1.1% | 5.1% / 4.6% | 1.32 / 1.45 |
| SimSun | Hans | Noto Sans SC | 400 | 4 | -1.1% | 4.6% | 1.14 / 1.45 |
| Microsoft JhengHei | Hant | Noto Sans TC | 400/700 | 4 | -3.3% / -2.8% | 10.6% / 10.6% | 1.33 / 1.45 |
| Malgun Gothic | Kore | Noto Sans KR | 400/700 | 4 | -5.9% / -5.8% | 9.0% / 9.0% | 1.33 / 1.45 |
| Arabic Typesetting | Arab | Noto Naskh Arabic | 400 | 12 | +56.0% | 74.5% | 1.15 / 1.70 |
| Traditional Arabic | Arab | Noto Naskh Arabic | 400/700 | 9 | +27.7% / +26.0% | 41.1% / 39.4% | 1.49 / 1.70 |
| Sakkal Majalla | Arab | Noto Naskh Arabic | 400/700 | 12 | +24.6% / +25.9% | 36.3% / 37.5% | 1.40 / 1.70 |
| Simplified Arabic | Arab | Noto Naskh Arabic | 400/700 | 11 | +7.9% / +8.9% | 14.6% / 13.7% | 1.66 / 1.70 |
| Andalus | Arab | Noto Naskh Arabic | 400 | 8 | +16.5% | 22.3% | 1.53 / 1.70 |
| Urdu Typesetting | Arab | Noto Naskh Arabic | 400/700 | 11 | +54.2% / +58.4% | 74.0% / 79.6% | 1.70 / 1.70 |
| Aldhabi | Arab | Noto Naskh Arabic | 400 | 11 | +76.4% | 98.3% | 1.75 / 1.70 |
| Nirmala UI | Deva | Noto Sans Devanagari | 400 | 9 | -6.2% | 9.2% | 1.33 / 1.30 |
| Angsana New | Thai | Noto Sans Thai | 400 | 7 | +42.4% | 58.2% | 1.16 / 1.51 |
| DilleniaUPC | Thai | Noto Sans Thai | 400 | 7 | +55.5% | 64.5% | 0.60 / 1.51 |
| Leelawadee | Thai | Noto Sans Thai | 400/700 | 7 | +2.8% / -4.3% | 5.4% / 7.9% | 1.20 / 1.51 |
| Cordia New | Thai | Noto Sans Thai | 400 | 7 | +39.0% | 49.4% | 1.15 / 1.51 |
| Browallia New | Thai | Noto Sans Thai | 400 | 7 | +35.9% | 43.8% | 1.13 / 1.51 |
| Myanmar Text | Mymr | Noto Sans Myanmar | 400/700 | 3 | +11.5% / +12.3% | 15.6% / 17.3% | 1.86 / 2.18 |
| Microsoft Himalaya | Tibt | Noto Serif Tibetan | 400 | 2 | +54.1% | 57.3% | 1.00 / 2.81 |
| Mongolian Baiti | Mong | Noto Sans Mongolian | 400 | 2 | +77.0% | 79.8% | 1.15 / 1.75 |
| MV Boli | Thaa | Noto Sans Thaana | 400 | 2 | -26.9% | 27.4% | 1.61 / 1.49 |
| Sylfaen | Armn | Noto Sans | 400 | 3 | +2.9% | 13.6% | 1.32 / 1.36 |
| Sylfaen | Geor | Noto Sans | 400 | 1 | +1.7% | 1.7% | 1.32 / 1.36 |

**Not installed on the measuring host** (all `windows-optional` Supplemental Fonts on Demand or absent): Meiryo, MS Mincho, SimHei, FangSong, MingLiU, PMingLiU, Batang, BatangChe, Gungsuh, GungsuhChe, David, Miriam, Gisha, Mangal, Aparajita, Shonar Bangla, Vrinda, Raavi, Shruti, Kalinga, Latha, Gautami, Tunga, Kartika, Iskoola Pota, DokChampa, DaunPenh, Khmer UI, MoolBoran, Estrangelo Edessa, Nyala. These stay
unmeasured; nothing here claims their widths. Their replacement is the script's designated Noto face.

Reading the table:

- **CJK**: the replacements are within 1 to 6 percent in mean width on mixed text (Latin runs are the difference; ideographs are one em in both),
  with MS Gothic (-5 percent, 16 percent at worst), JhengHei and Malgun Gothic the widest gaps. Line heights differ (Noto 1.45 em against 1.0
  to 1.6): composition does not use font line height, but the baseline sits at a different offset in the box.
- **Arabic and Thai fonts built compact are not matchable**: Arabic Typesetting (+56 percent), Urdu Typesetting (+54), Aldhabi (+76), Traditional
  Arabic (+28), Sakkal Majalla (+25), Angsana New (+42), DilleniaUPC (+56), Cordia New (+39), Browallia New (+36), Mongolian Baiti (+77) and
  Microsoft Himalaya (+54) are far narrower than any open face of their script. Noto Serif Thai was measured as the Angsana and Dillenia
  replacement and is **wider** still (+51 and +65 percent), so the sans face stays. A deck set in one of them previews with longer lines than
  PowerPoint draws; the PPTX names the original. Leelawadee (Thai, +3 percent), Simplified Arabic (+8), Andalus (+17) and Nirmala UI (-6) are close.
- **No open face is metric-compatible with any script font** in this table, so none is `perfect` for parity; every one is `near` by the owner's
  definition of a visual-only replacement. This was measured, not assumed.

## Findings and fixes

| Finding | Where | Disposition |
| --- | --- | --- |
| Chromium 123+ trims adjacent fullwidth punctuation (`text-spacing-trim: normal`): a `「」。` sequence draws 10 percent narrower than measured, so the browser stretched glyphs back to the pinned `textLength` | SVG in a browser, East Asian decks | **Fixed** (opf-render #93): a slide that draws fullwidth punctuation carries `text-spacing-trim:space-all` on the root `<svg>`; other output is byte-identical (no golden changed). Proven on real `renderSvg` output in Chromium. PowerPoint draws such punctuation at full width; the native deck checks it |
| fontkit 2.0.4 has no Myanmar shaper: no medial-ra or e-vowel reordering, no kinzi, no u/ii ligature. The measured advance of Myanmar words is 3.5 percent wider than HarfBuzz's (kinzi) | measurement and line breaking | Recorded and bounded in the fixture (`knownShapingLimits`), gated both ways (a deviation above the bound fails, a limit that no longer deviates fails). Only the Myanmar Text script slot uses it; no catalog language does |
| fontkit gives the first letter of one Syriac word its isolated form (1.6 percent narrower than HarfBuzz) | measurement | Recorded and bounded (Estrangelo Edessa slot only) |
| fontkit throws on Noto Nastaliq Urdu's mark-to-base anchors; the renderer measures without mark positioning, which changes vowel-marked words by up to 1 percent | measurement | Recorded and bounded (Google Slides `noto-nastaliq-urdu` scheme only). The retry itself was FF-19's |
| Noto Sans Mongolian could not shape any text in fontkit (GSUB type 8 lookup) | fixed earlier (FF-44 groundwork, `skipUndecodableLookups`) | The corpus proves the three Mongolian samples equal HarfBuzz to 0.011 px and the Noto Sans Mongolian scheme draws; the tracker row was out of date |
| Noto Sans Mongolian has no bold upstream | packaging | Documented and tested: a bold request draws the regular face (`visual`); no bold file exists to qualify |
| **resvg-js 2.6.2 mis-shapes Indic scripts, Thai, Lao, Khmer, Myanmar and ignores `lang`** | PNG output (SVG in a browser and the vector PDF of RR-12 are right) | **Open**: recorded as a test that fails when resvg stops doing it; see [Raster limit](#raster-limit-resvg-js) |
| **Core line breaking has no dictionary word breaking and no kinsoku**: it wraps at white space and, for a token wider than the line, at grapheme clusters | composition (`wrapText`), every host | **Open**, measured (`line-breaks.json`): 122 of 160 breaks in the Thai samples, 28 of 40 in Lao, 38 of 49 in Khmer and 66 of 103 in Myanmar fall inside an ICU dictionary word; 54 (Japanese), 51 (Simplified) and 57 (Traditional Chinese) lines over 61 widths start with closing punctuation or end with an opening bracket. PowerPoint breaks these scripts at word boundaries and applies East Asian line-break rules by default (`eaLnBrk`), but that is not natively verified: the exported decks bake the preview breaks, so a separate probe deck has PowerPoint wrap by itself ([Native check](#native-check)). Changing it moves geometry (a core release and lockstep floors), so it is a follow-up item, not part of this PR |
| Serif originals (MS Mincho, SimSun, FangSong, MingLiU, PMingLiU, Batang, Gungsuh) preview in the sans face of their script | appearance | Documented visual gap; see [Decisions](#decisions-vetoable) |
| The seven shipped script dependencies (Noto Sans Arabic, Lao, Myanmar, Sinhala, Syriac, Thaana and Noto Serif Tibetan) had no policy row | `spec/reference/font-policy.json` | **Fixed** (this PR): open rows, OFL-1.1 |

### Raster limit (resvg-js)

resvg-js 2.6.2 (the newest release; 2.7.0-alpha.2 behaves the same) draws the text of Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil,
Telugu, Kannada, Malayalam, Sinhala, Thai, Lao, Khmer and Myanmar with a different shaping from HarfBuzz, Chromium and fontkit: a spacing vowel sign
or a space that follows a cluster loses its advance, so letters overlap and words run together (`भाषा` draws as `भषा`, the ink of a Hindi title
is 20 percent narrower). It also ignores the SVG `lang`, so Korean is shaped without the KOR language-system lookups (about 1.5 percent
narrower). Latin, Cyrillic, Greek, CJK (apart from that Korean case), Arabic, Hebrew, Armenian, Georgian, Ethiopic, Mongolian, Tibetan, Thaana and Syriac
agree. The SVG itself is correct in a browser (every sample, above), and the vector PDF (RR-12) shapes with fontkit, not resvg. What is affected is
`svgToPng` and the raster PDF mode. `test/script-corpora-raster.mjs` pins the list: each listed script must still deviate (so a resvg fix
fails the test and removes the limit from the fixture and from this page) and every other script must agree. Making the PNG right needs a resvg
fix or a per-cluster positioning step in the rasterizer; neither is part of this item.

## Decisions (vetoable)

1. **The corpus is original text**, not UDHR or other third-party prose (see What the corpus is). Vetoable: a licensed corpus can be added as a second fixture.
2. **HarfBuzz (harfbuzzjs, MIT) is the shaping reference; fontkit stays the measurement engine.** Swapping the engine would change every line break; the
   measurement is instead held to HarfBuzz sample by sample, with the limits recorded.
3. **The fontkit limits (Myanmar, Syriac, Nastaliq) are recorded, not patched.** A Myanmar shaper in the renderer is a feature, and no catalog language needs it.
4. **`text-spacing-trim:space-all`** on slides that draw fullwidth punctuation, so the browser draws the advances the measurement and PowerPoint use.
   If PowerPoint turns out to compress adjacent fullwidth punctuation, the measurement (not the style) is what must change; the native deck is built to show it.
5. **No Noto Serif CJK is bundled.** Noto Serif JP, SC, TC and KR are OFL-1.1 and exist as pinned npm packages (62 to 119 MiB unpacked each, about 9 to 17 MiB per face),
   which would double the optional script pack and every CI install for seven scheme families. The seven serif originals preview in the sans face of their script
   (visual, recorded in the policy rows). The route exists for hosts: a host that supplies a face named `Noto Serif JP` (or SC, TC, KR) gets it for MS Mincho, SimSun,
   FangSong, MingLiU, PMingLiU, Batang and Gungsuh through the script-font alias rule, which a test now pins. Revisit if the owner wants the serif look in the gallery.
6. **Noto Sans Mongolian stays regular-only**; bold requests draw regular and say `visual`.
7. **Noto Serif Thai is not adopted** for Angsana New or DilleniaUPC: it is wider than Noto Sans Thai (measured above).
8. **The seven policy rows** (`licenseClass: open`, `OFL-1.1`, `embeddableByOpf`, `replacement: null`) follow the existing Noto rows.

## What is not done, and why

- **Native PowerPoint comparison (FF-46, RR-05)** for every family: root only. [Native check](#native-check) describes the decks that are ready.
- **The 31 originals not installed here** (list above) have no width or line-metric measurement; a host that has the Supplemental Fonts can run
  `node scripts/measure-script-references.mjs`.
- **Per-family acceptance** (`accepted: true`) is not claimed for any family: it needs the native comparison.
- **Scripts no catalog language or font scheme selects** (N'Ko, Tifinagh and Vai, which the Ebrima policy row names) have no bundled face and no corpus: they draw with the
  design font (diagnosed `script-font-unavailable`). Recorded as descoped for this item.
- **Core line breaking** for Thai, Lao, Khmer, Myanmar and CJK (above): a follow-up core change plus the native probe.
- **Raster shaping** (above) and the **serif CJK look** (decision 5) are the open fidelity gaps.

## Native check

The supervisor's decks are prepared outside the repository (`rr-17-native/scripts`, with a manifest of the expected typeface names in the file, the
`a:ea` and `a:cs` slots, `lang`, `rtl`, the preview line widths and, where the original is installed, its widths). They check what the preview cannot:
that PowerPoint resolves each named script family (or substitutes it), how it draws marks, conjuncts and mixed-script lines, that adjacent fullwidth
punctuation is not compressed, the Latin-deck slot routing, and (a separate probe deck whose text box PowerPoint wraps itself) where PowerPoint breaks Thai, Khmer, Japanese and Chinese lines. Results are recorded by the supervisor under `docs/evidence/`.

## Reproduce

```
# opf-render, with the optional script packages installed (npm ci)
npm run build
node test/script-corpora.mjs            # Node gate (about 10 s)
node test/script-corpora-raster.mjs     # resvg conformance record
npm run test:script-corpora-browser     # Chromium (CI: the pinned Playwright image)
node scripts/script-corpora.mjs report.json              # the qualification report
node scripts/measure-script-references.mjs report.json   # Windows only; reads installed fonts in place
```
