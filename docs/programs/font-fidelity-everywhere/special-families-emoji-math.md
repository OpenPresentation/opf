# Special families: Segoe UI Emoji and Cambria Math (FF-45, RR-17)

Status 2026-10-01. Implementation: opf-render `codex/rr-17b-emoji-math` ([opf-render#95](https://github.com/OpenPresentation/opf-render/pull/95)), opf-pptx `codex/rr-17b-emoji-math` ([opf-pptx#139](https://github.com/OpenPresentation/opf-pptx/pull/139)), this core PR. The symbol-encoded families (Symbol, Webdings, Wingdings) are a separate path: [special-families.md](special-families.md).

Owner policy (2026-09-29) applies unchanged: the preview uses an open look-alike, the PPTX names the chosen font and keeps the authors' characters, fonts are bundled and self-hosted only, and only OFL-1.1, Apache-2.0, MIT and UFL-1.0 faces may be bundled. Every number below was measured with fontkit 2.0.4 (the renderer's shaper, default features) and, for browsers, Edge 154 (Chromium) on Windows 11; Segoe UI Emoji 1.33 and Cambria Math 6.99 were read in place from `C:\Windows\Fonts` and no outline, table or byte of them was copied.

## Summary

| Family | Route | Compatibility | Format | Browser | Raster (resvg) | Native |
|---|---|---|---|---|---|---|
| Segoe UI Emoji | Noto Color Emoji (`@expo-google-fonts/noto-color-emoji` 0.4.6, OFL-1.1), alternate Noto Emoji (`@expo-google-fonts/noto-emoji` 0.4.7, OFL-1.1) | visual, unmeasured on the policy corpus | COLRv1 plus OT-SVG colour glyphs (glyf outlines empty), 25.1 MB; Noto Emoji monochrome TTF, 0.9 MB | colour (COLRv1 in Chromium; test: 9 emoji runs with saturated pixels, advances within 0.014 px of fontkit) | monochrome silhouette in Noto Emoji: resvg 2.6.2 paints nothing from COLRv1 or OT-SVG tables (test pins both facts) | pending (FF-46; checks listed for the root) |
| Cambria Math | STIX Two Math (`@expo-google-fonts/stix-two-math` 0.4.0, OFL-1.1, Reserved Font Name "TM Math"), alternates Noto Sans Math (`@expo-google-fonts/noto-sans-math` 0.4.2), Caladea | visual, unmeasured on the policy corpus; math corpus mean 5.0%, max 18.2% | TrueType with a MATH table, 1.4 MB; Noto Sans Math 1.0 MB | STIX runs draw with advances within 0.1 px of fontkit | outlines rasterize (ink test) | pending (FF-46) |

Both packs are exact optional peer dependencies of opf-render (devDependencies for its tests), hash-pinned in `src/font-manifest.js` with the licence read from each package's `LICENSE_FONT`, and load like the Noto script packs under the pseudo-scripts `Zsye` (emoji symbols) and `Zmth` (mathematical notation), which are ISO 15924 codes for text rather than for characters. The default install and the eager browser registry do not grow; a browser host fetches the 25.1 MB colour face only for a deck that draws emoji (`ensureScripts`), and Node loads it only with `scripts: 'auto'` for such a deck or `scripts: ['Zsye']`.

## Segoe UI Emoji

### Candidates and decision (vetoable)

Google's Noto Color Emoji is the only openly licensed colour emoji family with an npm pin. The `@expo-google-fonts` file is the Google Fonts build: COLRv1 (checked: `COLR` version 1) plus an OT-SVG table (711 documents, uncompressed, one shared 14 MB document for glyphs 4 to 2740 that declares the `xlink` namespace), 41 863 glyphs, 1024 units per em, hhea and typo 950/-250/0 with `useTypoMetrics` set. Twemoji and OpenMoji are CC-BY and CC-BY-SA, which the policy does not allow, and Microsoft's Fluent Emoji assets (MIT) have no font build with a pin. Google publishes no COLRv0 build, and resvg cannot draw bitmaps either, so there is no open colour face that the raster path could draw today. Decision: Segoe UI Emoji previews with Noto Color Emoji; Noto Emoji (monochrome, the same project) is the alternate and the face the raster path draws. Both rows are in the policy table as open families.

### What was measured

Every emoji sequence shapes to one glyph in both Noto faces and in Segoe UI Emoji, except where Segoe UI Emoji's own design differs:

| Sequence | Code points | Noto Color Emoji | Noto Emoji | Segoe UI Emoji 1.33 |
|---|---|---|---|---|
| 😀 single | U+1F600 | 1 glyph, 1.2451 em | 1 glyph, 1.2695 em | 1 glyph, 1.3730 em |
| 👨‍👩‍👧‍👦 ZWJ family | U+1F468 200D 1F469 200D 1F467 200D 1F466 | 1 glyph (a grey silhouette by Noto's design since 2.042) | 1 glyph | 5 glyphs in fontkit, 1.7837 em (what PowerPoint draws is a native check) |
| 🇩🇪 flag | U+1F1E9 1F1EA | 1 glyph | 1 glyph | 2 letter glyphs, 0.9668 em (Segoe UI Emoji draws no national flags) |
| 👍🏽 skin tone | U+1F44D 1F3FD | 1 glyph | 1 glyph | 1 glyph |
| 1️⃣ keycap | U+0031 FE0F 20E3 | 1 glyph | 1 glyph | 1 glyph |
| ❤️ VS16, ❤︎ VS15 | U+2764 FE0F, U+2764 FE0E | 1 glyph each | 1 glyph each | 1 glyph each |
| 🏴󠁧󠁢󠁳󠁣󠁴󠁿 tag sequence | U+1F3F4 E0067 E0062 E0073 E0063 E0074 E007F | 1 glyph | 1 glyph | the black flag plus six zero-width tags (no tag glyphs) |
| 👩🏾‍💻, 🏳️‍🌈 | — | 1 glyph each | 1 glyph each | 1 glyph each |

Advance: 1.2451 em (1275/1024) per emoji in Noto Color Emoji against 1.3730 em in Segoe UI Emoji, a -9.3% width difference per emoji, and 1.2695 em in Noto Emoji. The per-run width is not pinned to Segoe's advance: `textLength` stretching an emoji glyph by 10% would draw a wrong glyph, so the preview keeps the replacement's advance, reported as visual, and the delta is recorded here and gated in `test/emoji-math.mjs`. Noto Color Emoji has no Latin glyphs (`Hello` shapes to five `.notdef`), while Segoe UI Emoji carries Segoe UI's Latin (for example `Hello` 2.3032 em, digits 0.539 em); its digits and `#`, `*` exist only as 1.2451 em keycap bases.

Edge 154 draws the pinned file in colour: a 1200 px line of the ten sequences at 80 px gives 25 237 saturated pixels, every sequence measures 99.61 px (1.2451 em) in the browser, equal to fontkit, and only the VS15 heart differs (the browser substitutes a text font for text presentation, 77.73 px). resvg 2.6.2 draws nothing from the same file for any sequence (0 ink pixels), and draws every sequence from Noto Emoji (1 500 to 2 800 ink pixels at 80 px, no saturated pixel).

### Renderer path

- Pack: manifest packages `@expo-google-fonts/noto-color-emoji` (`color: {format: "COLRv1, SVG", rasterFamily: "Noto Emoji"}`) and `@expo-google-fonts/noto-emoji`, both `pack: "scripts"`, `scripts: ["Zsye"]`; `scriptFontPackages(['Zsye'])` returns both; `SCRIPT_FONT_FAMILIES.Zsye` is Noto Color Emoji; `SCRIPT_FONT_REPLACEMENTS` maps Segoe UI Emoji to Noto Color Emoji, then Noto Emoji, so the loaded face aliases the family under every substitution policy (`resolveFont` reports `compatibility: "visual"`, `sourceFamily: "Segoe UI Emoji"`).
- Detection: `hasEmojiPresentation(text)` (Emoji_Presentation characters, emoji modifiers, regional indicators, VS16, the keycap mark, tag characters) makes `scriptsOfText` report `Zsye`, so `scripts: 'auto'` in Node and `ensureScripts` in a browser load the pack for decks that draw emoji; a font scheme that names Segoe UI Emoji loads it as a design script. Text-default pictographs (❤, ☺, ©) without VS16 do not load it.
- Planning (`createScriptFonts().plan`): emoji are Common characters and stay in their neighbours' run; a run with an emoji-presentation cluster, or whose face is an emoji face, is planned per grapheme cluster. An emoji-presentation cluster takes the emoji faces first, then the text faces; any other cluster takes the text faces first and the emoji faces last. So a ZWJ sequence, flag, skin-tone sequence, keycap or tag sequence is never split across faces (adjacent clusters in the same face merge into one run, one `tspan`, one fontkit shaping call: one glyph), VS16 forces the emoji face even when the text face has the base character, VS15 keeps a text face when one has the character (otherwise the emoji face draws it), and the Latin text and digits of a Segoe UI Emoji run take a text face (Noto Sans by the chain) instead of Noto Color Emoji's emoji-sized digits. The chain `glyphFallbackFamilies` lists the emoji and math faces last, after every real script face.
- Measurement: fontkit shapes the sequences with the face's GSUB ligatures (one glyph, one advance); `createScriptTextMeasurement` sums the runs, so line breaking, SVG `textLength` and the browser agree (`test/emoji-math-browser.mjs`: 18 runs within 0.014 px). `outlineBounds` of a COLRv1 face reports the em box over the run: fontkit's COLR reader handles v0 layers only and threw on this table.
- SVG: the run names `Noto Color Emoji` (`font-family="Noto Color Emoji, sans-serif"`); the deck's chosen family is untouched for exporters. Script faces are not embedded in standalone SVGs by default (`embedScriptFonts`), so the 25 MB file is never base64-encoded into a slide unless asked.
- Raster: `src/color-fonts.js` renames colour families to their `rasterFamily` in the SVG about to be rasterized (never the emitted SVG, the same pattern as the ligature separation for Gelasio) and drops the colour files from resvg's font list, so resvg draws Noto Emoji, deterministically. Where a run is positioned, `textLength` pins it to the colour face's measured width (Noto Emoji is 2.0% wider), so layout does not move. Limit: PNG and PDF output shows emoji as black-and-white silhouettes.
- Errors: strict mode (`glyphFallback: 'none'`) still raises `missing-glyph`; without the pack, `Segoe UI Emoji` raises `font-unavailable` with `details.replacement: "Noto Color Emoji"` and `details.packs: ["scripts"]`.

### Export

`toPptx` writes `Segoe UI Emoji` in every run's `a:latin`, `a:ea` and `a:cs` and in the theme, and the `a:t` text byte for byte (ZWJ, VS15, VS16, tag characters), whatever face the preview used; `fromPptx` returns the same string (`opf-pptx test/math-emoji.mjs`).

### Limits and open items

- Raster output is monochrome. A colour raster path needs either a resvg with COLRv1 (not in 2.6.2) or inlining the font's OT-SVG glyph documents into the SVG as paths before rasterizing; the documents exist (711, one shared 14 MB document with `xlink` references and `id="glyphN"` groups) but inlining them per run is a separate change.
- Noto Color Emoji draws the family ZWJ sequences as grey silhouettes by design; Segoe UI Emoji draws them in colour. Segoe UI Emoji draws no national flags and has no tag glyphs, so a flag or the Scotland tag sequence looks different natively; both facts are native checks, not preview faults.
- The width difference per emoji is -9.3%; mixed Latin text in a Segoe UI Emoji run is drawn with Noto Sans in the preview and with Segoe UI's own Latin natively.
- Native evidence: pending (FF-46). The root's deck list is in the native-check brief (`emoji-math-native-checks.md`, expected widths in `expected-widths.json`).

## Cambria Math

### Candidates and decision (vetoable)

| Candidate | Licence | Coverage of the 144 corpus characters | Width delta against Cambria Math 6.99 (31 strings) | Verdict |
|---|---|---|---|---|
| STIX Two Math 2.13 (`@expo-google-fonts/stix-two-math` 0.4.0) | OFL-1.1, Reserved Font Name "TM Math" (not carried by the family or file name; allowed under the name-contains rule) | 143 (lacks U+1D62 subscript i) | mean 4.98%, signed -0.56%, max 18.16% (arrows); Latin 0.94%, digits 10.0%, Greek 7.8%, operators 4.8%, math italic 2.8%, double-struck 5.6%, script and fraktur 3.7% | **accepted, visual** |
| Noto Sans Math (`@expo-google-fonts/noto-sans-math` 0.4.2) | OFL-1.1 | 142 (lacks U+00B2, U+1D62) | mean 8.25%, signed +6.31%, max 21.81%; Latin 10.0% | alternate; the designated math face for sans schemes in glyph fallback |
| Caladea (already bundled, the Cambria look-alike) | OFL-1.1 | 71 (no Greek, no math alphanumerics, few operators) | Latin 4.72%, digits 15.6%; the rest unmeasurable | last alternate (registries without the pack); not combined with STIX per character, because STIX's Latin is closer in width (0.94%) and one face keeps a Cambria Math run one run |
| Latin Modern Math | GUST Font License | — | — | not allowed, not measured |

Cambria Math's Latin outlines are Cambria's (62 of 62 shared basic Latin glyphs identical); none of the three candidates shares an outline with it (0 of 62). Note that Cambria Math spaces its operators wider than Cambria: `≤`, `≠`, `±` and `=` advance 0.749 em in Cambria Math and 0.554 em in Cambria, `∫` 0.586 against 0.425.

Vertical metrics (em): Cambria Math hhea 0.7788/-0.2222/0.1724, typo 0.7778/-0.2222/0.1724 (`useTypoMetrics` set; win 3.1167/2.4634 because of the extensible glyphs), x-height 0.4668, cap height 0.6665. STIX Two Math hhea and typo 0.762/-0.238/0.25, x-height 0.473, cap height 0.657: a STIX line is 1.250 em against Cambria Math's 1.1724 em (+6.6%). Noto Sans Math 1.069/-0.423/0 (1.492 em), x-height 0.536. MATH constants (font units; Cambria Math 2048 upem, STIX and Noto 1000): AxisHeight 585 / 258 / 278, MathLeading 300 / 150 / 150, FractionRuleThickness 133 / 68 / 71, FractionNumeratorShiftUp 1200 / 585 / 529, FractionDenominatorShiftDown 1030 / 585 / 320, RadicalRuleThickness 133 / 68 / 71, RadicalVerticalGap 166 / 85 / 89, SuperscriptShiftUp 750 / 360 / 390, SubscriptShiftDown 418 / 210 / 210, ScriptPercentScaleDown 73 / 70 / 60, DisplayOperatorMinHeight 2500 / 1800 / 2300. They are recorded for the day an equation model exists; nothing reads them today.

### Renderer path

- Pack: `@expo-google-fonts/stix-two-math` and `@expo-google-fonts/noto-sans-math`, `pack: "scripts"`, `scripts: ["Zmth"]`; `SCRIPT_FONT_FAMILIES.Zmth` is `{serif: "STIX Two Math", sans: "Noto Sans Math"}`, so glyph fallback for a math character a design face lacks takes Noto Sans Math in a sans deck and STIX Two Math in a serif deck; `SCRIPT_FONT_REPLACEMENTS` maps Cambria Math to STIX Two Math, then Noto Sans Math, under every policy. STIX Two Math and Noto Sans Math named directly resolve to themselves (`compatibility: "exact"`). Bold or italic Cambria Math requests take the one regular face and are reported visual (Cambria Math itself ships one face).
- Detection: `hasMathNotation(text)` covers the math alphanumerics U+1D400 to U+1D7FF, the letterlike math sets (ℂ ℍ ℕ ℙ ℚ ℝ ℤ, script and fraktur letters) and the rarer operator blocks (U+27C0 to U+27EF, U+2980 to U+2AFF); `scripts: 'auto'` loads the pack for such text or for a scheme that names Cambria Math. Common operators (∑ ∫ √ ≤ ≠ ∞ ±, arrows) do not load it: the text faces and Noto Sans cover them, and a 2.4 MB fetch for an arrow is not worth it. A char a scheme face lacks still reaches the math faces through the chain when the pack is loaded.
- Planning and measurement: a Cambria Math run is text; STIX Two Math covers the whole corpus so each corpus string is one run; a character it lacks (U+1D62) takes the next face per character, noted as `font-glyph-fallback`. Measurement and drawing agree (browser test: STIX runs within 0.1 px).
- The former `math-font-required` error is gone: without the pack, `Cambria Math` raises `font-unavailable` naming STIX Two Math and the scripts pack (metric registries), or takes the generic fallback family when the registry has one, like any other visual family.

### Math shaping limits (honest statement)

- OPF has no equation model: `spec/schemas/opf.schema.json` has no math, equation or OMML field (checked 2026-10-01). A Cambria Math run is a sequence of characters.
- The renderer draws text runs only. There is no OpenType MATH-table layout: no stacked fractions, no radicals with extensible rules, no over- or under-limits on big operators, no display-size operator variants, no italic correction or math kerning. fontkit and resvg implement none of this, and the MATH constants above are unused.
- Native OMML equations in an imported PPTX were dropped silently before this change: opf-pptx's paragraph readers took only the paragraph's direct `a:r` and `a:fld` runs, and an equation paragraph is an `mc:AlternateContent` whose `mc:Choice` holds `a14:m` / `m:oMathPara` and whose `mc:Fallback` holds plain runs. Now ([opf-pptx#139](https://github.com/OpenPresentation/opf-pptx/pull/139)) both readers import the fallback runs' text, or the equation's `m:t` text in order when there are none, and `fromPptx` reports `math-equation-flattened` (`slides.N`, one per native shape). The equation's layout is still lost; representing it is an owner decision for RR-18. The assumption that PowerPoint writes `a:r` runs in the fallback was not verified against a native file (no Office here); the native brief asks the root to save one equation and import it.
- Export writes `Cambria Math` and the characters; PowerPoint draws them as text in Cambria Math, not as an equation.

### Limits and open items

- Visual, not metric: digits are 10.6% narrower and arrows 6.7% wider in STIX Two Math; lines are 6.6% taller. A metric math face does not exist openly.
- The math corpus (31 strings, 144 characters) is FF-45's, not the policy's 300-string Latin corpus, so the policy rows say `measured: null` and the deltas live here and in the renderer test gate (`meanAbs <= 5.05%`, `maxAbs <= 18.5%`, Latin strings within 1.4%).
- Native evidence: pending (FF-46).

## Packaging, size and loading

| Package | Version | Faces pinned | File size | Pack | Loaded when |
|---|---|---|---|---|---|
| `@expo-google-fonts/noto-color-emoji` | 0.4.6 | Noto Color Emoji 400 | 25 111 640 bytes (23.9 MiB) | scripts, `Zsye`, `color` | text with emoji presentation, a Segoe UI Emoji scheme, `scripts: ['Zsye']` or `'all'` |
| `@expo-google-fonts/noto-emoji` | 0.4.7 | Noto Emoji 400 | 886 572 bytes | scripts, `Zsye` | with the colour face (the raster stand-in) |
| `@expo-google-fonts/stix-two-math` | 0.4.0 | STIX Two Math 400 | 1 471 976 bytes | scripts, `Zmth` | mathematical notation, a Cambria Math scheme, `scripts: ['Zmth']` or `'all'` |
| `@expo-google-fonts/noto-sans-math` | 0.4.2 | Noto Sans Math 400 | 1 004 120 bytes | scripts, `Zmth` | with STIX Two Math |

The eager browser registry (33 faces) and the Node base and office packs are unchanged; `registry.lazyFonts` (the vendored open faces) is unchanged; the script pack grows from 31 packages and 63 faces to 35 and 67. A browser host serves the packages from `scriptBaseUrl` like the Noto script packs; the colour face is 24 MiB over the wire once per document that draws emoji, which is the price of colour emoji with pinned whole files (Google Fonts serves this face subsetted by `unicode-range`; a subset would be a modified file and is not pinned). Hosts that cannot afford it can leave the package uninstalled: `scripts: 'auto'` reports `script-font-not-installed` and emoji fall back to whatever text face covers them, or `missing-glyph`.

## Evidence

- opf-render `test/emoji-math.mjs`: packs and policy rows, detection, loading under `scripts: 'auto'`, resolution under the metric policy, one glyph and one advance per sequence (1.2451 em, recorded Segoe delta -9.3%), planning (sequences unsplit, VS15 and VS16, Latin and digits of an emoji run in a text face), measurement agreement, strict mode, SVG runs, deterministic raster, raster ink without saturated pixels, the resvg blank-colour-font fact, the math corpus coverage and gated deltas, per-character STIX advances, the U+1D62 fallback, sans and serif chain order.
- opf-render `test/emoji-math-browser.mjs` (CI `test:emoji-math-browser`): four decks in Chromium with every face served from a local route, 18 runs within 0.014 px of the pinned `textLength`, 9 emoji runs with saturated pixels, the family silhouette drawn, Latin of a Segoe UI Emoji deck in a text face, a Cambria Math title in STIX Two Math.
- opf-pptx `test/math-emoji.mjs`: export writes the chosen family and the characters; import round-trips emoji; an `a14:m` paragraph imports its fallback text (or its `m:t` text) with `math-equation-flattened`; the ordered reader agrees with the keyed one.
- Native: none yet. Brief for the root: `emoji-math-native-checks.md` and `expected-widths.json` in the RR-17 native scratch folder.
