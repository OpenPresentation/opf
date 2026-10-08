// FF-35 (font-fidelity-everywhere): one shared last-resort font scheme for every engine. OPF 0.15 (FA-23): it is core's
// ENGINE_DEFAULT_FONT_SCHEME (Aptos Display / Aptos), code, not a catalog record. A theme without a font scheme composes and
// transfers in the same fonts that core pagination, opf-render preview and opf-pptx export use.
import assert from "node:assert/strict";
import { ENGINE_DEFAULT_FONT_SCHEME, paginate, validate } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { parseOpfTransfer, prepareOpfImport } from "../dist/transfer.js";

assert.deepEqual({ major: ENGINE_DEFAULT_FONT_SCHEME.major, minor: ENGINE_DEFAULT_FONT_SCHEME.minor }, { major: "Aptos Display", minor: "Aptos" });

const catalogs = [defaultCatalog];
const textSlide = { id: "text", title: "Title", text: "Body copy" };
const bareTheme = (extra = {}) => ({
  name: "Theme without font scheme",
  design: { theme: "bare", ...extra },
  catalogs: { custom: { themes: { bare: { name: "Bare" } } } },
  slides: [textSlide],
});
function measured(presentation, options = {}) {
  const families = new Set();
  createEditorSession(presentation, options).composeSlide(0, {
    fonts: {
      textMeasurement: {
        measure: (text, size, style) => {
          families.add(style.fontFamily);
          return text.length * size * 0.5;
        },
      },
    },
  });
  return [...families].sort();
}

const aptos = ["Aptos", "Aptos Display"];
// A custom theme without a font scheme composes in Aptos, as it is exported.
assert.deepEqual(measured(bareTheme()), aptos);
// Same as a document with no design and no catalog registered: the engine default.
assert.deepEqual(measured({ name: "Defaults", slides: [textSlide] }), aptos);
// Deck choices still win over the last resort.
assert.deepEqual(measured(bareTheme({ fontScheme: "roboto" }), { catalogs }), ["Roboto"]);

// Inserting slides freezes the source deck's effective design; the frozen font scheme for a theme without one is the
// engine default (written out, since the target deck names another scheme), not the target's roboto.
const current = { name: "Target", design: { fontScheme: "roboto" }, slides: [{ id: "existing", title: "Existing" }] };
const inserted = prepareOpfImport(current, parseOpfTransfer(JSON.stringify(bareTheme())), { catalogs }).presentation;
assert.equal(inserted.slides.length, 2);
assert.deepEqual(inserted.slides[1].design.fontScheme, ENGINE_DEFAULT_FONT_SCHEME);
assert.deepEqual(validate(inserted, { only: ["format"] }).valid, true);
assert.deepEqual(measured(inserted, { catalogs }), ["Roboto"], "the target's own slide keeps its fonts");

console.log("shared engine default font scheme (Aptos) passed");

// FF-35b: one rule for an unresolvable font scheme in every engine. The engine default is the base, sibling overrides still
// apply, and one unresolved-reference diagnostic names the reference. The editor reports exactly what core pagination does.
const unknownCases = [
  ["string id", { design: { fontScheme: "no-such-scheme" } }, ["Aptos", "Aptos Display"], true],
  ["object id", { design: { fontScheme: { id: "no-such-scheme" } } }, ["Aptos", "Aptos Display"], true],
  ["object id with a family pair", { design: { fontScheme: { id: "no-such-scheme", major: "Inter", minor: "Inter" } } }, ["Inter"], true],
  ["slide design", { slideDesign: { fontScheme: "no-such-scheme" } }, ["Aptos", "Aptos Display"], true],
  ["theme record", { design: { theme: "bare-unknown" }, catalogs: { custom: { themes: { "bare-unknown": { name: "Bare", fontScheme: "no-such-scheme" } } } } }, ["Aptos", "Aptos Display"], true],
  ["inline scheme without id", { design: { fontScheme: { major: "Inter", minor: "Inter" } } }, ["Inter"], false],
  ["inline code role without id", { design: { fontScheme: { code: "JetBrains Mono" } } }, ["Aptos", "Aptos Display"], false],
];
const unknownDeck = ({ design, slideDesign, catalogs: groups }) => ({ name: "Unknown font scheme", ...(design ? { design } : {}), ...(groups ? { catalogs: groups } : {}), slides: [{ id: "t", title: "Title", text: "Body", ...(slideDesign ? { design: slideDesign } : {}) }, { id: "u", title: "Second", text: "Body" }] });
// Core pagination agreement: the same families, the same diagnostics.
const corePagination = (deck) => {
  const diagnostics = [], families = new Set();
  paginate(structuredClone(deck), { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic), fonts: { textMeasurement: { measure: (text, size, style) => { families.add(style.fontFamily); return text.length * size * 0.5; } } } });
  return { diagnostics, families: [...families].sort() };
};
for (const [name, input, expected, reported] of unknownCases) {
  const deck = unknownDeck(input), diagnostics = [], families = new Set();
  createEditorSession(deck).composeSlide(0, { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic), fonts: { textMeasurement: { measure: (text, size, style) => { families.add(style.fontFamily); return text.length * size * 0.5; } } } });
  assert.deepEqual([...families].sort(), expected, name);
  const fontDiagnostics = diagnostics.filter((diagnostic) => diagnostic.kind === "fontSchemes");
  assert.equal(fontDiagnostics.length, reported ? 1 : 0, `${name}: diagnostics`);
  if (reported) {
    assert.equal(fontDiagnostics[0].code, "unresolved-reference", name);
    assert.equal(fontDiagnostics[0].reference, "no-such-scheme", name);
    assert.equal(fontDiagnostics[0].fallback, "engine-default", name);
    assert.match(fontDiagnostics[0].message, /no-such-scheme/, name);
  }
  const reference = corePagination(deck);
  assert.deepEqual(reference.families, expected, `core pagination: ${name}`);
  // The same reference, path and fallback as core pagination (the message names the host catalogs each call registered).
  const shape = (list) => list.map(({ code, kind, reference, path, fallback }) => ({ code, kind, reference, path, fallback }));
  assert.deepEqual(shape(reference.diagnostics.filter((diagnostic) => diagnostic.kind === "fontSchemes")), shape(fontDiagnostics), `core pagination: ${name}`);
}
console.log("unresolved font schemes: engine default base and one diagnostic, as in every engine");
