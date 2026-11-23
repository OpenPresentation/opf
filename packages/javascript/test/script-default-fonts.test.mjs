import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FONT_POLICY, LANGUAGES, fontPolicyFor } from "../dist/index.js";
import { resolveScriptFonts } from "../dist/composition.js";
import { catalogDisplay, gallery } from "@openpresentation/gallery";

// v0.35: the default font of every script is one that ships with Windows by default (not an optional Windows feature, not an Office
// download) and draws the script at about the size of the Latin text beside it. Seventeen languages moved to such a font: the Indic
// scripts to Nirmala UI, Thai and Khmer to Leelawadee UI, Hebrew to Segoe UI, Amharic to Ebrima and Japanese to Yu Gothic. Pashto and
// Punjabi (Shahmukhi) take the Arabic default (arabic-default-fonts.test.mjs) instead of Arial Black, which has no Arabic letters.
// OPF bundles none of these fonts: the policy names the open face that previews each script, with a measured size factor.
const catalogs = [gallery];

/** [language record, tag, script, where the family is named, font scheme, heading family, body family] */
const DEFAULTS = [
  ["amharic", "am", "Ethi", "supplement", "ebrima", "Ebrima", "Ebrima"],
  ["bengali", "bn", "Beng", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["chittagonian", "ctg", "Beng", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["gujarati", "gu", "Gujr", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["hindi", "hi", "Deva", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["marathi", "mr", "Deva", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["nepali", "ne", "Deva", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["kannada", "kn", "Knda", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["malayalam", "ml", "Mlym", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["odia", "or", "Orya", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["punjabi-gurmukhi", "pa-Guru", "Guru", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["tamil", "ta", "Taml", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["telugu", "te", "Telu", "complexScript", "nirmala-ui", "Nirmala UI", "Nirmala UI"],
  ["thai", "th", "Thai", "complexScript", "leelawadee-ui", "Leelawadee UI", "Leelawadee UI"],
  ["khmer", "km", "Khmr", "complexScript", "leelawadee-ui", "Leelawadee UI", "Leelawadee UI"],
  ["hebrew", "he", "Hebr", "complexScript", "segoe-ui-regular", "Segoe UI", "Segoe UI"],
  ["japanese", "ja", "Jpan", "eastAsian", "yu-gothic", "Yu Gothic", "Yu Gothic"],
  ["pashto", "ps", "Arab", "complexScript", "times-new-roman-arial", "Times New Roman", "Arial"],
  ["punjabi-shahmukhi", "pa-Arab", "Arab", "complexScript", "times-new-roman-arial", "Times New Roman", "Arial"],
];

describe("the script default fonts (v0.35)", () => {
  for (const [record, tag, script, slot, schemeId, heading, body] of DEFAULTS) {
    test(`${tag}: ${heading === body ? heading : `${heading} and ${body}`}`, () => {
      const resolved = resolveScriptFonts({ language: tag, slides: [{ title: "x" }] }, { catalogs });
      assert.equal(resolved.script, script);
      if (slot === "supplement") {
        // A script the Latin slot covers has no slot of its own: its theme entry names the family.
        assert.equal(resolved.scriptRole, "latin");
      } else {
        assert.equal(resolved.scriptRole, slot);
        assert.deepEqual([resolved.heading[slot], resolved.body[slot]], [heading, body]);
        assert.equal(resolved.sources[slot], "language");
      }
      assert.deepEqual(resolved.supplement, { script, heading, body });
      // The Latin slots keep the deck's own scheme (the engine default, Aptos): a language never changes them.
      assert.deepEqual([resolved.heading.latin, resolved.body.latin], ["Aptos Display", "Aptos"]);
      // The vocabulary and the gallery's language record say the same thing.
      assert.deepEqual(LANGUAGES.find((entry) => entry.tag === tag).fonts.powerpoint, { major: heading, minor: body });
      const language = catalogDisplay.languages[record];
      assert.equal(language.fontScheme, schemeId);
      const scheme = gallery.fontSchemes[schemeId];
      assert.deepEqual([scheme.major, scheme.minor], [heading, body]);
      assert.ok(scheme.languages.includes(tag), `${schemeId} lists ${tag}`);
    });
  }

  test("the rule: the default font of every script outside Latin, Cyrillic and Greek ships with Windows by default", () => {
    // Latin, Cyrillic and Greek text is in the deck's own font scheme (Aptos by default, an Office cloud font), not in a language default.
    const own = LANGUAGES.filter((language) => !["Latn", "Cyrl", "Grek"].includes(language.script));
    assert.equal(own.length, 27);
    for (const language of own) {
      for (const family of new Set([language.fonts.powerpoint.major, language.fonts.powerpoint.minor])) {
        const row = fontPolicyFor(family);
        assert.ok(row, `${language.tag}: ${family} has a policy row`);
        assert.ok(row.availability.includes("windows"), `${language.tag}: ${family} ships with Windows by default (${row.availability.join(", ")})`);
      }
    }
  });

  test("the fonts of the earlier defaults stay schemes a deck can choose", () => {
    for (const [tag, schemeId, family] of [["hi", "mangal", "Mangal"], ["th", "angsana-new", "Angsana New"], ["he", "david", "David"], ["ja", "meiryo", "Meiryo"], ["am", "nyala", "Nyala"]]) {
      const chosen = resolveScriptFonts({ language: tag, design: { fontScheme: schemeId }, slides: [{ title: "x" }] }, { catalogs });
      assert.deepEqual([chosen.supplement.heading, chosen.supplement.body], [family, family], tag);
    }
  });

  test("the policy previews each script of the new defaults with its own open face at a measured factor", () => {
    const scripts = (family) => Object.fromEntries(Object.entries(fontPolicyFor(family).replacement.scripts).map(([script, entry]) => [script, [entry.family, entry.sizeAdjust]]));
    // Nirmala UI: Devanagari is the row's own replacement (1.07, measured natively for opf#361); the other eight scripts are script replacements.
    const nirmala = fontPolicyFor("Nirmala UI").replacement;
    assert.deepEqual([nirmala.family, nirmala.sizeAdjust], ["Noto Sans Devanagari", 1.07]);
    assert.deepEqual(scripts("Nirmala UI"), {
      Beng: ["Noto Sans Bengali", 1.08], Gujr: ["Noto Sans Gujarati", 1.13], Guru: ["Noto Sans Gurmukhi", 1.08], Knda: ["Noto Sans Kannada", 1.17],
      Mlym: ["Noto Sans Malayalam", 1.13], Orya: ["Noto Sans Oriya", 0.98], Taml: ["Noto Sans Tamil", 1.04], Telu: ["Noto Sans Telugu", 1.17],
    });
    // Leelawadee UI: Thai is the row's own replacement, Khmer a script replacement.
    const leelawadee = fontPolicyFor("Leelawadee UI").replacement;
    assert.deepEqual([leelawadee.family, leelawadee.sizeAdjust], ["Noto Sans Thai", 0.96]);
    assert.deepEqual(scripts("Leelawadee UI"), { Khmr: ["Noto Sans Khmer", 1.19] });
    // Ebrima keeps Noto Sans for Latin text and draws Ethiopic with Noto Sans Ethiopic.
    assert.equal(fontPolicyFor("Ebrima").replacement.family, "Noto Sans");
    assert.deepEqual(scripts("Ebrima"), { Ethi: ["Noto Sans Ethiopic", 1.06] });
    // Every script replacement is a visual one with a factor and how it was measured.
    for (const row of FONT_POLICY.families) {
      for (const [script, entry] of Object.entries(row.replacement?.scripts ?? {})) {
        assert.equal(entry.compatibility, "visual", `${row.family} ${script}`);
        assert.ok(entry.sizeAdjust >= 0.25 && entry.sizeAdjust <= 2, `${row.family} ${script}`);
        assert.match(entry.sizeAdjustBasis, /advances/, `${row.family} ${script}`);
      }
    }
    // Segoe UI keeps its Latin preview face (which has no Hebrew) and draws Hebrew with Noto Sans Hebrew.
    assert.notEqual(fontPolicyFor("Segoe UI").replacement.family, "Noto Sans Hebrew");
    assert.deepEqual(scripts("Segoe UI"), { Hebr: ["Noto Sans Hebrew", 1.03] });
    // Yu Gothic (Japanese) needs no factor: Noto Sans JP runs at 0.999 of its line lengths over eight sentences.
    assert.deepEqual([fontPolicyFor("Yu Gothic").replacement.family, fontPolicyFor("Yu Gothic").replacement.sizeAdjust], ["Noto Sans JP", undefined]);
  });
});
