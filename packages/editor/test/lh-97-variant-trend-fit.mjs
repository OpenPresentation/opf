// LH-97, LH-123 and LH-126 (layout harvest, the editor's follow-ups of LH-01, LH-53 and LH-104):
// - the variant picker offers accent1 to accent6 and reads a layout's variant (surface, brand, an accent) as the selected state;
// - a metric's trend is a field of its own (read, set, removed, undone) and the canvas edits it through the choices up, down, flat;
// - the image fit select reads what `auto` resolved to from the composed geometry.
import assert from "node:assert/strict";
import { gallery } from "@openpresentation/gallery";
import { createEditorSession } from "../dist/index.js";
import { ACCENT_SLOTS, VARIANT_SLOTS, normalizeVariant, prepareDesignVariant, readDesignVariant, setDesignVariant, variantSwatches } from "../dist/design-variants.js";
import { readSchemeSlots } from "../dist/color-slots.js";
import { METRIC_TRENDS, prepareMetricTrend, readMetricTrend, setMetricTrend } from "../dist/content-actions.js";
import { readEffectiveImageFit } from "../dist/image-options.js";
import { METRIC_TREND_CHOICES, fieldChoices } from "../dist/canvas-fields.js";
import { colorMapFor } from "@openpresentation/opf/composition";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
const session = (deck) => createEditorSession({ name: "LH-97", assets: { photo: PIXEL }, ...deck }, { rejectInvalid: true, catalogs: [gallery] });
const design = (extra = {}) => ({ theme: "classic", fontScheme: "roboto", ...extra });

// --- LH-97: the picker offers the accents ---------------------------------------------------------------------------------------------

assert.deepEqual(VARIANT_SLOTS, ["light1", "light2", "dark1", "dark2", ...ACCENT_SLOTS]);
for (const slot of ACCENT_SLOTS) assert.equal(normalizeVariant(slot), slot, `${slot} is a variant background`);
assert.deepEqual(normalizeVariant({ background: "accent3", accents: ["accent2", "accent1", "accent3", "accent4", "accent5", "accent6"] }), { background: "accent3", accents: ["accent2", "accent1", "accent3", "accent4", "accent5", "accent6"] });
assert.throws(() => normalizeVariant("accent7"), (error) => error.code === "invalid-variant" && /accent6/.test(error.message), "the message lists every slot");

{
  const editor = session({ design: design(), slides: [{ title: "One" }, { title: "Two" }] });
  const change = setDesignVariant(editor, "accent2", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { variant: "accent2" } }]);
  const read = readDesignVariant(editor.presentation, { slideIndex: 1, catalogs: editor.catalogs });
  assert.deepEqual([read.scope, read.background, read.own], ["slide", "accent2", { background: "accent2" }]);
  const swatches = variantSwatches(editor.presentation, { slideIndex: 1, catalogs: editor.catalogs });
  assert.deepEqual(swatches.map((entry) => entry.slot), VARIANT_SLOTS, "ten swatches");
  assert.deepEqual(swatches.filter((entry) => entry.selected).map((entry) => entry.slot), ["accent2"], "exactly the chosen accent is selected");
  // The swatch is the accent's own color with the text family core's color map gives it (the one that reads better on it).
  const slots = readSchemeSlots(editor.presentation, { slideIndex: 1, catalogs: editor.catalogs });
  for (const entry of swatches.slice(4)) {
    const map = colorMapFor(entry.slot, slots);
    assert.deepEqual([entry.background, entry.surface, entry.text, entry.dark], [slots[entry.slot], slots[entry.slot], slots[map.tx1], map.tx1 === "light1"], `${entry.slot}: background, surface and text`);
  }
  editor.undo();
  assert.equal(editor.get("slides.1.design"), undefined, "one undo step");
}

// --- LH-97: a layout's variant is the selected state ----------------------------------------------------------------------------------

{
  const slides = [
    { title: "Part", layout: "section" },
    { title: "Statement", layout: "statement" },
    { title: "Thanks", layout: "closing" },
    { title: "Plain" },
    { title: "Own", layout: "section", design: { variant: "dark1" } },
  ];
  const at = (editor, index) => readDesignVariant(editor.presentation, { slideIndex: index, catalogs: editor.catalogs });
  const selected = (editor, index) => variantSwatches(editor.presentation, { slideIndex: index, catalogs: editor.catalogs }).filter((entry) => entry.selected).map((entry) => entry.slot);

  const light = session({ design: design(), slides });
  // section: accent1; statement: surface (light2 on a light deck); closing: brand (dark2); none, and an own variant, are not the layout's.
  assert.deepEqual([at(light, 0).scope, at(light, 0).background, at(light, 0).layout], ["layout", "accent1", { background: "accent1" }], "a section on accent1");
  assert.deepEqual([at(light, 1).scope, at(light, 1).background, at(light, 1).layout], ["layout", "light2", { background: "light2", role: "surface" }], "surface on a light deck is light2");
  assert.deepEqual([at(light, 2).scope, at(light, 2).background, at(light, 2).layout], ["layout", "dark2", { background: "dark2", role: "brand" }], "brand is dark2");
  assert.deepEqual([at(light, 3).scope, at(light, 3).layout], ["default", undefined], "a plain slide has no layout variant");
  assert.deepEqual([at(light, 4).scope, at(light, 4).background, at(light, 4).layout], ["slide", "dark1", undefined], "the slide's own variant wins, so the layout is not reported");
  assert.equal(at(light, 0).inherited, false, "a layout's variant is not the deck's");
  assert.deepEqual([0, 1, 2, 3, 4].map((index) => selected(light, index)), [["accent1"], ["light2"], ["dark2"], ["light1"], ["dark1"]], "the resolved variant is the selected swatch");
  assert.equal(at(light, 0).own, undefined, "the layout's variant is not written to the slide");

  // The tone-relative values follow the deck: surface on a dark deck is dark2, brand on a dark2 deck is dark1.
  const dark = session({ design: design({ variant: "dark1" }), slides });
  assert.deepEqual([at(dark, 1).background, at(dark, 1).layout.role, at(dark, 2).background], ["dark2", "surface", "dark2"]);
  const deep = session({ design: design({ variant: "dark2" }), slides });
  assert.deepEqual([at(deep, 1).background, at(deep, 2).background], ["dark1", "dark1"], "surface and brand step off a dark2 deck");

  // The deck scope reads the deck, never slide one's layout: slide one is a section, the deck is still light1.
  const deckRead = readDesignVariant(light.presentation, { catalogs: light.catalogs });
  assert.deepEqual([deckRead.scope, deckRead.background, deckRead.layout], ["default", "light1", undefined]);
  assert.deepEqual(variantSwatches(light.presentation, { catalogs: light.catalogs }).filter((entry) => entry.selected).map((entry) => entry.slot), ["light1"]);

  // Choosing a swatch writes the slide's own variant, which then wins over the layout; removing it hands the slide back to the layout.
  setDesignVariant(light, "accent4", { slideIndex: 0 });
  assert.deepEqual([at(light, 0).scope, at(light, 0).background], ["slide", "accent4"]);
  setDesignVariant(light, null, { slideIndex: 0 });
  assert.deepEqual([at(light, 0).scope, at(light, 0).background], ["layout", "accent1"], "removing the variant returns the slide to its layout");

  // LH-103: a fixed deck background beats the layout's variant, so the picker does not claim it.
  const fixed = session({ design: design({ background: "#102A43" }), slides });
  assert.notEqual(at(fixed, 0).scope, "layout");
  assert.equal(at(fixed, 0).layout, undefined);
}

// --- LH-123: the trend of a metric ------------------------------------------------------------------------------------------------------

assert.deepEqual(METRIC_TRENDS, ["up", "down", "flat"]);
assert.deepEqual(METRIC_TREND_CHOICES, METRIC_TRENDS, "the canvas offers the same choices");
assert.deepEqual(fieldChoices({ path: "/slides/3/blocks/0/metric/trend" }), METRIC_TRENDS, "the arrow's properties form is a menu");
assert.equal(fieldChoices({ path: "/slides/3/blocks/0/metric/label" }), undefined, "another metric field is free text");

{
  const editor = session({
    design: design(),
    slides: [
      { title: "KPIs", blocks: [{ metric: { value: 42, label: "Retention", delta: "+4", trend: "up" } }, { metric: { value: 7, label: "Churn" } }, { metric: 12 }, { text: "Not a metric" }] },
      { title: "Alone", metric: { value: 3, label: "Wins" } },
    ],
  });
  assert.deepEqual(readMetricTrend(editor.presentation, "slides.0.blocks.0"), { path: "slides.0.blocks.0.metric", trend: "up", scalar: false });
  assert.deepEqual(readMetricTrend(editor.presentation, "slides.0.blocks.1"), { path: "slides.0.blocks.1.metric", trend: undefined, scalar: false }, "no trend yet");
  assert.deepEqual(readMetricTrend(editor.presentation, "slides.0.blocks.2"), { path: "slides.0.blocks.2.metric", trend: undefined, scalar: true }, "a bare value");
  assert.equal(readMetricTrend(editor.presentation, "slides.0.blocks.3"), undefined, "a text block has no trend");
  assert.deepEqual(readMetricTrend(editor.presentation, "slides.1"), { path: "slides.1.metric", trend: undefined, scalar: false }, "the slide's own metric");

  const down = setMetricTrend(editor, "slides.0.blocks.0", "down");
  assert.deepEqual([down.changed, down.trend, down.patches.map((patch) => patch.op)], [true, "down", ["replace"]]);
  assert.equal(editor.get("slides.0.blocks.0.metric.trend"), "down");
  assert.equal(setMetricTrend(editor, "slides.0.blocks.0", "down").changed, false, "no change when it already has that trend");
  assert.deepEqual(setMetricTrend(editor, "slides.0.blocks.1", "flat").patches, [{ op: "add", path: "/slides/0/blocks/1/metric/trend", value: "flat" }], "a metric without a trend gets one");
  setMetricTrend(editor, "slides.0.blocks.2", "up");
  assert.deepEqual(editor.get("slides.0.blocks.2.metric"), { value: 12, trend: "up" }, "a bare value becomes { value, trend }");
  assert.equal(setMetricTrend(editor, "slides.1", "flat").changed, true);
  assert.equal(editor.get("slides.1.metric.trend"), "flat");

  const removed = setMetricTrend(editor, "slides.0.blocks.0", null);
  assert.equal(removed.changed, true);
  assert.equal("trend" in editor.get("slides.0.blocks.0.metric"), false, "null removes the trend");
  assert.equal(setMetricTrend(editor, "slides.0.blocks.0", null).changed, false);
  editor.undo();
  assert.equal(editor.get("slides.0.blocks.0.metric.trend"), "down", "undo restores the trend");

  assert.throws(() => setMetricTrend(editor, "slides.0.blocks.0", "sideways"), (error) => error.code === "invalid-metric-trend" && /up, down, flat/.test(error.message));
  assert.throws(() => setMetricTrend(editor, "slides.0.blocks.3", "up"), (error) => error.code === "content-action-refused");
  assert.equal(prepareMetricTrend(editor.presentation, "slides.0.blocks.0", "up").presentation.slides[0].blocks[0].metric.trend, "up", "the prepare form leaves the session alone");
  assert.equal(editor.get("slides.0.blocks.0.metric.trend"), "down");
}

// --- LH-126: the fit auto resolved to ---------------------------------------------------------------------------------------------------

{
  const fitOf = (slide, extraDesign) => {
    const editor = session({ design: design(extraDesign), slides: [{ title: "Picture", ...slide }] });
    return readEffectiveImageFit(editor.composeSlide(0), "slides.0.blocks.0");
  };
  const image = { src: "asset:photo", alt: "A pixel" };
  // A square picture covers a square frame (it keeps all of it) and is contained in a frame three times as wide (cover would crop two thirds).
  assert.deepEqual(fitOf({ blocks: [{ image, fit: "auto", aspectRatio: 1 }] }), { fit: "cover", auto: true }, "Auto (cover)");
  assert.deepEqual(fitOf({ blocks: [{ image, fit: "auto", aspectRatio: 3 }] }), { fit: "contain", auto: true }, "Auto (contain)");
  // A fit the block names is that fit, and not auto.
  assert.deepEqual(fitOf({ blocks: [{ image, fit: "contain", aspectRatio: 1 }] }), { fit: "contain", auto: false });
  assert.equal(fitOf({ blocks: [{ image, aspectRatio: 1 }] }).auto, false, "a default that is not auto is not reported as Auto");
  // The deck's default can be auto: a block that names none then reads Auto too.
  assert.deepEqual(fitOf({ blocks: [{ image, aspectRatio: 3 }] }, { imageFit: "auto" }), { fit: "contain", auto: true }, "design.imageFit auto");
  // The path may be the block or its image field; anything else, or no geometry, reads nothing.
  const editor = session({ design: design(), slides: [{ title: "Picture", blocks: [{ image, fit: "auto" }, { text: "Beside it" }] }] });
  const geometry = editor.composeSlide(0);
  assert.deepEqual(readEffectiveImageFit(geometry, "slides.0.blocks.0.image"), readEffectiveImageFit(geometry, "slides.0.blocks.0"));
  assert.equal(readEffectiveImageFit(geometry, "slides.0.blocks.1"), undefined, "a text block has no picture");
  assert.equal(readEffectiveImageFit(undefined, "slides.0.blocks.0"), undefined);
  assert.equal(readEffectiveImageFit({ items: [] }, "slides.0.blocks.0"), undefined);
}

console.log("lh-97 variant, trend and fit ok");
