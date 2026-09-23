// FF-35 (font-fidelity-everywhere): one shared last-resort font scheme, aptos, for
// every engine. A theme without a font scheme composes and transfers in the same
// fonts that core pagination, opf-render preview and opf-pptx export use
// (see opf docs/design-resolution.md, "Engine default font scheme").
import assert from "node:assert/strict";
import * as core from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { parseOpfTransfer, prepareOpfImport } from "../dist/transfer.js";
import { DEFAULT_FONT_SCHEME, resolveFontSchemeReference } from "../dist/font-defaults.js";

assert.equal(DEFAULT_FONT_SCHEME, "aptos");
// Parity with core's exported constant once the installed core publishes it.
if ("DEFAULT_FONT_SCHEME" in core) assert.equal(DEFAULT_FONT_SCHEME, core.DEFAULT_FONT_SCHEME);
assert.ok(core.fontSchemes.some((scheme) => scheme.id === DEFAULT_FONT_SCHEME), "the default is a bundled scheme");

const textSlide = { id: "text", title: "Title", text: "Body copy" };
const bare = { $schema: "https://openpresentation.org/schema/opf-theme/v1", id: "bare", name: "Bare" };
const bareTheme = (extra = {}) => ({
  name: "Theme without font scheme",
  design: { theme: "bare", ...extra },
  catalogs: { themes: { records: [bare] } },
  slides: [textSlide],
});
function measured(document) {
  const families = new Set();
  createEditorSession(document).composeSlide(0, {
    textMeasurement: {
      measure: (text, size, style) => {
        families.add(style.fontFamily);
        return text.length * size * 0.5;
      },
    },
  });
  return [...families].sort();
}

const aptos = ["Aptos", "Aptos Display"];
// A custom theme without a font scheme composes in Aptos, as it is exported.
assert.deepEqual(measured(bareTheme()), aptos);
// Same as a document with no design (default minimal theme names aptos).
assert.deepEqual(measured({ name: "Defaults", slides: [textSlide] }), aptos);
// Deck choices still win over the last resort.
assert.deepEqual(measured(bareTheme({ fontScheme: "roboto" })), ["Roboto"]);

// Inserting slides freezes the source deck's effective design; the frozen font
// scheme for a theme without one is the shared default, not roboto.
const current = { name: "Target", design: { fontScheme: "roboto" }, slides: [{ id: "existing", title: "Existing" }] };
const inserted = prepareOpfImport(current, parseOpfTransfer(JSON.stringify(bareTheme()))).document;
assert.equal(inserted.slides.length, 2);
assert.equal(inserted.slides[1].design.fontScheme, DEFAULT_FONT_SCHEME);
assert.deepEqual(core.validatePresentation(inserted).valid, true);

console.log("shared default font scheme (aptos) passed");

// FF-35b: one rule for an unresolvable font scheme in every engine. The default
// (aptos) record is the base, sibling overrides still apply, and one
// `unresolved-font-scheme` diagnostic names the reference. Same table as opf
// packages/javascript/test/font-scheme-defaults.test.mjs.
const unknownCases = [
  ['string id', {design: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id', {design: {fontScheme: {id: 'no-such-scheme'}}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id with a family pair', {design: {fontScheme: {id: 'no-such-scheme', major: 'Inter', minor: 'Inter'}}}, ['Inter'], 'design.fontScheme'],
  ['slide design', {slideDesign: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'slides.0.design.fontScheme'],
  ['theme record', {design: {theme: 'bare-unknown'}, catalogs: {themes: {records: [{$schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'bare-unknown', name: 'Bare', fontScheme: 'no-such-scheme'}]}}}, ['Aptos', 'Aptos Display'], 'design.theme'],
  ['inline scheme without id', {design: {fontScheme: {major: 'Inter', minor: 'Inter'}}}, ['Inter'], undefined],
  ['inline code role without id', {design: {fontScheme: {code: {family: 'JetBrains Mono'}}}}, ['Aptos', 'Aptos Display'], undefined],
];
const unknownDeck = ({design, slideDesign, catalogs}) => ({name: 'Unknown font scheme', ...(design ? {design} : {}), ...(catalogs ? {catalogs} : {}), slides: [{id: 't', title: 'Title', text: 'Body', ...(slideDesign ? {design: slideDesign} : {})}, {id: 'u', title: 'Second', text: 'Body'}]});
const expectedDiagnostics = path => path ? [{code: 'unresolved-font-scheme', path, id: 'no-such-scheme', fallback: 'aptos', message: "Font scheme 'no-such-scheme' is not in the inline or bundled catalogs; using the default font scheme 'aptos'."}] : [];
// Core pagination agreement, checked once the installed core exports
// resolveFontSchemeReference (opf after FF-35b). Published core 0.11.0 lacks it,
// so the check is skipped until the sibling installs a core release that has it.
const corePagination = deck => {
  const diagnostics = [], measured = new Set();
  core.paginatePresentation(structuredClone(deck), {onDiagnostic: diagnostic => diagnostics.push(diagnostic), textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}});
  return {diagnostics, families: [...measured].sort()};
};
const checkCore = (deck, expected, diagnostics, name) => {
  if (!('resolveFontSchemeReference' in core)) return;
  const reference = corePagination(deck);
  assert.deepEqual(reference.families, expected, `core pagination: ${name}`);
  assert.deepEqual(reference.diagnostics, diagnostics, `core pagination: ${name}`);
};
for (const [name, input, expected, path] of unknownCases) {
  const deck = unknownDeck(input), diagnostics = [], measuredFamilies = new Set();
  createEditorSession(deck).composeSlide(0, {onDiagnostic: diagnostic => diagnostics.push(diagnostic), textMeasurement: {measure: (text, size, style) => { measuredFamilies.add(style.fontFamily); return text.length * size * 0.5; }}});
  assert.deepEqual([...measuredFamilies].sort(), expected, name);
  assert.deepEqual(diagnostics, expectedDiagnostics(path), name);
  checkCore(deck, expected, diagnostics, name);
}
// The local resolver matches core's once the installed core exports it.
if ("resolveFontSchemeReference" in core) {
  const lookup = id => core.fontSchemes.find(record => record.id === id);
  for (const reference of ["roboto", "no-such-scheme", { id: "no-such-scheme", code: { family: "JetBrains Mono" } }, { major: "Inter", minor: "Inter" }, undefined])
    assert.deepEqual(resolveFontSchemeReference(reference, lookup, "slides.1.design.fontScheme"), core.resolveFontSchemeReference(reference, lookup, "slides.1.design.fontScheme"));
}
console.log("unresolved font schemes: default base and one diagnostic, as in every engine");
