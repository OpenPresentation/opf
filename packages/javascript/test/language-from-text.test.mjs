import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validate } from "../dist/index.js";
import { resolveScriptFonts, resolveSlideDirection } from "../dist/composition.js";
import { gallery } from "@openpresentation/gallery";

// v0.35: a deck written in Arabic or Hebrew that declares no language is laid out as that language: a slide whose letters are mostly
// of the script resolves as `ar` or `he`, with the script's default fonts, right to left, exactly as a deck that declares it. A
// declared language (deck, slide or option) always wins, and no other script is read from the text.
const catalogs = [gallery];
const ARABIC = "نراجع اليوم نتائج الربع الثالث وخطة العام المقبل";
const HEBREW = "היום נסקור את תוצאות הרבעון השלישי";
const slide = (title, text) => ({ title, text });
const deck = (slides, extra = {}) => ({ name: "Language from the text", ...extra, slides });
const picked = (resolved) => ({ bcp47: resolved.bcp47, lang: resolved.lang, script: resolved.script, direction: resolved.direction, heading: resolved.heading, body: resolved.body, supplement: resolved.supplement });

describe("the language of a deck that declares none (v0.35)", () => {
  for (const [tag, lang, script, text] of [["ar", "ar-SA", "Arab", ARABIC], ["he", "he-IL", "Hebr", HEBREW]]) {
    test(`${tag}: a slide written in the ${script} script resolves as a deck that declares "${tag}" does`, () => {
      const undeclared = deck([slide(text, text)]), declared = deck([slide(text, text)], { language: tag });
      for (const options of [{ catalogs }, { catalogs, slideIndex: 0 }]) {
        const read = resolveScriptFonts(undeclared, options), named = resolveScriptFonts(declared, options);
        assert.equal(read.languageSource, "text");
        assert.equal(named.languageSource, "document");
        assert.deepEqual([read.bcp47, read.lang, read.script, read.rtl], [tag, lang, script, true]);
        assert.deepEqual(picked(read), picked(named));
      }
      assert.equal(resolveSlideDirection(undeclared, 0), "rtl");
      assert.equal(resolveSlideDirection(undeclared), "rtl");
    });
  }

  test("each slide is read on its own: an Arabic slide in an English deck is right to left, its neighbors are not", () => {
    const mixed = deck([slide("Quarterly review", "Revenue grew twelve percent."), slide(ARABIC, ARABIC), slide("Launch plan", ["We call the launch ", { text: "خطة النمو", bold: true }, " in the Gulf markets."])]);
    assert.deepEqual([0, 1, 2].map((slideIndex) => { const resolved = resolveScriptFonts(mixed, { catalogs, slideIndex }); return [resolved.bcp47, resolved.languageSource, resolved.direction]; }), [["en-US", "default", "ltr"], ["ar", "text", "rtl"], ["en-US", "default", "ltr"]]);
    // The deck as a whole is what most of the letters on all its slides are.
    assert.equal(resolveScriptFonts(deck([slide("Quarterly review of the plan for the next year", "Revenue grew twelve percent in the third quarter."), slide("خطة", "خطة")]), { catalogs }).languageSource, "default");
    assert.equal(resolveScriptFonts(deck([slide("Plan", "Review"), slide(ARABIC, `${ARABIC} ${ARABIC}`)]), { catalogs }).bcp47, "ar");
  });

  test("the letters counted are the ones the slide draws: title, text, list items, table cells and nested blocks; not the notes", () => {
    const one = (content) => resolveScriptFonts(deck([content]), { catalogs, slideIndex: 0 }).languageSource;
    assert.equal(one({ title: "Plan", bullets: [ARABIC, { text: ARABIC, description: ARABIC }] }), "text");
    assert.equal(one({ title: "Plan", table: { columns: [ARABIC, ARABIC], rows: [[ARABIC, "12"]] } }), "text");
    assert.equal(one({ title: "Plan", blocks: [{ text: ARABIC }, { blocks: [{ text: [{ text: ARABIC, bold: true }] }] }] }), "text");
    assert.equal(one({ title: "Quarterly review of the plan", notes: `${ARABIC} ${ARABIC}` }), "default");
    // More than half of the letters, not half: digits, punctuation and spaces do not count.
    assert.equal(one({ title: "abcd", text: "ابتث" }), "default");
    assert.equal(one({ title: "abc 2026: 14%", text: "ابتث" }), "text");
    assert.equal(one({ title: "2026", text: "14%" }), "default");
  });

  test("a declared language always wins: the deck's, the slide's, or the option", () => {
    const english = resolveScriptFonts(deck([slide(ARABIC, ARABIC)], { language: "en-US" }), { catalogs, slideIndex: 0 });
    assert.deepEqual([english.bcp47, english.languageSource, english.direction], ["en-US", "document", "ltr"]);
    const french = resolveScriptFonts(deck([{ ...slide(ARABIC, ARABIC), language: "fr" }]), { catalogs, slideIndex: 0 });
    assert.deepEqual([french.bcp47, french.languageSource, french.direction], ["fr", "document", "ltr"]);
    const option = resolveScriptFonts(deck([slide(ARABIC, ARABIC)]), { catalogs, slideIndex: 0, language: "de" });
    assert.deepEqual([option.bcp47, option.languageSource], ["de", "option"]);
    // A slide that declares its own language leaves the others to their text.
    const own = deck([{ ...slide(ARABIC, ARABIC), language: "en" }, slide(ARABIC, ARABIC)]);
    assert.deepEqual([0, 1].map((slideIndex) => resolveScriptFonts(own, { catalogs, slideIndex }).languageSource), ["document", "text"]);
    // A declared language that does not resolve is not replaced by a guess.
    assert.equal(resolveScriptFonts(deck([slide(ARABIC, ARABIC)], { language: "und" }), { catalogs, slideIndex: 0 }).languageSource, "default");
  });

  test("only right-to-left scripts are read from the text", () => {
    for (const text of ["आज हम तीसरी तिमाही के नतीजों की समीक्षा करेंगे", "วันนี้เราจะทบทวนผลประกอบการ", "本日は第3四半期の業績を確認します", "Сегодня мы рассмотрим результаты", "Today we review the results"]) {
      const resolved = resolveScriptFonts(deck([slide(text, text)]), { catalogs, slideIndex: 0 });
      assert.deepEqual([resolved.bcp47, resolved.languageSource, resolved.direction], ["en-US", "default", "ltr"], text);
    }
  });

  test("opf/missing-language says which slides were read as which language", () => {
    const finding = (document) => validate(document, { catalogs }).findings.find((item) => item.ruleId === "opf/missing-language");
    const all = finding(deck([slide(ARABIC, ARABIC), slide(ARABIC, ARABIC)]));
    assert.equal(all.severity, "info");
    assert.match(all.message, /^The presentation has no language set\. Its slides are written in the Arabic script, so OPF lays them out as Arabic \("ar"\): right to left/);
    assert.match(all.help, /for example "ar"/);
    const some = finding(deck([slide("Quarterly review", "Revenue grew."), slide(HEBREW, HEBREW)]));
    assert.match(some.message, /Slide 2 is written in the Hebrew script, so OPF lays it out as Hebrew \("he"\)/);
    assert.match(some.help, /on those slides/);
    const latin = finding(deck([slide("Quarterly review", "Revenue grew.")]));
    assert.equal(latin.message, "The presentation has no language set.");
    assert.equal(finding(deck([slide(ARABIC, ARABIC)], { language: "ar" })), undefined);
  });
});
