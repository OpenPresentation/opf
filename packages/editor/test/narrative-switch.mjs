// FA-02: the root `narrative` is a string pointer; a custom narrative is a record in catalogs.narratives.records.
// The Narrative picker lists the document's own records first and switches by id, so it needs no inline-object editing.
import assert from "node:assert/strict";
import { validatePresentation } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { currentSwitchValue, listSwitchOptions, switchDimension } from "../dist/switches.js";

const record = {
  $schema: "https://openpresentation.org/schema/opf-narrative/v1",
  id: "proof-arc",
  name: "Proof Arc",
  duration: { min: 8, max: 20 },
  beats: [{ id: "contract", name: "Contract", type: "text" }, { id: "evidence", name: "Evidence", type: "chart" }],
};
const document = {
  name: "Narrative switch",
  narrative: "proof-arc",
  catalogs: { narratives: { records: [record] } },
  slides: [{ beat: "contract", title: "Contract" }, { beat: "evidence", title: "Evidence" }],
};
assert.equal(validatePresentation(document).valid, true);

const options = listSwitchOptions(document, "narratives");
assert.equal(options[0].id, "proof-arc", "the document's own record comes first");
assert.equal(options[0].label, "Proof Arc");
assert.ok(options.some((entry) => entry.id === "scqa"), "bundled records follow");
assert.deepEqual(currentSwitchValue(document, "narratives"), { value: "proof-arc", scope: "deck" });

const editor = createEditorSession(structuredClone(document), { rejectInvalid: true });
const change = switchDimension(editor, "narratives", "scqa");
assert.equal(editor.document.narrative, "scqa");
assert.deepEqual(editor.document.slides.map((slide) => slide.beat), ["contract", "evidence"], "slides keep their beat links");
assert.equal(editor.document.catalogs.narratives.records[0].id, "proof-arc", "the custom record stays");
assert.equal(typeof editor.document.narrative, "string");
assert.ok(change.patches.every((patch) => patch.path === "/narrative"), "one root string replace");
editor.undo();
assert.equal(editor.document.narrative, "proof-arc");
switchDimension(editor, "narratives", "proof-arc");
assert.equal(editor.document.narrative, "proof-arc");
console.log("narrative switch: ok");
