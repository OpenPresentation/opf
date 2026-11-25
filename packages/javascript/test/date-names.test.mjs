// FR-10 part 2 (CR 15): the month and weekday names of a date are the language's where the date is drawn, from one generated table
// (src/date-name-data.ts, read from Intl once by scripts/build-date-names.mjs), never the runtime's Intl.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DATE_NAMES, DATE_NAMES_MISSING, DATE_NAME_SOURCE, DATE_PATTERNS, ENGLISH_DATE_NAMES, dateNamesOf, formatFurnitureDate, layoutFurniture, longDatePattern } from "../dist/composition.js";
import { resolveVariables, validate } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const date = "2026-03-05"; // a Thursday
const draw = (pattern, language) => formatFurnitureDate(date, pattern, language).text;

test("the table is what Intl says on the ICU version it was made with, and is only reported on another", () => {
  const sameIcu = process.versions.icu === DATE_NAME_SOURCE.icu;
  const directory = mkdtempSync(path.join(tmpdir(), "opf-date-names-"));
  try {
    const out = path.join(directory, "date-name-data.ts");
    const run = spawnSync(process.execPath, [path.join(here, "../scripts/build-date-names.mjs"), path.join(here, "../../gallery/catalog/languages"), out], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const fresh = readFileSync(out, "utf8");
    const committed = readFileSync(path.join(here, "../src/date-name-data.ts"), "utf8");
    if (sameIcu) assert.equal(fresh, committed, "rerun packages/javascript/scripts/build-date-names.mjs, with a changelog fragment, to take other data on purpose");
    else console.log(`reported only: this runtime has ICU ${process.versions.icu}, the table ${DATE_NAME_SOURCE.icu}; differs: ${fresh !== committed}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the table holds every language of the gallery the runtime has data for, and lists the rest", () => {
  const tags = readdirSync(path.join(here, "../../gallery/catalog/languages")).map((file) => JSON.parse(readFileSync(path.join(here, "../../gallery/catalog/languages", file), "utf8")).bcp47).filter(Boolean);
  assert.deepEqual([...DATE_NAMES_MISSING].sort(), ["ay", "ber-Latn", "ctg"]);
  for (const tag of tags) if (!DATE_NAMES_MISSING.includes(tag)) assert.ok(dateNamesOf(tag) !== ENGLISH_DATE_NAMES || tag.startsWith("en"), tag);
  assert.ok(Object.keys(DATE_NAMES).length >= 80);
  // Every entry has the six lists and twelve months, seven weekdays.
  for (const [tag, row] of Object.entries(DATE_NAMES)) {
    const names = dateNamesOf(tag);
    assert.equal(names.months.length, 12, tag);
    assert.equal(names.monthsShort.length, 12, tag);
    assert.equal(names.monthsStandalone.length, 12, tag);
    assert.equal(names.weekdays.length, 7, tag);
    assert.equal(names.weekdaysShort.length, 7, tag);
    assert.ok(row.split("~").length === 6, tag);
  }
  for (const tag of Object.keys(DATE_PATTERNS)) assert.ok(formatFurnitureDate(date, DATE_PATTERNS[tag], tag).text, tag);
});

test("month and weekday names follow the language, falling back from de-AT to de and to English", () => {
  assert.equal(draw("EEEE, d. MMMM yyyy", "de"), "Donnerstag, 5. März 2026");
  assert.equal(draw("EEE d MMM yyyy", "fr"), "jeu. 5 mars 2026");
  assert.equal(draw("EEEE d MMMM yyyy", "fr-CA"), "jeudi 5 mars 2026");
  assert.equal(draw("d. MMMM yyyy", "de-AT"), "5. März 2026");
  assert.equal(draw("EEEE d MMMM", "es"), "jueves 5 marzo");
  assert.equal(draw("MMMM d, yyyy"), "March 5, 2026");
  assert.equal(draw("EEEE, MMMM d, yyyy", "en-US"), "Thursday, March 5, 2026");
  assert.equal(draw("MMM d", "en"), "Mar 5");
  // A language with no data, and a language that is unknown, draw English.
  assert.equal(draw("EEEE d MMMM", "ay"), "Thursday 5 March");
  assert.equal(draw("EEEE d MMMM", "xx-YY"), "Thursday 5 March");
  assert.equal(draw("EEEE d MMMM", "ber-Latn"), "Thursday 5 March");
  // Quoted literals, numeric tokens and the year tokens are untouched.
  assert.equal(draw("'Woche' d", "de"), "Woche 5");
  assert.ok("error" in formatFurnitureDate(date, "'Woche' w", "de"), "w is not a token");
});

test("a month is in its format form after a day and its stand-alone form without one", () => {
  assert.equal(draw("d MMMM yyyy", "ru"), "5 марта 2026");
  assert.equal(draw("MMMM yyyy", "ru"), "март 2026");
  assert.equal(draw("dd MMM", "ru"), "05 мар.");
  assert.equal(draw("MMM yyyy", "ru"), "март 2026".replace("март", dateNamesOf("ru").monthsShortStandalone[2]));
  assert.equal(draw("d MMMM", "pl"), "5 marca");
  assert.equal(draw("MMMM", "pl"), "marzec");
  // A language that does not inflect its months prints the same either way.
  assert.equal(draw("d MMMM", "de"), "5 März");
  assert.equal(draw("MMMM", "de"), "März");
});

test("a language that counts its months prints the whole label, and its digits are the numerals table's", () => {
  assert.equal(draw("MMMM", "ja"), "3月");
  assert.equal(draw("yyyy年MMMM d日", "ja"), "2026年3月 5日");
  assert.equal(draw("EEEE", "ja"), "木曜日");
  assert.equal(draw("MMMM", "ko"), "3월");
  assert.equal(draw("EEEE", "zh-Hans"), "星期四");
  // Digits: Latin without a language, the language's in a language that draws other ones (LH-106).
  assert.equal(draw("d/M/yyyy"), "5/3/2026");
  assert.equal(draw("d/M/yyyy", "ar-SA"), "٥/٣/٢٠٢٦");
  assert.equal(draw("d/M/yyyy", "ar-AE"), "5/3/2026");
  assert.equal(draw("yy", "fa-IR"), "۲۶");
});

test("the language's long date pattern, and English where there is none", () => {
  assert.equal(longDatePattern("de"), "d. MMMM yyyy");
  assert.equal(longDatePattern("fr"), "d MMMM yyyy");
  assert.equal(longDatePattern("en-GB"), "d MMMM yyyy");
  assert.equal(longDatePattern("ja"), "yyyy年M月d日");
  assert.equal(longDatePattern("es"), "d' de 'MMMM' de 'yyyy");
  assert.equal(longDatePattern("en"), "MMMM d, yyyy");
  assert.equal(longDatePattern("en-US"), "MMMM d, yyyy");
  assert.equal(longDatePattern(undefined), undefined);
  assert.equal(longDatePattern("ay"), undefined);
  assert.equal(draw(longDatePattern("es"), "es"), "5 de marzo de 2026");
  assert.equal(draw(longDatePattern("ja"), "ja"), "2026年3月5日");
  assert.equal(draw(longDatePattern("de"), "de"), "5. März 2026");
});

test("a date variable is drawn in the language of the slide it is on, with the language's pattern when it has no format", () => {
  const deck = (language, slides) => ({ name: "D", ...(language ? { language } : {}), variables: { day: { type: "date", value: date }, pinned: { type: "date", value: date, format: "EEEE d MMMM" } }, slides });
  const text = (document) => resolveVariables(document).presentation.slides.map((slide) => slide.title);
  // A deck with no declared language, and an English one, draw as they always did.
  assert.deepEqual(text(deck(undefined, [{ title: "{{day}}" }, { title: "{{day|dd MMM yyyy}}" }])), ["March 5, 2026", "05 Mar 2026"]);
  assert.deepEqual(text(deck("en-US", [{ title: "{{day}}" }])), ["March 5, 2026"]);
  assert.deepEqual(text(deck("en-GB", [{ title: "{{day}}" }])), ["5 March 2026"]);
  // The slide's language, else the deck's.
  assert.deepEqual(text(deck("de", [{ title: "{{day}}" }, { language: "fr", title: "{{day}}" }, { language: "ja", title: "{{day}}" }, { language: "ru", title: "{{day|d MMMM yyyy}} / {{day|MMMM yyyy}}" }])), ["5. März 2026", "5 mars 2026", "2026年3月5日", "5 марта 2026 / март 2026"]);
  assert.deepEqual(text(deck("de", [{ title: "{{pinned}}" }, { language: "fr", title: "{{pinned}}" }])), ["Donnerstag 5 März", "jeudi 5 mars"]);
  // A translated format wins over the language's default pattern.
  const translated = deck("de", [{ title: "{{day}}" }]);
  translated.variables.day.translations = { de: { format: "EEEE, d. MMMM yyyy" } };
  assert.deepEqual(text(translated), ["Donnerstag, 5. März 2026"]);
  assert.equal(validate(translated, { only: ["format"] }).valid, true);
});

test("a header or footer date is drawn in the language of its slide", () => {
  const furniture = (slideLanguage, content) => {
    const presentation = { language: "de", slides: [slideLanguage ? { language: slideLanguage } : {}] };
    return layoutFurniture({ ...presentation.slides[0], design: { footer: { start: content } } }, { presentation, slideIndex: 0, date }).parts[0]?.text;
  };
  assert.equal(furniture(undefined, { date: date, dateFormat: "EEEE, d. MMMM yyyy" }), "Donnerstag, 5. März 2026");
  assert.equal(furniture("fr", { date: date, dateFormat: "EEEE d MMMM yyyy" }), "jeudi 5 mars 2026");
  assert.equal(furniture("fr", { date: true, dateFormat: "d MMMM yyyy" }), "5 mars 2026");
  // The current-date default (M/d/yyyy) is numeric: it stays what PowerPoint's first date choice is.
  assert.equal(furniture("fr", { date: true }), "3/5/2026");
  // No presentation and no language: English, as before.
  assert.equal(layoutFurniture({ design: { footer: { start: { date, dateFormat: "MMMM d, yyyy" } } } }).parts[0]?.text, "March 5, 2026");
});
