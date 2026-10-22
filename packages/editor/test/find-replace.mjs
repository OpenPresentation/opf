// RR-25: deck-wide find and replace. The model searches every text field of a document, replaces one match or all of
// them as one undoable session change, and keeps rich-text formatting (see the rules in src/find-replace.js).
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import {
  MAX_MATCHES,
  applyTextEdits,
  collectSearchFields,
  compileSearch,
  findMatches,
  planReplace,
  replaceAll,
  replaceMatch,
} from "../dist/find-replace.js";

const deck = () => ({
  name: "Acme review",
  description: "Acme quarterly numbers",
  design: { theme: "minimal", fontScheme: "roboto", footer: { center: { text: "Acme confidential" } } },
  assets: { logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=" },
  slides: [
    {
      id: "one", title: "Acme grows", subtitle: "The Acme story", tag: "ACME", notes: "Mention Acme first.",
      text: [{ text: "Acme ", bold: true }, { text: "is the best", italic: true }, " place to work"],
    },
    {
      id: "two", title: "Numbers",
      blocks: [
        { items: ["Acme revenue", { text: "Cost of Acme", level: 1 }, [{ text: "Acme ", bold: true }, "profit"]] },
        { quote: { text: "Acme is great", attribution: "A fan of Acme", source: "Acme Weekly" } },
        { metric: { value: 98, label: "Acme retention", unit: "%", delta: "+2" } },
        { timeline: [{ when: "2025", what: "Acme founded" }, { when: "2026", what: "Series A" }] },
        { table: { columns: ["Region", [{ text: "Acme ", bold: true }, { text: "units" }]], rows: [["north", 12], [{ value: "Acme south", colSpan: 1 }, 5]] } },
        { chart: { type: "column", data: { columns: ["Quarter", "Acme revenue"], rows: [["Acme Q1", 12], ["Q2", 18]] } } },
        { image: { src: "asset:logo", alt: "Acme logo" } },
        { code: { source: "const acme = 1;", language: "javascript" } },
      ],
    },
    { id: "three", title: "Left and right", left: { text: "Acme left" }, right: { items: ["Acme right"] }, design: { header: { left: { text: "Acme header" } } } },
  ],
});
const session = () => createEditorSession(deck(), { rejectInvalid: true });

// Fields: everything the spec lists is searched, and nothing that is not text.
{
  const fields = collectSearchFields(deck());
  const labels = fields.map((field) => field.label);
  for (const expected of ["Presentation name", "Presentation description", "Footer center", "Title", "Subtitle", "Tag", "Speaker notes", "Text",
    "List item 1", "List item 2", "List item 3", "Quote", "Quote attribution", "Quote source", "Metric label", "Timeline event 1", "Timeline event 1 date",
    "Table header 1", "Table row 1, column 1", "Table row 2, column 1", "Chart label 2", "Image alt text", "Code", "left · Text", "right · List item 1", "Header left"]) {
    assert.ok(labels.some((label) => label.endsWith(expected)), `searches ${expected}: ${labels.join("; ")}`);
  }
  assert.ok(!fields.some((field) => /asset:|data:|minimal|roboto/.test(field.text)), "never searches asset references or design ids");
  assert.ok(!fields.some((field) => field.label.includes("Metric value")), "a numeric metric value is not text");
  assert.ok(!fields.some((field) => /javascript/.test(field.text)), "language names are not searched");
  assert.equal(collectSearchFields(deck(), { notes: false }).some((field) => field.kind === "notes"), false);
  const slideOnly = collectSearchFields(deck(), { slideIndex: 0 });
  assert.ok(slideOnly.length && slideOnly.every((field) => field.slideIndex === 0), "slideIndex limits the search to one slide and leaves deck fields out");
  for (const field of fields) assert.equal(typeof field.pointer, "string");
  // Paths are the dotted paths the canvas traces.
  assert.ok(fields.some((field) => field.path === "slides.2.left.text"));
  assert.ok(fields.some((field) => field.path === "slides.1.blocks.0.items.1.text"));
  assert.ok(fields.some((field) => field.path === "slides.1.blocks.4.table.rows.1.0.value"));
}

// Options.
{
  const d = deck();
  const base = findMatches(d, "acme");
  const exact = findMatches(d, "acme", { matchCase: true });
  assert.ok(base.matches.length > exact.matches.length, "case-insensitive by default, match case narrows");
  assert.equal(exact.matches.filter((match) => match.text !== "acme").length, 0);
  const lower = findMatches({ slides: [{ title: "Cat concatenate cat." }] }, "cat", { wholeWord: true });
  assert.deepEqual(lower.matches.map((match) => match.start), [0, 16], "whole word skips concatenate");
  assert.equal(findMatches({ slides: [{ title: "snake_case snake" }] }, "snake", { wholeWord: true }).matches.length, 1, "an underscore is a word character");
  const regex = findMatches({ slides: [{ title: "Q1 and Q22 and Qx" }] }, "Q\\d+", { regex: true });
  assert.deepEqual(regex.matches.map((match) => match.text), ["Q1", "Q22"]);
  assert.equal(findMatches({ slides: [{ title: "a.b" }] }, "a.b").matches.length, 1, "literal queries escape the dot");
  assert.equal(findMatches({ slides: [{ title: "axb" }] }, "a.b").matches.length, 0);
  assert.equal(findMatches({ slides: [{ title: "axb" }] }, "a.b", { regex: true }).matches.length, 1);
  const bad = findMatches(d, "(", { regex: true });
  assert.match(bad.error, /^Not a valid regular expression/);
  assert.deepEqual(bad.matches, []);
  assert.equal(compileSearch("").empty, true);
  assert.equal(findMatches(d, "").matches.length, 0);
  assert.equal(findMatches({ slides: [{ title: "abc" }] }, "x*", { regex: true }).matches.length, 0, "empty matches are skipped");
  assert.equal(findMatches({ slides: [{ title: "Straße Δελτα" }] }, "δελτα").matches.length, 1, "case-insensitive for non-Latin text");
  const spans = findMatches({ slides: [{ title: "line one\nline two" }] }, "^line", { regex: true });
  assert.equal(spans.matches.length, 2, "^ matches at every line start");
  const wide = findMatches({ slides: [{ title: "x".repeat(MAX_MATCHES + 5) }] }, "x");
  assert.equal(wide.matches.length, MAX_MATCHES);
  assert.equal(wide.truncated, true);
}

// A run array is searched as its joined text, with context for the results list.
{
  const result = findMatches(deck(), "Acme is the best", { matchCase: true });
  assert.equal(result.matches.length, 1, "a phrase that crosses runs is one match");
  const across = findMatches(deck(), "Acme is", { matchCase: true });
  const hit = across.matches.find((match) => match.path === "slides.0.text");
  assert.ok(hit, "a phrase across the bold and italic runs is found");
  assert.equal(hit.runs, true);
  assert.deepEqual([hit.start, hit.end], [0, 7]);
  assert.equal(hit.context.after.startsWith("the best") || hit.context.after.startsWith(" the best") || hit.context.after.includes("best"), true);
}

// Run-aware replacement: inside one run, across runs, formatting kept.
{
  const runs = [{ text: "Hello ", bold: true }, { text: "big ", italic: true }, "world and Hello again"];
  assert.deepEqual(applyTextEdits(runs, [{ start: 0, end: 5, replacement: "Howdy" }]), [{ text: "Howdy ", bold: true }, { text: "big ", italic: true }, "world and Hello again"], "inside one run");
  // Across the bold and italic runs: the replacement takes the first matched character's run (bold).
  assert.deepEqual(applyTextEdits(runs, [{ start: 3, end: 8, replacement: "p" }]), [{ text: "Help", bold: true }, { text: "g ", italic: true }, "world and Hello again"], "across two runs the first run's formatting wins");
  // A match covering one whole run and the start of the next removes the emptied run.
  assert.deepEqual(applyTextEdits(runs, [{ start: 0, end: 8, replacement: "X" }]), [{ text: "X", bold: true }, { text: "g ", italic: true }, "world and Hello again"]);
  assert.deepEqual(applyTextEdits(runs, [{ start: 6, end: 10, replacement: "" }]), [{ text: "Hello ", bold: true }, "world and Hello again"], "an emptied run is dropped");
  assert.deepEqual(applyTextEdits(runs, [{ start: 0, end: 10, replacement: "" }]), ["world and Hello again"], "two whole runs removed");
  // All text replaced: one empty run stays.
  assert.deepEqual(applyTextEdits([{ text: "ab", bold: true }], [{ start: 0, end: 2, replacement: "" }]), [{ text: "", bold: true }]);
  // A plain-string run stays a string.
  assert.deepEqual(applyTextEdits(["foo bar", { text: " baz", bold: true }], [{ start: 0, end: 3, replacement: "qux" }]), ["qux bar", { text: " baz", bold: true }]);
  // Several edits over several runs.
  assert.deepEqual(applyTextEdits([{ text: "aa-", bold: true }, { text: "bb-aa", italic: true }], [{ start: 0, end: 2, replacement: "Z" }, { start: 6, end: 8, replacement: "YY" }]),
    [{ text: "Z-", bold: true }, { text: "bb-YY", italic: true }]);
  assert.equal(applyTextEdits("one two one", [{ start: 0, end: 3, replacement: "1" }, { start: 8, end: 11, replacement: "1" }]), "1 two 1");
  // The input is not mutated.
  assert.deepEqual(runs, [{ text: "Hello ", bold: true }, { text: "big ", italic: true }, "world and Hello again"]);
}

// Replace all: one undo step, formatting kept, validation intact.
{
  const editor = session();
  const before = editor.presentation;
  const found = findMatches(before, "Acme");
  assert.ok(found.matches.length >= 20);
  const depth = editor.snapshot().undoDepth;
  const result = replaceAll(editor, "Acme", "Globex");
  assert.equal(result.count, found.matches.length);
  assert.equal(editor.snapshot().undoDepth, depth + 1, "replace all is one undo step");
  assert.equal(editor.validation.valid, true);
  const after = editor.presentation;
  assert.equal(after.name, "Globex review");
  assert.equal(after.slides[0].title, "Globex grows");
  assert.equal(after.slides[0].notes, "Mention Globex first.");
  assert.deepEqual(after.slides[0].text, [{ text: "Globex ", bold: true }, { text: "is the best", italic: true }, " place to work"], "formatting survives");
  assert.equal(after.design.footer.center.text, "Globex confidential");
  assert.equal(after.slides[1].blocks[1].quote.attribution, "A fan of Globex");
  assert.equal(after.slides[1].blocks[0].items[1].level, 1, "list levels survive");
  assert.equal(after.slides[1].blocks[0].items[1].text, "Cost of Globex");
  assert.equal(after.slides[1].blocks[4].table.rows[1][0].value, "Globex south");
  assert.equal(after.slides[1].blocks[4].table.rows[1][0].colSpan, 1);
  assert.equal(after.slides[1].blocks[5].chart.data.columns[1], "Globex revenue");
  assert.equal(after.slides[1].blocks[5].chart.data.rows[0][0], "Globex Q1");
  assert.equal(after.slides[1].blocks[6].image.alt, "Globex logo");
  assert.equal(after.slides[1].blocks[6].image.src, "asset:logo", "references are untouched");
  assert.equal(after.slides[1].blocks[2].metric.value, 98);
  assert.equal(after.slides[2].left.text, "Globex left");
  assert.equal(after.slides[2].design.header.left.text, "Globex header");
  assert.equal(findMatches(after, "Acme").matches.length, 0);
  editor.undo();
  assert.deepEqual(editor.presentation, before, "one undo restores every field");
  editor.redo();
  assert.equal(editor.presentation.name, "Globex review");
  // Nothing found: no history entry.
  const empty = replaceAll(editor, "zzz-not-there", "x");
  assert.equal(empty.count, 0);
  assert.equal(empty.change, null);
}

// Replace one: stale matches are refused, indexes stay valid after each replacement.
{
  const editor = session();
  let found = findMatches(editor.presentation, "Acme");
  const total = found.matches.length;
  const first = found.matches[0];
  const depth = editor.snapshot().undoDepth;
  replaceMatch(editor, first, "Acme", "Globex");
  assert.equal(editor.snapshot().undoDepth, depth + 1);
  found = findMatches(editor.presentation, "Acme");
  assert.equal(found.matches.length, total - 1);
  assert.throws(() => replaceMatch(editor, first, "Acme", "Globex"), (error) => error.code === "stale-match");
  // Two matches in one field: replacing the first leaves the second at a new offset.
  const two = createEditorSession({ slides: [{ title: "cat and cat" }] });
  const [one] = findMatches(two.presentation, "cat").matches;
  replaceMatch(two, one, "cat", "elephant");
  assert.equal(two.presentation.slides[0].title, "elephant and cat");
  const [rest] = findMatches(two.presentation, "cat").matches;
  assert.equal(rest.start, 13);
  replaceMatch(two, rest, "cat", "x");
  assert.equal(two.presentation.slides[0].title, "elephant and x");
  two.undo();
  two.undo();
  assert.equal(two.presentation.slides[0].title, "cat and cat");
}

// Rich text: a match inside a run and across runs, through the session.
{
  const editor = createEditorSession({ slides: [{ title: "T", text: [{ text: "The ", bold: true }, { text: "quick ", italic: true }, { text: "brown", underline: true }, " fox"] }] });
  replaceAll(editor, "quick", "slow");
  assert.deepEqual(editor.presentation.slides[0].text, [{ text: "The ", bold: true }, { text: "slow ", italic: true }, { text: "brown", underline: true }, " fox"]);
  replaceAll(editor, "slow brown", "red");
  assert.deepEqual(editor.presentation.slides[0].text, [{ text: "The ", bold: true }, { text: "red", italic: true }, " fox"], "the replacement takes the first run's formatting; the emptied run goes");
  editor.undo();
  assert.equal(editor.presentation.slides[0].text[1].text, "slow ");
}

// Regular expression replacements.
{
  const editor = createEditorSession({ slides: [{ title: "Q1 2026 and Q2 2027" }] });
  replaceAll(editor, "Q(\\d) (\\d{4})", "$2-Q$1", { regex: true });
  assert.equal(editor.presentation.slides[0].title, "2026-Q1 and 2027-Q2");
  replaceAll(editor, "(?<year>\\d{4})", "[$<year>|$&|$$]", { regex: true });
  assert.equal(editor.presentation.slides[0].title, "[2026|2026|$]-Q1 and [2027|2027|$]-Q2");
  // Without the regex option a $ in the replacement is literal.
  const literal = createEditorSession({ slides: [{ title: "price" }] });
  replaceAll(literal, "price", "$1 $&");
  assert.equal(literal.presentation.slides[0].title, "$1 $&");
  assert.throws(() => replaceAll(literal, "(", "x", { regex: true }), (error) => error.code === "invalid-search");
  // A group number the pattern does not have stays literal.
  const unknown = createEditorSession({ slides: [{ title: "ab" }] });
  replaceAll(unknown, "(a)", "$1$3", { regex: true });
  assert.equal(unknown.presentation.slides[0].title, "a$3b");
}

// A plan is refused when the text changed since the search.
{
  const editor = createEditorSession({ slides: [{ title: "T", quote: { text: "keep", attribution: "x" } }] }, { rejectInvalid: true });
  const stale = findMatches(editor.presentation, "keep").matches;
  const plan = planReplace(editor.presentation, stale, "");
  assert.equal(plan.patches.length, 1);
  editor.set("slides.0.quote.text", "other");
  assert.throws(() => planReplace(editor.presentation, stale, "x"), (error) => error.code === "stale-match");
  // A replacement the schema rejects changes nothing (an empty required list item is still valid text, so use a bad run).
  const strict = createEditorSession({ slides: [{ title: "T" }] }, { rejectInvalid: true });
  assert.throws(() => strict.applyPatch([{ op: "replace", path: "/slides/0/title", value: 5 }], { rejectInvalid: true }));
  assert.equal(strict.presentation.slides[0].title, "T");
}

// Slide scope.
{
  const editor = session();
  const result = replaceAll(editor, "Acme", "Globex", { slideIndex: 2 });
  assert.equal(result.count, 3);
  assert.equal(editor.presentation.slides[2].left.text, "Globex left");
  assert.equal(editor.presentation.slides[0].title, "Acme grows");
  assert.equal(editor.presentation.name, "Acme review");
}

// FA-31: a variable token is not text. Searching never offers a match inside `{{slide.number}}` (or any other token), so a replace cannot
// turn it into literal text such as "{{slide.no.}}" that no check would flag; the text around a token is searched and replaced as usual.
{
  const tokens = () => ({
    name: "Acme",
    design: { footer: { right: { text: "Page {{slide.number}} of {{ deck.slideCount }} · Acme" }, left: { text: "{{organization.name}} number" } } },
    organization: { id: "acme", name: "Acme" },
    slides: [{ id: "one", title: "Slide {{slide.number}}: Acme", section: "Acme part", text: [{ text: "see {{slide.section}} and ", bold: true }, "slide.number written \\{{customer}}"] }],
  });
  const editor = createEditorSession(tokens(), { rejectInvalid: true });
  const slidePaths = (query) => findMatches(editor.presentation, query).matches.map((match) => `${match.path}@${match.start}`);
  // "number" appears in the token and in plain text: only the plain text is found.
  assert.deepEqual(slidePaths("number"), ["design.footer.left.text@22", "slides.0.text@32"], "matches inside tokens are not offered");
  // Words of the token's name, a match that starts before a token and runs into it, and the token's braces are not matches either.
  assert.deepEqual(slidePaths("deck.slideCount"), []);
  assert.deepEqual(slidePaths("of {{ deck"), []);
  assert.deepEqual(slidePaths("{{slide.number}}"), []);
  assert.deepEqual(slidePaths("Page {{"), []);
  assert.deepEqual(findMatches(editor.presentation, "{{", { regex: false }).matches.length, 1, "an escaped \\{{ is literal text and is found");
  // Replacing "number" changes the plain text only; every token is intact, the document stays valid, and one undo restores it.
  const before = editor.presentation;
  const depth = editor.snapshot().undoDepth;
  const result = replaceAll(editor, "number", "no.");
  assert.equal(result.count, 2);
  assert.equal(editor.presentation.design.footer.left.text, "{{organization.name}} no.");
  assert.equal(editor.presentation.design.footer.right.text, "Page {{slide.number}} of {{ deck.slideCount }} · Acme");
  assert.equal(editor.presentation.slides[0].title, "Slide {{slide.number}}: Acme");
  assert.deepEqual(editor.presentation.slides[0].text, [{ text: "see {{slide.section}} and ", bold: true }, "slide.no. written \\{{customer}}"]);
  assert.equal(editor.validation.valid, true);
  assert.equal(editor.snapshot().undoDepth, depth + 1);
  editor.undo();
  assert.deepEqual(editor.presentation, before);
  // "slide" and "Acme" are found around the tokens, never in them; replacing them leaves every token as written.
  replaceAll(editor, "slide", "page");
  assert.equal(editor.presentation.slides[0].title, "page {{slide.number}}: Acme", "only the word outside the token changes");
  assert.equal(editor.presentation.design.footer.right.text, "Page {{slide.number}} of {{ deck.slideCount }} · Acme");
  assert.equal(replaceAll(editor, "Acme", "Globex").count, 4);
  assert.equal(editor.presentation.design.footer.left.text, "{{organization.name}} number");
  assert.equal(editor.presentation.design.footer.right.text, "Page {{slide.number}} of {{ deck.slideCount }} · Globex");
  assert.equal(editor.presentation.slides[0].section, "Globex part");
  // A regular expression is held to the same rule: a pattern that would cut through a token skips it.
  assert.deepEqual(findMatches(editor.presentation, "slide\\.\\w+", { regex: true }).matches, [], "every slide.* left in the document is inside a token");
  const regex = findMatches(editor.presentation, "page\\.\\w+", { regex: true });
  assert.deepEqual(regex.matches.map((match) => [match.path, match.text]), [["slides.0.text", "page.number"]], "the plain text is still found");
}

console.log("find-replace: ok");
