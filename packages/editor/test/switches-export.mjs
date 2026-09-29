// FF-16 (font-fidelity-everywhere): exports after a dimension switch pass the FF-08 check.
// The exported package names only the fonts the switched document chose: no leaked
// hard-coded or default fonts in slides, layouts, theme, charts, embedded workbooks or app.xml.
//
// The checker is opf-pptx's `checkPptxTypefaces` (FF-08, opf-pptx#69). It is not in the
// published opf-pptx 0.9.1, so with a published install the check is reported as skipped
// unless OPF_REQUIRE_FF08=1, which turns its absence into a failure. Run it against the
// linked ecosystem (core's scripts/link-ecosystem.mjs) or a current opf-pptx build.
import assert from "node:assert/strict";
import * as pptx from "@openpresentation/opf-pptx";
import * as core from "@openpresentation/opf";
const { catalogs } = core;
import { createEditorSession, resolveSlideFonts } from "../dist/index.js";
import { switchDimension } from "../dist/switches.js";
import { baseDeck, cases } from "./switch-fixture.mjs";

const { toPptx, checkPptxTypefaces } = pptx;
const checkerAvailable = typeof checkPptxTypefaces === "function";
if (!checkerAvailable && process.env.OPF_REQUIRE_FF08 === "1")
  throw new Error("OPF_REQUIRE_FF08=1 but the installed @openpresentation/opf-pptx has no checkPptxTypefaces (FF-08).");

// The fixture plus a code slide, so the code font is exercised too.
const deck = () => {
  const document = baseDeck();
  document.slides.push({ id: "code", layout: "code-1x", title: "Rule", code: { source: "const score = urgency * confidence;", language: "ts" } });
  return document;
};
const schemeRecord = (document, id) =>
  document.catalogs?.fontSchemes?.records?.find((record) => record.id === id) ?? catalogs.fontSchemes.find((record) => record.id === id);

function chosenFonts(document) {
  const fonts = new Set();
  const monospace = new Set();
  document.slides.forEach((slide, index) => {
    const resolved = resolveSlideFonts(document, index);
    for (const family of Object.values(resolved)) fonts.add(family);
    monospace.add(resolved.code);
    // Core with the FF-18 language model also chooses East Asian and complex-script fonts.
    if (typeof core.resolveScriptFonts === "function") {
      const script = core.resolveScriptFonts(document, { slideIndex: index });
      for (const slots of [script.heading, script.body, script.supplement && { heading: script.supplement.heading, body: script.supplement.body }])
        for (const family of Object.values(slots ?? {})) if (family) fonts.add(family);
    }
  });
  // A monospace scheme's heading and body are fixed-pitch too.
  const reference = (index) => document.slides[index]?.design?.fontScheme ?? document.design?.fontScheme;
  document.slides.forEach((_, index) => {
    const value = reference(index);
    const record = schemeRecord(document, typeof value === "string" ? value : value?.id);
    if (record?.type === "monospace") {
      const resolved = resolveSlideFonts(document, index);
      monospace.add(resolved.heading);
      monospace.add(resolved.body);
    }
  });
  return { fonts: [...fonts], monospace: [...monospace] };
}

let checked = 0;
let exported = 0;
async function verify(document, label, expectFonts) {
  const bytes = await toPptx(structuredClone(document), { strictAssets: true });
  exported += 1;
  assert.ok(bytes.byteLength > 0, `${label}: export produced a package`);
  if (!checkerAvailable) return;
  const { fonts, monospace } = chosenFonts(document);
  const result = checkPptxTypefaces(bytes, { fonts, monospace });
  assert.deepEqual(result.violations, [], `${label}: FF-08 typeface check`);
  for (const family of expectFonts ?? []) assert.ok(result.fontsUsed.includes(family), `${label}: the export uses ${family}`);
  checked += 1;
}

// Every dimension: after the switch, after undo and after redo.
for (const { dimension, value, options, fonts } of cases) {
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  const original = editor.document;
  await verify(original, `${dimension} before`);
  switchDimension(editor, dimension, value, options);
  const switched = editor.document;
  await verify(switched, `${dimension} after switch`, fonts && Object.values(fonts));
  editor.undo();
  assert.deepEqual(editor.document, original);
  await verify(editor.document, `${dimension} after undo`);
  editor.redo();
  assert.deepEqual(editor.document, switched);
  await verify(editor.document, `${dimension} after redo`, fonts && Object.values(fonts));
}

// Font schemes with distinct roles: bundled ids, and a gallery record with a code role.
for (const [id, record, expected] of [
  ["consolas", undefined, ["Consolas"]],
  ["courier-new", undefined, ["Courier New"]],
  ["times-new-roman", undefined, ["Times New Roman"]],
  ["team-mono", { id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter", code: { family: "JetBrains Mono" } }, ["Inter", "JetBrains Mono"]],
]) {
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  switchDimension(editor, "font-schemes", id, record ? { record } : {});
  await verify(editor.document, `font scheme ${id}`, expected);
  // A per-slide switch on the code slide names both the deck's and the slide's fonts.
  const mixed = createEditorSession(deck(), { rejectInvalid: true });
  switchDimension(mixed, "font-schemes", id, { slideIndex: 3, ...(record ? { record } : {}) });
  await verify(mixed.document, `slide font scheme ${id}`, [...expected, "Aptos"]);
}

// Negative control: the check tells the deck's old fonts from the switched ones, so a passing
// export really follows the switch.
if (checkerAvailable) {
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  switchDimension(editor, "font-schemes", "georgia");
  const bytes = await toPptx(editor.document, { strictAssets: true });
  const stale = checkPptxTypefaces(bytes, { fonts: ["Aptos", "Aptos Display", "Roboto Mono"], monospace: ["Roboto Mono"] });
  assert.ok(stale.violations.some((violation) => violation.typeface === "Georgia"), "Georgia is reported when only the old fonts are allowed");
  assert.ok(!stale.inventory.typefaces.some((entry) => entry.typeface === "Aptos" && entry.part.startsWith("ppt/slides/")), "no slide keeps the old body font");
}

// Every switch in one session, in gallery order, then unwound.
{
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  const original = editor.document;
  for (const { dimension, value, options } of cases) switchDimension(editor, dimension, value, options);
  assert.equal(editor.snapshot().undoDepth, cases.length);
  await verify(editor.document, "all dimensions switched", ["Tenorite", "Tenorite Display"]);
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.document, original);
  await verify(editor.document, "all dimensions undone", ["Aptos", "Aptos Display"]);
}

console.log(
  checkerAvailable
    ? `Exports after switches passed the FF-08 typeface check: ${checked} packages checked.`
    : `Exports after switches built ${exported} packages. FF-08 typeface check SKIPPED: the installed opf-pptx has no checkPptxTypefaces (set OPF_REQUIRE_FF08=1 to require it).`,
);
