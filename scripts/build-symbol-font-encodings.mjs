// Maintenance command (font-fidelity-everywhere FF-45): rebuild spec/reference/symbol-font-encodings.json, the
// reversible code-to-Unicode tables for the symbol-encoded families Symbol, Wingdings, Wingdings 2, Wingdings 3 and
// Webdings, from published mapping tables and verify them against the installed Windows fonts, read in place.
//
//   node scripts/build-symbol-font-encodings.mjs --sources <dir> [--fonts C:/Windows/Fonts] [--fontkit <dir-with-node_modules>]
//
// <dir> holds the published tables (downloaded, never committed):
//   adobe-symbol.txt   https://www.unicode.org/Public/MAPPINGS/VENDORS/ADOBE/symbol.txt   (Adobe Symbol encoding -> Unicode, with glyph names)
//   apple-symbol.txt   https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/SYMBOL.TXT   (Apple's Symbol table; the macOS differences)
//   wiki-tables.json   the Unicode 7.0 tables of the Wingdings, Wingdings 2, Wingdings 3 and Webdings code charts
//                      (one object per family: code -> {u: hex code point(s), name}) as transcribed in the public domain
//                      summary tables of the Unicode proposals L2/11-052R and L2/11-344 (Michel Suignard) and the Unicode 7.0
//                      Miscellaneous Symbols and Pictographs, Ornamental Dingbats, Geometric Shapes Extended, Supplemental
//                      Arrows-C and Miscellaneous Symbols and Arrows charts; this checkout's copy was parsed from the
//                      Wikipedia code-chart templates that carry those tables (see docs/programs/font-fidelity-everywhere/special-families.md).
// The Windows fonts are read in place to record facts (version string, glyph ids, advances, bounds, post names) and
// nothing of them is copied: no outline, no byte. The output is a fact table about proprietary fonts, not a font.
import {readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const sourcesDir = option("--sources");
if (!sourcesDir) { console.error("--sources <dir> is required"); process.exit(2); }
const fontsDir = option("--fonts", "C:/Windows/Fonts");
const fontkitDir = option("--fontkit", fileURLToPath(new URL("../", import.meta.url)));
const fontkit = createRequire(path.join(fontkitDir, "package.json"))("fontkit");
const target = fileURLToPath(new URL("../spec/reference/symbol-font-encodings.json", import.meta.url));

const hex = value => value.toString(16).toUpperCase().padStart(4, "0");
const hex2 = value => value.toString(16).toUpperCase().padStart(2, "0");

// --- published tables -------------------------------------------------------------------------------------------
const adobeLines = (await readFile(path.join(sourcesDir, "adobe-symbol.txt"), "utf8")).split("\n").filter(line => /^[0-9A-F]{4}\t/.test(line));
const adobe = new Map(); // code -> [{unicode, name, glyph}]
for (const line of adobeLines) {
  const [unicode, code, name, glyph] = line.split("\t");
  const entry = {unicode: unicode.toUpperCase(), name: name.replace(/^# /, ""), glyph: (glyph ?? "").replace(/^# /, "")};
  const key = parseInt(code, 16);
  if (!adobe.has(key)) adobe.set(key, []);
  adobe.get(key).push(entry);
}
const appleLines = (await readFile(path.join(sourcesDir, "apple-symbol.txt"), "utf8")).split("\n").filter(line => /^0x[0-9A-F]{2}\t/.test(line));
const apple = new Map(); // code -> {unicode (may be a sequence), note}
for (const line of appleLines) {
  const [code, unicode, ...rest] = line.split("\t");
  apple.set(parseInt(code, 16), {unicode: unicode.replace(/0x/g, "").toUpperCase(), note: rest.join(" ").replace(/^#\s*/, "")});
}
const wiki = JSON.parse(await readFile(path.join(sourcesDir, "wiki-tables.json"), "utf8"));

// --- the installed fonts, read in place ---------------------------------------------------------------------------
function lookupFormat4(table, code) {
  const count = table.segCountX2 / 2;
  const at = (array, index) => (typeof array.get === "function" ? array.get(index) : array[index]);
  for (let i = 0; i < count; i++) {
    const end = at(table.endCode, i);
    if (code > end) continue;
    const start = at(table.startCode, i);
    if (code < start) return 0;
    const delta = at(table.idDelta, i), rangeOffset = at(table.idRangeOffset, i);
    if (rangeOffset === 0) return (code + delta) & 0xffff;
    const glyph = at(table.glyphIndexArray, rangeOffset / 2 + (code - start) - (count - i));
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }
  return 0;
}
function readInstalled(file) {
  const font = fontkit.create(require_fs().readFileSync(path.join(fontsDir, file)));
  const names = font.name?.records ?? {};
  const pick = key => { const record = names[key]; return record ? (record.en ?? Object.values(record)[0]) : null; };
  const symbolTable = font.cmap.tables.find(table => table.platformID === 3 && table.encodingID === 0);
  if (!symbolTable) throw new Error(`${file}: no (3,0) symbol cmap subtable`);
  const codes = new Map();
  for (let code = 0x20; code <= 0xff; code++) {
    const glyphId = lookupFormat4(symbolTable.table, 0xF000 + code);
    if (!glyphId) { codes.set(code, null); continue; }
    const glyph = font.getGlyph(glyphId);
    const box = glyph.bbox;
    const finite = box && [box.minX, box.minY, box.maxX, box.maxY].every(Number.isFinite) && box.width > 0 && box.height > 0;
    // Composite glyphs can report fractional bounds; the facts are recorded in whole font units.
    codes.set(code, {glyph: glyphId, name: glyph.name && !/^(?:glyph|g)\d+$/.test(glyph.name) ? glyph.name : null, advance: Math.round(glyph.advanceWidth), bounds: finite ? [box.minX, box.minY, box.maxX, box.maxY].map(Math.round) : null});
  }
  return {
    file, version: pick("version"), familyName: font.familyName, postscriptName: font.postscriptName, copyright: pick("copyright"),
    unitsPerEm: font.unitsPerEm, ascent: font.ascent, descent: font.descent, lineGap: font.lineGap, numGlyphs: font.numGlyphs,
    cmap: "Microsoft Symbol (platform 3, encoding 0, format 4): codes 0x20..0xFF at U+F020..U+F0FF",
    codes,
  };
}
function require_fs() { return createRequire(import.meta.url)("node:fs"); }

// --- families ---------------------------------------------------------------------------------------------------
const commonSources = [
  {url: "https://learn.microsoft.com/en-us/typography/font-list/symbol", note: "Microsoft font list: Symbol"},
  {url: "https://learn.microsoft.com/en-us/typography/font-list/wingdings", note: "Microsoft font list: Wingdings"},
  {url: "https://learn.microsoft.com/en-us/typography/font-list/webdings", note: "Microsoft font list: Webdings"},
];
const dingbatSources = [
  {url: "https://www.unicode.org/L2/L2011/11052r-wingding.pdf", note: "L2/11-052R, Michel Suignard, Wingdings and Webdings Symbols: preliminary study (2011-02-17); the per-code repertoire"},
  {url: "https://www.unicode.org/L2/L2011/11344-wingdings.pdf", note: "L2/11-344, Michel Suignard, Updated proposal to add Wingdings and Webdings Symbols (2011-09-24); the code points as accepted for Unicode 7.0"},
  {url: "https://www.unicode.org/versions/Unicode7.0.0/", note: "Unicode 7.0.0 (2014): the Wingdings and Webdings symbols encoded (Miscellaneous Symbols and Pictographs, Ornamental Dingbats, Geometric Shapes Extended, Supplemental Arrows-C, Miscellaneous Symbols and Arrows)"},
  {url: "https://www.unicode.org/charts/PDF/U1F300.pdf", note: "Unicode code chart: Miscellaneous Symbols and Pictographs"},
  {url: "https://www.unicode.org/charts/PDF/U1F650.pdf", note: "Unicode code chart: Ornamental Dingbats"},
  {url: "https://www.unicode.org/charts/PDF/U1F780.pdf", note: "Unicode code chart: Geometric Shapes Extended"},
  {url: "https://www.unicode.org/charts/PDF/U1F800.pdf", note: "Unicode code chart: Supplemental Arrows-C"},
  {url: "https://www.unicode.org/charts/PDF/U2B00.pdf", note: "Unicode code chart: Miscellaneous Symbols and Arrows"},
];
const symbolSources = [
  {url: "https://www.unicode.org/Public/MAPPINGS/VENDORS/ADOBE/symbol.txt", note: "Adobe Symbol encoding to Unicode (Unicode, Inc. vendor mapping; glyph names)"},
  {url: "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/SYMBOL.TXT", note: "Apple Symbol encoding to Unicode (the macOS differences: bracket pieces at U+239B.., U+3008/U+3009, the Apple logo at 0xF0)"},
];

const files = {
  "Symbol": "symbol.ttf", "Wingdings": "wingding.ttf", "Wingdings 2": "WINGDNG2.TTF", "Wingdings 3": "WINGDNG3.TTF", "Webdings": "webdings.ttf",
};
// Adobe maps bracket pieces, line extensions and the serif/sans ©®™ to its own PUA (F6xx, F8xx); Unicode 3.2 encoded the
// bracket pieces and extensions, which Apple's table uses, so those are the preview code points. The serif/sans ©®™ pairs
// take the one Unicode sign each (the inverse mapping goes to the serif code, which Adobe lists first).
const adobePua = {
  0x60: {unicode: "23B7", note: "RADICAL SYMBOL BOTTOM (Adobe radicalex, PUA F8E5)"},
  0xBD: {unicode: "23D0", note: "VERTICAL LINE EXTENSION (Adobe arrowvertex, PUA F8E6; Apple 23D0)"},
  0xBE: {unicode: "23AF", note: "HORIZONTAL LINE EXTENSION (Adobe arrowhorizex, PUA F8E7; Apple 23AF)"},
  0xD2: {unicode: "00AE", note: "REGISTERED SIGN, serif form (Adobe registerserif, PUA F6DA)"},
  0xD3: {unicode: "00A9", note: "COPYRIGHT SIGN, serif form (Adobe copyrightserif, PUA F6D9)"},
  0xD4: {unicode: "2122", note: "TRADE MARK SIGN, serif form (Adobe trademarkserif, PUA F6DB)"},
  0xE2: {unicode: "00AE", note: "REGISTERED SIGN, sans-serif form (Adobe registersans, PUA F8E8); inverse mapping resolves to 0xD2", duplicateOf: 0xD2},
  0xE3: {unicode: "00A9", note: "COPYRIGHT SIGN, sans-serif form (Adobe copyrightsans, PUA F8E9); inverse mapping resolves to 0xD3", duplicateOf: 0xD3},
  0xE4: {unicode: "2122", note: "TRADE MARK SIGN, sans-serif form (Adobe trademarksans, PUA F8EA); inverse mapping resolves to 0xD4", duplicateOf: 0xD4},
  0xE6: {unicode: "239B", note: "LEFT PARENTHESIS UPPER HOOK (Adobe parenlefttp, PUA F8EB)"},
  0xE7: {unicode: "239C", note: "LEFT PARENTHESIS EXTENSION (Adobe parenleftex, PUA F8EC)"},
  0xE8: {unicode: "239D", note: "LEFT PARENTHESIS LOWER HOOK (Adobe parenleftbt, PUA F8ED)"},
  0xE9: {unicode: "23A1", note: "LEFT SQUARE BRACKET UPPER CORNER (Adobe bracketlefttp, PUA F8EE)"},
  0xEA: {unicode: "23A2", note: "LEFT SQUARE BRACKET EXTENSION (Adobe bracketleftex, PUA F8EF)"},
  0xEB: {unicode: "23A3", note: "LEFT SQUARE BRACKET LOWER CORNER (Adobe bracketleftbt, PUA F8F0)"},
  0xEC: {unicode: "23A7", note: "LEFT CURLY BRACKET UPPER HOOK (Adobe bracelefttp, PUA F8F1)"},
  0xED: {unicode: "23A8", note: "LEFT CURLY BRACKET MIDDLE PIECE (Adobe braceleftmid, PUA F8F2)"},
  0xEE: {unicode: "23A9", note: "LEFT CURLY BRACKET LOWER HOOK (Adobe braceleftbt, PUA F8F3)"},
  0xEF: {unicode: "23AA", note: "CURLY BRACKET EXTENSION (Adobe braceex, PUA F8F4)"},
  0xF4: {unicode: "23AE", note: "INTEGRAL EXTENSION (Adobe integralex, PUA F8F5)"},
  0xF6: {unicode: "239E", note: "RIGHT PARENTHESIS UPPER HOOK (Adobe parenrighttp, PUA F8F6)"},
  0xF7: {unicode: "239F", note: "RIGHT PARENTHESIS EXTENSION (Adobe parenrightex, PUA F8F7)"},
  0xF8: {unicode: "23A0", note: "RIGHT PARENTHESIS LOWER HOOK (Adobe parenrightbt, PUA F8F8)"},
  0xF9: {unicode: "23A4", note: "RIGHT SQUARE BRACKET UPPER CORNER (Adobe bracketrighttp, PUA F8F9)"},
  0xFA: {unicode: "23A5", note: "RIGHT SQUARE BRACKET EXTENSION (Adobe bracketrightex, PUA F8FA)"},
  0xFB: {unicode: "23A6", note: "RIGHT SQUARE BRACKET LOWER CORNER (Adobe bracketrightbt, PUA F8FB)"},
  0xFC: {unicode: "23AB", note: "RIGHT CURLY BRACKET UPPER HOOK (Adobe bracerighttp, PUA F8FC)"},
  0xFD: {unicode: "23AC", note: "RIGHT CURLY BRACKET MIDDLE PIECE (Adobe bracerightmid, PUA F8FD)"},
  0xFE: {unicode: "23AD", note: "RIGHT CURLY BRACKET LOWER HOOK (Adobe bracerightbt, PUA F8FE)"},
};

const families = [];
const summary = [];
for (const [family, file] of Object.entries(files)) {
  const installed = readInstalled(file);
  const codes = [];
  const seen = new Map(); // unicode -> first code (inverse uniqueness)
  for (let code = 0x20; code <= 0xff; code++) {
    const real = installed.codes.get(code);
    let unicode = null, name = null, reason, note, duplicateOf, apple_, adobeGlyph;
    if (family === "Symbol") {
      const entries = adobe.get(code);
      const appleEntry = apple.get(code);
      if (entries) {
        const first = entries[0];
        adobeGlyph = first.glyph || null;
        if (/^F[68][0-9A-F]{2}$/.test(first.unicode) && adobePua[code]) { unicode = adobePua[code].unicode; name = adobePua[code].note.replace(/ \(.*$/, ""); note = adobePua[code].note; duplicateOf = adobePua[code].duplicateOf; }
        else { unicode = first.unicode; name = first.name; }
        if (entries.length > 1) note = `${note ? note + "; " : ""}Adobe also maps ${entries.slice(1).map(entry => "U+" + entry.unicode).join(", ")} to this code`;
      } else if (code === 0xF0) {
        reason = "unassigned in Symbol (no glyph at U+F0F0); the Apple build draws its logo (PUA U+F8FF) here";
      } else if (code === 0x7F || (code >= 0x80 && code <= 0x9F) || code === 0xA0 && !real) {
        reason = "unassigned in the Symbol encoding (no glyph at U+F0" + hex2(code) + ")";
      } else if (code === 0xFF) {
        reason = "unassigned in the Symbol encoding (no glyph at U+F0FF)";
      }
      // Apple's value where it differs from the table (also the sans-serif signs that carry Apple's variation tag U+F87F).
      if (appleEntry && unicode && appleEntry.unicode !== unicode) {
        apple_ = {unicode: appleEntry.unicode, note: appleEntry.note.replace(/^.*?# ?/, "")};
      } else if (appleEntry && !unicode) {
        apple_ = {unicode: appleEntry.unicode, note: appleEntry.note.replace(/^.*?# ?/, "")};
      }
    } else {
      const entry = wiki[family][String(code)];
      if (entry?.u) { unicode = entry.u; name = entry.name.replace(/^U\+[0-9A-F]+ /, ""); }
      else if (code === 0x7F) reason = "unassigned (no glyph at U+F07F)";
      else if (!real) reason = `unassigned (no glyph at U+F0${hex2(code)})`;
      else if (family === "Wingdings" && code === 0xFF) reason = "the Microsoft Windows logo, a trademark Unicode did not encode (the glyph exists in the font)";
      else reason = "no Unicode equivalent: the glyph is a duplicate or a private ornament that Unicode 7.0 did not encode";
    }
    if (unicode === null && reason === undefined) reason = "no published mapping";
    // Inverse uniqueness: the first code to carry a code point owns the inverse mapping.
    if (unicode !== null) {
      if (seen.has(unicode)) { if (duplicateOf === undefined) duplicateOf = seen.get(unicode); }
      else seen.set(unicode, code);
    }
    const row = {code, hex: hex2(code), unicode, ...(name ? {name} : {}), ...(reason ? {reason} : {}), ...(note ? {note} : {}), ...(duplicateOf !== undefined ? {duplicateOf} : {}), ...(adobeGlyph ? {adobeGlyph} : {}), ...(apple_ ? {macos: apple_} : {}),
      installed: real ? {glyph: real.glyph, ...(real.name ? {glyphName: real.name} : {}), advance: real.advance, bounds: real.bounds} : null};
    codes.push(row);
  }
  const mapped = codes.filter(row => row.unicode !== null).length, verified = codes.filter(row => row.unicode !== null && row.installed).length;
  const unverified = codes.filter(row => row.unicode !== null && !row.installed).map(row => "0x" + row.hex);
  const unmappedWithGlyph = codes.filter(row => row.unicode === null && row.installed).map(row => "0x" + row.hex);
  const duplicates = codes.filter(row => row.duplicateOf !== undefined).map(row => `0x${row.hex}->0x${hex2(row.duplicateOf)}`);
  summary.push(`${family}: ${mapped} of 224 codes mapped, ${verified} verified against ${installed.version}; unverified ${unverified.join(",") || "none"}; glyph without mapping ${unmappedWithGlyph.join(",") || "none"}; duplicates ${duplicates.join(",") || "none"}`);
  families.push({
    family,
    charset: 2,
    sources: family === "Symbol" ? [...symbolSources, commonSources[0]] : [...dingbatSources, commonSources[family === "Webdings" ? 2 : 1]],
    verifiedAgainst: {platform: "windows", file: installed.file, version: installed.version, familyName: installed.familyName, postscriptName: installed.postscriptName, copyright: installed.copyright, unitsPerEm: installed.unitsPerEm, ascent: installed.ascent, descent: installed.descent, lineGap: installed.lineGap, numGlyphs: installed.numGlyphs, cmap: installed.cmap, date: "2026-10-01"},
    ...(family === "Symbol" ? {platformNotes: "Apple's Symbol (macOS) is Apple's own build: 0x27 is U+220D there (Adobe U+220B), 0x6D U+03BC (Adobe U+00B5), 0xE1/0xF1 U+3008/U+3009 (Adobe U+2329/U+232A, canonically equivalent), the sans-serif ©®™ at 0xE2..0xE4 carry Apple's variation tag U+F87F, and 0xF0 draws the Apple logo (PUA U+F8FF). Each such code records the Apple value under `macos`."} : {platformNotes: "The macOS build of this family carries the same Unicode 7.0 repertoire; its Macintosh (1,0) cmap orders codes 0x80..0xFF by Mac OS Roman, so only the (3,0) symbol cmap at U+F020..U+F0FF is the code table."}),
    summary: {codes: 224, mapped, verified, unmapped: 224 - mapped},
    codes,
  });
}

const output = {
  $schema: "./symbol-font-encodings.schema.json",
  description: "Reversible, version-specific code-to-Unicode tables for the symbol-encoded families (FF-45): per family, each code 0x20..0xFF of the Microsoft Symbol cmap (U+F020..U+F0FF) with its Unicode equivalent from the published tables, or null with a reason, plus the glyph id, advance and bounds of the installed Windows font the table was verified against (font units; facts only, no outlines). A renderer previews a code with an openly licensed face that has the Unicode equivalent; an exporter keeps the family name and the original codes. Codes that share a code point name `duplicateOf`: the inverse (Unicode to code) mapping resolves to that code.",
  version: 1,
  codeRange: {first: 32, last: 255},
  inputForms: {
    privateUse: "U+F020..U+F0FF (what Office writes for Insert > Symbol and a:sym runs): the code is the low byte.",
    codePage: "U+0020..U+007E and U+00A0..U+00FF are their own code; the 27 Windows-1252 characters at 0x80..0x9F (U+20AC EURO SIGN at 0x80, U+201A at 0x82, U+0192, U+201E, U+2026, U+2020, U+2021, U+02C6, U+2030, U+0160, U+2039, U+0152, U+017D, U+2018, U+2019, U+201C, U+201D, U+2022, U+2013, U+2014, U+02DC, U+2122, U+0161, U+203A, U+0153, U+017E, U+0178) map to their Windows-1252 byte, as GDI maps text typed in a symbol font.",
    other: "Any other character has no code: it is not symbol-encoded text and draws as itself.",
  },
  families,
};
await writeFile(target, JSON.stringify(output, null, 1) + "\n");
console.log(summary.join("\n"));
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
