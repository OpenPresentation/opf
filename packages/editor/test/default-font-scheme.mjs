// FF-35 (font-fidelity-everywhere): one shared last-resort font scheme, aptos, for
// every engine. A theme without a font scheme composes and transfers in the same
// fonts that core pagination, opf-render preview and opf-pptx export use
// (see opf docs/design-resolution.md, "Engine default font scheme").
import assert from "node:assert/strict";
import * as core from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { parseOpfTransfer, prepareOpfImport } from "../dist/transfer.js";
import { DEFAULT_FONT_SCHEME } from "../dist/font-defaults.js";

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
