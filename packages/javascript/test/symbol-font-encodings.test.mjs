import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import { SYMBOL_FONT_ENCODINGS, SYMBOL_FONT_FAMILIES, fontPolicyFor, isSymbolEncodedFamily, mapSymbolText, symbolCodeForUnicode, symbolCodeOf, symbolFontEncodingFor, symbolUnicodeFor } from "../dist/index.js";
import * as subpath from "../dist/symbol-font-encodings.js";

// FF-45: one reversible, version-specific code-to-Unicode table per symbol-encoded family. Exhaustive: every code of
// every family is checked for its mapping, inverse, advance and bounds facts, and the normalisation of the two input
// forms (private-use U+F0xx and Windows-1252 characters).
const source = JSON.parse(readFileSync(new URL("../../../spec/reference/symbol-font-encodings.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../../../spec/reference/symbol-font-encodings.schema.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;
const FAMILIES = ["Symbol", "Wingdings", "Wingdings 2", "Wingdings 3", "Webdings"];
const codePoints = (value) => value.split("+").map((hex) => parseInt(hex, 16));

describe("symbol font encodings", () => {
  test("symbol-font-encodings.json is valid against its JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(source.$schema, "./symbol-font-encodings.schema.json");
    assert.equal(validate(source), true, JSON.stringify(validate.errors, null, 2));
    const broken = structuredClone(source);
    broken.families[0].codes[0].unicode = null;
    delete broken.families[0].codes[0].reason;
    assert.equal(validate(broken), false, "a null mapping needs a reason");
  });

  test("the exported table is the spec reference file, frozen, with the five families in order", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(SYMBOL_FONT_ENCODINGS)), JSON.parse(JSON.stringify(source)));
    assert.ok(Object.isFrozen(SYMBOL_FONT_ENCODINGS) && Object.isFrozen(SYMBOL_FONT_ENCODINGS.families[0].codes[0]));
    assert.equal(subpath.SYMBOL_FONT_ENCODINGS, SYMBOL_FONT_ENCODINGS);
    assert.deepEqual([...SYMBOL_FONT_FAMILIES], FAMILIES);
    for (const family of FAMILIES) {
      assert.equal(symbolFontEncodingFor(family.toUpperCase()).family, family);
      assert.ok(isSymbolEncodedFamily(family));
      assert.ok(fontPolicyFor(family) === undefined || fontPolicyFor(family).replacement === null, `${family}: the policy row has no text replacement; the encoding path previews it`);
    }
    for (const name of ["Calibri", "Noto Sans Symbols 2", "", "Wingdings 4"]) assert.ok(!isSymbolEncodedFamily(name), name);
  });

  test("every family has all 224 codes in order, verified against a named Windows font version", () => {
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      assert.equal(entry.codes.length, 224);
      entry.codes.forEach((row, index) => {
        assert.equal(row.code, 0x20 + index, `${entry.family} row ${index}`);
        assert.equal(row.hex, row.code.toString(16).toUpperCase().padStart(2, "0"));
      });
      assert.equal(entry.verifiedAgainst.platform, "windows");
      assert.match(entry.verifiedAgainst.version, /^Version \d+\.\d+/);
      assert.equal(entry.verifiedAgainst.unitsPerEm, 2048);
      assert.equal(entry.charset, 2);
      const mapped = entry.codes.filter((row) => row.unicode !== null).length;
      const verified = entry.codes.filter((row) => row.unicode !== null && row.installed).length;
      assert.deepEqual(entry.summary, { codes: 224, mapped, verified, unmapped: 224 - mapped });
      assert.ok(mapped >= 189, `${entry.family}: ${mapped} codes mapped`);
    }
    // The measured counts (2026-10-01): Symbol 189, Wingdings 222, Wingdings 2 217, Wingdings 3 208, Webdings 223.
    assert.deepEqual(SYMBOL_FONT_ENCODINGS.families.map((entry) => entry.summary.mapped), [189, 222, 217, 208, 223]);
  });

  test("every mapped code is a Unicode scalar value outside the private use areas, and 0x20 is the space", () => {
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      for (const row of entry.codes) {
        if (row.unicode === null) { assert.ok(row.reason, `${entry.family} 0x${row.hex} needs a reason`); continue; }
        for (const point of codePoints(row.unicode)) {
          assert.ok(point >= 0x20 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff), `${entry.family} 0x${row.hex}: U+${row.unicode}`);
          assert.ok(!(point >= 0xe000 && point <= 0xf8ff) && !(point >= 0xf0000), `${entry.family} 0x${row.hex} maps to a private-use code point U+${row.unicode}; the preview needs a real character`);
        }
        assert.ok(row.name, `${entry.family} 0x${row.hex} names its character`);
      }
      assert.equal(entry.codes[0].unicode, "0020");
      assert.equal(symbolUnicodeFor(entry.family, 0x20), " ");
    }
  });

  test("the inverse mapping is unique: code -> Unicode -> code round-trips, duplicates name their owner", () => {
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      const owners = new Map();
      for (const row of entry.codes) {
        if (row.unicode === null) { assert.equal(symbolUnicodeFor(entry.family, row.code), null); continue; }
        const text = symbolUnicodeFor(entry.family, row.code);
        assert.equal(text, String.fromCodePoint(...codePoints(row.unicode)));
        const back = symbolCodeForUnicode(entry.family, text);
        if (row.duplicateOf === undefined) {
          assert.equal(back, row.code, `${entry.family} 0x${row.hex} (U+${row.unicode}) round-trips`);
          assert.ok(!owners.has(row.unicode), `${entry.family}: U+${row.unicode} at 0x${row.hex} and 0x${owners.get(row.unicode)} without duplicateOf`);
          owners.set(row.unicode, row.hex);
        } else {
          assert.equal(back, row.duplicateOf, `${entry.family} 0x${row.hex} resolves to its owner`);
          assert.equal(entry.codes[row.duplicateOf - 0x20].unicode, row.unicode);
          assert.ok(row.duplicateOf < row.code, "the owner is the lower code");
        }
      }
    }
    // Only Symbol has duplicates: the sans-serif copyright, registered and trade mark signs at 0xE2..0xE4.
    assert.deepEqual(SYMBOL_FONT_ENCODINGS.families.map((entry) => entry.codes.filter((row) => row.duplicateOf !== undefined).map((row) => `${row.hex}->${row.duplicateOf.toString(16).toUpperCase()}`)), [["E2->D2", "E3->D3", "E4->D4"], [], [], [], []]);
    assert.equal(symbolCodeForUnicode("Wingdings", "\u2713"), 0xfc, "the Wingdings check mark");
    assert.equal(symbolCodeForUnicode("Wingdings", "\u{1F5B9}"), null, "a character outside the family");
  });

  test("advance and bounds facts: every verified glyph has a positive advance and the drawn ones have non-empty bounds", () => {
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      for (const row of entry.codes) {
        if (!row.installed) continue;
        assert.ok(Number.isInteger(row.installed.glyph) && row.installed.glyph > 0, `${entry.family} 0x${row.hex} glyph id`);
        assert.ok(row.installed.advance >= 0 && row.installed.advance <= 2 * entry.verifiedAgainst.unitsPerEm, `${entry.family} 0x${row.hex} advance ${row.installed.advance}`);
        const space = row.unicode === "0020" || row.unicode === "00A0";
        if (space) assert.equal(row.installed.bounds, null, `${entry.family} 0x${row.hex}: a space has no ink`);
        else if (row.installed.bounds) {
          const [x0, y0, x1, y1] = row.installed.bounds;
          assert.ok(x1 > x0 && y1 > y0, `${entry.family} 0x${row.hex} bounds ${row.installed.bounds}`);
        }
        if (row.unicode !== null && !space) assert.ok(row.installed.bounds, `${entry.family} 0x${row.hex}: a mapped code has ink in the verified font`);
      }
      // Advances per family are facts about the verified font: Wingdings 0x20 is a 1 em space, Symbol 0x20 is 0.25 em.
      assert.ok(entry.codes[0].installed, `${entry.family} 0x20 exists`);
    }
    assert.equal(symbolFontEncodingFor("Wingdings").codes[0].installed.advance, 2048);
    assert.equal(symbolFontEncodingFor("Symbol").codes[0].installed.advance, 512);
  });

  test("Symbol records the Apple differences and Adobe glyph names", () => {
    const symbol = symbolFontEncodingFor("Symbol");
    const at = (code) => symbol.codes[code - 0x20];
    assert.equal(at(0x61).unicode, "03B1");
    assert.equal(at(0x61).adobeGlyph, "alpha");
    assert.equal(at(0x27).unicode, "220B");
    assert.equal(at(0x27).macos.unicode, "220D");
    assert.equal(at(0xf0).unicode, null);
    assert.equal(at(0xf0).macos.unicode, "F8FF");
    assert.equal(at(0xe6).unicode, "239B", "bracket pieces take the Unicode 3.2 characters, not Adobe's PUA");
    assert.equal(at(0xa0).unicode, "20AC");
    assert.equal(at(0xa0).installed, null, "Windows Symbol 5.01 has no euro glyph at 0xA0");
    assert.equal(symbol.codes.filter((row) => row.macos).length, 9, "0x27, 0x6D, 0xE1, 0xF1, 0xF0 and the sans-serif signs 0xE2..0xE4 with Apple's variation tag");
    assert.equal(at(0xe2).macos.unicode, "00AE+F87F");
  });

  test("input forms normalise to one code: private-use U+F0xx, ASCII and Latin-1, Windows-1252 at 0x80..0x9F; nothing else", () => {
    assert.equal(symbolCodeOf("\uF06C"), 0x6c);
    assert.equal(symbolCodeOf("l"), 0x6c);
    assert.equal(symbolCodeOf("\u00A7"), 0xa7);
    assert.equal(symbolCodeOf("\u20AC"), 0x80);
    assert.equal(symbolCodeOf("\u2022"), 0x95);
    assert.equal(symbolCodeOf("\u0178"), 0x9f);
    assert.equal(symbolCodeOf("\uF020"), 0x20);
    assert.equal(symbolCodeOf("\uF0FF"), 0xff);
    for (const other of ["\u{1F5B9}", "\u00FF\u0300".slice(1), "\u0081", "\t", "\u3042", "\uF000", "\uF100", ""]) assert.equal(symbolCodeOf(other), null, JSON.stringify(other));
    // Every Windows-1252 byte that has a character is reachable, and the five holes are not.
    const reachable = new Set();
    for (let point = 0; point < 0xf000; point++) { const code = symbolCodeOf(String.fromCharCode(point)); if (code !== null) reachable.add(code); }
    assert.equal(reachable.size, 224 - 6, "0x7F and the five Windows-1252 holes are reachable only as private-use characters");
    for (const hole of [0x7f, 0x81, 0x8d, 0x8f, 0x90, 0x9d]) { assert.ok(!reachable.has(hole), hole.toString(16)); assert.equal(symbolCodeOf(String.fromCharCode(0xf000 + hole)), hole); }
  });

  test("mapSymbolText: the two forms of a Wingdings bullet draw the same character, foreign characters are passed through", () => {
    const pua = mapSymbolText("Wingdings", "\uF06C\uF0FC");
    const plain = mapSymbolText("Wingdings", "l\u00FC");
    assert.deepEqual(pua.map((item) => [item.code, item.unicode]), [[0x6c, "\u26AB"], [0xfc, "\u2713"]]);
    assert.deepEqual(plain.map((item) => [item.code, item.unicode]), pua.map((item) => [item.code, item.unicode]));
    assert.deepEqual(mapSymbolText("Wingdings", "\u3042"), [{ source: "\u3042", code: null, unicode: null }]);
    const logo = mapSymbolText("Wingdings", "\uF0FF")[0];
    assert.equal(logo.code, 0xff);
    assert.equal(logo.unicode, null);
    assert.match(logo.reason, /Windows logo/);
    assert.deepEqual(mapSymbolText("Calibri", "ab"), [{ source: "a", code: null, unicode: null }, { source: "b", code: null, unicode: null }]);
    // Exhaustive: every code of every family round-trips through both input forms.
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      for (const row of entry.codes) {
        const forms = [String.fromCharCode(0xf000 + row.code)];
        const direct = [...Array(0x10000).keys()].find((point) => symbolCodeOf(String.fromCharCode(point)) === row.code && point < 0xf000);
        if (direct !== undefined) forms.push(String.fromCharCode(direct));
        for (const form of forms) {
          const [item] = mapSymbolText(entry.family, form);
          assert.equal(item.code, row.code, `${entry.family} ${JSON.stringify(form)}`);
          assert.equal(item.unicode, row.unicode === null ? null : String.fromCodePoint(...codePoints(row.unicode)));
        }
      }
    }
  });

  test("no symbol-encoded family is a bundled face name and every row points at a verified Microsoft font, never a font file in this repository", () => {
    for (const entry of SYMBOL_FONT_ENCODINGS.families) {
      assert.match(entry.verifiedAgainst.file, /^[A-Za-z0-9]+\.ttf$/i, "a file name of the installed font, never a path into this repository");
      assert.ok(!/\.(ttf|otf|woff2?)$/i.test(entry.family));
      assert.ok(entry.sources.every((item) => item.url.startsWith("https://")));
    }
  });
});
