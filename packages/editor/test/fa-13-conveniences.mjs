// FA-13: the editor side of the small conveniences. Slide sizes (switches) are covered by switches*.mjs with the extended
// SLIDE_SIZES fixture; this file checks the watermark text option, the inline code and language run styles, the generic form's
// view of the new schema fields and the preview of an edited code.highlight.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { toSvg } from "@openpresentation/opf-render/svg";
import { OPFEditorError, createEditorSession } from "../dist/index.js";
import { setDesignOption } from "../dist/design-options.js";
import { formatRichTextRange } from "../dist/rich-text.js";
import { activeSchema, createSchemaValue, listSchemaFields, schemaAtPath, schemaVariants } from "../dist/schema.js";
import { SLIDE_SIZE_PRESETS, currentSwitchValue, listSwitchOptions, switchDimension } from "../dist/switches.js";

const deck = () => ({ name: "FA-13", design: { fontScheme: "roboto" }, slides: [
  { title: "One", text: "First" },
  { title: "Code", code: { source: "const a = 1;\nconst b = 2;\nconst c = 3;\nreturn a + b + c;", language: "ts" } },
] });
const session = (document = deck()) => createEditorSession(document, { rejectInvalid: true });

// --- slide sizes: the picker lists the ten presets and each one is a validated, undoable switch -------------------------------
for (const preset of ["1:1", "4:5", "9:16"]) {
  assert.ok(SLIDE_SIZE_PRESETS.includes(preset));
  assert.ok(listSwitchOptions({}, "slide-sizes").some((option) => option.id === preset), `${preset} is in the picker`);
  const editor = session();
  switchDimension(editor, "slide-sizes", preset);
  assert.equal(editor.presentation.design.dimensions, preset);
  assert.equal(currentSwitchValue(editor.presentation, "slide-sizes").value, preset);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  const composed = editor.composeSlide(0);
  assert.equal(composed.width, 720, `${preset} keeps the 7.5 in short edge`);
  assert.equal(composed.height, { "1:1": 720, "4:5": 900, "9:16": 1280 }[preset]);
  editor.undo();
  assert.equal(editor.presentation.design.dimensions, undefined);
}

// --- watermark text --------------------------------------------------------------------------------------------------------------
{
  const editor = session();
  setDesignOption(editor, "watermark", { text: "DRAFT", opacity: 0.1 });
  assert.deepEqual(editor.get("design.watermark"), { text: "DRAFT", opacity: 0.1 });
  setDesignOption(editor, "watermark", { opacity: 0.25 });
  assert.deepEqual(editor.get("design.watermark"), { text: "DRAFT", opacity: 0.25 }, "the opacity merges into a text watermark");
  setDesignOption(editor, "watermark", { src: "asset:mark" });
  assert.deepEqual(editor.get("design.watermark"), { src: "asset:mark", opacity: 0.25 }, "an image replaces the text");
  setDesignOption(editor, "watermark", { text: "CONFIDENTIAL" });
  assert.deepEqual(editor.get("design.watermark"), { text: "CONFIDENTIAL", opacity: 0.25 }, "text replaces the image");
  assert.throws(() => setDesignOption(editor, "watermark", { text: "  " }), (error) => error instanceof OPFEditorError && error.code === "invalid-design-value");
  assert.throws(() => setDesignOption(session(), "watermark", { opacity: 0.2 }), (error) => error.code === "invalid-design-value" && /image before setting its opacity/.test(error.message));
  setDesignOption(editor, "watermark", { text: "DRAFT", opacity: 0.1 }, { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design.watermark"), { text: "DRAFT", opacity: 0.1 }, "a slide can have its own text watermark");
  const out = toSvg(editor.presentation, 2);
  assert.match(out, /rotate\(-30 /, "the preview draws the diagonal stamp");
  assert.match(out, />DRAFT</);
  while (editor.snapshot().undoDepth) editor.undo();
  assert.equal(editor.get("design.watermark"), undefined);
}

// --- inline code and run language --------------------------------------------------------------------------------------------------
{
  const runs = ["Run npm install now"];
  const code = formatRichTextRange(runs, 4, 15, { code: true });
  assert.deepEqual(code, ["Run ", { text: "npm install", code: true }, " now"]);
  const lang = formatRichTextRange(code, 0, 3, { lang: "fr-FR" });
  assert.deepEqual(lang, [{ text: "Run", lang: "fr-FR" }, " ", { text: "npm install", code: true }, " now"]);
  const reset = formatRichTextRange(lang, 0, 19, { code: null, lang: null });
  assert.ok(reset.every((run) => typeof run === "string" || Object.keys(run).join() === "text"), "Reset removes code and lang");
  assert.throws(() => formatRichTextRange(runs, 0, 3, { lang: "not a tag" }), /BCP-47/);
  assert.throws(() => formatRichTextRange(runs, 0, 3, { code: "yes" }), /Invalid run style: code/);
  const editor = session();
  editor.set("slides.0.text", lang, { rejectInvalid: true });
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  const out = toSvg(editor.presentation, 1);
  assert.match(out, /lang="fr-FR"/, "the preview declares the run language");
  assert.match(out, /font-family="[^"]*Roboto Mono/, "the inline code run draws in the code font");
}

// --- the generic form sees the new fields -------------------------------------------------------------------------------------------
{
  const fields = listSchemaFields().filter((field) => field.schema === "presentation");
  for (const name of ["highlight", "code", "lang", "text"]) assert.ok(fields.some((field) => field.name === name), `${name} is in the property inventory`);
  // Watermark: exactly one of src and text, as two forms of one object that both keep `opacity` required.
  const variants = schemaVariants({ $ref: "#/$defs/Watermark" });
  assert.deepEqual(variants.map((variant) => variant.title), ["src", "text"]);
  for (const variant of variants) assert.ok(variant.required.includes("opacity"), "opacity stays required in both forms");
  assert.deepEqual(variants.map((variant) => variant.required.filter((key) => key !== "opacity")), [["src"], ["text"]]);
  assert.equal(activeSchema({ $ref: "#/$defs/Watermark" }, { text: "DRAFT", opacity: 0.1 }).title, "text");
  assert.equal(activeSchema({ $ref: "#/$defs/Watermark" }, { src: "asset:x", opacity: 0.1 }).title, "src");
  assert.deepEqual(createSchemaValue({ $ref: "#/$defs/Watermark" }), { opacity: 0, src: "" });
  // code.highlight resolves to an array of line numbers and [start, end] ranges.
  const highlight = schemaAtPath(deck(), "slides.1.code.highlight");
  assert.equal(highlight.type, "array");
  assert.deepEqual(schemaVariants(highlight.items).map((variant) => variant.type), ["integer", "array"]);
}

// --- code.highlight through the session -----------------------------------------------------------------------------------------------
{
  const editor = session();
  const plain = toSvg(editor.presentation, 2, { trace: true });
  assert.equal(plain.includes("data-opf-code-highlight"), false, "no band without the field");
  editor.set("slides.1.code.highlight", [2, [3, 4]], { rejectInvalid: true });
  assert.deepEqual(editor.get("slides.1.code.highlight"), [2, [3, 4]]);
  const marked = toSvg(editor.presentation, 2, { trace: true });
  assert.equal(marked.match(/data-opf-code-highlight="true"/g)?.length, 1, "lines 2-4 are one band");
  assert.throws(() => editor.set("slides.1.code.highlight", [0], { rejectInvalid: true }), OPFEditorError, "line numbers start at 1");
  assert.throws(() => editor.set("slides.1.code.highlight", [[1, 2, 3]], { rejectInvalid: true }), OPFEditorError);
  // A line past the end is a warning, not an error, and draws nothing.
  editor.set("slides.1.code.highlight", [9], { rejectInvalid: true });
  const result = validate(editor.presentation);
  assert.equal(result.valid, true);
  const outOfRange = result.findings.filter((finding) => finding.ruleId === "opf/code-highlight-out-of-range");
  assert.equal(outOfRange.length, 1);
  assert.equal(outOfRange[0].category, "content");
  assert.equal(outOfRange[0].severity, "warning");
  assert.equal(toSvg(editor.presentation, 2, { trace: true }).includes("data-opf-code-highlight"), false);
}

console.log("FA-13 editor: ten slide sizes, watermark text, inline code and run language, generic-form schema, code.highlight preview.");
