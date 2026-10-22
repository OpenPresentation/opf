// Symbol-encoded families for previews (font-fidelity-everywhere FF-45).
//
// Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings keep their glyphs at the 224 codes 0x20..0xFF of a
// Microsoft Symbol cmap (U+F020..U+F0FF), not at Unicode code points. Office stores such text as private-use
// characters (U+F0xx, what Insert > Symbol and `a:sym` runs write) or as the Windows-1252 character of each
// code (the letter "l" typed in a Wingdings run, a `buChar` of "§" with `buFont` Wingdings). None of the five
// fonts may be bundled (proprietary), so a preview maps each code to its Unicode equivalent with core's table
// (`@openpresentation/opf/symbol-font-encodings`, which also holds the verified font's advance for every code)
// and draws that character with the first loaded open face that has it; the PPTX keeps the family name and the
// original characters. Core owns the table and the code rules (`isSymbolEncodedFamily`, `symbolCodeOf`,
// `mapSymbolText`); this module adds the preview faces and the advance of each code. Browser-safe and
// deterministic: no DOM, network or locale data.
import { isSymbolEncodedFamily, mapSymbolText, symbolCodeOf, symbolFontEncodingFor } from "@openpresentation/opf/symbol-font-encodings";
export { isSymbolEncodedFamily, mapSymbolText, symbolCodeOf };

const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };

/** The script key the symbol faces load under (`scripts: ['Zsym']`; ISO 15924 Zsym, symbols). */
export const SYMBOL_SCRIPT = "Zsym";

/** Drawn for a code with no Unicode equivalent, or whose equivalent no loaded face has: U+25A1 WHITE SQUARE. */
export const SYMBOL_PLACEHOLDER = "□";

/**
 * The open faces that preview symbol codes, in the order a code tries them. The dingbat families try the
 * pictograph faces first; Symbol (Greek letters, digits, punctuation, mathematical operators) tries Noto Sans,
 * which every office registry carries, then Noto Sans Math. All four are OFL; the first three ship in the
 * optional script pack under `Zsym`, Noto Sans with the office pack.
 */
export const SYMBOL_PREVIEW_FACES = freeze({
  "Symbol": ["Noto Sans", "Noto Sans Math", "Noto Sans Symbols 2", "Noto Sans Symbols"],
  "Wingdings": ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math", "Noto Sans"],
  "Wingdings 2": ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math", "Noto Sans"],
  "Wingdings 3": ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math", "Noto Sans"],
  "Webdings": ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math", "Noto Sans"],
});

/** Every open face a symbol preview may draw with. */
export const SYMBOL_FACE_FAMILIES = freeze([...new Set(Object.values(SYMBOL_PREVIEW_FACES).flat())]);

/** The canonical family name of a symbol-encoded family (case-insensitive), or undefined for any other family. */
export function symbolEncodingFamily(family) {
  return symbolFontEncodingFor(family)?.family;
}

/** The faces a symbol-encoded family previews with, in order. */
export function symbolPreviewFaces(family) {
  const name = symbolEncodingFamily(family);
  return name ? SYMBOL_PREVIEW_FACES[name] : [];
}

/**
 * Core `mapSymbolText` with the advance of each code added: `{source, code, unicode, advance, reason?}`. `advance` is the
 * verified font's advance for the code in em (null when that font has no glyph there, or the character is not a code); the
 * preview places each drawn character at it. An unknown family maps every character to `{code: null}`.
 */
export function mapSymbolAdvances(family, text) {
  const encoding = symbolFontEncodingFor(family);
  return mapSymbolText(family, text).map(item => ({
    ...item,
    advance: encoding && item.code !== null && encoding.codes[item.code - 0x20]?.installed ? encoding.codes[item.code - 0x20].installed.advance / encoding.verifiedAgainst.unitsPerEm : null,
  }));
}
