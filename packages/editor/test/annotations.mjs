// RR-34: captions, references, citations and footnotes as validated, undoable session edits; the
// numbering the engines draw; the preview draws the result and the PPTX export carries it.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import {
  CAPTIONABLE_FIELDS,
  addReference,
  captionTargets,
  citeRun,
  listCitations,
  listReferences,
  prepareCaption,
  prepareCite,
  prepareReferenceRemoval,
  readCaption,
  referencesSlideFor,
  removeReference,
  runAt,
  setCaption,
  setFootnote,
  unciteRun,
  updateReference,
} from "../dist/annotations.js";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=";
const deck = () => ({
  name: "Annotations fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  references: [{ id: "gartner", text: "Gartner, Market Guide, 2026", url: "https://example.com/g" }],
  slides: [
    { id: "intro", title: "Intro", text: ["Growth was strong", { text: " and margins held", bold: true }] },
    { id: "media", title: "Media", blocks: [{ image: png }, { table: { columns: ["A"], rows: [[1]] } }, { text: "Not captionable" }] },
    { id: "list", title: "List", items: [{ text: ["Point ", { text: "one", cite: "gartner" }], description: ["why"] }, "plain"] },
    { id: "root", title: "Root chart", chart: { type: "bar", data: { columns: ["x", "y"], rows: [["p", 1]] } } },
  ],
});
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };
const throws = (fn, code) => { try { fn(); } catch (error) { assert.equal(error.code, code, error.message); checks += 1; return; } assert.fail(`expected ${code}`); };

// Captions: every captionable block, set, read, short and object forms, remove, undo.
{
  const editor = createEditorSession(deck());
  const targets = captionTargets(editor.presentation);
  assert.deepEqual(targets.map((target) => [target.blockPath, target.field]), [["slides.1.blocks.0", "image"], ["slides.1.blocks.1", "table"], ["slides.3", "chart"]]);
  assert.deepEqual([...CAPTIONABLE_FIELDS], ["image", "chart", "table", "video"]);
  const change = setCaption(editor, "slides.1.blocks.0", "Figure 1. Pixel");
  assert.equal(change.changed, true);
  assert.deepEqual(change.patches.map((patch) => patch.op), ["test", "replace"]);
  assert.equal(editor.presentation.slides[1].blocks[0].caption, "Figure 1. Pixel");
  assert.deepEqual(readCaption(editor.presentation, "slides.1.blocks.0").caption, { text: "Figure 1. Pixel", position: "below", align: "left" });
  setCaption(editor, "slides.1.blocks.1", { text: ["Table ", { text: "1", bold: true }], position: "above", align: "center" });
  assert.deepEqual(editor.presentation.slides[1].blocks[1].caption, { text: ["Table ", { text: "1", bold: true }], position: "above", align: "center" });
  setCaption(editor, "slides.3", { text: "Figure 2", position: "below", align: "left" });
  assert.equal(editor.presentation.slides[3].caption, "Figure 2", "default position and alignment store the short form");
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  ok(renderSlideSvg(editor.presentation, 1, { trace: true }).includes('data-opf-caption="above"'), "the preview draws the caption band");
  throws(() => prepareCaption(editor.presentation, "slides.1.blocks.2", "no"), "caption-unsupported");
  throws(() => prepareCaption(editor.presentation, "slides.1", "no"), "caption-unsupported");
  throws(() => prepareCaption(editor.presentation, "slides.1.blocks.0", { text: "x", position: "left" }), "invalid-caption");
  assert.equal(setCaption(editor, "slides.1.blocks.0", "Figure 1. Pixel").changed, false, "same caption is a no-op");
  setCaption(editor, "slides.1.blocks.0", null);
  assert.equal(editor.presentation.slides[1].blocks[0].caption, undefined);
  editor.undo();
  assert.equal(editor.presentation.slides[1].blocks[0].caption, "Figure 1. Pixel", "undo restores the caption");
  editor.undo(); editor.undo(); editor.undo();
  assert.deepEqual(editor.presentation, deck(), "every caption edit undoes");
}

// References: list with numbering, add, update, remove (refused while cited, forced removes the cites).
{
  const editor = createEditorSession(deck());
  assert.deepEqual(listReferences(editor.presentation).map((reference) => [reference.id, reference.cited, reference.number]), [["gartner", true, 1]]);
  addReference(editor, { id: "annual", text: ["Annual report ", { text: "2025", bold: true }] });
  assert.deepEqual(listReferences(editor.presentation).map((reference) => [reference.id, reference.cited]), [["gartner", true], ["annual", false]]);
  throws(() => addReference(editor, { id: "annual", text: "dup" }), "duplicate-reference");
  throws(() => addReference(editor, { id: "", text: "x" }), "invalid-reference");
  throws(() => addReference(editor, { id: "x", text: "" }), "invalid-reference");
  updateReference(editor, "gartner", { text: "Gartner, 2026", url: null });
  assert.deepEqual(editor.presentation.references[0], { id: "gartner", text: "Gartner, 2026" });
  throws(() => updateReference(editor, "nope", { text: "x" }), "unknown-reference");
  throws(() => removeReference(editor, "gartner"), "reference-cited");
  const removal = prepareReferenceRemoval(editor.presentation, "gartner", { force: true });
  assert.deepEqual(removal.removedCites, ["slides.2.items.0.text.1"]);
  removeReference(editor, "gartner", { force: true });
  assert.deepEqual(editor.presentation.references, [{ id: "annual", text: ["Annual report ", { text: "2025", bold: true }] }]);
  assert.deepEqual(editor.presentation.slides[2].items[0].text, ["Point ", "one"], "the forced removal drops the cite and simplifies the run");
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  removeReference(editor, "annual");
  assert.equal(editor.presentation.references, undefined, "an empty list is removed");
  editor.undo(); editor.undo();
  assert.deepEqual(editor.presentation.slides[2].items[0].text, ["Point ", { text: "one", cite: "gartner" }], "undo restores the cite");
}

// Citations and footnotes on runs, with the numbering the engines draw; the preview and export carry them.
{
  const editor = createEditorSession(deck());
  addReference(editor, { id: "annual", text: "Annual report" });
  assert.deepEqual(runAt(editor.presentation, "slides.0.text.0"), { parts: ["slides", "0", "text"], index: 0, run: "Growth was strong" });
  citeRun(editor, "slides.0.text.0", "gartner");
  assert.deepEqual(editor.presentation.slides[0].text[0], { text: "Growth was strong", cite: "gartner" });
  citeRun(editor, "slides.0.text.1", ["annual", "gartner", "annual"]);
  assert.deepEqual(editor.presentation.slides[0].text[1], { text: " and margins held", bold: true, cite: ["annual", "gartner"] });
  setFootnote(editor, "slides.2.items.0.description.0", "Because it matters.");
  assert.deepEqual(editor.presentation.slides[2].items[0].description, [{ text: "why", footnote: "Because it matters." }]);
  throws(() => prepareCite(editor.presentation, "slides.0.text.0", "missing"), "unknown-reference");
  throws(() => prepareCite(editor.presentation, "slides.0.title", "gartner"), "invalid-path");
  throws(() => prepareCite(editor.presentation, "slides.1.blocks.1.table.columns.0", "gartner"), "invalid-path");
  throws(() => setFootnote(editor, "slides.0.text.0", ""), "invalid-footnote");
  const citations = listCitations(editor.presentation);
  assert.deepEqual(citations.notes.map((note) => [note.number, note.kind, note.id ?? note.text]), [[1, "reference", "gartner"], [2, "reference", "annual"], [3, "footnote", "Because it matters."]]);
  assert.deepEqual(citations.slides.map((slide) => [slide.slideIndex, slide.markers.map((marker) => marker.text), slide.notes]), [[0, ["1", "2,1"], [1, 2]], [2, ["1", "3"], [1, 3]]]);
  assert.deepEqual(citations.unused, []);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  const svg = renderSlideSvg(editor.presentation, 0, { trace: true });
  assert.deepEqual([...svg.matchAll(/data-opf-marker="([^"]*)"/g)].map((match) => match[1]), ["1", "2,1"]);
  ok(svg.includes('data-opf-footnotes="slides.0"'), "the preview draws the footnote area");
  const bytes = await pptx.toPptx(editor.presentation, { seed: 1 });
  const imported = await pptx.fromPptx(bytes);
  assert.deepEqual(imported.references, editor.presentation.references);
  assert.equal(imported.slides[0].text[0].cite, "gartner");
  assert.deepEqual(imported.slides[0].text[1].cite, ["annual", "gartner"]);
  assert.equal(imported.slides[2].items[0].description[0].footnote, "Because it matters.");
  unciteRun(editor, "slides.0.text.0");
  assert.equal(editor.presentation.slides[0].text[0], "Growth was strong", "an uncited plain run returns to its string form");
  setFootnote(editor, "slides.2.items.0.description.0", null);
  assert.deepEqual(editor.presentation.slides[2].items[0].description, ["why"]);
  const slide = referencesSlideFor(editor.presentation, { title: "Sources" });
  // After the uncite, the first use is slides.0.text.1 (annual, then gartner): numbers follow the current document.
  assert.deepEqual(slide, { title: "Sources", items: ["1. Annual report", ["2. ", "Gartner, Market Guide, 2026", " ", { text: "https://example.com/g", link: "https://example.com/g" }]] });
  while (editor.snapshot().canUndo) editor.undo();
  assert.deepEqual(editor.presentation, deck(), "every citation edit undoes");
}

console.log(`Annotations passed: ${checks} caption, reference, citation and footnote checks.`);
