// Every note of the vector PDF export says what it is in its message. pdf-font-embedded carried only its facts (family, weight,
// glyphs, bytes, embedding), so a report built from it, such as the CLI's (`pdf/pdf-font-embedded`), showed an empty message.
import assert from "node:assert/strict";
import { toPdf, toSvg } from "../dist/index.js";
import { loadFonts } from "../dist/fonts-node.js";

const deck = {
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Messages",
  language: "en-US",
  slides: [{ title: "Quarterly review", blocks: [{ text: "Revenue grew 12% year on year." }, { text: "Ελληνικά and *emphasis*" }] }],
};
const fonts = (await loadFonts({ pack: "office", presentation: deck })).registry;
const svgs = toSvg(deck, { fonts: { textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts } });
const diagnostics = [];
await toPdf(svgs, { fonts: { fontFiles: fonts.fontFiles, useBundledFonts: false }, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });

const embedded = diagnostics.filter((diagnostic) => diagnostic.code === "pdf-font-embedded");
assert.ok(embedded.length >= 1, "the PDF embeds at least one face");
for (const diagnostic of diagnostics) {
  assert.equal(typeof diagnostic.message, "string", `${diagnostic.code} has a message`);
  assert.ok(diagnostic.message.trim().length > 0, `${diagnostic.code} has a message that says something`);
}
for (const face of embedded) {
  const label = `${face.postscriptName} (${face.family} ${face.weight}${face.italic ? " italic" : ""})`;
  const how = face.embedding === "subset" ? `as a subset of the ${face.glyphs} glyphs the PDF draws` : `whole, because its fsType forbids subsetting (the PDF draws ${face.glyphs} of its glyphs)`;
  const restricted = face.embeddingRestriction ? "; its fsType allows the PDF to be viewed and printed only, not edited" : "";
  assert.equal(face.message, `The font ${label} is embedded in the PDF ${how}, ${face.bytes} bytes${restricted}.`);
}
console.log(`ok - ${diagnostics.length} PDF notes, each with a message (${embedded.length} pdf-font-embedded): ${embedded.map((face) => face.message).join(" ")}`);
