# RR-12: vector PDF with selectable text

Evidence for the vector PDF export (`svgToPdf` default mode `vector`). Source checkout only (not a registry or browser-download result); measured on Windows 11 with Node 26.4 against core 0.11.4 examples, CI adds Linux. This is not a PDF/UA or PDF/A claim and not a native PowerPoint fidelity claim.

## Approach and why

The converter reads the renderer's own SVG (the SVG the preview rasterizes) and writes PDF directly: shapes and paths as PDF paths, gradients as shadings, `<pattern>` as tiling patterns, `clip-path`, dashes and opacity natively, pictures as image XObjects, and text as text objects in embedded TrueType subsets. There is no second layout pass: every line, position and width is the SVG's.

Chosen over the alternatives:

- **pdf-lib** (already a dependency, raster mode keeps it): no glyph-level positioning, no control over `ToUnicode` or `/ActualText`, no shaping; its custom-font path would re-encode text itself.
- **pdfkit**: pulls its own font stack and Node zlib, whose output varies with the zlib build and CPU (Chromium zlib hashes differently with SIMD), and its text API lays out strings itself.
- **A small purpose-built writer (chosen)**: about 2,700 lines over `fontkit` (already used for measurement, so the PDF is shaped by the same engine that measured the preview), `bidi-js` (MIT, UAX #9 conformance-tested, new) and `pako` (pure-JS Flate, already in the tree through pdf-lib, now pinned directly). Determinism is by construction: objects numbered in first-use order, no timestamps unless the caller supplies them (zone-less dates are read as UTC), file id = hash of the content, Flate in JavaScript.

Font subsetting is the package's own TrueType subsetter (`src/pdf-subset.js`): the glyphs used plus composite components, renumbered, with `head`, `hhea`, `maxp`, `hmtx`, `loca`, `glyf` and the original `cvt`/`fpgm`/`prep`; every table is bounds-checked, so a corrupt font is reported `pdf-font-unreadable` instead of throwing. A CID is one glyph drawing one piece of text (fonts that build several letters from one shared glyph, as Arabic does with dotless bodies plus separate dot glyphs, still get an exact `ToUnicode` map), and a CIDToGIDMap sends CIDs to the renumbered glyphs. Every bundled face is TrueType (`glyf`); a face without TrueType outlines, or whose OS/2 `fsType` forbids embedding (or is bitmap-only), is never embedded and never used; one that forbids subsetting is embedded whole.

## How text is encoded, and why (review finding 1)

The first encoding was tuned to pdf.js, whose text extraction reorders right-to-left runs itself; PDFium (Chrome, Edge) and poppler read the same files reversed. The encoding now follows what Chromium writes for the same strings (measured against a Chromium `page.pdf()` control, with PDFium, poppler and pdf.js reading both):

- Runs are drawn in visual order. Right-to-left runs sit in `/ReversedChars BMC ... EMC` inside their text object.
- A glyph the glyph-to-Unicode map cannot give gets `/ActualText`, one span per glyph: a ligature of several characters in a right-to-left run (lam-alef) and a mirrored bracket.
- A left-to-right run whose characters the glyph order does not give (reordered Indic or Khmer syllables, a no-break space) is split into the shortest glyph clusters that hold exactly the next characters of the text (matched as written, then in canonical decomposition, which is how a Bengali two-part vowel appears in a font) and each cluster gets one `/ActualText` span, as Chromium writes them. One span across several text objects made poppler scramble cluster tails (and other readers duplicate them).
- A glyph that stands for no character of its own (the dots and marks a font splits off an Arabic letter) is drawn as a filled outline, not as text: extractors then never see an extra character (the previous zero-width-space mapping showed up as stray spaces in PDFium and pdf.js).
- Glyphs the font displaces by a visible amount are shown alone with their own `Td` and a leading adjustment inside the object (marks under 2.5 % of the font size horizontally or 3 % vertically are not displaced), and kerning numbers are whole thousandths with the remainder carried, so there are no tiny `TJ` numbers; PDFium duplicates an `/ActualText` span whose text objects are not adjacent, and splits words at tiny adjustments.

## Results

### Appearance (805 core example slides, `npm run report:pdf-vector`)

Each slide is exported to a vector PDF, rasterized independently with pdf.js (`pdfjs-dist` 6.3.289, Apache-2.0, with `@napi-rs/canvas`) at 1 pixel per point, and compared with the resvg PNG preview of the same SVG (same font files) after averaging 2 x 2 pixels, because the two rasterizers anti-alias differently.

| Metric | p50 | p90 | p99 | max |
| --- | --- | --- | --- | --- |
| Mean absolute channel error (0-255) | 0.177 | 0.449 | 0.647 | 0.955 |
| Pixels differing by more than 48 in any channel | 0.0043 % | 0.0148 % | 0.0208 % | 0.0551 % |

Declared tolerances (checked in `test/pdf-vector-visual.mjs`): mean error 1.5, large-difference pixels 0.5 %. All 805 slides are within them; none used a raster fallback or raised an error. (An independent review rendered 155 slides in PDFium as well and found the geometry sound.)

### Text, in independent readers

- All 805 example slides: the text pdf.js and PDFium extract contains exactly the characters the SVG draws (character multisets after NFKC, ignoring whitespace and bidirectional controls).
- `test/pdf-vector.mjs` compares ordered logical text (no re-sorting) of single-script lines in pdf.js, PDFium and, when `pdftotext` is installed, poppler. All of them read Latin (ligatures, accents, decomposed marks), Japanese, Chinese, Korean, Hebrew, Arabic (including the lam-alef ligature) and Syriac exactly. PDFium and poppler read Devanagari, Bengali, Tamil and Khmer exactly (poppler: not Gujarati). pdf.js, which ignores `/ActualText`, reports reordered Indic and Khmer clusters in drawing order.
- Known reader limits, identical for Chromium's own PDFs of the same strings: PDFium splits and duplicates Thai and Burmese marks (pdf.js reads them exactly); in a mixed-direction line, PDFium and pdf.js return each run in logical order but may swap the order of two right-to-left runs, and PDFium may put the percent sign of a number in a right-to-left sentence before the digits; PDFium misgroups a page when large serif Hebrew titles and body lines overlap in its line heuristics (reproduced with Chromium's PDF of the same fonts and geometry).

### Structure

`qpdf --check` (WebAssembly build) is clean for the fixture, an uncompressed untagged export and a two-page mixed-size export; the review ran it over 155 corpus slides, also clean.

### Sizes and speed

One slide per PDF, including its font subsets: vector mean 25.6 KB against raster 31.1 KB. Vector is not guaranteed to be smaller (image-heavy slides are dominated by their pictures either way). Export time is about 0.1 s per slide (about 1 s the first time a call loads the font pack; parsed fonts are cached across calls).

## Independent readers used

pdf.js 6.3.289, `@hyzyla/pdfium` 2.1.13 (PDFium, MIT wrapper around Apache-2.0 PDFium), `@jspawn/qpdf-wasm` 0.0.2 (Apache-2.0) and, optionally, poppler `pdftotext`. During development MuPDF (AGPL, so not a dependency of this repository and not used by its tests) and a Chromium `page.pdf()` control were also read for comparison. Not run in the tests: MuPDF, Acrobat, macOS Preview.

## Decisions (vetoable)

1. **Default mode is `vector`**, raster is `mode: "raster"`. The plan makes vector the default once the corpus gates pass; they pass here. It is a behaviour change; the two existing raster tests (`webp`, `jpeg-orientation`) now say `mode: "raster"` explicitly.
2. **One SVG pixel is one PDF point**, in both modes (a 1280 x 720 slide is a 1280 x 720 pt page), not 0.75 pt. Stated in the README. Printing scales to fit.
3. **System fonts are rejected** in vector mode (`loadSystemFonts: true` throws); fonts come from the bundled pack, `fontFiles`, `fontDirs` and the SVG's own `@font-face` (found by its declared family).
4. **A requested family without a face** is drawn with the family the PNG preview draws (`defaultFontFamily`, default Roboto) and reported (`pdf-font-substituted`), never silently; a character no face has is reported `pdf-glyph-missing` (strict throws).
5. **Raster fallback is per element** (filter, mask, nested SVG picture), reported with the element's trace path, never reads files or the network, and `strict: true` throws. Nothing else is rasterized.
6. **Tagging is on by default** (`tagged: false` removes it); decoration is an artifact, text lines of one traced block share one structure element, the `.title` placeholder is `H1`.
7. **The page is painted white by default** (raster mode composites on white), `background: "none"` leaves it unpainted.
8. **Space separators** (no-break, thin, ideographic) map to a plain space in `ToUnicode`; text that uses one carries `/ActualText`.
9. **Bounds** against hostile SVG: 50,000 elements per page (`<use>` expansion counts every copy), group nesting 256, XML nesting 1,000, pictures 40 megapixels, all with a diagnostic (`pdf-expansion-limit`, `svg-too-deep`).
10. **Marks displaced by under 2.5 % (horizontal) or 3 % (vertical) of the font size are drawn undisplaced**, so a cluster stays one text object; the error is under 0.75 px at 30 px text.

## Limitations

- Not claimed: PDF/UA, PDF/A, a verified reading order for screen readers, list and table structure, per-span language, alternative text beyond `aria-label`.
- Text inside a translucent group (opacity applied to a group of several drawings) is drawn in a form XObject and is not in the structure tree; it still extracts.
- A mark the font split off a letter (Arabic dots) is an outline, so selection highlights the letter without its dots.
- Reader limits above; Acrobat and Preview were not run.
- Only TrueType (`glyf`) fonts are embedded; CFF/OTF and WOFF faces are reported (`pdf-font-unsupported-format`) and skipped.
- SVG features not drawn as vectors: `filter`, `mask`, nested `image/svg+xml` pictures (rasterized per element), `marker`, gradient `spreadMethod` reflect/repeat and transparent gradient stops (drawn as pad/opaque), CSS combinators, `textPath`, vertical text, `rotate`, `dominant-baseline`, `baseline-shift`, `text-transform`, `font-variant`, `paint-order`, `mix-blend-mode`; each is reported (`pdf-unsupported-*`) and throws under `strict`.
- CMYK and 16-bit pictures are converted to 8-bit sRGB; animated pictures use the first frame.
- Cross-OS byte identity is pinned by `test/pdf-vector.mjs` (a frozen fixture with text in six scripts, a picture, a gradient, a pattern, a clip and a rotation, hashed with the pinned bundled fonts) and verified by CI on Linux.
- The command line: core's `packages/cli` has no render or export command yet (no dependency on this package), so there is nothing to wire; the CLI follow-up (RR-01) should call `svgToPdf(svgs, { mode: "vector", fontFiles, metadata })`.
