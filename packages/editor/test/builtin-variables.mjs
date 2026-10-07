// FA-04: the editor lists the document's built-in variables read-only, inserts them as tokens without a
// declaration, and edits the `speaker` header/footer field like the other zone fields.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import { hasTemplateVariables, insertVariableToken, listBuiltins, variableToken } from "../dist/templates.js";
import { ZONE_FIELDS, designWarnings, prepareHeaderFooterZone, readHeaderFooterZone, setHeaderFooterZone } from "../dist/design-options.js";

const document = () => ({
  name: "Q4 Review",
  speaker: [{ id: "ada", name: "Ada Lovelace", title: "CTO" }],
  organization: { id: "acme", name: "Acme Corp" },
  slides: [{ id: "cover", title: "Hello", subtitle: "By " }],
});

// Listing: kinds, availability, current values, uses; the generic names first, then the id-addressed ones.
const editor = createEditorSession(document(), { rejectInvalid: true });
assert.equal(hasTemplateVariables(editor.presentation), false, "a deck that uses no built-in is not a template");
const list = listBuiltins(editor.presentation);
const byName = Object.fromEntries(list.map((entry) => [entry.name, entry]));
assert.deepEqual(list.slice(0, 3).map((entry) => entry.name), ["deck.name", "deck.description", "deck.author"]);
assert.equal(byName["speaker.name"].value, "Ada Lovelace");
assert.equal(byName["speaker.name"].available, true);
assert.equal(byName["speaker.photo"].available, false);
assert.equal(byName["speaker.photo"].kind, "image");
assert.equal(byName.speakers.kind, "list");
assert.ok(byName["speaker.ada.title"] && byName["organization.acme.logo"]);
assert.ok(list.every((entry) => entry.label && Array.isArray(entry.uses)));

// Inserting: a built-in needs no declaration; an unknown path is refused by the validated edit.
assert.equal(variableToken("speaker.name"), "{{speaker.name}}");
assert.throws(() => variableToken("Speaker.Name"), /kebab-case/);
const inserted = insertVariableToken(editor, ["slides", 0, "subtitle"], "speaker.name");
assert.equal(inserted.token, "{{speaker.name}}");
assert.equal(editor.presentation.slides[0].subtitle, "By {{speaker.name}}");
assert.equal(editor.presentation.variables, undefined, "no variable is declared");
assert.equal(hasTemplateVariables(editor.presentation), true);
assert.deepEqual(listBuiltins(editor.presentation).find((entry) => entry.name === "speaker.name").uses.map((use) => use.path), ["/slides/0/subtitle"]);
editor.undo();
assert.equal(editor.presentation.slides[0].subtitle, "By ");
assert.throws(() => insertVariableToken(editor, ["slides", 0, "subtitle"], "speaker.nickname"));
assert.equal(editor.presentation.slides[0].subtitle, "By ", "the refused edit changed nothing");

// The speaker zone field.
assert.ok(ZONE_FIELDS.includes("speaker"));
const change = setHeaderFooterZone(editor, "footer", "left", { organization: true, speaker: true });
assert.deepEqual(readHeaderFooterZone(editor.presentation, "footer", "left"), { organization: true, speaker: true });
assert.equal(editor.presentation.design.footer.left.speaker, true);
setHeaderFooterZone(editor, "footer", "left", { speaker: false });
assert.deepEqual(editor.presentation.design.footer.left, { organization: true }, "false removes the flag");
assert.throws(() => prepareHeaderFooterZone(editor.presentation, "footer", "left", { speaker: "yes" }), /true or false/);
assert.ok(change);

// A zone that shows the speaker warns when the deck has no named speaker.
setHeaderFooterZone(editor, "footer", "right", { speaker: true });
assert.deepEqual(designWarnings(editor.presentation, 0).filter((warning) => warning.path.endsWith(".speaker")), []);
const noSpeaker = { ...document(), design: { footer: { right: { speaker: true } } } };
delete noSpeaker.speaker;
assert.deepEqual(designWarnings(noSpeaker, 0).map((warning) => [warning.code, warning.path]), [["unresolved-content", "design.footer.right.speaker"]]);
console.log("Editor built-in variables passed: listing, token insertion, speaker zone field and warning.");
