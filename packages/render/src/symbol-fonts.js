// Symbol-encoded families for previews (font-fidelity-everywhere FF-45).
//
// Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings keep their glyphs at the 224 codes 0x20..0xFF of a
// Microsoft Symbol cmap (U+F020..U+F0FF), not at Unicode code points. Office stores such text as private-use
// characters (U+F0xx, what Insert > Symbol and `a:sym` runs write) or as the Windows-1252 character of each
// code (the letter "l" typed in a Wingdings run, a `buChar` of "§" with `buFont` Wingdings). None of the five
// fonts may be bundled (proprietary), so a preview maps each code to its Unicode equivalent (core
// spec/reference/symbol-font-encodings.json, snapshot in symbol-encodings.js) and draws that character with the
// first loaded open face that has it; the PPTX keeps the family name and the original characters. Browser-safe
// and deterministic: no DOM, network or locale data.
import { SYMBOL_ENCODINGS } from "./symbol-encodings.js";
export { SYMBOL_ENCODINGS, SYMBOL_ENCODINGS_SOURCE } from "./symbol-encodings.js";

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

const byFamily = new Map(SYMBOL_ENCODINGS.map(entry => [entry.family.toLowerCase(), entry]));

/** The encoding snapshot of a symbol-encoded family (case-insensitive), or undefined for any other family. */
export function symbolEncodingFor(family) {
  return typeof family === "string" ? byFamily.get(family.trim().toLowerCase()) : undefined;
}

/** True for Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings (case-insensitive). */
export function isSymbolEncodedFamily(family) {
  return symbolEncodingFor(family) !== undefined;
}

/** The faces a symbol-encoded family previews with, in order. */
export function symbolPreviewFaces(family) {
  const entry = symbolEncodingFor(family);
  return entry ? SYMBOL_PREVIEW_FACES[entry.family] : [];
}

// Windows-1252 characters at 0x80..0x9F (the five unassigned bytes 0x81, 0x8D, 0x8F, 0x90 and 0x9D have no character).
const CP1252_HIGH = freeze({
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
});

/**
 * The symbol code of one character, or null when it is not a code (the same rule as core `symbolCodeOf`): a
 * private-use character U+F020..U+F0FF gives its low byte; U+0020..U+007E and U+00A0..U+00FF are their own
 * byte; the Windows-1252 characters at 0x80..0x9F give that byte. Any other character is not symbol-encoded
 * text and draws as itself.
 */
export function symbolCodeOf(character) {
  if (typeof character !== "string" || !character) return null;
  const point = character.codePointAt(0);
  if (point >= 0xf020 && point <= 0xf0ff) return point - 0xf000;
  if ((point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff)) return point;
  return CP1252_HIGH[point] ?? null;
}

const unicodeString = value => String.fromCodePoint(...value.split("+").map(hex => parseInt(hex, 16)));

/**
 * Normalise text in a symbol-encoded family character by character: `{source, code, unicode, advance, reason?}`.
 * `code` is null for a character that is not symbol-encoded text (it draws as itself); `unicode` is the
 * equivalent to draw or null with the table's `reason`; `advance` is the verified font's advance for the code
 * in em (null when that font has no glyph there). An unknown family maps every character to `{code: null}`.
 */
export function mapSymbolText(family, text) {
  const entry = symbolEncodingFor(family);
  const out = [];
  for (const source of String(text ?? "")) {
    const code = entry ? symbolCodeOf(source) : null;
    if (code === null) { out.push({source, code: null, unicode: null, advance: null}); continue; }
    const [unicode, advance, reason] = entry.codes[code - 0x20];
    out.push({source, code, unicode: unicode === null ? null : unicodeString(unicode), advance: advance === null ? null : advance / entry.unitsPerEm, ...(unicode === null ? {reason} : {})});
  }
  return out;
}
