import { symbolFontEncodingsSource } from "./generated/symbol-font-encodings.js";

/**
 * Symbol-encoded font families (font-fidelity-everywhere FF-45): Symbol, Wingdings, Wingdings 2,
 * Wingdings 3 and Webdings carry their glyphs at the 224 codes 0x20..0xFF of a Microsoft Symbol
 * cmap (U+F020..U+F0FF), not at Unicode code points. Office stores such text as private-use
 * characters (U+F0xx) or as the Windows-1252 character of each code, and names the family.
 *
 * This module is the reversible, version-specific table that turns a code into its Unicode
 * equivalent (or says why there is none) and back. Renderers preview a code with an openly
 * licensed face that has the equivalent; exporters keep the family name and the original codes.
 * Data: spec/reference/symbol-font-encodings.json. Guide: docs/font-fidelity.md and
 * docs/programs/font-fidelity-everywhere/special-families.md.
 */
export type SymbolFontFamily = "Symbol" | "Wingdings" | "Wingdings 2" | "Wingdings 3" | "Webdings";

export interface SymbolFontCode {
  /** The code, 32..255. */
  code: number;
  /** The code as two uppercase hex digits. */
  hex: string;
  /** The Unicode equivalent as hex scalar values joined with '+', or null when there is none. */
  unicode: string | null;
  /** The Unicode character name of the equivalent. */
  name?: string;
  /** Why the code has no equivalent. */
  reason?: string;
  note?: string;
  /** Another code of the family carries the same code point and owns the inverse mapping. */
  duplicateOf?: number;
  /** Symbol only: the PostScript glyph name from Adobe's table. */
  adobeGlyph?: string;
  /** Symbol only: Apple's value where the macOS build differs. */
  macos?: { unicode: string; note: string };
  /** The verified font's glyph for the code (font units), or null when it has none. */
  installed: { glyph: number; glyphName?: string; advance: number; bounds: [number, number, number, number] | null } | null;
}

export interface SymbolFontEncoding {
  family: SymbolFontFamily;
  /** The OOXML/GDI charset of a symbol font (CT_TextFont charset="2"). */
  charset: 2;
  sources: { url: string; note: string }[];
  verifiedAgainst: {
    platform: "windows" | "macos";
    file: string;
    version: string;
    familyName: string;
    postscriptName: string;
    copyright: string;
    unitsPerEm: number;
    ascent: number;
    descent: number;
    lineGap: number;
    numGlyphs: number;
    cmap: string;
    date: string;
  };
  platformNotes: string;
  summary: { codes: 224; mapped: number; verified: number; unmapped: number };
  codes: SymbolFontCode[];
}

export interface SymbolFontEncodingTable {
  description: string;
  version: number;
  codeRange: { first: 32; last: 255 };
  inputForms: { privateUse: string; codePage: string; other: string };
  families: SymbolFontEncoding[];
}

/** One character of symbol-font text, normalised to its code and Unicode equivalent. */
export interface SymbolTextCharacter {
  /** The character as it appears in the text (one code point). */
  source: string;
  /** Its code in the family's encoding, or null when the character is not symbol-encoded text. */
  code: number | null;
  /** The Unicode equivalent to draw, or null when the code has no equivalent (see `reason`). */
  unicode: string | null;
  reason?: string;
}

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const SYMBOL_FONT_ENCODINGS: Readonly<SymbolFontEncodingTable> = freeze(structuredClone(symbolFontEncodingsSource) as SymbolFontEncodingTable);

/** The symbol-encoded families, in table order. */
export const SYMBOL_FONT_FAMILIES: readonly SymbolFontFamily[] = Object.freeze(SYMBOL_FONT_ENCODINGS.families.map((entry) => entry.family));

const byFamily = new Map(SYMBOL_FONT_ENCODINGS.families.map((entry) => [entry.family.toLowerCase(), entry]));

/** The encoding of a symbol-encoded family (case-insensitive), or undefined for any other family. */
export function symbolFontEncodingFor(family: string): Readonly<SymbolFontEncoding> | undefined {
  return typeof family === "string" ? byFamily.get(family.trim().toLowerCase()) : undefined;
}

/** True for Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings (case-insensitive). */
export function isSymbolEncodedFamily(family: string): boolean {
  return symbolFontEncodingFor(family) !== undefined;
}

// Windows-1252 characters at 0x80..0x9F (the five unassigned bytes 0x81, 0x8D, 0x8F, 0x90 and 0x9D have no character).
const CP1252_HIGH: Readonly<Record<number, number>> = Object.freeze({
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
});

/**
 * The symbol code of one character, or null when it is not a code: a private-use character U+F020..U+F0FF
 * (what Office writes) gives its low byte; U+0020..U+007E and U+00A0..U+00FF are their own byte; the
 * Windows-1252 characters at 0x80..0x9F give that byte. Any other character (a CJK letter, an emoji, a
 * control character) is not symbol-encoded text.
 */
export function symbolCodeOf(character: string): number | null {
  if (typeof character !== "string" || character.length === 0) return null;
  const point = character.codePointAt(0) as number;
  if (point >= 0xf020 && point <= 0xf0ff) return point - 0xf000;
  if ((point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff)) return point;
  return CP1252_HIGH[point] ?? null;
}

const unicodeString = (value: string): string => String.fromCodePoint(...value.split("+").map((hex) => parseInt(hex, 16)));

const forward = new Map<string, Map<number, SymbolFontCode>>();
const inverse = new Map<string, Map<string, number>>();
for (const entry of SYMBOL_FONT_ENCODINGS.families) {
  const key = entry.family.toLowerCase();
  const codes = new Map<number, SymbolFontCode>();
  const back = new Map<string, number>();
  for (const row of entry.codes) {
    codes.set(row.code, row);
    if (row.unicode !== null && row.duplicateOf === undefined && !back.has(row.unicode)) back.set(unicodeString(row.unicode), row.code);
  }
  forward.set(key, codes);
  inverse.set(key, back);
}

/** The Unicode equivalent of a code in a family, as a string, or null (unknown family, code outside 0x20..0xFF, or no equivalent). */
export function symbolUnicodeFor(family: string, code: number): string | null {
  const row = forward.get(String(family ?? "").trim().toLowerCase())?.get(code);
  return row?.unicode == null ? null : unicodeString(row.unicode);
}

/**
 * The code of a Unicode equivalent in a family (the inverse mapping), or null. A code point two codes share
 * resolves to the code that owns it (`duplicateOf` names the owner), so code -> Unicode -> code round-trips for
 * every other code.
 */
export function symbolCodeForUnicode(family: string, text: string): number | null {
  if (typeof text !== "string" || !text) return null;
  return inverse.get(String(family ?? "").trim().toLowerCase())?.get(text) ?? null;
}

/**
 * Normalise text in a symbol-encoded family character by character: each character's code (or null when
 * it is not symbol-encoded text) and the Unicode equivalent to draw (or null, with the table's reason).
 * Unknown families map every character to `{code: null, unicode: null}`.
 */
export function mapSymbolText(family: string, text: string): SymbolTextCharacter[] {
  const codes = forward.get(String(family ?? "").trim().toLowerCase());
  const out: SymbolTextCharacter[] = [];
  for (const source of String(text ?? "")) {
    const code = codes ? symbolCodeOf(source) : null;
    if (code === null) { out.push({ source, code: null, unicode: null }); continue; }
    const row = codes!.get(code);
    if (!row || row.unicode === null) out.push({ source, code, unicode: null, reason: row?.reason ?? "no published mapping" });
    else out.push({ source, code, unicode: unicodeString(row.unicode) });
  }
  return out;
}
