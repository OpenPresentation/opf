# Special families: symbol-encoded fonts (FF-45)

Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings are proprietary (Monotype and Microsoft), never bundled, and
not text fonts: their glyphs sit at the 224 codes 0x20..0xFF of a Microsoft Symbol cmap (platform 3, encoding 0, at
U+F020..U+F0FF), not at Unicode code points. Before FF-45 every renderer request for one of them failed with
`font-encoding-required`. This page records how OPF previews them now, the data it previews with, what was measured,
and the decisions taken (owner-vetoable). Cambria Math and Segoe UI Emoji have their own page,
[special-families-emoji-math.md](special-families-emoji-math.md).

## Model

1. **Normalisation to a code.** Text in a symbol-encoded family reaches a renderer in two forms, and both become one
   byte code: the private-use character U+F020..U+F0FF (what PowerPoint writes for Insert > Symbol and `a:sym` runs,
   low byte = code) and the Windows-1252 character of the code (the letter "l" typed in a Wingdings run, a `buChar`
   of "§" with `buFont` Wingdings: U+0020..U+007E and U+00A0..U+00FF are their own byte, the 27 Windows-1252
   characters at 0x80..0x9F map to that byte, as GDI maps text typed in a symbol font). Any other character (a CJK
   letter, an emoji, a control) is not symbol-encoded text and draws as itself with the ordinary chain. Core:
   `symbolCodeOf()`, `mapSymbolText()`.
2. **Code to Unicode.** [`spec/reference/symbol-font-encodings.json`](../../../spec/reference/symbol-font-encodings.json)
   (schema [`symbol-font-encodings.schema.json`](../../../spec/reference/symbol-font-encodings.schema.json), core
   exports `SYMBOL_FONT_ENCODINGS`, `symbolUnicodeFor()`, `symbolCodeForUnicode()`) gives, per family and per code,
   the Unicode equivalent or `null` with a reason, plus the glyph id, advance and bounds of the installed Windows font
   the table was verified against (facts in font units; no outline or byte of the proprietary fonts is copied).
   The mapping is reversible: `symbolCodeForUnicode` is the exact inverse for every code except the three Symbol
   codes that share a code point with another (see Symbol below), which name their owner in `duplicateOf`.
3. **Preview.** opf-render draws the equivalent with the first loaded open face of the family's chain, one positioned
   glyph per code at the verified Windows font's advance, in measurement, line breaking and drawing alike
   (`createScriptFonts().plan` returns `symbol` runs; the SVG writes one `tspan` per glyph with `x`). The open glyph
   keeps its shape: it is compressed to the code's advance only when it is wider (`textLength`), never stretched.
4. **Export.** opf-pptx writes the chosen family (`a:latin typeface="Wingdings"`) and the author's characters byte for
   byte, in either form; `fromPptx` gives them back. No preview face reaches the PPTX.

## Sources and verification

| Family | Published tables | Verified against (read in place, 2026-10-01) | Codes mapped | Codes drawn |
| --- | --- | --- | --- | --- |
| Symbol | [Adobe Symbol encoding to Unicode](https://www.unicode.org/Public/MAPPINGS/VENDORS/ADOBE/symbol.txt) (code, Unicode, glyph name); [Apple Symbol table](https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/SYMBOL.TXT) (the macOS differences) | `symbol.ttf`, Version 5.01, Monotype, 192 glyphs, 2048 upm | 189 of 224 | 189 |
| Wingdings | Unicode 7.0 repertoire: [L2/11-052R](https://www.unicode.org/L2/L2011/11052r-wingding.pdf) (Michel Suignard, preliminary study), [L2/11-344](https://www.unicode.org/L2/L2011/11344-wingdings.pdf) (updated proposal), the [Unicode 7.0](https://www.unicode.org/versions/Unicode7.0.0/) charts (Miscellaneous Symbols and Pictographs, Ornamental Dingbats, Geometric Shapes Extended, Supplemental Arrows-C, Miscellaneous Symbols and Arrows) | `wingding.ttf`, Version 5.01, Microsoft 2006, 226 glyphs | 222 of 224 | 222 |
| Wingdings 2 | same | `WINGDNG2.TTF`, Version 1.55, Bigelow & Holmes for Microsoft 1992, 220 glyphs | 217 of 224 | 217 |
| Wingdings 3 | same | `WINGDNG3.TTF`, Version 1.55, 211 glyphs | 208 of 224 | 208 |
| Webdings | same | `webdings.ttf`, Version 5.01, Microsoft 2006, 227 glyphs | 223 of 224 | 223 |

The Wingdings and Webdings tables were transcribed from the public code-chart summaries of those proposals (the
per-code tables carried by the Wikipedia code-chart templates for Wingdings, Wingdings 2, Wingdings 3 and Webdings,
which cite L2/11-052 and the Unicode 7.0 release). The builder (`scripts/build-symbol-font-encodings.mjs`) then
verified each table against the installed Windows fonts: every mapped code has a glyph in the font's (3,0) symbol cmap
at U+F0xx (Symbol 0xA0, the euro, is the one mapped code without a glyph in Windows Symbol 5.01), every drawn glyph has
non-empty bounds, and Wingdings 2 and 3 carry PostScript glyph names that are recorded. The Macintosh (1,0) cmap of
these fonts orders codes 0x80..0xFF by Mac OS Roman, so only the (3,0) table is the code table. As a supplementary
check, the installed glyph and the open face's glyph for each code were rasterized at 48 px, box-normalised and
compared (intersection over union: Symbol 0.52, Wingdings 0.59, Wingdings 2 0.70, Wingdings 3 0.65, Webdings 0.47 on
average); the measure is weak for thin glyphs and stylised pictographs and was used only to spot a wrong row, not as a
gate.

Codes without a Unicode equivalent carry a reason: 0x7F everywhere (no glyph at U+F07F); Symbol 0x80..0x9F, 0xF0 (the
Apple build draws its logo there, PUA U+F8FF) and 0xFF; Wingdings 0xFF (the Microsoft Windows logo, a trademark Unicode
did not encode, although the glyph exists); Wingdings 2 0xFA..0xFF and Wingdings 3 0xF1..0xFF (no glyph).

**Symbol specifics.** Adobe's table maps the bracket pieces, line extensions and the serif and sans-serif ©®™ to
Adobe PUA code points (F6D9.., F8E5..); the table takes the Unicode 3.2 characters instead (U+239B..U+23AD,
U+23AE, U+23AF, U+23B7, U+23D0), which Apple's table uses too and Noto Sans Math draws. The serif and sans-serif
copyright, registered and trade mark signs (0xD3/0xE3, 0xD2/0xE2, 0xD4/0xE4) share U+00A9, U+00AE and U+2122; the
sans-serif codes name the serif code as `duplicateOf`, so the inverse mapping goes to 0xD2..0xD4. The macOS Symbol is
Apple's own build and differs at nine codes, recorded per code under `macos`: 0x27 U+220D (Adobe U+220B), 0x6D
U+03BC (Adobe U+00B5), 0xE1/0xF1 U+3008/U+3009 (Adobe U+2329/U+232A, canonically equivalent), 0xE2..0xE4 with
Apple's variation tag U+F87F, and 0xF0 the Apple logo.

## Preview faces and measured coverage

Faces (all OFL-1.1, pinned by sha256 in opf-render's manifest, optional peers of the script pack under the key
`Zsym`, about 2.6 MB in all): `@expo-google-fonts/noto-sans-symbols-2` 0.4.1 (Noto Sans Symbols 2 2.008),
`@expo-google-fonts/noto-sans-symbols` 0.4.1 (Noto Sans Symbols 2.003, regular and bold),
`@expo-google-fonts/noto-sans-math` 0.4.2 (Noto Sans Math 3.000), plus the office pack's Noto Sans 2.015 (the
glyph-fallback face every office registry carries). Chain order: Noto Sans Symbols 2, Noto Sans Symbols, Noto Sans
Math, Noto Sans for the dingbat families; Noto Sans, Noto Sans Math, Noto Sans Symbols 2, Noto Sans Symbols for Symbol
(Greek letters, digits and punctuation keep text proportions).

Measured with the pack loaded (opf-render `test/symbol-fonts.mjs`, every code of every family):

| Family | Codes drawn with a real equivalent glyph | By face | Placeholder (no equivalent) |
| --- | --- | --- | --- |
| Symbol | 189 of 224 (all mapped codes) | Noto Sans 109, Noto Sans Math 78, Noto Sans Symbols 2 | 35 |
| Wingdings | 222 of 224 | Noto Sans Symbols 2 176, Noto Sans Symbols 46 | 2 |
| Wingdings 2 | 217 of 224 | Noto Sans Symbols 2 186, Noto Sans Symbols 26, Noto Sans 4, Noto Sans Math 1 | 7 |
| Wingdings 3 | 208 of 224 | Noto Sans Symbols 2 206, Noto Sans Symbols 2 | 16 |
| Webdings | 223 of 224 | Noto Sans Symbols 2 217, Noto Sans Symbols 4, Noto Sans Math 2 | 1 |

1059 of the 1120 codes draw a real glyph. Without the pack (an office registry only): Symbol's 108 Noto Sans codes
still draw, every other code draws U+FFFD in the style's face, and the diagnostic names the pack. Browser evidence:
`test/symbol-fonts-browser.mjs` loads the pinned bytes offline in Chromium (Edge on Windows) and finds every one of
the 1120 glyphs' advances within 0.015 px of fontkit's, and the Wingdings run displayed at the verified advances.
Raster evidence: the same test suite renders the deck through resvg with only the pinned files and checks the ink.
Native evidence: pending (FF-46; the deck specification for the supervisor's native run is in the RR-17 native
checklist).

## Advances and bounds

The preview places each glyph at the verified Windows font's advance for its code (recorded in the table in font
units, 2048 per em). The open glyph's own advance differs; measured per family with the chain above (em, mapped codes
with a Windows glyph):

| Family | Mean abs. difference | Max | Mean signed | Within ±15 % | Open glyph wider | Open glyph narrower | Largest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Symbol | 0.072 | 0.562 | +0.004 | 129 of 188 | 23 | 36 | 0xF2 ∫ 0.274 vs 0.836 |
| Wingdings | 0.115 | 0.740 | −0.008 | 159 of 222 | 27 | 36 | 0x20 space 1.000 vs 0.260 |
| Wingdings 2 | 0.096 | 0.740 | +0.021 | 165 of 217 | 30 | 22 | 0x20 space 1.000 vs 0.260 |
| Wingdings 3 | 0.113 | 0.740 | −0.056 | 124 of 208 | 24 | 60 | 0x20 space 1.000 vs 0.260 |
| Webdings | 0.135 | 0.543 | −0.002 | 152 of 223 | 30 | 41 | 0x57/0x58 0.537 vs 1.080 |

Decision (vetoable): the preview forces the real advance by position, not by scaling. A wider open glyph is
compressed to the code's advance (`textLength`, `spacingAndGlyphs`), a narrower one is left at its own width inside the
code's advance, so line breaks, bullet gaps and pagination follow PowerPoint while glyph shapes stay the open face's.
The alternative, keeping the open face's advances, would have changed line breaks for symbol-heavy lines (a row of ten
Wingdings icons would drift by about one em) and the Wingdings 1 em space would have been drawn as a quarter em.
Bounds: every drawn glyph has non-empty bounds in the open face and in the verified font; the vertical extents are
the open face's. Limit: in natural-flow output (no measurement provider) the browser lays the glyphs out at the open
face's advances.

## Decisions (owner-vetoable)

- No text replacement row: the policy rows for Symbol, Wingdings and Webdings keep `replacement: null` and describe
  the encoding path in their note; the tracker keeps them in the `special` class (`needs-special-path` status) with
  the new evidence and next actions, since the status model has no "mapped" state and native verification is open.
- Wingdings 2 and Wingdings 3 are included (same pipeline, same cost) and share the Wingdings policy row.
- Placeholder for a code with no equivalent or no loaded glyph: U+25A1 WHITE SQUARE from a loaded symbol face, else
  U+FFFD from the style's face, else nothing, always at the code's advance, always reported (`font-glyph-fallback`
  with `codes` and `placeholder`). Drawing the original private-use character was rejected: a browser would substitute
  an arbitrary system font and resvg nothing.
- `scripts: 'auto'` selects `Zsym` when a run, `design.fonts` or a font scheme names a symbol-encoded family; text
  alone cannot tell (private-use characters have no script).
- The symbol faces end the general glyph fallback chain, after every designated script face, so a mathematical
  operator or arrow in ordinary text draws when the pack is loaded (previously `missing-glyph`).
- SVG `font-family` quoting: a family whose name has a word starting with a digit ("Noto Sans Symbols 2", and the
  already bundled "Source Sans 3") is now single-quoted; unquoted it is invalid CSS and browsers dropped the whole
  list (resvg accepted it, so PNG goldens are unchanged). Found by the browser test.
- Export: opf-pptx keeps writing `a:latin` with the family and the original characters and writes no `a:sym`.
  Whether PowerPoint draws an `a:latin` symbol font with private-use text, and with the Windows-1252 character, is the
  native check; if it does not, the exporter should add `a:sym typeface="<family>"` (CT_TextFont, `charset="2"`,
  ECMA-376 21.1.2.3.10) beside `a:latin` for symbol-encoded runs. Not implemented until verified.
- Native bullets: OPF list markers carry no per-list bullet font, so a native deck's `buFont` Wingdings `buChar` is
  imported as a plain bullet and exported with the body font; recorded as a limit, not changed here.

## Maintenance

`node scripts/build-symbol-font-encodings.mjs --sources <dir> --fontkit <checkout-with-fontkit>` rebuilds the table
from the downloaded published tables (never committed) and the installed Windows fonts; the core test
`packages/javascript/test/symbol-font-encodings.test.mjs` validates the schema, the 224 codes per family, Unicode
scalar values outside the private use areas, inverse uniqueness, advance and bounds facts and both input forms
exhaustively. opf-render snapshots the table with `node scripts/update-symbol-encodings.mjs <path>` into
`src/symbol-encodings.js` (`--check` compares) and pins the source file's sha256; `test/symbol-fonts.mjs` fails when a
core checkout beside the renderer has a newer table.
