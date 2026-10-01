import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { assemble } from "./assemble-latin-host-evidence.mjs";
import { BOX_WIDTHS_EM, PARAGRAPH_SIZE, ROOT, compareBreaks, paragraphsOf, wrapBreaks } from "./qualify-latin-fonts.mjs";

// Every character is 0.5 em wide, so a word of n letters is n / 2 em and a space is 0.5 em.
const width = (word) => word.length / 2;

test("wrapBreaks wraps greedily on spaces and keeps a long word on its own line", () => {
  assert.deepEqual(wrapBreaks("aaaa bbbb cccc dddd", width, 0.5, 5), [2, 2], "two words (2 + 0.5 + 2 = 4.5 em) fit in 5 em");
  assert.deepEqual(wrapBreaks("aaaa bbbb cccc dddd", width, 0.5, 4.4), [1, 1, 1, 1]);
  assert.deepEqual(wrapBreaks("a verylongwordthatdoesnotfit b", width, 0.5, 3), [1, 1, 1]);
  assert.deepEqual(wrapBreaks("", width, 0.5, 5), []);
  assert.deepEqual(wrapBreaks("  spaced   words ", width, 0.5, 20), [2]);
});

test("compareBreaks counts the cases whose breaks differ, per box width", () => {
  const paragraphs = ["aaaa bbbb cccc dddd eeee ffff"];
  const same = compareBreaks(paragraphs, width, 0.5, width, 0.5, [4.4, 5, 9]);
  assert.equal(same.cases, 3);
  assert.equal(same.identical, 3);
  assert.equal(same.identicalFraction, 1);
  // A replacement that is 10% wider moves the break at 5 em (4.5 em of two words becomes 4.95 em: still fits) and at 4.4 em nowhere, but at 4.9 em it flips.
  const wider = compareBreaks(paragraphs, (word) => width(word) * 1.1, 0.5 * 1.1, width, 0.5, [4.9]);
  assert.equal(wider.differing, 1);
  assert.equal(wider.perWidth[0].differing, 1);
  assert.deepEqual(BOX_WIDTHS_EM, [8, 11.5, 16, 22, 30]);
});

test("paragraphsOf groups the corpus into paragraphs of six strings", () => {
  const corpus = JSON.parse(readFileSync(path.join(ROOT, "docs/evidence/font-replacements-20260923/corpus.json"), "utf8"));
  const paragraphs = paragraphsOf(corpus);
  assert.equal(paragraphs.length, 50);
  assert.equal(paragraphs[0], corpus.slice(0, PARAGRAPH_SIZE).join(" "));
});

test("the committed qualification report agrees with the policy rows it measured", () => {
  const report = JSON.parse(readFileSync(path.join(ROOT, "docs/evidence/font-replacements-20260923/latin-qualification-20261001.json"), "utf8"));
  const policy = JSON.parse(readFileSync(path.join(ROOT, "spec/reference/font-policy.json"), "utf8"));
  assert.equal(report.lineBreakModel.paragraphs * report.lineBreakModel.boxWidthsEm.length, 250);
  for (const entry of report.results) {
    const row = policy.families.find((item) => item.family === entry.family);
    assert.ok(row, entry.family);
    if (!entry.referenceAvailable) { assert.equal(entry.styles.length, 0, entry.family); continue; }
    // A metric claim in the policy must clear the width bar in every measured style, as the owner's bar says.
    if (row.replacement?.compatibility === "metric") assert.equal(entry.summary.widthBarMet, true, `${entry.family}: metric claim`);
    for (const style of entry.styles) {
      assert.ok(style.lineBreaks.cases === 250 && style.lineBreaks.identical <= 250, entry.family);
      assert.match(style.reference.sha256, /^[0-9a-f]{64}$/, entry.family);
      assert.match(style.replacement.sha256, /^[0-9a-f]{64}$/, entry.family);
    }
    // The policy's recorded measurement names the same replacement the report measured.
    if (row.replacement?.measured && !row.replacement.decision) assert.equal(row.replacement.measured.replacement, entry.route, entry.family);
  }
  // The report holds no absolute paths or font data.
  const text = JSON.stringify(report);
  assert.ok(!/[A-Za-z]:\\\\Users/.test(text) && !text.includes("/Users/"));
});

test("assemble records which families passed in which host, with the lazy-load budget", () => {
  const row = (family, lazyBytes) => ({ family, route: "R", files: lazyBytes ? [`fonts/${family}.ttf`] : [], lazyBytes });
  const report = { node: "v24", browser: "154", renderer: "0.11.9", manifestVersion: "0.11.9", filesFetchedInTotal: 2, bytesFetchedInTotal: 3145728, report: [row("A", 0), row("B", 1048576), row("C", 2097152)] };
  const out = assemble({ node: report, browser: report, editor: report, gallery: { ...report, report: [row("A", 0), row("B", 1048576)] }, commits: { render: "a".repeat(40), editor: "b".repeat(40), gallery: "c".repeat(40) } });
  assert.deepEqual(Object.keys(out.hosts), ["node", "browser", "editor", "galleryEditor"]);
  assert.deepEqual(Object.keys(out.hosts.galleryEditor.families), ["A", "B"]);
  assert.equal(out.hosts.node.families.B.lazyBytes, 1048576);
  assert.equal(out.lazyBudget.node.deckBytesMaxMiB, 2);
  assert.equal(out.lazyBudget.node.largestDeck, "C");
  assert.equal(out.lazyBudget.galleryEditor.familiesWithoutLazyFiles, 1);
  assert.equal(out.hosts.browser.filesFetchedInTotal, 2);
});
