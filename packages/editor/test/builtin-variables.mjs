// FA-04, FA-31: the editor lists the document's built-in variables read-only, inserts them as tokens without a
// declaration (the slide-scoped three too), and header and footer zones use them as variables in their text.
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

/// FA-31: the slide-scoped built-ins are listed with scope "slide", after the deck-wide ones, with no value of their own.
const slideScoped = list.filter((entry) => entry.scope === "slide" && entry.kind === "text");
assert.deepEqual(slideScoped.map((entry) => entry.name), ["slide.number", "slide.section", "deck.slideCount"]);
assert.deepEqual(slideScoped.map((entry) => entry.label), ["Slide number", "Section", "Slide count"]);
assert.ok(slideScoped.every((entry) => entry.kind === "text" && !("value" in entry)), "no single value for a value that varies per slide");
assert.deepEqual(list.filter((entry) => entry.scope === "slide" && entry.kind === "text").map((entry) => entry.name), ["slide.number", "slide.section", "deck.slideCount"]);
assert.ok(list.filter((entry) => entry.scope !== "slide").every((entry) => entry.scope === "deck"));

/// RR-71: the organization logos are slide-scoped images (placed with var:, the artwork chosen per slide background), listed read-only
/// after the slide-scoped text values: the primary organization's four shapes, then each organization by id.
const logos = list.filter((entry) => entry.kind === "image" && entry.scope === "slide");
assert.deepEqual(logos.map((entry) => entry.name), ["organization.logo", "organization.logo.stacked", "organization.logo.icon", "organization.logo.wordmark", "organization.acme.logo", "organization.acme.logo.stacked", "organization.acme.logo.icon", "organization.acme.logo.wordmark"]);
assert.ok(logos.every((entry) => entry.label && !("value" in entry) && Array.isArray(entry.uses)), "no single value: each slide gets its own artwork");
assert.deepEqual(logos.map((entry) => entry.label).slice(0, 4), ["Organization logo", "Organization logo (stacked)", "Organization logo (icon)", "Organization logo (wordmark)"]);
assert.ok(list.indexOf(logos[0]) > list.indexOf(byName["deck.slideCount"]), "they come after the slide-scoped text values");
assert.equal(list.filter((entry) => entry.name.includes(".logo")).length, logos.length, "no other kind of logo is listed");
// The names are valid built-in names for the editor's token helpers, and a logo is not a {{ }} text token.
assert.equal(variableToken("organization.logo.icon"), "{{organization.logo.icon}}");
assert.equal(variableToken("organization.acme.logo.wordmark"), "{{organization.acme.logo.wordmark}}");
// Using a logo as a whole image field records the use; availability follows the logo.
const withLogo = createEditorSession({ ...document(), organization: { id: "acme", name: "Acme Corp", logo: { icon: "asset:mark" } }, assets: { mark: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=" } }, { rejectInvalid: true });
setHeaderFooterZone(withLogo, "footer", "right", { image: "var:organization.logo.icon" });
const used = listBuiltins(withLogo.presentation).find((entry) => entry.name === "organization.logo.icon");
assert.equal(used.available, true);
assert.deepEqual(used.uses.map((use) => use.path), ["/design/footer/right/image"]);
assert.equal(byName["slide.number"].available, true);
assert.equal(byName["deck.slideCount"].available, true);
assert.equal(byName["slide.section"].available, false, "no slide has a section yet");
// They insert like any built-in (no declaration), also the camel-case count, and mark the document as using built-ins.
const withNumber = createEditorSession(document(), { rejectInvalid: true });
for (const name of ["slide.number", "slide.section", "deck.slideCount"]) {
  assert.equal(variableToken(name), `{{${name}}}`);
  insertVariableToken(withNumber, ["slides", 0, "subtitle"], name);
}
assert.equal(withNumber.presentation.slides[0].subtitle, "By {{slide.number}}{{slide.section}}{{deck.slideCount}}");
assert.equal(withNumber.presentation.variables, undefined, "no variable is declared");
assert.deepEqual(listBuiltins(withNumber.presentation).find((entry) => entry.name === "slide.number").uses.map((use) => use.path), ["/slides/0/subtitle"]);
assert.throws(() => insertVariableToken(withNumber, ["slides", 0, "subtitle"], "slide.title"), "an unknown slide.* path is refused by the validated edit");
assert.equal(withNumber.presentation.slides[0].subtitle, "By {{slide.number}}{{slide.section}}{{deck.slideCount}}", "the refused edit changed nothing");

// Header and footer values are variables in a zone's text; the 0.16 flags are gone.
for (const removed of ["organization", "speaker", "section", "slideNumber", "slideNumberFormat", "logo"]) assert.ok(!ZONE_FIELDS.includes(removed), `${removed} is not a zone field`);
setHeaderFooterZone(editor, "footer", "left", { text: "{{organization.name}}\n{{speaker.name}}, {{speaker.title}}" });
assert.deepEqual(readHeaderFooterZone(editor.presentation, "footer", "left"), { text: "{{organization.name}}\n{{speaker.name}}, {{speaker.title}}" });
assert.throws(() => prepareHeaderFooterZone(editor.presentation, "footer", "left", { speaker: true }), /Unknown header\/footer field: speaker\. Write \{\{speaker\.name\}\} in the text\./);
assert.equal(editor.presentation.design.footer.left.speaker, undefined);
assert.equal(listBuiltins(editor.presentation).find((entry) => entry.name === "speaker.title").uses.map((use) => use.path).join(), "/design/footer/left/text", "the footer text is a use of the built-in");
assert.deepEqual(designWarnings(editor.presentation, 0), []);

// A zone that shows the speaker or the organization through its text warns when the deck has no value for it.
const noSpeaker = { ...document(), design: { footer: { right: { text: "{{speaker.name}}" } } } };
delete noSpeaker.speaker;
assert.deepEqual(designWarnings(noSpeaker, 0).map((warning) => [warning.code, warning.path]), [["unresolved-content", "design.footer.right.text"]]);
const noOrganization = { ...document(), design: { header: { left: { text: "{{organization.name}} | {{organization.acme.name}}" } } } };
delete noOrganization.organization;
assert.deepEqual(designWarnings(noOrganization, 0).map((warning) => warning.message), ["The header left zone shows {{organization.name}}, but the presentation has no value for it."], "an unknown id is not this panel's finding");
// The slide-scoped values never warn from the deck: only {{slide.section}} on a slide without a section does.
const perSlide = { ...document(), design: { footer: { right: { text: "{{slide.number}} / {{deck.slideCount}}" } } } };
assert.deepEqual(designWarnings(perSlide, 0), []);
console.log("Editor built-in variables passed: listing (deck and slide scope), token insertion, header/footer variables and warnings.");
