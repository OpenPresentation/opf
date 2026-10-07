// A preview draws with the fonts handle's text measurement and nothing else. The renderer writes `fonts.embeddedFonts` into every
// SVG it returns (an export needs the faces in the file), so handing the full handle to the canvas, the thumbnails and the panel
// previews put megabytes of base64 into each of them and made every click in the playground three times slower.
import assert from "node:assert/strict";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import { previewFonts } from "../dist/font-gate.js";

const dataUrl = `data:font/ttf;base64,${"A".repeat(4096)}`;
const measurement = { measure: (text, size) => text.length * size * 0.5 };
const handle = { textMeasurement: measurement, embeddedFonts: [{ family: "Inter", weight: 400, italic: false, dataUrl }] };
const deck = { name: "Preview fonts", slides: [{ id: "a", title: "Hello" }] };

assert.equal(previewFonts(undefined), undefined, "no handle, no fonts");
const fonts = previewFonts(handle);
assert.deepEqual(Object.keys(fonts), ["textMeasurement"], "only the measurement is handed on");
assert.equal(fonts.textMeasurement, measurement);
handle.textMeasurement = { measure: () => 1 };
assert.equal(fonts.textMeasurement, handle.textMeasurement, "the measurement is read from the handle at each use");

assert.ok(renderSlideSvg(deck, 0, { fonts: handle }).includes("@font-face"), "the full handle embeds its faces (what an export wants)");
const preview = renderSlideSvg(deck, 0, { fonts });
assert.ok(!preview.includes("@font-face") && !preview.includes("base64"), "a preview embeds no face");
console.log("Preview fonts: measurement only; a preview SVG carries no embedded faces.");
