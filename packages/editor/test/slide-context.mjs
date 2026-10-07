// RR-55: the editor takes a slide's composition context from core's `resolveSlideContext`, the one resolution every engine uses (slide
// design, then deck design, then theme, then the engine default, per field), and measures with the fonts handle it is given. There is
// no editor-side copy of that chain: composition, pagination and the renderer agree because they ask the same function.
import assert from "node:assert/strict";
import { resolveSlideContext } from "@openpresentation/opf";
import { composeSlide } from "@openpresentation/opf/composition";
import { resolvePresentation } from "@openpresentation/opf-render/svg";
import * as editorEntry from "../dist/index.js";
import { createEditorSession } from "../dist/index.js";

assert.equal("resolveSlideFonts" in editorEntry, false, "the editor's own font chain is gone");
assert.equal("validateOpfDocument" in editorEntry, false, "the editor's own validation adapter is gone");

// A measurement that records which families the composition asked for.
const recorder = () => {
  const families = new Set();
  return { families, fonts: { textMeasurement: { measure: (text, size, style) => (families.add(style.fontFamily), text.length * size * 0.5) } } };
};
const slide = { id: "s", title: "Title", text: "Body copy" };
const familiesOf = (presentation, options = {}, index = 0) => {
  const { families, fonts } = recorder();
  createEditorSession(presentation).composeSlide(index, { fonts, ...options });
  return [...families].sort();
};

// The deck's font scheme, a slide's own scheme, a theme's scheme, an inline scheme and a host catalog scheme all compose in the families
// core resolves: the editor never asks "which fonts" itself.
const cases = [
  ["the default (no design)", { slides: [slide] }, 0, undefined],
  ["the deck's font scheme", { design: { fontScheme: "roboto" }, slides: [slide] }, 0, undefined],
  ["a slide's own font scheme", { design: { fontScheme: "roboto" }, slides: [slide, { ...slide, id: "t", design: { fontScheme: "georgia" } }] }, 1, undefined],
  ["a theme's font scheme", { design: { theme: "classic" }, slides: [slide] }, 0, undefined],
  ["an inline font scheme", { design: { fontScheme: { id: "x", major: "Inter", minor: "Inter" } }, slides: [slide] }, 0, undefined],
  ["a scheme only the host's catalogs have", { design: { fontScheme: "host-lora" }, slides: [slide] }, 0, { fontSchemes: [{ id: "host-lora", name: "Host Lora", major: "Lora", minor: "Lora" }] }],
];
for (const [name, presentation, index, catalogs] of cases) {
  const expected = resolveSlideContext(presentation, index, { catalogs }).options.fontFamilies;
  const drawn = familiesOf(presentation, catalogs ? { catalogs } : {}, index);
  const names = [...new Set([expected.heading, expected.body])].sort();
  assert.deepEqual(drawn, names, `${name}: composition measures the families core resolved (${names.join(", ")})`);
}
assert.deepEqual(familiesOf({ design: { fontScheme: "roboto" }, slides: [slide] }), ["Roboto"], "a deck that sets roboto composes in Roboto, not the default Aptos");
assert.deepEqual(familiesOf({ slides: [slide] }), ["Aptos", "Aptos Display"]);

// The editor composes what the renderer draws: same geometry through the same context.
{
  const { fonts } = recorder();
  const presentation = { design: { theme: "classic", fontScheme: "roboto" }, slides: [slide, { id: "two", title: "Two", items: ["a", "b", "c"] }] };
  const editor = createEditorSession(presentation);
  for (const index of [0, 1]) {
    assert.deepEqual(editor.composeSlide(index, { fonts }).items, resolvePresentation(presentation, { fonts }).slides[index].geometry.items, `slide ${index}: editor and renderer geometry agree`);
    // And it is exactly core's composeSlide over core's context.
    assert.deepEqual(editor.composeSlide(index, { fonts }).items, composeSlide(presentation.slides[index], resolveSlideContext(presentation, index, { fonts }).options).items, `slide ${index}: editor.composeSlide is composeSlide over resolveSlideContext`);
  }
}

// Unknown ids fall back and report; they never throw (the layout study's rule): no layout record, `minimal`, `cool-horizon`, `aptos`.
{
  const presentation = { design: { theme: "no-such-theme", colorScheme: "no-such-colors", fontScheme: "no-such-fonts" }, slides: [{ ...slide, layout: "no-such-layout" }] };
  const diagnostics = [];
  const composition = createEditorSession(presentation).composeSlide(0, { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  assert.ok(composition.items.length > 0, "the slide still composes");
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code).sort(), ["unresolved-color-scheme", "unresolved-font-scheme", "unresolved-layout", "unresolved-theme"]);
  assert.equal(resolveSlideContext(presentation, 0).options.layout, undefined, "an unknown layout composes with no layout record");
  // A slide with no layout at all is the same: no layout record, no diagnostic.
  const none = [];
  createEditorSession({ slides: [slide] }).composeSlide(0, { onDiagnostic: (diagnostic) => none.push(diagnostic) });
  assert.deepEqual(none, []);
}

// An option still overrides what was resolved, and the slide index is checked.
{
  const editor = createEditorSession({ slides: [slide] });
  const layout = { id: "mine", name: "Mine" };
  assert.doesNotThrow(() => editor.composeSlide(0, { layout }));
  assert.throws(() => editor.composeSlide(5), (error) => error.code === "slide-index-out-of-range");
  assert.throws(() => editor.paginateSlide(-1), (error) => error.code === "slide-index-out-of-range");
}

// Pagination measures with the handle's textMeasurement: a wide measurement breaks a page the portable estimate would not.
{
  const long = { id: "long", title: "Long", text: "This draft preserves its words while the layout finds natural places to continue on another slide. ".repeat(40) };
  const wide = { textMeasurement: { measure: (text, size) => text.length * size * 2 } };
  const narrow = { textMeasurement: { measure: (text, size) => text.length * size * 0.1 } };
  const pagesWith = (fonts) => createEditorSession({ slides: [long] }).paginateSlide(0, { fonts }).pagination.slides.length;
  assert.ok(pagesWith(wide) > pagesWith(narrow), "the fonts handle's measurement decides the page breaks");
  assert.ok(pagesWith(wide) > 1);
}

console.log("Slide context: composition, pagination and the renderer share core's resolved fonts, layout and theme; unknown ids fall back and report.");
