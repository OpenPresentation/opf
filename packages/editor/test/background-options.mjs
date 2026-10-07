// RR-06 gaps: every background form (theme slot, solid, gradient, image, pattern) with validation,
// one undo step, scope, removal, and export. The 54 pattern presets all survive a PPTX round trip.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import {
  BACKGROUND_TYPES,
  COLOR_NAMES,
  PATTERN_GROUPS,
  PATTERN_PRESETS,
  isColorRef,
  normalizeBackground,
  prepareBackground,
  readBackground,
  setBackground,
} from "../dist/background-options.js";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
const deck = () => ({
  name: "Background fixture",
  design: { theme: "minimal", fontScheme: "aptos", colorScheme: "cool-horizon" },
  assets: { photo: PIXEL },
  slides: [
    { id: "a", title: "Cover", subtitle: "Backgrounds" },
    { id: "b", title: "Body", text: "Text" },
  ],
});
const session = () => createEditorSession(deck(), { rejectInvalid: true });
const svg = (presentation, index = 0) => renderSlideSvg(presentation, index);

// The pattern list is the 54 DrawingML presets, once each, in five families.
assert.equal(PATTERN_PRESETS.length, 54);
assert.equal(new Set(PATTERN_PRESETS).size, 54);
assert.deepEqual(Object.keys(PATTERN_GROUPS), ["Percent", "Horizontal and vertical", "Diagonal", "Checks, grids and bricks", "Shapes and textures"]);
assert.deepEqual([...BACKGROUND_TYPES], ["theme", "solid", "gradient", "image", "pattern"]);

// ColorRefs: hex (3, 6, 8 digits), scheme slots and roles, var:<id>.
for (const good of ["#FFF", "#1f2937", "#11223344", "accent1", "dark2", "primary", "surface", "textSecondary", "var:brand-blue"]) assert.equal(isColorRef(good), true, good);
for (const bad of ["red", "#12", "#GGGGGG", "accent7", "var:Brand", "", 4, null]) assert.equal(isColorRef(bad), false, String(bad));
assert.ok(COLOR_NAMES.includes("hyperlink") && COLOR_NAMES.includes("followedHyperlink"));

// Each form: the patch, one undo step, a valid document, a preview that changes where the renderer draws it, and an export.
const forms = [
  { name: "theme slot", spec: { type: "theme", slot: "dark1" }, stored: "dark1", draws: true },
  { name: "hex shorthand", spec: "#1f2937", stored: "#1F2937", draws: true },
  { name: "solid with a scheme color", spec: { type: "solid", color: "accent2" }, stored: { type: "solid", color: "accent2" }, draws: true },
  { name: "solid with opacity", spec: { type: "solid", color: "#336699", opacity: 0.5 }, stored: { type: "solid", color: "#336699", opacity: 0.5 }, draws: true },
  {
    name: "linear gradient with scheme slots",
    spec: { type: "gradient", gradient: { angle: 45, stops: [{ color: "accent1", position: 0 }, { color: "#FFFFFF", position: 1 }] } },
    stored: { type: "gradient", gradient: { angle: 45, stops: [{ color: "accent1", position: 0 }, { color: "#FFFFFF", position: 1 }] } },
    draws: true,
  },
  { name: "image with fit", spec: { type: "image", image: { src: "asset:photo", fit: "tile" }, opacity: 0.8 }, stored: { type: "image", image: { src: "asset:photo", fit: "tile" }, opacity: 0.8 }, draws: false },
  {
    name: "pattern with colors",
    spec: { type: "pattern", pattern: { preset: "wdUpDiag", foregroundColor: "accent1", backgroundColor: "#FFFFFF" } },
    stored: { type: "pattern", pattern: { preset: "wdUpDiag", foregroundColor: "accent1", backgroundColor: "#FFFFFF" } },
    draws: true,
  },
];
for (const form of forms) {
  const editor = session();
  const before = editor.presentation;
  const beforeSvg = svg(before);
  const change = setBackground(editor, form.spec);
  assert.equal(change.changed, true, form.name);
  assert.deepEqual(editor.get("design.background"), form.stored, form.name);
  assert.equal(editor.snapshot().undoDepth, 1, `${form.name}: one undo step`);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true, form.name);
  if (form.draws) assert.notEqual(svg(editor.presentation), beforeSvg, `${form.name}: the preview draws it`);
  assert.deepEqual(prepareBackground(before, form.spec).patches, change.patches, `${form.name}: prepare is the same patch`);
  assert.ok((await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true })).byteLength > 0, `${form.name}: exports`);
  assert.deepEqual(editor.undo().presentation, before);
  editor.redo();
  assert.equal(setBackground(editor, form.spec).changed, false, `${form.name}: repeat commits nothing`);
  assert.equal(editor.snapshot().undoDepth, 1);
}

// Gradient stops are validated and sorted; text positions from a form are numbers.
{
  const spec = { type: "gradient", gradient: { angle: "90", stops: [{ color: "#000000", position: "1" }, { color: "accent1", position: "0" }, { color: "#888888", position: 0.5 }] } };
  assert.deepEqual(normalizeBackground(spec), { type: "gradient", gradient: { angle: 90, stops: [{ color: "accent1", position: 0 }, { color: "#888888", position: 0.5 }, { color: "#000000", position: 1 }] } });
  const fails = (value, pattern) => assert.throws(() => normalizeBackground(value), (error) => error.code === "invalid-background" && pattern.test(error.message), JSON.stringify(value).slice(0, 80));
  fails({ type: "gradient", gradient: { stops: [{ color: "#000", position: 0 }] } }, /at least two color stops/);
  fails({ type: "gradient", gradient: { stops: [{ color: "#000", position: 0 }, { color: "teal", position: 1 }] } }, /Stop 2: the color must be a hex color/);
  fails({ type: "gradient", gradient: { stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 2 }] } }, /Stop 2: the position is a number from 0/);
  fails({ type: "gradient", gradient: { angle: "steep", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 1 }] } }, /gradient angle is a number/);
  fails({ type: "solid", color: "nope" }, /solid background color must be a hex color/);
  fails({ type: "solid", color: "#000", opacity: 3 }, /opacity is a number from 0 to 1/);
  fails({ type: "image", image: { src: "  " } }, /needs an image/);
  fails({ type: "image", image: { src: "a", fit: "stretch" } }, /Image fit is one of cover, contain, tile/);
  fails({ type: "pattern", pattern: { preset: "" } }, /needs a preset/);
  fails({ type: "pattern", pattern: { preset: "pct5", foregroundColor: "blue" } }, /pattern foreground color/);
  fails({ type: "theme", slot: "mid" }, /names a slot/);
  fails({ type: "radial" }, /Background type is one of/);
  fails("blue", /theme slot/);
  fails(5, /Describe the background/);
  const editor = session();
  assert.throws(() => setBackground(editor, { type: "gradient", gradient: { stops: [] } }));
  assert.equal(editor.snapshot().undoDepth, 0);
}

// Engine-defined pattern ids are accepted as text; the renderer's legacy diagStripe stays valid.
assert.deepEqual(normalizeBackground({ type: "pattern", pattern: { preset: "diagStripe" } }), { type: "pattern", pattern: { preset: "diagStripe" } });

// All 54 presets: valid, one step each, and each survives a PPTX round trip under its own name.
for (const preset of PATTERN_PRESETS) {
  const editor = session();
  setBackground(editor, { type: "pattern", pattern: { preset, foregroundColor: "#112233", backgroundColor: "#EEEEEE" } });
  assert.equal(editor.get("design.background.pattern.preset"), preset);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true, preset);
  assert.equal(editor.snapshot().undoDepth, 1, preset);
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true });
  const back = await pptx.fromPptx(bytes);
  const background = (back.presentation ?? back).design?.background ?? (back.presentation ?? back).slides?.[0]?.design?.background;
  assert.equal(background?.pattern?.preset, preset, `${preset} survives export and reimport`);
}

// Scope: a slide's own background, removal returns the deck's, and a deck change reports shadowing.
{
  const editor = session();
  setBackground(editor, "#112233");
  const slide = setBackground(editor, { type: "pattern", pattern: { preset: "pct50" } }, { slideIndex: 1 });
  assert.equal(slide.scope, "slide");
  assert.deepEqual(readBackground(editor.presentation, { slideIndex: 1 }), { type: "pattern", preset: "pct50", foregroundColor: undefined, backgroundColor: undefined, opacity: undefined, scope: "slide", value: { type: "pattern", pattern: { preset: "pct50" } } });
  assert.equal(readBackground(editor.presentation, { slideIndex: 0 }).scope, "deck");
  assert.equal(readBackground(editor.presentation, { slideIndex: 0 }).type, "solid");
  const deckChange = setBackground(editor, "dark2");
  assert.deepEqual(deckChange.shadowed, [1]);
  const removed = setBackground(editor, null, { slideIndex: 1 });
  assert.deepEqual(removed.patches, [{ op: "remove", path: "/slides/1/design/background" }]);
  assert.equal(readBackground(editor.presentation, { slideIndex: 1 }).value, "dark2", "removal inherits the deck's");
  const none = setBackground(editor, null);
  assert.equal(none.changed, true);
  assert.equal(editor.get("design.background"), undefined);
  assert.equal(setBackground(editor, null).changed, false, "removing nothing commits nothing");
}

// readBackground flattens every form for a form.
{
  const read = (value) => readBackground({ design: { background: value }, slides: [{ title: "x", text: "y" }] });
  assert.deepEqual([read("light2").type, read("light2").slot], ["theme", "light2"]);
  assert.deepEqual([read("#abc").type, read("#abc").color], ["solid", "#abc"]);
  assert.deepEqual(read({ type: "gradient", gradient: { angle: 10, stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 1 }] }, opacity: 0.4 }).stops.length, 2);
  assert.equal(read({ type: "image", image: { src: "asset:photo", fit: "contain" } }).fit, "contain");
  assert.equal(read(undefined).type, undefined);
}

console.log("Backgrounds: 5 types with scheme-slot colors, gradient stop validation, 54 patterns round-tripped through PPTX, scope, removal, one undo step each.");
