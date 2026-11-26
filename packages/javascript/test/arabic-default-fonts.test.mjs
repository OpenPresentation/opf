import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import { FONT_POLICY, LANGUAGES, fontPolicyFor } from "../dist/index.js";
import { resolveScriptFonts } from "../dist/composition.js";
import { catalogDisplay, gallery } from "@openpresentation/gallery";

// v0.35: Arabic, Persian and Urdu decks default to PowerPoint's Office theme fonts for the Arabic script, Times New Roman for
// headings and Arial for body, instead of Arabic Typesetting, which draws Arabic at about two thirds of the Latin size. Arial and
// Times New Roman preview Latin text with their metric replacements and Arabic-script runs with Noto Naskh Arabic at a measured
// size multiplier (`replacement.scripts`).
const schema = JSON.parse(readFileSync(new URL("../../../spec/reference/font-policy.schema.json", import.meta.url), "utf8"));
const source = JSON.parse(readFileSync(new URL("../../../spec/reference/font-policy.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;
const catalogs = [gallery];

describe("the Arabic, Persian and Urdu default fonts (v0.35)", () => {
  for (const [tag, record] of [["ar", "arabic"], ["fa", "persian"], ["ur", "urdu"]]) {
    test(`${tag}: Times New Roman for headings and Arial for body, in the complex-script slot and the Arab theme entry`, () => {
      const resolved = resolveScriptFonts({ language: tag, slides: [{ title: "x" }] }, { catalogs });
      assert.equal(resolved.heading.complexScript, "Times New Roman");
      assert.equal(resolved.body.complexScript, "Arial");
      assert.equal(resolved.sources.complexScript, "language");
      assert.deepEqual(resolved.supplement, { script: "Arab", heading: "Times New Roman", body: "Arial" });
      // The Latin slots keep the deck's own scheme (the engine default, Aptos).
      assert.deepEqual([resolved.heading.latin, resolved.body.latin], ["Aptos Display", "Aptos"]);
      // The vocabulary and the gallery's language record say the same thing: the record names the scheme with these families.
      assert.deepEqual(LANGUAGES.find((entry) => entry.tag === tag).fonts.powerpoint, { major: "Times New Roman", minor: "Arial" });
      const language = catalogDisplay.languages[record];
      assert.equal(language.fontScheme, "times-new-roman-arial");
      const scheme = gallery.fontSchemes[language.fontScheme];
      assert.deepEqual([scheme.major, scheme.minor, scheme.scriptGroup], ["Times New Roman", "Arial", "complexScript"]);
      assert.ok(scheme.languages.includes(tag));
    });
  }

  test("Arabic Typesetting stays a scheme a deck can choose", () => {
    const chosen = resolveScriptFonts({ language: "ar", design: { fontScheme: "arabic-typesetting" }, slides: [{ title: "x" }] }, { catalogs });
    assert.equal(chosen.body.complexScript, "Arabic Typesetting");
    const named = resolveScriptFonts({ language: { bcp47: "ar", fontScheme: "arabic-typesetting" }, slides: [{ title: "x" }] }, { catalogs });
    assert.deepEqual([named.heading.complexScript, named.body.complexScript, named.body.latin], ["Arabic Typesetting", "Arabic Typesetting", "Aptos"]);
  });

  test("the policy previews Arabic-script runs of Arial and Times New Roman with Noto Naskh Arabic, and Latin text as before", () => {
    for (const [family, latin, adjust] of [["Arial", "Arimo", 0.96], ["Times New Roman", "Tinos", 0.95]]) {
      const { replacement } = fontPolicyFor(family);
      // Latin text keeps its metric replacement, at the composed size.
      assert.deepEqual([replacement.family, replacement.compatibility, replacement.sizeAdjust], [latin, "metric", undefined], family);
      const arab = replacement.scripts.Arab;
      assert.deepEqual([arab.family, arab.compatibility, arab.sizeAdjust], ["Noto Naskh Arabic", "visual", adjust], family);
      assert.match(arab.sizeAdjustBasis, /advances/, family);
      assert.deepEqual(Object.keys(replacement.scripts), ["Arab"], family);
    }
    // The rows that carry script replacements: these two, and the four of the other script defaults (script-default-fonts.test.mjs).
    assert.deepEqual(FONT_POLICY.families.filter((row) => row.replacement?.scripts).map((row) => row.family).sort(), ["Arial", "Ebrima", "Leelawadee UI", "Nirmala UI", "Segoe UI", "Times New Roman"]);
  });

  test("the schema holds a script replacement to a known shape", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(validate(source), true, JSON.stringify(validate.errors, null, 2));
    const arialArab = (table) => table.families.find((row) => row.family === "Arial").replacement.scripts;
    for (const mutate of [
      (scripts) => delete scripts.Arab.sizeAdjustBasis,
      (scripts) => delete scripts.Arab.family,
      (scripts) => { scripts.Arab.sizeAdjust = 0.1; },
      (scripts) => { scripts.Arab.lineAscent = 0.8; },
      (scripts) => { scripts.arabic = scripts.Arab; },
    ]) {
      const broken = structuredClone(source);
      mutate(arialArab(broken));
      assert.equal(validate(broken), false, String(mutate));
    }
  });
});
