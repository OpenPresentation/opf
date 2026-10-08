// FF-16 (font-fidelity-everywhere): exports after a dimension switch pass the FF-08 check.
// The exported package names only the fonts the switched document chose: no leaked
// hard-coded or default fonts in slides, layouts, theme, charts, embedded workbooks or app.xml.
//
// The checker is opf-pptx's `checkTypefaces` (FF-08, opf-pptx#69).
import assert from "node:assert/strict";
import * as pptx from "@openpresentation/opf-pptx";
import { resolveReference, resolveSlideContext } from "@openpresentation/opf";
import { resolveScriptFonts } from "@openpresentation/opf/composition";
import { createEditorSession } from "../dist/index.js";
import { switchDimension } from "../dist/switches.js";
import { SLIDE_SIZES, baseDeck, cases, catalogs } from "./switch-fixture.mjs";

const { toPptx, fromPptx, checkTypefaces } = pptx;
// RR-17: jszip is a test dependency of its own (opf-pptx 0.13 no longer installs it).
import JSZip from 'jszip';

// The fixture plus a code slide, so the code font is exercised too.
const deck = () => {
  const presentation = baseDeck();
  presentation.slides.push({ id: "code", layout: "code-1x", title: "Rule", code: { source: "const score = urgency * confidence;", language: "ts" } });
  return presentation;
};
const schemeRecord = (presentation, id) => (id ? resolveReference(presentation, "fontSchemes", id, { catalogs })?.record : undefined);

function chosenFonts(presentation) {
  const fonts = new Set();
  const monospace = new Set();
  presentation.slides.forEach((slide, index) => {
    const resolved = resolveSlideContext(presentation, index, { catalogs }).options.fontFamilies;
    for (const family of Object.values(resolved)) fonts.add(family);
    monospace.add(resolved.code);
    // The FF-18 language model also chooses East Asian and complex-script fonts.
    const script = resolveScriptFonts(presentation, { slideIndex: index, catalogs });
    for (const slots of [script.heading, script.body, script.supplement && { heading: script.supplement.heading, body: script.supplement.body }])
      for (const family of Object.values(slots ?? {})) if (family) fonts.add(family);
  });
  // A monospace scheme's heading and body are fixed-pitch too.
  const reference = (index) => presentation.slides[index]?.design?.fontScheme ?? presentation.design?.fontScheme;
  presentation.slides.forEach((_, index) => {
    const value = reference(index);
    const record = schemeRecord(presentation, typeof value === "string" ? value : value?.id);
    if (record?.type === "monospace") {
      const resolved = resolveSlideContext(presentation, index, { catalogs }).options.fontFamilies;
      monospace.add(resolved.heading);
      monospace.add(resolved.body);
    }
  });
  return { fonts: [...fonts], monospace: [...monospace] };
}

let checked = 0;
let exported = 0;
async function verify(presentation, label, expectFonts) {
  const bytes = await toPptx(structuredClone(presentation), { strictAssets: true, catalogs });
  exported += 1;
  assert.ok(bytes.byteLength > 0, `${label}: export produced a package`);
  const { fonts, monospace } = chosenFonts(presentation);
  const result = checkTypefaces(bytes, { families: fonts, monospace });
  assert.deepEqual(result.violations, [], `${label}: FF-08 typeface check`);
  for (const family of expectFonts ?? []) assert.ok(result.fontsUsed.includes(family), `${label}: the export uses ${family}`);
  checked += 1;
}

// Every dimension: after the switch, after undo and after redo.
for (const { dimension, value, options, fonts } of cases) {
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  const original = editor.presentation;
  await verify(original, `${dimension} before`);
  switchDimension(editor, dimension, value, options);
  const switched = editor.presentation;
  await verify(switched, `${dimension} after switch`, fonts && Object.values(fonts));
  editor.undo();
  assert.deepEqual(editor.presentation, original);
  await verify(editor.presentation, `${dimension} after undo`);
  editor.redo();
  assert.deepEqual(editor.presentation, switched);
  await verify(editor.presentation, `${dimension} after redo`, fonts && Object.values(fonts));
}

// Font schemes with distinct roles: bundled ids, and a gallery record with a code role.
for (const [id, record, expected] of [
  ["consolas", undefined, ["Consolas"]],
  ["courier-new", undefined, ["Courier New"]],
  ["times-new-roman", undefined, ["Times New Roman"]],
  ["team-mono", { id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter", code: "JetBrains Mono" }, ["Inter", "JetBrains Mono"]],
]) {
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  switchDimension(editor, "font-schemes", id, record ? { record } : {});
  await verify(editor.presentation, `font scheme ${id}`, expected);
  // A per-slide switch on the code slide names both the deck's and the slide's fonts.
  const mixed = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  switchDimension(mixed, "font-schemes", id, { slideIndex: 3, ...(record ? { record } : {}) });
  await verify(mixed.presentation, `slide font scheme ${id}`, [...expected, "Aptos"]);
}

// Negative control: the check tells the deck's old fonts from the switched ones, so a passing
// export really follows the switch.
{
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  switchDimension(editor, "font-schemes", "georgia");
  const bytes = await toPptx(editor.presentation, { strictAssets: true, catalogs });
  const stale = checkTypefaces(bytes, { families: ["Aptos", "Aptos Display", "Roboto Mono"], monospace: ["Roboto Mono"] });
  assert.ok(stale.violations.some((violation) => violation.typeface === "Georgia"), "Georgia is reported when only the old fonts are allowed");
  assert.ok(!stale.inventory.typefaces.some((entry) => entry.typeface === "Aptos" && entry.part.startsWith("ppt/slides/")), "no slide keeps the old body font");
}

// RR-41: the slide-size switch is what the export writes. Every preset sets the package's p:sldSz to
// the size the preview composes at (96 px per inch, 914400 EMU per inch), undo restores the old size,
// and re-importing the package returns the switched preset.
const sldSz = async (presentation) => {
  const bytes = await toPptx(structuredClone(presentation), { strictAssets: true, catalogs });
  const xml = await (await JSZip.loadAsync(bytes)).file("ppt/presentation.xml").async("string");
  const match = xml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  assert.ok(match, "presentation.xml has p:sldSz");
  return { cx: Number(match[1]), cy: Number(match[2]), bytes };
};
{
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  const original = await sldSz(editor.presentation);
  assert.deepEqual([original.cx, original.cy], [SLIDE_SIZES.widescreen.cx, SLIDE_SIZES.widescreen.cy], "the fixture exports at widescreen");
  for (const [preset, size] of Object.entries(SLIDE_SIZES)) {
    switchDimension(editor, "slide-sizes", preset);
    const out = await sldSz(editor.presentation);
    assert.deepEqual([out.cx, out.cy], [size.cx, size.cy], `${preset}: p:sldSz`);
    // The exported size is the composed canvas, 96 px and 914400 EMU per inch.
    assert.ok(Math.abs(out.cx - Math.round(size.width * 9525)) <= 1 && Math.abs(out.cy - Math.round(size.height * 9525)) <= 1, `${preset}: p:sldSz matches the preview canvas`);
    assert.equal((await fromPptx(out.bytes)).design?.dimensions, preset, `${preset}: re-import returns the preset`);
    await verify(editor.presentation, `slide size ${preset}`);
    editor.undo();
    const back = await sldSz(editor.presentation);
    assert.deepEqual([back.cx, back.cy], [original.cx, original.cy], `${preset}: undo restores p:sldSz`);
  }
  // A purpose does not touch the slide size.
  switchDimension(editor, "purposes", "pitch");
  const withPurpose = await sldSz(editor.presentation);
  assert.deepEqual([withPurpose.cx, withPurpose.cy], [original.cx, original.cy]);
  assert.equal((await fromPptx(withPurpose.bytes)).purpose, "pitch", "the purpose survives the export and re-import");
}

// Every switch in one session, in gallery order, then unwound.
{
  const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
  const original = editor.presentation;
  for (const { dimension, value, options } of cases) switchDimension(editor, dimension, value, options);
  assert.equal(editor.snapshot().undoDepth, cases.length);
  await verify(editor.presentation, "all dimensions switched", ["Tenorite", "Tenorite Display"]);
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.presentation, original);
  await verify(editor.presentation, "all dimensions undone", ["Aptos", "Aptos Display"]);
}

console.log(`Exports after switches passed the FF-08 typeface check: ${checked} packages checked (${exported} built).`);
