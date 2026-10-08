// RR-55: the editor takes a slide's composition context from core's `resolveSlideContext`, the one resolution every engine uses (slide
// design, then deck design, then theme, then the engine default, per field), and measures with the fonts handle it is given. There is
// no editor-side copy of that chain: composition, pagination and the renderer agree because they ask the same function.
import assert from "node:assert/strict";
import { resolveSlideContext } from "@openpresentation/opf";
import { composeSlide } from "@openpresentation/opf/composition";
import { resolvePresentation } from "@openpresentation/opf-render/svg";
import * as editorEntry from "../dist/index.js";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";

// OPF 0.15 (FA-23): references resolve in the document, then in the catalogs the host registers.
const gallery = [defaultCatalog];

assert.equal("resolveSlideFonts" in editorEntry, false, "the editor's own font chain is gone");
assert.equal("validateOpfDocument" in editorEntry, false, "the editor's own validation adapter is gone");

// A measurement that records which families the composition asked for.
const recorder = () => {
  const families = new Set();
  return { families, fonts: { textMeasurement: { measure: (text, size, style) => (families.add(style.fontFamily), text.length * size * 0.5) } } };
};
const slide = { id: "s", title: "Title", text: "Body copy" };
const familiesOf = (presentation, options = {}, index = 0, catalogs = gallery) => {
  const { families, fonts } = recorder();
  createEditorSession(presentation, { catalogs }).composeSlide(index, { fonts, ...options });
  return [...families].sort();
};

// The deck's font scheme, a slide's own scheme, a theme's scheme, an inline scheme and a scheme from a per-call host catalog all compose in
// the families core resolves with the session's catalogs plus the call's: the editor never asks "which fonts" itself.
const cases = [
  ["the default (no design)", { slides: [slide] }, 0, undefined],
  ["the deck's font scheme", { design: { fontScheme: "roboto" }, slides: [slide] }, 0, undefined],
  ["a slide's own font scheme", { design: { fontScheme: "roboto" }, slides: [slide, { ...slide, id: "t", design: { fontScheme: "georgia" } }] }, 1, undefined],
  ["a theme's font scheme", { design: { theme: "classic" }, slides: [slide] }, 0, undefined],
  ["an inline font scheme", { design: { fontScheme: { id: "x", major: "Inter", minor: "Inter" } }, slides: [slide] }, 0, undefined],
  ["a scheme only a per-call host catalog has", { catalogs: { host: { source: "pkg:host" } }, design: { fontScheme: "host:host-lora" }, slides: [slide] }, 0, [{ source: "pkg:host", fontSchemes: { "host-lora": { name: "Host Lora", major: "Lora", minor: "Lora" } } }]],
];
for (const [name, presentation, index, extra] of cases) {
  const expected = resolveSlideContext(presentation, index, { catalogs: [...gallery, ...(extra ?? [])] }).options.fontFamilies;
  const drawn = familiesOf(presentation, extra ? { catalogs: extra } : {}, index);
  const names = [...new Set([expected.heading, expected.body])].sort();
  assert.deepEqual(drawn, names, `${name}: composition measures the families core resolved (${names.join(", ")})`);
}
assert.deepEqual(familiesOf({ design: { fontScheme: "roboto" }, slides: [slide] }), ["Roboto"], "a deck that sets roboto composes in Roboto, not the default Aptos");
assert.deepEqual(familiesOf({ slides: [slide] }), ["Aptos", "Aptos Display"]);
assert.deepEqual(familiesOf({ design: { fontScheme: "roboto" }, slides: [slide] }, {}, 0, []), ["Aptos", "Aptos Display"], "with no catalog registered roboto is unresolved: the engine default");

// The editor composes what the renderer draws: same geometry through the same context.
{
  const { fonts } = recorder();
  const presentation = { design: { theme: "classic", fontScheme: "roboto" }, slides: [slide, { id: "two", title: "Two", items: ["a", "b", "c"] }] };
  const editor = createEditorSession(presentation, { catalogs: gallery });
  for (const index of [0, 1]) {
    assert.deepEqual(editor.composeSlide(index, { fonts }).items, resolvePresentation(presentation, { fonts, catalogs: gallery }).slides[index].geometry.items, `slide ${index}: editor and renderer geometry agree`);
    // And it is exactly core's composeSlide over core's context, with the same catalogs.
    assert.deepEqual(editor.composeSlide(index, { fonts }).items, composeSlide(presentation.slides[index], resolveSlideContext(presentation, index, { fonts, catalogs: gallery }).options).items, `slide ${index}: editor.composeSlide is composeSlide over resolveSlideContext`);
  }
}

// Unknown references fall back and report; they never throw: no layout record (automatic composition), core's engine defaults.
{
  const presentation = { design: { theme: "no-such-theme", colorScheme: "no-such-colors", fontScheme: "no-such-fonts" }, slides: [{ ...slide, layout: "no-such-layout" }] };
  const diagnostics = [];
  const composition = createEditorSession(presentation, { catalogs: gallery }).composeSlide(0, { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  assert.ok(composition.items.length > 0, "the slide still composes");
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), diagnostics.map(() => "unresolved-reference"));
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.kind).sort(), ["colorSchemes", "fontSchemes", "layouts", "themes"]);
  assert.deepEqual(diagnostics.find((diagnostic) => diagnostic.kind === "layouts").fallback, "automatic");
  assert.equal(resolveSlideContext(presentation, 0, { catalogs: gallery }).options.layout, undefined, "an unknown layout composes with no layout record");
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
