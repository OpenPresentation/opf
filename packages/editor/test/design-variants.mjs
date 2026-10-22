// RR-96: deck and slide color variants in the editor (core 0.23 `design.variant`). A variant is a background slot, or an object when the
// accents are reordered; the editor writes the slot name, validates before the schema does, and every change is one undoable patch whose
// preview comes from core's roles.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import { readSchemeSlots } from "../dist/color-slots.js";
import { ACCENT_SLOTS, VARIANT_BACKGROUND_SLOTS, normalizeVariant, prepareDesignVariant, readDesignVariant, setDesignVariant, variantSwatches } from "../dist/design-variants.js";

const deck = (design = {}, slides) => ({
  name: "Variants fixture",
  design: { theme: "minimal", fontScheme: "aptos", colorScheme: "corporate-blue", ...design },
  slides: slides ?? [{ title: "One" }, { title: "Two" }, { title: "Three", design: { background: "dark1" } }],
});
const session = (design, slides) => createEditorSession(deck(design, slides), { rejectInvalid: true });
const SWAPPED = ["accent2", "accent1", "accent3", "accent4", "accent5", "accent6"];

// Validation names the problem and stores the slot, not an object, unless the accents are reordered.
assert.equal(normalizeVariant("dark1"), "dark1");
assert.equal(normalizeVariant({ background: "dark2" }), "dark2");
assert.equal(normalizeVariant({ background: "light1", accents: ACCENT_SLOTS }), "light1", "the scheme's own order says nothing");
assert.deepEqual(normalizeVariant({ background: "light1", accents: SWAPPED }), { background: "light1", accents: SWAPPED });
for (const [value, pattern] of [
  ["blue", /one of light1, light2, dark1, dark2/],
  [{ background: "dark1", extra: 1 }, /not extra/],
  [{ background: "dark1", accents: ["accent1", "accent1", "accent3", "accent4", "accent5", "accent6"] }, /each of accent1 to accent6 once/],
  [{ background: "dark1", accents: ["accent1"] }, /each of accent1 to accent6 once/],
  [42, /background slot/],
]) assert.throws(() => normalizeVariant(value), (error) => error.code === "invalid-variant" && pattern.test(error.message), JSON.stringify(value));

// The deck variant: one undoable patch, the slot written.
{
  const editor = session();
  assert.deepEqual(readDesignVariant(editor.presentation), { own: undefined, background: "dark2", accents: ACCENT_SLOTS, scope: "default", inherited: false }, "the minimal theme is dark2 without a variant");
  const change = setDesignVariant(editor, "dark1");
  assert.deepEqual(change.patches, [{ op: "add", path: "/design/variant", value: "dark1" }]);
  assert.equal(editor.get("design.variant"), "dark1");
  const read = readDesignVariant(editor.presentation);
  assert.deepEqual([read.own, read.background, read.scope], [{ background: "dark1" }, "dark1", "deck"]);
  assert.equal(setDesignVariant(editor, "dark1").changed, false, "no change when it is already set");
  setDesignVariant(editor, "light2");
  assert.equal(editor.get("design.variant"), "light2");
  assert.equal(readDesignVariant(editor.presentation).background, "light2", "core resolves it for the slides");
  editor.undo();
  assert.equal(editor.get("design.variant"), "dark1", "undo restores the previous variant");
  editor.undo();
  assert.equal(editor.get("design.variant"), undefined);
  editor.redo();
  setDesignVariant(editor, null);
  assert.equal(editor.get("design.variant"), undefined, "null removes it");
}

// A slide's variant replaces the deck's; null hands it back; the deck read reports who is shadowed.
{
  const editor = session({ variant: "light1" });
  const change = setDesignVariant(editor, "dark1", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { variant: "dark1" } }]);
  const slide = readDesignVariant(editor.presentation, { slideIndex: 1 });
  assert.deepEqual([slide.scope, slide.inherited, slide.background, slide.own], ["slide", false, "dark1", { background: "dark1" }]);
  const other = readDesignVariant(editor.presentation, { slideIndex: 0 });
  assert.deepEqual([other.scope, other.inherited, other.background, other.own], ["deck", true, "light1", undefined], "slide one follows the deck");
  // A deck change is hidden on slide 1 (its own variant) and slide 2 (its own dark1 background).
  const prepared = prepareDesignVariant(editor.presentation, "light2");
  assert.deepEqual(prepared.shadowed, [1, 2]);
  const cleared = prepareDesignVariant(editor.presentation, "light2", { clearSlideOverrides: true });
  assert.deepEqual(cleared.shadowed, [2], "clearing the slides' own variants leaves a background that decides by itself");
  assert.equal(cleared.patches.some((patch) => patch.op === "remove" && patch.path === "/slides/1/design/variant"), true);
  setDesignVariant(editor, null, { slideIndex: 1 });
  assert.equal(readDesignVariant(editor.presentation, { slideIndex: 1 }).inherited, true, "removing the slide's variant follows the deck again");
  assert.throws(() => setDesignVariant(editor, "dark1", { slideIndex: 9 }), (error) => error.code === "slide-index-out-of-range");
}

// The accent order: an object, kept apart from the background; it is read back in order, and the order alone keeps the background.
{
  const editor = session({ variant: "dark1" });
  setDesignVariant(editor, { accents: SWAPPED });
  assert.deepEqual(editor.get("design.variant"), { background: "dark1", accents: SWAPPED });
  const read = readDesignVariant(editor.presentation);
  assert.deepEqual([read.background, read.accents], ["dark1", SWAPPED]);
  setDesignVariant(editor, "light1");
  assert.equal(editor.get("design.variant"), "light1", "choosing a background alone drops the accent order");
  setDesignVariant(editor, { accents: SWAPPED });
  assert.deepEqual(editor.get("design.variant"), { background: "light1", accents: SWAPPED }, "no own variant: the effective background is kept");
  setDesignVariant(editor, { accents: ACCENT_SLOTS });
  assert.equal(editor.get("design.variant"), "light1", "the scheme's own order collapses to the slot");
}

// Four swatches from the deck's own slots, like the Variants gallery.
{
  const editor = session({ variant: "dark1" });
  const swatches = variantSwatches(editor.presentation);
  assert.deepEqual(swatches.map((entry) => entry.slot), VARIANT_BACKGROUND_SLOTS);
  assert.deepEqual(swatches.map((entry) => entry.selected), [false, false, true, false]);
  assert.deepEqual(swatches.map((entry) => entry.dark), [false, false, true, true]);
  for (const entry of swatches) {
    assert.match(entry.background, /^#[0-9a-f]{6}$/i);
    assert.match(entry.text, /^#[0-9a-f]{6}$/i);
    assert.equal(entry.accents.length, 3);
  }
  const slots = readSchemeSlots(editor.presentation);
  const [light1, light2, dark1, dark2] = swatches;
  assert.deepEqual([light1.background, light1.text, light1.surface], [slots.light1, slots.dark1, slots.light2], "light1: light1 behind dark1 text, light2 as the surface");
  assert.deepEqual([dark1.background, dark1.text, dark1.surface], [slots.dark1, slots.light1, slots.dark2], "dark1: the same slots the other way round");
  assert.deepEqual([light2.background, light2.surface, dark2.background, dark2.surface], [slots.light2, slots.light2, slots.dark2, slots.dark2], "light2 and dark2 are their own surface");
  assert.deepEqual(light1.accents, [slots.accent1, slots.accent2, slots.accent3], "the first three accents in the effective order");
  setDesignVariant(editor, { accents: SWAPPED });
  assert.deepEqual(variantSwatches(editor.presentation)[0].accents, [slots.accent2, slots.accent1, slots.accent3], "a reordered variant shows its accent order");
}
console.log("design variants ok");
