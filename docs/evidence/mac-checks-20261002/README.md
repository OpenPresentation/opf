# Mac checks (RR-17): Didot, vector PDF in PDFKit, Quick Look, WebKit

Date: 2026-10-02. Host: the owner's Mac mini (Apple silicon), macOS 26.6.2 (25G83), Node 26.7.0, Swift 6.3.3, Playwright 1.63.0
(Chromium 153.0.8010.12, WebKit 26.6). Packages under test: `@openpresentation/opf` 0.12.0, `@openpresentation/opf-render` 0.12.0
(registry), `@openpresentation/opf-pptx` 0.12.1 (registry; 0.12.2 was not on npm yet), and the `opf-editor` 0.11.1 release commit
(`f4779da`, built with opf-render 0.12.0) for the playground. Not covered, by rule: Keynote, PowerPoint (not installed), the Preview and
Safari applications (no GUI app was opened or automated; Quick Look ran through `qlmanage` thumbnails, PDFKit through a Swift program,
WebKit through Playwright). This is evidence for these checks on this Mac only. It is not a native PowerPoint claim and not a claim about
Safari's user interface. Keynote was checked afterwards by the supervisor (2026-10-04): see [keynote/README.md](keynote/README.md).

| Check | Verdict |
| --- | --- |
| 1. Didot against its Playfair Display route | Measured. `documented-visual` in the font tracker, with a large recorded gap: width 20.7% narrower on average, 0 of 250 wrap cases break at the same words. Playfair Display is a Didone look-alike, not a width match; the numbers argue for the owner to reconsider the route (below). |
| 2. Vector PDF in PDFKit | Pass for Latin, Japanese, Chinese, Korean, Arabic, Hebrew, Devanagari, Tamil and Thai: opens, page counts equal, every font embedded as a subset, extracted and selected text equal the SVG text. Two exceptions, both reading limits of PDFKit and not damage in the file: Bengali two-part vowels and one Khmer vowel come out as their visual-order parts (PDFKit ignores `/ActualText`, as pdf.js does in the RR-12 evidence). |
| 3. Quick Look of vector PDFs and exported PPTX | Pass: 5 of 5 PDFs and 5 of 5 PPTX produce a real thumbnail with `qlmanage -t`. Quick Look draws no native chart (the chart slide shows its title only). |
| 4. WebKit (Playwright) | Partial, with one root cause. WebKit's SVG text draws without kerning, so the natural advance of a line is up to about 1% (8 px on one Arabic line) wider than the renderer measured, where Chromium is within 0.015 px; `textLength` then squeezes the glyphs to keep line ends in place. 4 of 23 renderer browser gates and 14 of 22 editor gates pass in WebKit; the rest fail on this and on harness assumptions listed below. Nothing was relaxed. |

## 1. Didot

Didot ships only with macOS (`/System/Library/Fonts/Supplemental/Didot.ttc`, version 13.0d1e3, SHA-256 `c227867f...6fe8c`, three faces:
Regular, Italic, Bold). It was read in place (through a symlink in a scratch folder) and never copied. The report keeps only the file
name, version, hash and aggregate numbers, like the Latin qualification.

`scripts/qualify-latin-fonts.mjs --families Didot` ran on this Mac with opf-render 0.12.0 (same corpus of 300 strings, same 50
paragraphs at 8, 11.5, 16, 22 and 30 em). Its row replaced the `referenceAvailable: false` Didot row in
`../font-replacements-20260923/latin-qualification-20261001.json`; the run is recorded in that file's `supplementalRuns`. The
bundled Playfair Display files are byte-identical to the ones the other rows used (same SHA-256 per style).

| Style (Didot face) | Mean abs width delta | Max | Line breaks identical | x-height | cap height | hhea ascent |
| --- | --- | --- | --- | --- | --- | --- |
| 400 (Regular) | 20.16% | 22.71% | 0 of 250 | 0.968x | 0.802x | 1.150x |
| 700 (Bold) | 17.86% | 20.00% | 0 of 250 | 0.972x | 0.802x | 1.117x |
| 400i (Italic) | 24.10% | 26.96% | 0 of 250 | 0.963x | 0.802x | 0.855x |
| 700i | none: Didot has no Bold Italic face on macOS | | | | | |

The replacement is narrower in every string (signed mean equals the absolute mean). Playfair Display is 0.80x as wide as Didot (0.798
Regular, 0.798 Bold, 0.827 Italic; spread across the corpus 0.7 to 0.9 percentage points). An independent CoreText measurement of five
strings (`didot-coretext.swift`, `didot-coretext-widths.json`) gives 0.7995, 0.7933 and 0.8278, so the fontkit numbers are not an
artifact of the shaper. Vertical metrics differ in every table (hhea Regular: Didot 0.941 / -0.299 / 0.024, Playfair 1.082 / -0.251 / 0;
the hhea line height is 1.055x Regular, 1.034x Bold, and 0.796x for Italic because the bundled Playfair Display Italic is built
with a 1.0 line height). Coverage: 9 Latin code points Didot has are missing in Playfair (U+00B5, U+2011, U+2012, U+2015, U+201B,
U+201F, U+2024, U+2025, U+2031). 371 shared non-empty glyphs, none with an identical outline (expected for different designs).
Appearance (`didot-vs-playfair.png`, CoreText drawing of the same text): both are high-contrast Didone serifs; Playfair has heavier colour,
smaller capitals and a narrower set width.

Extra measurements (`didot-measurements-20261002.json`, `measure-didot.mjs`), recorded for the owner and not used for the acceptance:

- If Playfair Display were scaled to Didot's mean width (a preview-only size adjust like the Arabic `sizeAdjust`), line breaks would still
  match only 72 to 78% of cases because of the 0.7 to 0.9 point spread, below the 99.5% floor used for the Latin families.
- Ranked by Regular width against Didot, Playfair Display is 24th of 25 bundled Regular faces. The closest are Intos Serif (0.92% mean,
  71.6% line breaks identical), Figtree (1.60%), Raleway (1.75%) and PT Serif (1.90%, 50.0%). Intos Serif and PT Serif are not Didones;
  the policy decision (appearance against width) is the owner's and is not changed here.

Acceptance: the builder derives `documented-visual` for a visual-tier family when its qualification row has a real reference and the
fixture passes in every host (`../font-replacements-20260923/latin-host-fixtures-20261001.json` has Didot in node, browser, editor and
gallery editor). Nothing in `scripts/build-font-tracker.mjs` was changed. Didot moves from `visual-gap` to `documented-visual`, with
the measured gaps in its acceptance note and appearance caveat. This is the same standing as Bodoni MT to Playfair Display (14.9% mean,
0 identical line breaks) and Baskerville Old Face (19.2%, 0): the status records that the gaps are measured and reflow is expected, it
does not say they are small. `overrides.acceptance` was not used: an entry there records an acceptance but leaves the status at
`visual-gap` (the builder derives the status only from the qualification report), so it could not reach `documented-visual`. The
acceptance date the builder prints is the Latin acceptance date (2026-10-01); the Didot measurement date (2026-10-02) is in the report's
`supplementalRuns` and here. Native PowerPoint verification of Didot stays separate (FF-46: name read-back passed in the 0.12 native run).

## 2. Vector PDF in PDFKit

Decks: two core examples (`contract-cycle-time-brief` with six slides, `chart-data-sources` with three) and three decks written for
this check (`decks/`: `cjk` Japanese, Chinese and Korean; `rtl` Arabic and Hebrew; `indic-sea` Hindi, Bengali, Tamil, Thai and Khmer,
the last with `language` set to the catalog language). No core example contains non-Latin text. `generate-pdf-pptx.mjs` renders
each with opf-render 0.12.0 (`renderSvgDeck`, visual substitution, all script packs) and `svgToPdf` in vector mode. Two runs gave
byte-identical PDFs. `pdfkit-check.swift` reads each file with PDFKit and CoreGraphics (no window). Text is compared the way the RR-12
evidence does it: the character multiset of the page after NFKC, ignoring whitespace, zero-width and bidirectional controls, against the
text of the slide's SVG; `selection` is PDFKit's selection over the whole page.

| Deck | Pages | Fonts (all embedded, all subset-tagged) | Extracted text equals SVG text | Selected text equals | SVG text lines found verbatim in logical order |
| --- | --- | --- | --- | --- | --- |
| chart-data-sources | 3 | 2 | 3 of 3 | 3 of 3 | 16 of 16 |
| cjk | 3 | 8 | 3 of 3 | 3 of 3 | 21 of 21 |
| contract-cycle-time-brief | 6 | 3 | 6 of 6 | 6 of 6 | 98 of 98 |
| rtl | 2 | 5 | 2 of 2 | 2 of 2 | 14 of 14 |
| indic-sea | 5 | 11 | 3 of 5 | 3 of 5 | 13 of 25 |

In `indic-sea`, the two pages that differ are Bengali (the vowel signs U+09CB come out as U+09C7 plus U+09BE around the consonant,
three times) and Khmer (U+17C1 appears three extra times). Devanagari and Tamil lines contain every character but in visual order
(short i, reph), which is why their line count is below the total; Thai is exact. All of these are the cluster cases the RR-12
evidence lists for pdf.js, which also ignores `/ActualText`; PDFium and poppler read them exactly. The right-to-left decks (Arabic
and Hebrew, including the numbers) are read in logical order by PDFKit. Every PDF has PDF 1.7 as its version and opens unlocked;
every font is a Type0 font whose descendant carries a `FontFile2` program and a `ToUnicode` map.

Beside this, the renderer's own gates ran on macOS from the release commit of opf-render 0.12.0: `test/pdf-vector.mjs` passes
(structure, text round trips in pdf.js and PDFium, determinism, frozen cross-OS byte hash; poppler absent), and
`test/pdf-vector-visual.mjs` over 51 of 805 slides (every 16th) is within its tolerances: mean absolute channel error p50 0.144, p99
0.822, max 0.822 (declared 1.5); large-difference pixels p50 0.0004%, max 0.0195% (declared 0.5%); all 51 slides' text matches in pdf.js
and PDFium. RR-12 on Windows reported p50 0.177 and p99 0.647 over 805 slides, so the numbers agree
(`pdf/opf-render-pdf-vector-visual-macos.json`).

## 3. Quick Look

`qlmanage -t -s 800` on the five PDFs and the five PPTX of `generate-pdf-pptx.mjs` (opf-pptx 0.12.1): every file produced one
thumbnail and each thumbnail is a real rendering of the first slide (242 to 1180 distinct colours, `quicklook-thumbnails.txt`; a generic
icon or blank would have a handful). The Arabic and Hindi thumbnails draw the right text in the right direction. Quick Look
substitutes its own font for Intos (the preview font that Office does not have either), as expected. Limit: the PPTX of
`chart-data-sources` has a native chart on slide 1 (`ppt/charts/chart1.xml`) that Quick Look does not draw; the slide thumbnail shows the
title only, while the PDF of the same deck draws the chart. Pass/fail only, as requested: **pass** for both formats.

## 4. WebKit

Method. `run-engine-gates.mjs` runs opf-render's own browser gates (`test/*-browser.mjs`, 23) and opf-editor's playground and UI gates
(22) unchanged in Chromium, then again in WebKit by replacing only the Playwright import line (`import {webkit as chromium}`). Chromium
is the control. `engine-text-compare.mjs` loads the preview SVG of the five decks into both engines with the registry's font files
(through the FontFace API, no system fonts, zero external requests) and measures every text element: the renderer writes
`textLength` = its measured advance; removing it and asking the engine for the natural advance shows the gap.

Result of the text comparison (`engine-text-compare-20261002.json`, 174 text elements, 67 of them carry `textLength`):

| | Chromium 153 | WebKit 26.6 |
| --- | --- | --- |
| natural advance minus renderer width, mean abs / max | 0.005 / 0.015 px | 0.697 / 8.154 px |
| elements over the 0.1 px gate (of 67) | 0 | 45 (37 over 0.15 px) |
| by deck (elements over 0.1 px) | 0 everywhere | contract brief 41 of 55, chart 3 of 3, Arabic/Hebrew 1 of 2, CJK 0 of 2, Indic/SEA 0 of 5 |

WebKit against Chromium over all 174 elements: natural width mean abs 0.41 px, p95 2.17 px, max 8.15 px; line start x differs by more
than 0.1 px on 28 elements and line end x on 30.

Cause (reproduced in isolation): WebKit does not apply kerning in SVG `<text>`. "Signal Trend" in Intos Display Bold at 54 px is
279.598 px for the renderer, Chromium and WebKit's canvas and HTML text, and 282.445 px for WebKit's SVG text; setting
`font-kerning: normal`, `font-feature-settings: "kern"`, `text-rendering: optimizeLegibility` or `font-variant-ligatures: none` on the
SVG text changes nothing. The renderer's `lengthAdjust="spacingAndGlyphs"` compresses the glyphs to the measured width, so lines still
start and end where the layout says (a title ended about 3 px short in a screenshot, `shots/`), glyph shapes are squeezed by up to
about 1% and inner glyph positions drift by up to about a pixel. Wrapping is unaffected, since lines are laid out by the renderer, not by
the browser. Non-Latin faces with little or no kerning (the CJK and Indic samples) are within 0.1 px.

Gates, WebKit against Chromium (`engine-gates-render-20261002.json`, `engine-gates-editor-20261002.json`; the first failing assertion
of each file is kept, so one cause can hide others behind it):

- opf-render, 23 gates: both engines pass `shared-code-browser`, `image-placeholders-browser`, `export-browser` (vector and raster PDF,
  PNG, filter fallback, offline) and `symbol-fonts-browser`. WebKit fails the other 19 and Chromium fails 1 (below). The WebKit failures
  are advance differences against the accepted widths, between 0.35 and 3.7 px (`accepted-text`, `rich-spacing` 4.19 px, `rich-tab` 13.5 px
  at a tab end, `font-variants`, `font-preparation`, `aptos-preview`, `latin-family-hosts`, `lazy-fonts`, `lazy-face-fallback`,
  `extra-lazy-fonts`, `script-fonts`, `script-fonts-auto`, `emoji-math`, `script-corpora` for Noto Sans JP prolonged-sound text 1856.8
  against 1855.8 px), or stop at the fixtures' own bound for the accepted advance correction (`rich-flow-browser`,
  `plain-whitespace-browser`), with two exceptions: `script-corpora-slides-browser` reports that a right-to-left title line paints its
  first letter right of its last at 882 against 1194 px (not a width difference; not investigated further), and `player-browser`
  passes its rendering checks and fails the tab-order step (WebKit's Tab order was `viewport, thumb, body`; Safari skips buttons
  unless its keyboard setting is on, which is not a product fault).
- opf-editor playground, 22 gates: 12 pass unchanged in WebKit (`playground-source`, `playground-ensure-fonts`, `canvas-fonts-browser`,
  `design-gaps`, `chart-options`, `persistence`, `template-panel`, `numbering-panel`, `find-replace`, `review-panel`, `json-editor`,
  `selection`) and `playground-pptx` and `playground-download` pass once the test's `setOffline(true)` is turned off for WebKit
  (`webkit-online`): Playwright's WebKit blocks `blob:` URLs while the context is offline (shown in isolation: an `<img>` of a blob SVG
  errors offline and loads online; Chromium loads it either way), and with offline emulation the PPTX import fails with "The I/O read
  operation failed" and the raster PDF with "The browser could not draw this SVG as an image". Without it, PPTX export and import, vector and raster PDF, PNG and SVG downloads all pass.
  The rest fail in WebKit on kerning (`playground-lazy-fonts`, `playground-base-fonts`: 1.4 and 2.3 px), on a probe
  (`playground-script-fonts`: `Range.getBoundingClientRect` of an SVG character is about 27 px above the text box in WebKit, so the
  click lands on the background; whether the editor's own caret mapping is affected was not checked), on Playwright (`mobile-browser`
  needs a CDP session, Chromium only; `image-crop-browser` asserts Tab focus), and in Chromium too (below).

Failures that also happen in the Chromium control on this Mac (macOS Chromium, unchanged files), so they are not WebKit findings:

- `script-corpora-browser` (opf-render): `hans-punctuation`, the browser draws 989.7 px where 1026 is accepted (Noto Sans SC at 54 px).
  The test says Playwright's Chromium agrees with HarfBuzz on macOS and asserts strictly there; Chromium 153.0.8010.12 does not.
- opf-editor `design-controls-browser`, `slides-browser`, `click-entry-browser`: the tests use `ArrowDown` on a focused `<select>`,
  `Control+a`, `Control+click` and similar key bindings; the likely cause is that these mean something else on macOS (a select opens
  its list, Control+A moves to the line start, Control+click is a context click). This was not investigated further. The other
  editor gates, `mobile-browser` among them, pass in Chromium.

## Findings that need an RR item

1. Safari/WebKit SVG text has no kerning (cause above): previews in Safari are up to about 1% off in glyph width inside each line, with
   line ends kept by `textLength`. Options for the owner: accept and document it as a WebKit limit; keep `textLength` (already the
   case); or change the renderer to place per-glyph positions (`x` lists) instead of relying on the engine's shaping. No code was changed.
2. Didot's route (Playfair Display) is a poor width match (24th of 25); Intos Serif or PT Serif are far closer but not Didone. Owner's call.
3. macOS-run tests: opf-render `script-corpora-browser` fails on macOS Chromium 153 (`hans-punctuation`), and three opf-editor browser
   tests assume Windows/Linux key bindings. The test file `scripts/build-font-tracker.test.mjs` "--check detects drift" also fails on
   macOS, because the builder compares `process.argv[1]` with `fileURLToPath(import.meta.url)` and `os.tmpdir()` is a symlink
   (`/var` to `/private/var`), so the copied script never runs `main`. It passes on Linux and Windows. No gate was changed for any of this.
4. PDFKit reads Bengali two-part vowels and a Khmer vowel in visual order (it ignores `/ActualText`); the RR-12 note lists the same limit for
   pdf.js. Nothing in the file is wrong. It matters for copy-paste from Preview.
5. `docs/programs/font-fidelity-everywhere/font-licensing.md` still prints `n/m` (not measured) for Didot in its width column; that file
   is generated from the policy table, which this check did not touch.

## Files

- `measure-didot.mjs`, `didot-measurements-20261002.json`, `didot-coretext.swift`, `didot-coretext-widths.json`,
  `didot-vs-playfair.png`: Didot. The qualification row itself is in `../font-replacements-20260923/latin-qualification-20261001.json`.
- `decks/`: the three multilingual decks. `generate-pdf-pptx.mjs`, `pdfkit-check.swift`, `pdf/` (summary, expected text per slide,
  `pdfkit-report.json`, the renderer's visual gate on macOS), `thumbstat.swift`, `quicklook-thumbnails.txt`.
- `run-engine-gates.mjs`, `engine-gates-render-20261002.json`, `engine-gates-editor-20261002.json`, `engine-text-compare.mjs`,
  `engine-text-compare-20261002.json`, `engine-screens.mjs`, `shots/` (one slide in both engines).

Reproduce (all paths relative to a scratch folder): install `@openpresentation/opf@0.12.0`, `@openpresentation/opf-render@0.12.0`,
`@openpresentation/opf-pptx`, `playwright` and the opf-render peer font packs there, `npx playwright install webkit`, run the scripts
as their headers say; for the gates, check out opf-render at its 0.12.0 release commit (`3b300a3`) and opf-editor at `f4779da`,
`npm ci`, build (`npm run build`, `npm run build:browser-check`, and `npm run build:playground` for the editor), and run
`node run-engine-gates.mjs <checkout> <out.json>` (`SUITE=editor` for the editor). The WebKit download was
`npx playwright install webkit` (78 MiB, Playwright's cache outside any repository).
