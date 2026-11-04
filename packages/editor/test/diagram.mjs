// The `diagram` content kind in the editor: inserting and replacing a block, editing its Mermaid source and alt text, find and replace,
// the outline chip, the scene labels, the Markdown ```mermaid fence in the source editor (completion, hover, quick fix) and a diagram
// whose source does not parse (it must never crash a model). Real core, real schemas, the default catalog.
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { gallery } from "@openpresentation/gallery";
import { fromMarkdown } from "@openpresentation/opf/markdown";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { createContentBlock, listBlockContainers, prepareBlockInsert } from "../dist/blocks.js";
import { collectSearchFields, findMatches, replaceAll } from "../dist/find-replace.js";
import { readOutline } from "../dist/outline.js";
import { describeBlock, contentFieldsOf } from "../dist/slide-scene.js";
import { getEditableFields, isDiagramSource } from "../dist/canvas-fields.js";
import { switchDimension, listSwitchOptions } from "../dist/switches.js";
import { analyze } from "../dist/source-navigation-model.js";
import { completionResult, hoverModelAt } from "../dist/source-completions.js";
import { applySourceEdits } from "../dist/source-fixes.js";
import { syntaxFixesFor } from "../dist/source-fixes-syntax.js";
import { STUDIO_INSERT_KINDS, STUDIO_INSERT_LABELS, STUDIO_INSERT_HINTS } from "../dist/studio-commands.js";
import { LAYOUT_REGION_KINDS } from "../dist/layout-templates.js";
import { sampleBlock } from "../dist/layout-samples.js";

const FLOW = "flowchart LR\n  Plan --> Build --> Ship";
const deck = () => ({
  name: "Diagrams",
  design: { theme: "classic", fontScheme: "roboto" },
  slides: [
    { id: "one", title: "Process", diagram: FLOW },
    { id: "two", title: "Blocks", blocks: [{ text: "Intro" }, { diagram: { source: "sequenceDiagram\n  Ana->>Bo: Hello", alt: "Ana greets Bo" } }] },
    { id: "bad", title: "Broken", diagram: "flowchart LR\n  A -->" },
  ],
});
const valid = (presentation) => assert.equal(validate(presentation, { only: ["format"] }).valid, true, JSON.stringify(validate(presentation, { only: ["format"] }).findings.slice(0, 2)));

// ---- the sample, insert and replace -------------------------------------------------------------------------------------------------------------
const sample = createContentBlock("diagram");
assert.equal(typeof sample.diagram, "string");
assert.ok(sample.diagram.startsWith("flowchart LR\n"), "a small process flowchart");
assert.notEqual(createContentBlock("diagram"), sample, "each call is a fresh copy");
{
  const base = deck();
  assert.ok(listBlockContainers(base, { includeImplicit: true }).some((container) => container.path === "/slides/1"));
  const inserted = prepareBlockInsert(base, "slides.1", createContentBlock("diagram"), 1);
  assert.equal(inserted.path, "/slides/1/blocks/1");
  assert.equal(inserted.presentation.slides[1].blocks[1].diagram, sample.diagram);
  valid(inserted.presentation);
  // A slide whose diagram is written on the slide becomes blocks, keeping the diagram.
  const implicit = prepareBlockInsert(base, "slides.0", { text: "Beside it" }, 1);
  assert.deepEqual(implicit.presentation.slides[0].blocks, [{ diagram: FLOW }, { text: "Beside it" }]);
  valid(implicit.presentation);
}
{
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  switchDimension(editor, "blocks", "diagram", { path: "slides.1.blocks.0" });
  assert.equal(editor.get("slides.1.blocks.0.diagram"), sample.diagram);
  assert.equal(editor.get("slides.1.blocks.0.text"), undefined, "replacement discards the old payload");
  editor.undo();
  assert.equal(editor.get("slides.1.blocks.0.text"), "Intro");
  assert.ok(listSwitchOptions(editor.presentation, "blocks").some((option) => option.id === "diagram" && option.label === "Diagram"));
}

// ---- editing the source and the alt text ---------------------------------------------------------------------------------------------------------
{
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  editor.set("slides.0.diagram", "flowchart TB\n  A --> B");
  assert.equal(editor.get("slides.0.diagram"), "flowchart TB\n  A --> B");
  editor.set("slides.1.blocks.1.diagram.source", "sequenceDiagram\n  Ana->>Bo: Hi");
  editor.set("slides.1.blocks.1.diagram.alt", "Ana says hi to Bo");
  assert.equal(editor.get("slides.1.blocks.1.diagram.alt"), "Ana says hi to Bo");
  valid(editor.presentation);
  editor.undo();
  assert.equal(editor.get("slides.1.blocks.1.diagram.alt"), "Ana greets Bo");
  // The canvas form: a string diagram is one multi-line field, an object's source too; the alt is a plain field.
  const string = getEditableFields(editor.get("slides.0.diagram"), "slides.0.diagram");
  assert.deepEqual(string.fields.map(isDiagramSource), [true]);
  const object = getEditableFields(editor.get("slides.1.blocks.1.diagram"), "slides.1.blocks.1.diagram");
  assert.deepEqual(object.fields.map((field) => [field.label, isDiagramSource(field)]), [["source", true], ["alt", false]]);
  assert.equal(isDiagramSource({ path: "/slides/0/code/source", type: "string" }), false, "a code source is not Mermaid");
}

// ---- find and replace ----------------------------------------------------------------------------------------------------------------------------
{
  const fields = collectSearchFields(deck()).filter((field) => /iagram/.test(field.label) || field.kind === "diagram");
  assert.deepEqual(fields.map((field) => [field.pointer, field.label, field.kind]), [
    ["/slides/0/diagram", "Diagram", "diagram"],
    ["/slides/1/blocks/1/diagram/source", "Block 2 · Diagram", "diagram"],
    ["/slides/1/blocks/1/diagram/alt", "Block 2 · Diagram alt text", "alt"],
    ["/slides/2/diagram", "Diagram", "diagram"],
  ]);
  assert.equal(findMatches(deck(), "Build").matches.length, 1);
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  const done = replaceAll(editor, "Ana", "Cy", { matchCase: true });
  assert.equal(done.count, 2, "one in the source, one in the alt text");
  assert.equal(editor.get("slides.1.blocks.1.diagram.source"), "sequenceDiagram\n  Cy->>Bo: Hello");
  assert.equal(editor.get("slides.1.blocks.1.diagram.alt"), "Cy greets Bo");
  editor.undo();
  assert.equal(editor.get("slides.1.blocks.1.diagram.alt"), "Ana greets Bo");
}

// ---- the outline and the scene labels ------------------------------------------------------------------------------------------------------------
{
  const rows = readOutline(deck()).rows.filter((row) => row.kind === "other");
  assert.deepEqual(rows.map((row) => [row.slideIndex, row.label, row.editable]), [[0, "Diagram", false], [1, "Diagram", false], [2, "Diagram", false]]);
  assert.equal(describeBlock({ diagram: FLOW }), "Diagram: flowchart LR");
  assert.equal(describeBlock({ diagram: { source: "mindmap\n  root", alt: "Ideas" } }), "Diagram: Ideas");
  assert.equal(describeBlock({ diagram: { source: "mindmap\n  root" } }), "Diagram: mindmap");
  assert.deepEqual(contentFieldsOf({ title: "T", diagram: FLOW }), ["diagram"]);
}

// ---- the insert menus and the layout editor know the kind ------------------------------------------------------------------------------------------
assert.ok(STUDIO_INSERT_KINDS.includes("diagram") && STUDIO_INSERT_LABELS.diagram === "Diagram" && STUDIO_INSERT_HINTS.diagram);
assert.ok(LAYOUT_REGION_KINDS.includes("diagram"));
assert.deepEqual(Object.keys(sampleBlock("diagram", 1)), ["diagram"]);
valid({ ...deck(), slides: [{ id: "s", ...sampleBlock("diagram", 2) }] });

// ---- the Markdown fence in the source editor ----------------------------------------------------------------------------------------------------------
const catalogs = [gallery];
const caret = (doc) => { const at = doc.indexOf("¦"); return { text: doc.slice(0, at) + doc.slice(at + 1), at }; };
const labels = (doc, explicit = true) => {
  const { text, at } = caret(doc);
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit, catalogs, format: "md" });
  return result ? result.options.map((option) => option.label) : null;
};
assert.ok(labels("# A\n\n```¦").includes("mermaid"), "the info word is offered");
assert.deepEqual(labels("# A\n\n```mermaid ¦"), ["alt"], "the attribute of the fence");
assert.equal((labels("# A\n\n```mermaid alt=\"x\" ¦") ?? []).includes("alt"), false, "an attribute already written is not offered again");
assert.equal(labels("# A\n\n```mermaid\nflowchart LR\n  A --> ¦\n```\n"), null, "the body is Mermaid, not OPF");
{
  const text = "# A\n\n```mermaid alt=\"Steps\"\nflowchart LR\n  A --> B\n```\n";
  const hover = hoverModelAt(EditorState.create({ doc: text }), text.indexOf("mermaid") + 2, { catalogs, format: "md" });
  assert.equal(hover.model.title, "diagram");
  assert.ok(hover.model.notes.some((note) => note.includes("```mermaid")));
  const parsed = fromMarkdown(text);
  assert.equal(parsed.presentation.slides[0].diagram.alt, "Steps");
}
{
  // An attribute the fence does not take is removed by its quick fix.
  const text = "# A\n\n```mermaid size=3 alt=\"x\"\nflowchart LR\n  A --> B\n```\n";
  const found = fromMarkdown(text).findings.find((entry) => entry.ruleId === "markdown/diagram-attributes");
  assert.ok(found, "core reports the unknown attribute");
  const fix = syntaxFixesFor("md", text, found)?.fixes[0];
  assert.ok(fix && fix.title === "Remove size");
  assert.equal(applySourceEdits(text, fix.edits), "# A\n\n```mermaid alt=\"x\"\nflowchart LR\n  A --> B\n```\n");
}
{
  // `{{ }}` in Mermaid is a hexagon node, not a variable token.
  const text = "# A\n\n```mermaid\nflowchart LR\n  A{{Decide}} --> B\n```\n";
  const decides = (source) => analyze(source, "md").occurrences.some((occurrence) => occurrence.id === "Decide");
  assert.equal(decides(text), false);
  assert.equal(decides("# {{Decide}}\n"), true, "outside a fence it is a variable");
}

// ---- a diagram with a syntax error never breaks a model -----------------------------------------------------------------------------------------
{
  const broken = deck();
  const editor = createEditorSession(broken, { rejectInvalid: true });
  assert.equal(editor.get("slides.2.diagram"), "flowchart LR\n  A -->");
  editor.set("slides.2.diagram", "flowchart LR\n  A --> B");
  editor.undo();
  assert.equal(describeBlock({ diagram: broken.slides[2].diagram }), "Diagram: flowchart LR");
  assert.ok(collectSearchFields(broken).some((field) => field.pointer === "/slides/2/diagram"));
  assert.ok(readOutline(broken).rows.some((row) => row.slideIndex === 2 && row.label === "Diagram"));
  const findings = validate(broken, { only: ["format"] }).findings.filter((finding) => /diagram/.test(String(finding.path ?? finding.pointer ?? "")));
  assert.ok(findings.length <= 1, "the syntax error is a finding about the diagram, not a crash");
}
// Something that is not a diagram value is left alone by every reader.
assert.deepEqual(collectSearchFields({ slides: [{ diagram: 7 }] }), []);
assert.equal(describeBlock({ diagram: 7 }), "Diagram");

console.log("Diagram passed: sample and insert, replace and undo, source and alt editing, canvas form fields, find and replace, outline and scene labels, menus, the mermaid fence (completion, hover, quick fix) and broken sources.");
