// FA-22/FA-23 (OPF 0.15): image blocks carry their own framing (fit, focus, treatments, placement) and backgrounds take the
// flat image form. Each change is one validated, undoable patch.
import assert from "node:assert/strict";
import { composeSlide } from "@openpresentation/opf/composition";
import { resolveSlideContext } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { IMAGE_TREATMENT_FIELDS, prepareImageTreatment, readImageTreatments, setImageTreatment } from "../dist/image-options.js";
import { IMAGE_BACKGROUND_FITS, normalizeBackground, readBackground, setBackground } from "../dist/background-options.js";
import { DESIGN_OPTIONS, setDesignOption } from "../dist/design-options.js";
import { switchDimension } from "../dist/switches.js";
import { IMAGE_DESTINATIONS } from "../dist/content-controls.js";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const deck = () => ({
  assets: { photo: PIXEL },
  slides: [
    { title: "Where we ship", blocks: [{ type: "image", image: { src: "asset:photo", alt: "Routes" } }, { text: "Twelve ports" }, { blocks: [{ image: "asset:photo" }, { text: "Nested" }] }] },
    { title: "Cover", image: "asset:photo" },
  ],
});

// --- treatments: one patch, one undo step, null removes -----------------------------------------------------------
{
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  const fields = {
    fit: "contain",
    focus: { x: 0.25, y: 0.75 },
    shape: "rounded",
    cornerRadius: 0.1,
    border: { color: "dark1", width: 4 },
    opacity: 0.8,
    recolor: { dark: "dark1", light: "accent1" },
    overlay: { color: "dark1", opacity: 0.4, edge: "bottom", size: 0.25 },
    aspectRatio: 1.5,
    placement: { edge: "right", size: 0.45 },
  };
  assert.deepEqual(Object.keys(fields).sort(), [...IMAGE_TREATMENT_FIELDS].sort());
  const change = setImageTreatment(editor, "slides.0.blocks.0", fields);
  assert.equal(change.changed, true);
  assert.equal(editor.snapshot().undoDepth, 1);
  const block = editor.get("slides.0.blocks.0");
  for (const [key, value] of Object.entries(fields)) assert.deepEqual(block[key], value, key);
  const state = readImageTreatments(editor.presentation, "slides.0.blocks.0");
  assert.equal(state.placeable, true);
  assert.deepEqual(state.placement, { edge: "right", size: 0.45 });
  // The composition draws what was set: the block bleeds to the right edge and carries its fit and focus.
  const geometry = composeSlide(editor.presentation.slides[0], resolveSlideContext(editor.presentation, 0).options);
  const image = geometry.items.find((item) => item.path === "slides.0.blocks.0.image" || item.path === "slides.0.blocks.0");
  assert.ok(image?.image, "the composed image item carries its image geometry");
  assert.equal(image.image.fit, "contain");
  assert.equal(image.image.placement?.edge, "right");
  // Repeating is a no-op; null removes; a selection path (the image field) names the same block.
  assert.equal(setImageTreatment(editor, "slides.0.blocks.0", { fit: "contain" }).changed, false);
  setImageTreatment(editor, "slides.0.blocks.0.image", { placement: null, recolor: null });
  assert.equal(editor.get("slides.0.blocks.0.placement"), undefined);
  assert.equal(editor.get("slides.0.blocks.0.recolor"), undefined);
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.presentation, deck());
  // The slide's own image (Slide.image) is not an image block: it takes no framing fields.
  assert.throws(() => setImageTreatment(editor, "slides.1", { fit: "contain" }), (error) => error.code === "not-an-image-block");
  // The image-treatments switch takes the same fields for one block.
  const switched = switchDimension(editor, "image-treatments", { shape: "circle" }, { path: "slides.0.blocks.0" });
  assert.equal(switched.scope, "block");
  assert.equal(editor.get("slides.0.blocks.0.shape"), "circle");
}

// --- placement rules: top-level blocks only, one per edge -----------------------------------------------------------
{
  const presentation = deck();
  presentation.slides[0].blocks[1] = { image: "asset:photo", placement: { edge: "left" } };
  assert.throws(() => prepareImageTreatment(presentation, "slides.0.blocks.0", { placement: { edge: "left" } }), (error) => error.code === "placement-edge-taken");
  assert.equal(prepareImageTreatment(presentation, "slides.0.blocks.0", { placement: { edge: "top", size: 0.3 } }).changed, true);
  assert.throws(() => prepareImageTreatment(presentation, "slides.0.blocks.2.blocks.0", { placement: { edge: "right" } }), (error) => error.code === "placement-not-top-level");
  assert.deepEqual(readImageTreatments(presentation, "slides.0.blocks.0").usedEdges, ["left"]);
  assert.equal(readImageTreatments(presentation, "slides.0.blocks.2.blocks.0").placeable, false);
  for (const [fields, message] of [
    [{ fit: "crop" }, /cover, contain, stretch/],
    [{ focus: { x: 2, y: 0 } }, /focus/i],
    [{ placement: { edge: "middle" } }, /edge/],
    [{ placement: { edge: "left", size: 0.95 } }, /0\.1 to 0\.9/],
    [{ overlay: { color: "dark1" } }, /opacity/],
    [{ border: { color: "nope", width: 2 } }, /border color/i],
    [{ slideImage: "x" }, /Unknown image treatment/],
  ])
    assert.throws(() => prepareImageTreatment(deck(), "slides.0.blocks.0", fields), message);
  assert.throws(() => prepareImageTreatment(deck(), "slides.0.blocks.1", { fit: "cover" }), (error) => error.code === "not-an-image-block");
}

// --- backgrounds: the flat image form and the image-source shorthand -------------------------------------------------
{
  assert.deepEqual([...IMAGE_BACKGROUND_FITS], ["cover", "contain", "stretch", "tile"]);
  assert.equal(normalizeBackground("asset:photo"), "asset:photo", "an image source is the cover-image shorthand");
  assert.equal(normalizeBackground("./images/harbour.jpg"), "./images/harbour.jpg");
  assert.equal(normalizeBackground("light1"), "light1");
  assert.equal(normalizeBackground("#ffffff"), "#FFFFFF");
  assert.throws(() => normalizeBackground("x.jpg"), (error) => error.code === "invalid-background");
  assert.equal(normalizeBackground({ type: "image", src: "asset:photo" }), "asset:photo");
  const spec = { type: "image", src: "asset:photo", alt: "Ships at dawn", fit: "cover", focus: { x: 0.5, y: 0.7 }, opacity: 0.9, recolor: "grayscale", overlay: { color: "dark1", opacity: 0.4 } };
  assert.deepEqual(normalizeBackground(spec), spec);
  assert.throws(() => normalizeBackground({ type: "image", image: { src: "asset:photo" } }), (error) => error.code === "invalid-background", "the 0.14 image wrapper is gone");
  assert.throws(() => normalizeBackground({ ...spec, overlay: { color: "dark1", opacity: 2 } }), (error) => error.code === "invalid-background");
  assert.deepEqual(normalizeBackground({ ...spec, recolor: { dark: "dark1", light: "accent1" } }).recolor, { dark: "dark1", light: "accent1" }, "a background takes a duotone recolor (FA-22 draft 3)");
  assert.throws(() => normalizeBackground({ ...spec, recolor: "sepia" }), (error) => error.code === "invalid-background");

  const editor = createEditorSession(deck(), { rejectInvalid: true });
  setBackground(editor, spec);
  assert.deepEqual(editor.get("design.background"), spec);
  setBackground(editor, { type: "image", src: "asset:photo", fit: "tile" }, { slideIndex: 1 });
  assert.deepEqual(readBackground(editor.presentation, { slideIndex: 1 }), { type: "image", opacity: undefined, src: "asset:photo", alt: undefined, fit: "tile", focus: undefined, recolor: undefined, overlay: undefined, scope: "slide", value: { type: "image", src: "asset:photo", fit: "tile" } });
  const deckState = readBackground(editor.presentation);
  assert.equal(deckState.alt, "Ships at dawn");
  assert.deepEqual(deckState.focus, { x: 0.5, y: 0.7 });
  assert.deepEqual(deckState.overlay, { color: "dark1", opacity: 0.4 });
  assert.equal(deckState.recolor, "grayscale");
  const geometry = composeSlide(editor.presentation.slides[0], resolveSlideContext(editor.presentation, 0).options);
  assert.equal(geometry.backgroundImage?.src, "asset:photo", "the composed slide carries the background image");
  assert.equal(geometry.backgroundImage.alt, "Ships at dawn");
  setBackground(editor, "asset:photo", { slideIndex: 0 });
  assert.deepEqual(readBackground(editor.presentation, { slideIndex: 0 }).type, "image");
}

// --- removed design keys are refused; image destinations are the background and the watermark ----------------------
{
  assert.deepEqual(DESIGN_OPTIONS.find((option) => option.id === "imageFit").values, ["cover", "contain", "stretch"]);
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  setDesignOption(editor, "imageFit", "contain", { slideIndex: 0 });
  assert.equal(editor.get("slides.0.design.imageFit"), "contain");
  assert.throws(() => setDesignOption(editor, "slideImage", "asset:photo"), (error) => error.code === "unknown-design-option");
  assert.deepEqual(IMAGE_DESTINATIONS.map((entry) => entry.target), ["background", "watermark"]);
}

console.log("image options ok: block fit, focus, treatments and placement; flat image backgrounds; the removed design keys are refused");
