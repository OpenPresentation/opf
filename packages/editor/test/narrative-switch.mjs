// FA-02: the root `narrative` is a string pointer; a custom narrative is a record embedded in the document (OPF 0.15:
// catalogs.custom.narratives). The Narrative picker lists the document's own records first and switches by reference.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { currentSwitchValue, listSwitchOptions, switchDimension } from "../dist/switches.js";

const catalogs = [defaultCatalog];
const record = {
  name: "Proof Arc",
  duration: { min: 8, max: 20 },
  beats: [{ id: "contract", name: "Contract", type: "text" }, { id: "evidence", name: "Evidence", type: "chart" }],
};
const document = {
  name: "Narrative switch",
  narrative: "proof-arc",
  catalogs: { custom: { narratives: { "proof-arc": record } } },
  slides: [{ beat: "contract", title: "Contract" }, { beat: "evidence", title: "Evidence" }],
};
assert.equal(validate(document, { only: ["format"] }).valid, true);

const options = listSwitchOptions(document, "narratives", { catalogs });
assert.equal(options[0].id, "proof-arc", "the document's own record comes first");
assert.equal(options[0].label, "Proof Arc");
assert.ok(options.some((entry) => entry.id === "scqa"), "the registered catalog's records follow");
assert.deepEqual(currentSwitchValue(document, "narratives"), { value: "proof-arc", scope: "deck" });

const editor = createEditorSession(structuredClone(document), { rejectInvalid: true, catalogs });
const change = switchDimension(editor, "narratives", "scqa");
assert.equal(editor.presentation.narrative, "scqa");
assert.deepEqual(editor.presentation.slides.map((slide) => slide.beat), ["contract", "evidence"], "slides keep their beat links");
assert.deepEqual(editor.presentation.catalogs.custom.narratives["proof-arc"], record, "the custom record stays");
assert.equal(typeof editor.presentation.narrative, "string");
assert.ok(change.patches.every((patch) => patch.path === "/narrative"), "one root string replace");
editor.undo();
assert.equal(editor.presentation.narrative, "proof-arc");
switchDimension(editor, "narratives", "proof-arc");
assert.equal(editor.presentation.narrative, "proof-arc");
console.log("narrative switch: ok");
