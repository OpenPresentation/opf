// FA-10: rich headline text in the editor model. A TextRun[] title, subtitle, tag and quote text are ordinary rich-text values:
// formatted, cited and read back like body runs, shown in outlines and slide lists by their plain text, and found by find and replace.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { formatRichTextRange } from "../dist/rich-text.js";
import { citeRun, addReference, listCitations, setFootnote } from "../dist/annotations.js";
import { readOutline, prepareSetOutlineText } from "../dist/outline.js";
import { slideTitle, slideSummaries } from "../dist/slides.js";
import { collectSearchFields, findMatches, replaceAll } from "../dist/find-replace.js";

const deck = () => ({
  name: "Rich headings",
  references: [{ id: "r0", text: "Seed reference" }],
  slides: [
    { id: "a", tag: "Q3", title: ["Revenue grew ", { text: "28%", color: "accent1" }], subtitle: [{ text: "Read the ", bold: true }, "report"], quote: { text: ["One ", { text: "two", italic: true }] } },
    { id: "b", title: "Plain title", text: "Body" },
  ],
});
const valid = (document) => assert.equal(validate(document, { only: ["format"] }).valid, true, JSON.stringify(validate(document, { only: ["format"] }).findings.slice(0, 2)));
const editor = createEditorSession(deck(), { rejectInvalid: true });
valid(editor.presentation);

// A plain heading converts to runs and formats like body text (the canvas "Format text" button does exactly this).
editor.set("slides.1.title", ["Plain title"], { source: "test" });
const formatted = formatRichTextRange(editor.get("slides.1.title"), 0, 5, { bold: true });
editor.set("slides.1.title", formatted, { source: "test" });
assert.deepEqual(editor.get("slides.1.title"), [{ text: "Plain", bold: true }, " title"]);
valid(editor.presentation);

// A title run takes a citation and a footnote through the same helpers as body runs; the deck numbering counts headings first.
addReference(editor, { id: "r1", text: "Annual report" });
citeRun(editor, "slides.0.title.1", "r1");
setFootnote(editor, "slides.0.subtitle.1", "An inline note.");
assert.deepEqual(editor.get("slides.0.title.1"), { text: "28%", color: "accent1", cite: "r1" });
assert.deepEqual(editor.get("slides.0.subtitle.1"), { text: "report", footnote: "An inline note." });
citeRun(editor, "slides.0.quote.text.1", "r1");
assert.equal(editor.get("slides.0.quote.text.1").cite, "r1");
valid(editor.presentation);
const citations = listCitations(editor.presentation);
assert.deepEqual(citations.slides[0].markers.map((marker) => [marker.path, marker.text]), [["slides.0.title.1", "1"], ["slides.0.subtitle.1", "2"], ["slides.0.quote.text.1", "1"]]);
assert.throws(() => citeRun(editor, "slides.0.design.title.0", "r1"), /not a run|invalid/i);

// Outline and slide lists show a run title by its plain text and do not offer to flatten it.
const rows = readOutline(editor.presentation).rows;
const slideRow = rows.find((row) => row.key === "slide:slides.0");
assert.equal(slideRow.text, "Revenue grew 28%");
assert.equal(slideRow.editable, false);
assert.equal(rows.find((row) => row.key === "subtitle:slides.0.subtitle").text, "Read the report");
assert.equal(rows.find((row) => row.key === "subtitle:slides.0.subtitle").editable, false);
assert.throws(() => prepareSetOutlineText(editor.presentation, "slide:slides.0", "Flattened"), /./);
assert.equal(slideTitle(editor.presentation.slides[0]), "Revenue grew 28%");
assert.equal(slideSummaries(editor.presentation)[0].title, "Revenue grew 28%");

// Find and replace reaches heading runs and a quote's runs, keeping each run's formatting.
const fields = collectSearchFields(editor.presentation);
assert.ok(fields.some((field) => field.path === "slides.0.title" && field.runs), "the title is a searchable run field");
assert.ok(fields.some((field) => field.path === "slides.0.quote.text" && field.runs));
const matches = findMatches(editor.presentation, "grew").matches;
assert.equal(matches.length, 1);
replaceAll(editor, "grew", "rose");
assert.equal(editor.get("slides.0.title")[0], "Revenue rose ");
assert.equal(editor.get("slides.0.title")[1].color, "accent1");
valid(editor.presentation);

console.log("Rich headings: formatting, citations, outline and slide lists, find and replace.");
