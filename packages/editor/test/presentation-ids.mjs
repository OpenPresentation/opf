import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validatePresentation } from "@openpresentation/opf";
import { createEditorSession, validateOpfDocument } from "../dist/index.js";
import {
  collectReservedPresentationIds,
  remapSlideTreeIds,
  slideIds,
} from "../dist/presentation-ids.js";
import { prepareOpfImport, parseOpfTransfer } from "../dist/transfer.js";
import { isAuthoringColorRef } from "../dist/color-authoring.js";

const fixturePath = new URL("../../opf/docs/fixtures/color-references.opf.json", import.meta.url);
let fixture;
try {
  fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
} catch {
  console.log("presentation-ids: skipped color-references fixture (link OPF checkout at main 4761091)");
  fixture = null;
}

const payloadSlide = {
  id: "host",
  left: { id: "kpi-adoption", metric: { value: "1x", label: "Adoption" } },
};

assert.deepEqual(slideIds(payloadSlide).sort(), ["host", "kpi-adoption"].sort());
assert.ok(collectReservedPresentationIds({ slides: [payloadSlide, { id: "other" }] }).includes("kpi-adoption"));

const ids = new Set(["kpi-adoption"]);
const incoming = structuredClone(payloadSlide);
incoming.id = "guest";
remapSlideTreeIds(incoming, ids);
assert.equal(incoming.left.id, "kpi-adoption-2");
assert.ok(ids.has("kpi-adoption-2"));

if (fixture && validateOpfDocument(fixture).valid) {
  const host = structuredClone(fixture);
  const guest = structuredClone(fixture);
  const { document } = prepareOpfImport(host, parseOpfTransfer(JSON.stringify(guest)));
  const adoptionIds = [];
  for (const slide of document.slides) {
    for (const id of slideIds(slide)) if (id.startsWith("kpi-adoption")) adoptionIds.push(id);
  }
  assert.ok(adoptionIds.length >= 2, "insert remaps duplicate payload ids");
  assert.ok(new Set(adoptionIds).size === adoptionIds.length);
  assert.equal(document.slides[0].extensions?.authoring?.note, fixture.slides[0].extensions.authoring.note);
}

const referenceLayer =
  validatePresentation({ slides: [{ left: { id: "probe", text: "hi" } }] }).valid;

const editor = createEditorSession({
  slides: [{ title: "A", text: "x".repeat(5000) }, payloadSlide],
});
const reserved = collectReservedPresentationIds(editor.document);
assert.ok(reserved.includes("kpi-adoption"));
if (referenceLayer) {
  try {
    editor.paginateSlide(0, {}, { rejectInvalid: true });
  } catch (error) {
    assert.fail(`paginateSlide should not fail on payload id namespace: ${error.message}`);
  }
} else {
  console.log("presentation-ids: skipped paginateSlide probe (published opf 0.10.1 schema)");
}

const validation = validateOpfDocument({
  slides: [{ text: [{ text: "warn", color: "var:missing" }] }],
  variables: {},
});
assert.ok(Array.isArray(validation.warnings));
if (referenceLayer) {
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.length);
  assert.match(String(validation.warnings[0]?.message ?? ""), /var:|variable|reference|color/i);
} else {
  console.log("presentation-ids: skipped var: warning probe (published opf 0.10.1 schema)");
}

assert.equal(isAuthoringColorRef("accent2"), true);
assert.equal(isAuthoringColorRef("var:risk"), true);
assert.equal(isAuthoringColorRef("#ABC"), true);
assert.equal(isAuthoringColorRef("not-a-color"), false);

console.log("presentation-ids and reference-layer editor guards passed.");
