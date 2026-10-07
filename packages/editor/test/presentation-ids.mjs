import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import {
  collectReservedPresentationIds,
  remapSlideTreeIds,
  slideIds,
} from "../dist/presentation-ids.js";
import { prepareOpfImport, parseOpfTransfer } from "../dist/transfer.js";
import { isAuthoringColorRef } from "../dist/color-authoring.js";

const fixturePath = new URL("../../opf/docs/fixtures/color-references.opf.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

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

if (validate(fixture, { only: ["format"] }).valid) {
  const host = structuredClone(fixture);
  const guest = structuredClone(fixture);
  const { presentation } = prepareOpfImport(host, parseOpfTransfer(JSON.stringify(guest)));
  const adoptionIds = [];
  for (const slide of presentation.slides) {
    for (const id of slideIds(slide)) if (id.startsWith("kpi-adoption")) adoptionIds.push(id);
  }
  assert.ok(adoptionIds.length >= 2, "insert remaps duplicate payload ids");
  assert.ok(new Set(adoptionIds).size === adoptionIds.length);
  assert.equal(presentation.slides[0].extensions?.authoring?.note, fixture.slides[0].extensions.authoring.note);
}

const editor = createEditorSession({
  slides: [{ title: "A", text: "x".repeat(5000) }, payloadSlide],
});
const reserved = collectReservedPresentationIds(editor.presentation);
assert.ok(reserved.includes("kpi-adoption"));
try {
  editor.paginateSlide(0, {}, { rejectInvalid: true });
} catch (error) {
  assert.fail(`paginateSlide should not fail on payload id namespace: ${error.message}`);
}

const validation = validate({
  slides: [{ text: [{ text: "warn", color: "var:missing" }] }],
  variables: {},
}, { only: ["format", "references"] });
const warnings = validation.findings.filter((finding) => finding.severity === "warning");
assert.equal(validation.valid, true);
assert.ok(warnings.length);
assert.match(String(warnings[0]?.message ?? ""), /var:|variable|reference|color/i);

assert.equal(isAuthoringColorRef("accent2"), true);
assert.equal(isAuthoringColorRef("var:risk"), true);
assert.equal(isAuthoringColorRef("#ABC"), true);
assert.equal(isAuthoringColorRef("not-a-color"), false);

console.log("presentation-ids and reference-layer editor guards passed.");
