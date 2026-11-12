// LH-106: every number the engines generate follows the numbering system of the language in effect (deck, slide or run), with digits,
// separators and the percent sign from one table (src/number-locale-data.ts), never the runtime's Intl, so 999 and 1,000 cannot disagree
// and every runtime draws the same text. The `-u-nu-<system>` extension chooses another numbering system.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asciiDigits, composeSlide, formatDataNumber, formatListNumber, formatNumber, formatPercentNumber, groupNumber, languageInEffect, layoutMetric, layoutTable,
  listNumbers, localizeDigits, numberLocale, numberingSystemExtension, numberingSystemOf, numeralScripts, plainLanguageTag, resolveScriptFonts,
  NUMBER_LOCALE_SOURCE, NUMBER_LOCALES, NUMBERING_SYSTEMS, supportedNumberingSystems,
} from "../dist/composition.js";
import { formatVariableNumber, resolveSlideVariables, resolveVariables, validate } from "../dist/index.js";

const VALUES = [7, 999, 1000, 1234567.891];
const grouped = (value, language) => formatNumber(value, language, { group: Math.abs(value) >= 1000 });

// The locale x value matrix of the LH-106 brief: what a metric value draws.
const MATRIX = {
  "ar-SA": ["٧", "٩٩٩", "١٬٠٠٠", "١٬٢٣٤٬٥٦٧٫٨٩١"],
  "ar-EG": ["٧", "٩٩٩", "١٬٠٠٠", "١٬٢٣٤٬٥٦٧٫٨٩١"],
  "ar-AE": ["7", "999", "1,000", "1,234,567.891"],
  "ar-MA": ["7", "999", "1.000", "1.234.567,891"],
  "fa-IR": ["۷", "۹۹۹", "۱٬۰۰۰", "۱٬۲۳۴٬۵۶۷٫۸۹۱"],
  "hi-IN": ["7", "999", "1,000", "12,34,567.891"],
  "bn-BD": ["৭", "৯৯৯", "১,০০০", "১২,৩৪,৫৬৭.৮৯১"],
  "ja-JP": ["7", "999", "1,000", "1,234,567.891"],
  "de-DE": ["7", "999", "1.000", "1.234.567,891"],
  "fr-FR": ["7", "999", "1 000", "1 234 567,891"],
  "es-ES": ["7", "999", "1000", "1.234.567,891"],
  "en-US": ["7", "999", "1,000", "1,234,567.891"],
  "ar-SA-u-nu-latn": ["7", "999", "1,000", "1,234,567.891"],
  "ar-AE-u-nu-arab": ["٧", "٩٩٩", "١٬٠٠٠", "١٬٢٣٤٬٥٦٧٫٨٩١"],
  "hi-IN-u-nu-deva": ["७", "९९९", "१,०००", "१२,३४,५६७.८९१"],
};

describe("LH-106 numerals: the one number path", () => {
  test("the locale matrix: every value of a language is in one numbering system, grouped or not", () => {
    for (const [language, expected] of Object.entries(MATRIX)) assert.deepEqual(VALUES.map((value) => grouped(value, language)), expected, language);
    // groupNumber is the same path with grouping on.
    assert.equal(groupNumber(1000, "ar-SA"), "١٬٠٠٠");
    assert.equal(groupNumber(7, "ar-SA"), "٧");
  });

  test("the numbering system of a tag: the locale's own, or the one -u-nu- names", () => {
    const systems = { "ar-SA": "arab", "ar-EG": "arab", "ar-AE": "latn", "ar-MA": "latn", "ar-DZ": "latn", "ar-TN": "latn", "fa-IR": "arabext", "hi-IN": "latn", "en-GB": "latn",
      "ar-SA-u-nu-latn": "latn", "ar-AE-u-nu-arab": "arab", "ar-SA-u-ca-islamic-nu-latn": "latn", "ar-SA-u-nu-hanidec": "arab", "AR-sa": "arab", "": "latn", "zz-bogus": "latn" };
    for (const [tag, system] of Object.entries(systems)) assert.equal(numberingSystemOf(tag || undefined), system, tag);
    assert.equal(numberingSystemExtension("ar-SA-u-nu-latn"), "latn");
    assert.equal(numberingSystemExtension("ar-SA"), undefined);
    assert.deepEqual(supportedNumberingSystems().filter((system) => ["latn", "arab", "arabext", "deva", "beng", "thai", "hanidec", "mathbold"].includes(system)), ["arab", "arabext", "beng", "deva", "latn", "thai"]);
  });

  test("a plain tag for PowerPoint: extensions and private use go, the tag stays as written otherwise", () => {
    assert.equal(plainLanguageTag("ar-SA-u-nu-latn"), "ar-SA");
    assert.equal(plainLanguageTag("sr-Latn-RS-u-nu-latn-x-private"), "sr-Latn-RS");
    assert.equal(plainLanguageTag("en-US"), "en-US");
    assert.equal(resolveScriptFonts({ language: "ar-SA-u-nu-latn" }).lang, "ar-SA");
    assert.equal(resolveScriptFonts({ language: "ar-SA-u-nu-latn" }).bcp47, "ar-SA-u-nu-latn");
    assert.equal(resolveScriptFonts({ language: { bcp47: "ar-AE-u-nu-arab", ooxmlLang: "ar-AE-u-nu-arab" } }).lang, "ar-AE");
  });

  test("percent, patterns, exponents and signs share the locale's symbols", () => {
    assert.equal(formatPercentNumber(50, "ar-SA"), "٥٠٪");
    assert.equal(formatPercentNumber(12.5, "de-DE"), "12,5%");
    assert.equal(formatPercentNumber(50, "fa-IR"), "۵۰٪");
    assert.equal(formatPercentNumber(50, "ar-SA-u-nu-latn"), "50%");
    assert.equal(formatNumber(-1234.5, "ar-SA", { group: true }), "-١٬٢٣٤٫٥");
    assert.equal(formatNumber(1e21, "ar-SA"), "١e+٢١");
    assert.equal(formatNumber(0.1 + 0.2, "en-US"), "0.3");
    assert.equal(formatDataNumber(1234.5, "#,##0.00", "ar-SA"), "١٬٢٣٤٫٥٠");
    assert.equal(formatDataNumber(0.25, "0%", "ar-SA"), "٢٥٪");
    assert.equal(formatDataNumber(1234.5, "$#,##0.0", "de-DE"), "$1.234,5");
    assert.equal(formatDataNumber(1234567, "#,##0", "hi-IN"), "12,34,567");
    assert.equal(formatDataNumber(1000, "#,##0", "es-ES"), "1.000", "a pattern that groups groups from four digits");
    // Without a language a pattern prints its Latin form, as written (validation, provenance and the editor's grid read it).
    assert.equal(formatDataNumber(1234.5, "#,##0.00"), "1,234.50");
    assert.deepEqual(formatVariableNumber(1234567.891, "#,##0.0", "ar-SA"), { text: "١٬٢٣٤٬٥٦٧٫٩" });
    assert.deepEqual(formatVariableNumber(7, undefined, "fa-IR"), { text: "۷" });
  });

  test("digits read back from any numbering system OPF draws", () => {
    assert.equal(asciiDigits("١٬٢٣٤٫٥"), "1,234.5");
    assert.equal(asciiDigits("۹۹۹ / ७"), "999 / 7");
    assert.equal(localizeDigits("Q3 2026", "ar-SA"), "Q٣ ٢٠٢٦");
    assert.equal(localizeDigits("12", "en-US"), "12");
  });

  test("the language in effect: the slide's own, else the deck's", () => {
    const deck = { language: "ar-SA", slides: [{ title: "a" }, { title: "b", language: "en-US" }, { title: "c", language: { bcp47: "fa-IR" } }] };
    assert.deepEqual([0, 1, 2].map((index) => languageInEffect(deck, index)), ["ar-SA", "en-US", "fa-IR"]);
    assert.equal(languageInEffect(deck), "ar-SA");
    assert.deepEqual(numeralScripts(["ar-SA", "en-US", "fa-IR", "bn", "ar-SA-u-nu-latn"]), ["Arab", "Beng"]);
  });
});

describe("LH-106 numerals: what the engines generate", () => {
  const box = { x: 0, y: 0, width: 800, height: 400 };
  test("a metric below 1,000 and one above it draw the same digits", () => {
    for (const [language, expected] of Object.entries(MATRIX)) {
      const drawn = VALUES.map((value) => layoutMetric({ value, label: "L" }, box, { language }).parts.find((part) => part.role === "value").text);
      assert.deepEqual(drawn, expected, language);
    }
    // A string value is the author's text and is never rewritten.
    assert.equal(layoutMetric({ value: "999", label: "L" }, box, { language: "ar-SA" }).parts[0].text, "999");
  });

  test("the slide's language decides inside a deck of another language", () => {
    const deck = { language: "en-US", slides: [{ title: "T", metric: { value: 999, label: "L" }, language: "ar-SA" }, { title: "T", metric: { value: 999, label: "L" } }] };
    const value = (index) => composeSlide(deck.slides[index], { presentation: deck, slideIndex: index }).items.find((item) => item.field === "metric").metricLayout.parts.find((part) => part.role === "value").text;
    assert.equal(value(0), "٩٩٩");
    assert.equal(value(1), "999");
  });

  test("table number cells, list numerals, slide numbers and number variables", () => {
    const table = { columns: ["A", { name: "B", format: "#,##0.00" }], rows: [[7, 1000], [1234567.891, 2.5]] };
    const cells = (language) => layoutTable(table, box, { language }).rows.slice(1).flatMap((row) => row.cells.map((cell) => String(cell.value)));
    assert.deepEqual(cells("ar-SA"), ["٧", "١٬٠٠٠٫٠٠", "١٢٣٤٥٦٧٫٨٩١", "٢٫٥٠"]);
    assert.deepEqual(cells("en-US"), ["7", "1,000.00", "1234567.891", "2.50"]);
    assert.deepEqual(cells(undefined), ["7", "1,000.00", "1234567.891", "2.50"]);
    assert.deepEqual(listNumbers(["a", "b"], "arabic", "ar-SA").map((number) => [number.text, number.numberingSystem]), [["١.", "arab"], ["٢.", "arab"]]);
    assert.deepEqual(listNumbers(["a", "b"], "roman-upper", "ar-SA").map((number) => [number.text, number.numberingSystem]), [["I.", undefined], ["II.", undefined]]);
    assert.equal(formatListNumber(12, "arabic", "paren-both", "fa-IR"), "(۱۲)");
    assert.equal(resolveSlideVariables({ title: "{{slide.number}} / {{deck.slideCount}}", language: "ar-SA" }, { slideNumber: 3, slideCount: 12 }).title, "٣ / ١٢");
    assert.equal(resolveSlideVariables({ title: "{{slide.number}}" }, { slideNumber: 3, presentation: { language: "fa-IR" } }).title, "۳");
    assert.equal(resolveSlideVariables({ title: "{{slide.number}}" }, { slideNumber: 3 }).title, "3");
    const resolved = resolveVariables({ language: "ar-SA", variables: { n: { type: "number", value: 1500 }, link: { type: "number", value: 7 } }, slides: [{ title: "{{n}}", text: [{ text: "x", link: "https://example.com/{{link}}" }] }] }).presentation;
    assert.equal(resolved.slides[0].title, "١٥٠٠");
    assert.equal(resolved.slides[0].text[0].link, "https://example.com/7", "an address keeps Latin digits");
  });
});

describe("LH-106 numerals: the format accepts the extension", () => {
  test("a -u-nu- tag validates; a system OPF does not draw is a warning with the plain tag as its fix", () => {
    const deck = (language) => ({ language, slides: [{ title: "T", metric: { value: 1000, label: "L" } }] });
    const findings = (language) => validate(deck(language)).findings.filter((finding) => finding.ruleId === "opf/language-tag");
    assert.equal(validate(deck("ar-SA-u-nu-latn")).valid, true);
    assert.deepEqual(findings("ar-SA-u-nu-latn"), []);
    assert.deepEqual(findings("ar-AE-u-nu-arab"), []);
    const [warning] = findings("ar-SA-u-nu-hanidec");
    assert.equal(warning?.severity, "warning");
    assert.match(warning.message, /numbering system 'hanidec'/);
    assert.deepEqual(warning.fixes?.[0]?.patch, [{ op: "replace", path: "/language", value: "ar-SA" }]);
  });
});

describe("LH-106 numerals: the table is the format's, checked against Intl", () => {
  // The table was read from Intl on one ICU version (NUMBER_LOCALE_SOURCE). On that version it must equal Intl exactly; on another the
  // engines still draw the table (that is the point of it), and the differences are only reported, so a newer CLDR is taken on purpose
  // by rerunning scripts/build-number-locales.mjs.
  const sameIcu = process.versions.icu === NUMBER_LOCALE_SOURCE.icu;
  const intl = (tag) => {
    const format = new Intl.NumberFormat(tag, { maximumFractionDigits: 12 });
    const parts = format.formatToParts(1234567.891);
    return { system: format.resolvedOptions().numberingSystem, decimal: parts.find((part) => part.type === "decimal")?.value, group: parts.find((part) => part.type === "group")?.value, text: format.format(1234567.891), four: format.format(1000) };
  };
  test(`every table entry matches Intl${sameIcu ? "" : ` (reported only: this runtime has ICU ${process.versions.icu}, the table ${NUMBER_LOCALE_SOURCE.icu})`}`, () => {
    const differences = [];
    for (const key of Object.keys(NUMBER_LOCALES)) {
      const tag = key || "en";
      const expected = intl(tag), ours = numberLocale(tag);
      // Intl's bidi marks and its minus sign are not OPF's (OPF writes a hyphen-minus and lets the renderer order the runs).
      const strip = (text) => text.replace(/[؜‎‏]/g, "");
      const actual = { system: ours.system, decimal: ours.decimal, group: ours.group, text: formatNumber(1234567.891, tag, { group: true }), four: formatNumber(1000, tag, { group: true }) };
      for (const field of ["system", "decimal", "group", "text", "four"]) if (strip(expected[field] ?? "") !== actual[field]) differences.push(`${tag} ${field}: Intl ${JSON.stringify(expected[field])}, table ${JSON.stringify(actual[field])}`);
    }
    if (sameIcu) assert.deepEqual(differences, []);
    else if (differences.length) console.log(`numerals: ${differences.length} differences from this runtime's Intl:\n${differences.slice(0, 40).join("\n")}`);
  });

  test("every numbering system's digits are ten consecutive characters of one script", () => {
    for (const [system, [zero, script]] of Object.entries(NUMBERING_SYSTEMS)) {
      assert.equal(numberLocale(`en-u-nu-${system}`).digits, Array.from({ length: 10 }, (_, digit) => String.fromCodePoint(zero + digit)).join(""), system);
      assert.match(script, /^[A-Z][a-z]{3}$/, system);
    }
    assert.equal(NUMBERING_SYSTEMS.arab[1], "Arab");
    assert.equal(NUMBERING_SYSTEMS.arabext[1], "Arab");
    assert.equal(NUMBERING_SYSTEMS.deva[1], "Deva");
  });
});
