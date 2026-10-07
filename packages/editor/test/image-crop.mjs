// RR-25: image crop and focal point, the model: rectangle maths with aspect lock and bounds, and the one-patch change that
// applies a crop (a new asset plus the image pointing at it), restores the original, and keeps the document valid.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import {
  CROP_ASPECTS,
  MIN_CROP_SIDE,
  aspectRatioFor,
  clampRect,
  countAssetReferences,
  describeImage,
  fitAspect,
  focalPointOf,
  focalWindow,
  fullRect,
  isFullRect,
  moveRect,
  prepareCrop,
  prepareRestore,
  resizeRect,
  restoreOriginal,
  roundRect,
} from "../dist/image-crop.js";

const near = (actual, expected, message, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const bounds = { width: 400, height: 200 };

// Aspects.
assert.equal(aspectRatioFor("free"), undefined);
assert.equal(aspectRatioFor("original", bounds), 2);
assert.equal(aspectRatioFor("frame", { frame: 1.5 }), 1.5);
assert.equal(aspectRatioFor("frame", {}), undefined);
assert.equal(aspectRatioFor("16:9"), 16 / 9);
assert.ok(CROP_ASPECTS.every((aspect) => aspect.id && aspect.label));

// Move, clamp, round.
assert.deepEqual(moveRect({ x: 10, y: 10, width: 100, height: 50 }, -50, 500, bounds), { x: 0, y: 150, width: 100, height: 50 });
assert.deepEqual(clampRect({ x: -5, y: 190, width: 500, height: 2 }, bounds), { x: 0, y: 190, width: 400, height: MIN_CROP_SIDE });
assert.deepEqual(roundRect({ x: 10.4, y: 10.6, width: 99.5, height: 0.2 }, bounds), { x: 10, y: 11, width: 100, height: 1 });
assert.equal(isFullRect(fullRect(400, 200), bounds), true);
assert.equal(isFullRect({ x: 1, y: 0, width: 399, height: 200 }, bounds), false);

// Free resize: every handle moves only its own edges and stays in bounds.
{
  const start = { x: 100, y: 50, width: 200, height: 100 };
  assert.deepEqual(resizeRect(start, "e", { x: 350, y: 999 }, bounds), { x: 100, y: 50, width: 250, height: 100 });
  assert.deepEqual(resizeRect(start, "w", { x: 20, y: 0 }, bounds), { x: 20, y: 50, width: 280, height: 100 });
  assert.deepEqual(resizeRect(start, "n", { x: 0, y: 10 }, bounds), { x: 100, y: 10, width: 200, height: 140 });
  assert.deepEqual(resizeRect(start, "s", { x: 0, y: 500 }, bounds), { x: 100, y: 50, width: 200, height: 150 });
  assert.deepEqual(resizeRect(start, "se", { x: 999, y: 999 }, bounds), { x: 100, y: 50, width: 300, height: 150 });
  assert.deepEqual(resizeRect(start, "nw", { x: -50, y: -50 }, bounds), { x: 0, y: 0, width: 300, height: 150 });
  // Dragging past the opposite edge stops at the minimum.
  const flipped = resizeRect(start, "e", { x: 0, y: 0 }, bounds);
  assert.equal(flipped.width, MIN_CROP_SIDE);
  assert.equal(flipped.x, 100);
}

// Aspect lock: the ratio holds for every handle and the rectangle stays inside the image.
for (const aspect of [1, 4 / 3, 16 / 9, 3 / 4, 9 / 16]) {
  for (const handle of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
    for (const point of [{ x: 0, y: 0 }, { x: 400, y: 200 }, { x: 210, y: 90 }, { x: 150, y: 160 }, { x: 399, y: 1 }]) {
      const start = fitAspect({ x: 100, y: 40, width: 200, height: 120 }, aspect);
      const out = resizeRect(start, handle, point, bounds, { aspect });
      near(out.width / out.height, aspect, `aspect ${aspect} ${handle} ${JSON.stringify(point)}`, 1e-6);
      assert.ok(out.x >= -1e-9 && out.y >= -1e-9 && out.x + out.width <= bounds.width + 1e-9 && out.y + out.height <= bounds.height + 1e-9, `inside bounds: ${aspect} ${handle} ${JSON.stringify(point)} ${JSON.stringify(out)}`);
      assert.ok(out.width >= MIN_CROP_SIDE - 1e-9 || out.width >= MIN_CROP_SIDE * Math.min(1, aspect) - 1e-9);
    }
  }
}
// A corner keeps the opposite corner fixed.
{
  const start = { x: 100, y: 50, width: 160, height: 90 };
  const out = resizeRect(start, "se", { x: 300, y: 120 }, bounds, { aspect: 16 / 9 });
  near(out.x, 100, "anchor x");
  near(out.y, 50, "anchor y");
  const nw = resizeRect(start, "nw", { x: 60, y: 20 }, bounds, { aspect: 16 / 9 });
  near(nw.x + nw.width, 260, "anchor right");
  near(nw.y + nw.height, 140, "anchor bottom");
}

// Aspect fit and focal window.
assert.deepEqual(fitAspect(fullRect(400, 200), 1), { x: 100, y: 0, width: 200, height: 200 });
assert.deepEqual(fitAspect(fullRect(400, 200), 4), { x: 0, y: 50, width: 400, height: 100 });
assert.deepEqual(fitAspect(fullRect(400, 200), undefined), fullRect(400, 200));
{
  const window = focalWindow(bounds, 1, { x: 0.8, y: 0.5 });
  assert.deepEqual(window, { x: 200, y: 0, width: 200, height: 200 }, "the largest square, centred on the point and kept inside the image");
  const tight = focalWindow(bounds, 1, { x: 0.5, y: 0.5 }, 2);
  assert.deepEqual(tight, { x: 150, y: 50, width: 100, height: 100 });
  const corner = focalWindow(bounds, 2, { x: 0, y: 0 }, 4);
  assert.deepEqual(corner, { x: 0, y: 0, width: 100, height: 50 });
  assert.deepEqual(focalPointOf(tight, bounds), { x: 0.5, y: 0.5 });
  const wide = focalWindow(bounds, 16 / 9, { x: 0.5, y: 0.1 });
  assert.equal(wide.y, 0, "the window cannot leave the image");
  near(wide.width / wide.height, 16 / 9, "window aspect");
}

// The document change.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
const cropped = (tag = "a") => ({ dataUri: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=#${tag}`, mediaType: "image/png", width: 1, height: 1 });
const deck = () => ({
  name: "Crop fixture",
  design: { theme: "minimal", fontScheme: "roboto" },
  assets: { photo: { src: PNG, alt: "A photo", title: "photo.png", mediaType: "image/png" }, plain: PNG, vector: { src: "data:image/svg+xml;base64,PHN2Zy8+", mediaType: "image/svg+xml" } },
  slides: [
    { id: "block", title: "Block", blocks: [{ image: { src: "asset:photo", alt: "Block alt" } }, { text: "Beside the image" }] },
    { id: "string", title: "String", image: "asset:plain", text: "Text" },
    { id: "inline", title: "Inline", image: { src: PNG, alt: "inline" }, text: "Text" },
    { id: "slide-image", title: "Slide image", design: { slideImage: { src: "asset:photo", position: "right", size: 0.4 } }, text: "Text" },
    { id: "slide-image-asset", title: "Slide image string", design: { slideImage: "asset:plain" }, text: "Text" },
    { id: "svg", title: "Vector", image: "asset:vector", text: "Text" },
    { id: "url", title: "Hosted", image: "https://example.com/p.png", text: "Text" },
  ],
});
const session = () => createEditorSession(deck(), { rejectInvalid: true });

// describeImage
{
  const d = deck();
  const block = describeImage(d, "slides.0.blocks.0.image");
  assert.equal(block.form, "object");
  assert.equal(block.assetId, "photo");
  assert.equal(block.alt, "Block alt");
  assert.equal(block.srcPointer, "/slides/0/blocks/0/image/src");
  const string = describeImage(d, "slides.1.image");
  assert.equal(string.form, "string");
  assert.equal(string.srcPointer, "/slides/1/image");
  assert.equal(describeImage(d, "slides.3.design.slideImage").assetId, "photo");
  assert.equal(describeImage(d, "slides.4.design.slideImage").form, "string");
  assert.match(describeImage(d, "slides.5.image").error, /vector/i);
  assert.match(describeImage(d, "slides.0.title").error, /not a picture/);
  assert.match(describeImage({ slides: [{ title: "x", image: "asset:gone" }] }, "slides.0.image").error, /missing/);
  assert.equal(describeImage(d, "slides.6.image").assetSrc, "https://example.com/p.png");
}

// prepareCrop / applyPatch: one undo step, valid document, alt and untouched fields kept.
{
  const editor = session();
  const before = editor.presentation;
  const prepared = prepareCrop(editor.presentation, "slides.0.blocks.0.image", cropped());
  assert.equal(prepared.assetId, "photo-crop");
  const depth = editor.snapshot().undoDepth;
  editor.applyPatch(prepared.patches, { rejectInvalid: true });
  assert.equal(editor.snapshot().undoDepth, depth + 1, "a crop is one undo step");
  const after = editor.presentation;
  assert.deepEqual(after.slides[0].blocks[0].image, { src: "asset:photo-crop", alt: "Block alt" });
  assert.equal(after.assets["photo-crop"].description, "Cropped from asset:photo");
  assert.equal(after.assets["photo-crop"].alt, "Block alt");
  assert.equal(after.assets["photo-crop"].mediaType, "image/png");
  assert.equal(after.assets.photo.src, PNG, "the original asset stays");
  assert.equal(validate(after, { only: ["format"] }).valid, true, JSON.stringify(validate(after, { only: ["format"] }).findings));
  editor.undo();
  assert.deepEqual(editor.presentation, before, "one undo restores the document");

  // Re-crop: provenance points at the original, the earlier crop's asset (used nowhere else) is removed.
  editor.redo();
  const again = prepareCrop(editor.presentation, "slides.0.blocks.0.image", cropped("b"));
  assert.equal(again.origin, "photo");
  assert.ok(again.patches.some((patch) => patch.op === "remove" && patch.path === "/assets/photo-crop"), "the previous crop is dropped");
  editor.applyPatch(again.patches, { rejectInvalid: true });
  assert.equal(editor.presentation.assets["photo-crop"], undefined);
  assert.equal(editor.presentation.assets["photo-crop-2"].description, "Cropped from asset:photo");
  assert.equal(editor.presentation.slides[0].blocks[0].image.src, "asset:photo-crop-2");
  // Restore: one step back to the original, the crop asset is removed.
  const restored = restoreOriginal(editor, "slides.0.blocks.0.image");
  assert.equal(restored.origin, "photo");
  assert.equal(editor.presentation.slides[0].blocks[0].image.src, "asset:photo");
  assert.equal(editor.presentation.assets["photo-crop-2"], undefined);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.equal(restoreOriginal(editor, "slides.0.blocks.0.image"), null, "nothing to restore on an original");
  editor.undo();
  assert.equal(editor.presentation.slides[0].blocks[0].image.src, "asset:photo-crop-2", "restore is one undo step");
}

// A crop used by two images is kept when one of them is restored.
{
  const d = deck();
  d.slides[1].image = { src: "asset:photo" };
  const editor = createEditorSession(d, { rejectInvalid: true });
  editor.applyPatch(prepareCrop(editor.presentation, "slides.0.blocks.0.image", cropped()).patches, { rejectInvalid: true });
  editor.set("slides.1.image", { src: "asset:photo-crop" });
  assert.equal(countAssetReferences(editor.presentation, "photo-crop"), 2);
  assert.equal(prepareRestore(editor.presentation, "slides.0.blocks.0.image").patches.some((patch) => patch.op === "remove"), false);
}

// Other forms: string image, inline data image, slide image (object and string), no assets map.
{
  const editor = session();
  editor.applyPatch(prepareCrop(editor.presentation, "slides.1.image", cropped()).patches, { rejectInvalid: true });
  assert.equal(editor.presentation.slides[1].image, "asset:plain-crop", "a string image stays a string");
  assert.equal(editor.presentation.assets["plain-crop"].description, "Cropped from asset:plain");
  editor.applyPatch(prepareCrop(editor.presentation, "slides.2.image", cropped()).patches, { rejectInvalid: true });
  assert.deepEqual(editor.presentation.slides[2].image, { src: "asset:image-crop", alt: "inline" }, "an inline picture becomes an asset; its alt stays on the image");
  assert.equal(editor.presentation.assets["image-crop"].description, undefined, "no provenance for an inline original");
  assert.equal(prepareRestore(editor.presentation, "slides.2.image"), null);
  editor.applyPatch(prepareCrop(editor.presentation, "slides.3.design.slideImage", cropped()).patches, { rejectInvalid: true });
  assert.deepEqual(editor.presentation.slides[3].design.slideImage, { src: "asset:photo-crop", position: "right", size: 0.4 }, "slide image placement is kept");
  editor.applyPatch(prepareCrop(editor.presentation, "slides.4.design.slideImage", cropped()).patches, { rejectInvalid: true });
  assert.equal(typeof editor.presentation.slides[4].design.slideImage, "string");
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true, JSON.stringify(validate(editor.presentation, { only: ["format"] }).findings));
  const bare = createEditorSession({ slides: [{ title: "x", image: { src: PNG } }] }, { rejectInvalid: true });
  bare.applyPatch(prepareCrop(bare.presentation, "slides.0.image", cropped()).patches, { rejectInvalid: true });
  assert.ok(bare.presentation.assets["image-crop"], "a deck without assets gets the map");
  assert.throws(() => prepareCrop(deck(), "slides.5.image", cropped()), (error) => error.code === "not-croppable");
  assert.throws(() => prepareCrop(deck(), "slides.0.title", cropped()), (error) => error.code === "not-croppable");
}

console.log("image-crop: ok");
