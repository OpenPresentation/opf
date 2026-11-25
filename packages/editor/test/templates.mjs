// RR-32: the fill model behind the Fill template panel: typed fields, previews that never touch the
// document, one undoable fill, declarations and token insertion as validated session edits.
import assert from "node:assert/strict";
import { createEditorSession } from "../dist/index.js";
import {
  TEMPLATE_INPUT_TYPES,
  createTemplateFill,
  declareVariable,
  fieldTextToValue,
  hasTemplateVariables,
  insertVariableToken,
  isTemplateDocument,
  limitUsage,
  listTemplateFields,
  previewTemplate,
  removeVariableTranslation,
  setTemplate,
  setVariableTranslation,
  suggestVariableId,
  translationLanguages,
  templateStatus,
  valueToFieldText,
  variableToken,
} from "../dist/templates.js";

const template = () => ({
  template: true,
  name: "Quarterly review for {{client}}",
  variables: {
    client: { type: "text", label: "Client name", example: "Acme Corp" },
    revenue: { type: "number", format: "$#,##0", example: 1250000 },
    kickoff: { type: "date", value: "2026-10-01" },
    wins: { type: "list", example: ["Faster onboarding", "Lower churn"] },
    logo: { type: "image", required: false },
    accent: { type: "color", value: "#0F4C81" },
  },
  assets: { mark: "./mark.png" },
  slides: [
    { id: "cover", title: "Quarterly review: {{client}}", subtitle: "Kickoff {{kickoff}}", text: [{ text: "Revenue " }, { text: "{{revenue}}", bold: true }] },
    { id: "wins", title: "Wins", bullets: ["Revenue {{revenue}}", "var:wins"], image: "var:logo" },
    { id: "chart", title: "Revenue", chart: { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["This quarter", "var:revenue"]] } } },
  ],
});

const editor = createEditorSession(template(), { rejectInvalid: true });
assert.equal(editor.validation.valid, true, "a template is a valid document in the session");
assert.equal(isTemplateDocument(editor.presentation), true);
assert.equal(hasTemplateVariables(editor.presentation), true);
assert.equal(hasTemplateVariables({ variables: { risk: "#fff" }, slides: [] }), false);
assert.deepEqual(TEMPLATE_INPUT_TYPES.list, "list");

// Fields: typed, labelled, with state and uses.
const fields = Object.fromEntries(listTemplateFields(editor.presentation).map((field) => [field.id, field]));
assert.deepEqual(Object.keys(fields), ["client", "revenue", "kickoff", "wins", "logo", "accent"]);
assert.equal(fields.client.label, "Client name");
assert.equal(fields.revenue.label, "Revenue");
assert.equal(fields.client.status, "unfilled");
assert.equal(fields.client.placeholder, "Acme Corp");
assert.equal(fields.wins.placeholder, "Faster onboarding\nLower churn");
assert.equal(fields.kickoff.status, "default");
assert.equal(fields.kickoff.placeholder, "2026-10-01");
assert.equal(fields.logo.status, "optional");
assert.equal(fields.accent.status, "default");
assert.deepEqual(fields.client.uses.map((use) => use.path), ["/name", "/slides/0/title"]);
assert.deepEqual(fields.revenue.uses.map((use) => `${use.form}:${use.path}`), ["token:/slides/0/text/1/text", "token:/slides/1/bullets/0", "reference:/slides/2/chart/data/rows/0/1"]);
assert.deepEqual(templateStatus(editor.presentation), { template: true, fieldCount: 6, requiredCount: 6 - 1, filledRequiredCount: 2, unfilled: ["client", "revenue", "wins"], complete: false });

// Form text parses per kind; blank clears.
assert.deepEqual(fieldTextToValue("number", " 12.5 "), { ok: true, value: 12.5 });
assert.equal(fieldTextToValue("number", "1,200").ok, false);
assert.match(fieldTextToValue("number", "x").message, /number/);
assert.deepEqual(fieldTextToValue("list", "a\n b \n"), { ok: true, value: ["a", "b"] });
assert.deepEqual(fieldTextToValue("date", ""), { ok: true, value: undefined });
assert.deepEqual(fieldTextToValue("text", "  keep spaces  "), { ok: true, value: "  keep spaces  " });
assert.equal(valueToFieldText("text", [{ text: "Hello " }, "world"]), "Hello world");
assert.equal(valueToFieldText("image", { src: "a.png", alt: "x" }), "a.png");

// A fill session holds values apart from the document; the preview resolves them without editing it.
const fill = createTemplateFill(editor);
const notified = [];
fill.subscribe(() => notified.push(1));
assert.deepEqual(fill.setText("client", "Globex"), { ok: true, value: "Globex" });
assert.equal(fill.setText("revenue", "lots").ok, false);
assert.throws(() => fill.set("nope", 1), (error) => error.code === "unknown-variable");
assert.throws(() => fill.set("revenue", "lots"), (error) => error.code === "invalid-variable-value");
assert.equal(notified.length, 1);
assert.equal(fill.fields().find((field) => field.id === "client").status, "filled");
assert.equal(fill.fields().find((field) => field.id === "client").text, "Globex");
assert.deepEqual(fill.status().unfilled, ["revenue", "wins"]);
const preview = fill.preview();
assert.equal(preview.presentation.slides[0].title, "Quarterly review: Globex");
assert.equal(preview.presentation.slides[1].bullets[0], "Revenue $1,250,000", "an unfilled variable previews with its example");
assert.deepEqual(editor.presentation, template(), "previewing never edits the document");
assert.equal(editor.canUndo, false);

// Applying the fill: refused while required variables are unfilled, then one undoable edit.
assert.throws(() => fill.apply(), (error) => error.code === "unfilled-variables" && error.details.unfilled.join() === "revenue,wins");
assert.deepEqual(editor.presentation, template());
fill.setText("revenue", "1234567");
fill.set("wins", ["Shipped v2", "Won renewal"]);
fill.setText("logo", "asset:mark");
assert.equal(fill.status().complete, true);
const applied = fill.apply();
assert.equal(applied.complete, true);
assert.equal(editor.canUndo, true);
const filled = editor.presentation;
assert.equal("template" in filled, false);
assert.deepEqual(Object.keys(filled.variables), ["accent"]);
assert.equal(filled.name, "Quarterly review for Globex");
assert.deepEqual(filled.slides[1].bullets, ["Revenue $1,234,567", "Shipped v2", "Won renewal"]);
assert.equal(filled.slides[1].image, "asset:mark");
assert.equal(filled.slides[2].chart.data.rows[0][1], 1234567);
assert.deepEqual(filled.slides[0].text, [{ text: "Revenue " }, { text: "$1,234,567", bold: true }]);
assert.equal(editor.validation.valid, true);
assert.deepEqual(fill.values, {}, "values are consumed by the fill");
editor.undo();
assert.deepEqual(editor.presentation, template(), "one undo restores the template");
editor.redo();
assert.deepEqual(editor.presentation, filled);

// A partial fill keeps the unfilled variables declared.
{
  const session = createEditorSession(template(), { rejectInvalid: true });
  const partial = createTemplateFill(session);
  partial.set("client", "Initech");
  assert.throws(() => partial.apply(), (error) => error.code === "unfilled-variables");
  partial.apply({ partial: true });
  const presentation = session.presentation;
  assert.equal(presentation.template, true);
  assert.deepEqual(Object.keys(presentation.variables).sort(), ["accent", "revenue", "wins"]);
  assert.equal(presentation.slides[0].title, "Quarterly review: Initech");
  assert.equal(presentation.slides[1].bullets[0], "Revenue {{revenue}}");
  assert.equal(session.validation.valid, true);
}

// Declaring variables, marking a template and inserting tokens are validated, undoable session edits.
{
  const session = createEditorSession({ slides: [{ id: "s", title: "Hello", text: [{ text: "Plain " }, { text: "bold", bold: true }] }] }, { rejectInvalid: true });
  assert.equal(suggestVariableId(session.presentation, "Client Name!"), "client-name");
  assert.equal(suggestVariableId({ variables: { "client-name": "#fff" } }, "Client Name"), "client-name-2");
  assert.equal(variableToken("client-name"), "{{client-name}}");
  assert.equal(variableToken("when", "dd MMM yyyy"), "{{when|dd MMM yyyy}}");
  assert.throws(() => variableToken("Bad Id"), (error) => error.code === "invalid-variable-id");

  // A required variable with no value is an error in a normal deck, so declaring it needs template mode first.
  assert.throws(() => declareVariable(session, "client", { type: "text" }), (error) => error.code === "invalid-opf-edit");
  assert.equal(session.presentation.variables, undefined);
  setTemplate(session, true);
  assert.equal(session.presentation.template, true);
  const declared = declareVariable(session, "client", { type: "text", example: "Acme" });
  assert.deepEqual(declared.patches, [{ op: "add", path: "/variables", value: { client: { type: "text", example: "Acme" } } }]);
  assert.throws(() => declareVariable(session, "client", { type: "text" }), (error) => error.code === "variable-exists");
  assert.throws(() => declareVariable(session, "bad", { type: "sparkle" }), (error) => error.code === "invalid-variable");

  const inserted = insertVariableToken(session, "slides.0.title", "client", { start: 5, end: 5 });
  assert.equal(inserted.token, "{{client}}");
  assert.equal(session.get("slides.0.title"), "Hello{{client}}");
  insertVariableToken(session, "slides.0.title", "client", { start: 0, end: 5 });
  assert.equal(session.get("slides.0.title"), "{{client}}{{client}}", "a selection is replaced");
  insertVariableToken(session, "slides.0.text", "client");
  assert.equal(session.get("slides.0.text.1.text"), "bold{{client}}", "a run field inserts into the last run");
  insertVariableToken(session, "/slides/0/text", "client", { runIndex: 0, start: 0 });
  assert.equal(session.get("slides.0.text.0.text"), "{{client}}Plain ");
  assert.throws(() => insertVariableToken(session, "slides.0.title", "ghost"), (error) => error.code === "unknown-variable");
  assert.throws(() => insertVariableToken(session, "slides.0.title", "client", { start: 99 }), (error) => error.code === "invalid-selection");
  assert.throws(() => insertVariableToken(session, "slides.0", "client"), (error) => error.code === "not-text");

  // Declare and insert in one edit; one undo takes both back.
  const depth = session.snapshot().undoDepth;
  insertVariableToken(session, "slides.0.title", "total", { declare: { type: "number", example: 3, format: "0" } });
  assert.equal(session.snapshot().undoDepth, depth + 1);
  assert.equal(session.presentation.variables.total.type, "number");
  session.undo();
  assert.equal(session.presentation.variables.total, undefined);
  assert.equal(session.get("slides.0.title"), "{{client}}{{client}}");

  // Back to a normal deck: leaving template mode with an unfilled variable is refused.
  assert.throws(() => setTemplate(session, false), (error) => error.code === "invalid-opf-edit");
  assert.equal(session.presentation.template, true);
}

// FR-09: a variable's limits reach the form fields, count against the value, and survive every edit.
{
  const limited = () => ({
    template: true,
    name: "Limits",
    variables: {
      headline: { type: "text", maxLength: 10, maxLines: 2, example: "Short" },
      agenda: { type: "list", maxItems: 2, value: ["a", "b"] },
      plain: { type: "text", value: "x" },
    },
    slides: [{ id: "one", title: "{{headline}}", items: "var:agenda", text: "{{plain}}" }],
  });
  const fields = (values) => Object.fromEntries(listTemplateFields(limited(), values).map((field) => [field.id, field]));
  const before = fields({});
  assert.deepEqual([before.headline.maxLength, before.headline.maxLines, before.agenda.maxItems], [10, 2, 2]);
  assert.equal("maxLength" in before.plain || "maxLines" in before.plain || "maxItems" in before.plain, false);

  // The count is what the reader sees: an emoji is one character, and the list counts entries.
  assert.deepEqual(limitUsage("text", "Café 👨‍👩‍👧", { maxLength: 10 }), { unit: "characters", used: 6, max: 10, over: false });
  assert.deepEqual(limitUsage("text", "Eleven char", { maxLength: 10 }), { unit: "characters", used: 11, max: 10, over: true });
  assert.deepEqual(limitUsage("list", ["a", "b", "c"], { maxItems: 2 }), { unit: "items", used: 3, max: 2, over: true });
  assert.equal(limitUsage("text", "x", {}), undefined);
  assert.equal(limitUsage("number", 1, { maxLength: 3 }), undefined);
  const typed = fields({ headline: "Eleven char", agenda: ["a", "b", "c"] });
  assert.equal(limitUsage("text", typed.headline.value, typed.headline).over, true);
  assert.equal(limitUsage("list", typed.agenda.value, typed.agenda).over, true);

  // Edits keep the limits: an edit of a slide, an undo, and a partial fill that leaves the variable declared.
  const session = createEditorSession(limited(), { rejectInvalid: true });
  session.applyPatch([{ op: "replace", path: "/slides/0/id", value: "renamed" }]);
  session.applyPatch([{ op: "replace", path: "/variables/headline/example", value: "Other" }]);
  assert.deepEqual([session.presentation.variables.headline.maxLength, session.presentation.variables.headline.maxLines, session.presentation.variables.agenda.maxItems], [10, 2, 2]);
  session.undo();
  assert.equal(session.presentation.variables.headline.maxLength, 10);
  const fill = createTemplateFill(session);
  fill.set("headline", "Eleven char");
  const applied = fill.apply({ partial: true });
  assert.deepEqual(applied.diagnostics.filter((entry) => entry.code === "variable-overflow").map((entry) => entry.id), ["headline"]);
}

// FR-10: translations as rows (language, value), one undoable edit each, the declared languages offered first, and the canvas data in each slide's language.
{
  const bilingual = () => ({
    name: "Bilingual",
    language: "de",
    variables: { cta: { type: "text", value: "Book a demo" }, "event-date": { type: "date", value: "2026-03-05" }, steps: { type: "list", value: ["One"] }, growth: { type: "number", value: 1 } },
    slides: [{ title: "{{cta}}", text: "{{event-date}}", items: "var:steps" }, { language: "fr", title: "{{cta}}" }, { language: "de-AT", title: "x" }, { language: "fr-CA", title: "y" }],
  });
  const session = createEditorSession(bilingual(), { rejectInvalid: true });
  assert.deepEqual(translationLanguages(session.presentation), ["de", "fr", "de-AT", "fr-CA"]);
  assert.deepEqual(translationLanguages({ language: { bcp47: "ja" }, slides: [{}] }), ["ja"]);
  const field = (id) => listTemplateFields(session.presentation).find((entry) => entry.id === id);
  assert.deepEqual(field("cta").translations, []);
  assert.deepEqual(field("cta").translationLanguages, ["de", "fr", "de-AT", "fr-CA"]);
  assert.equal("translations" in field("growth"), false, "a number variable has no translations");

  setVariableTranslation(session, "cta", "de", "Demo buchen");
  setVariableTranslation(session, "cta", "fr", "Réserver une démo");
  assert.deepEqual(session.presentation.variables.cta.translations, { de: { value: "Demo buchen" }, fr: { value: "Réserver une démo" } });
  assert.deepEqual(field("cta").translations, [{ tag: "de", text: "Demo buchen", rich: false }, { tag: "fr", text: "Réserver une démo", rich: false }]);
  // The same language in another case replaces the entry; a rename moves it; the list takes lines; the date takes a pattern.
  setVariableTranslation(session, "cta", "DE", "Jetzt buchen");
  assert.deepEqual(Object.keys(session.presentation.variables.cta.translations), ["de", "fr"]);
  assert.equal(session.presentation.variables.cta.translations.de.value, "Jetzt buchen");
  setVariableTranslation(session, "cta", "fr-CA", "Réserver", { from: "fr" });
  assert.deepEqual(Object.keys(session.presentation.variables.cta.translations), ["de", "fr-CA"]);
  setVariableTranslation(session, "steps", "de", "Eins\nZwei");
  assert.deepEqual(session.presentation.variables.steps.translations.de.value, ["Eins", "Zwei"]);
  setVariableTranslation(session, "event-date", "de", "d. MMMM yyyy");
  assert.deepEqual(session.presentation.variables["event-date"].translations, { de: { format: "d. MMMM yyyy" } });
  assert.deepEqual(field("event-date").translations, [{ tag: "de", text: "d. MMMM yyyy", rich: false }]);
  // Refusals leave the document alone.
  const before = structuredClone(session.presentation);
  for (const bad of [() => setVariableTranslation(session, "growth", "de", "1"), () => setVariableTranslation(session, "cta", "German", "x"), () => setVariableTranslation(session, "event-date", "de", "  "), () => setVariableTranslation(session, "steps", "fr", ""), () => setVariableTranslation(session, "missing", "de", "x"), () => removeVariableTranslation(session, "cta", "it")]) assert.throws(bad);
  assert.deepEqual(session.presentation, before);
  // The preview draws each slide in its own language (the panel's preview and the canvas resolve through core).
  const drawn = previewTemplate(session.presentation).presentation.slides;
  assert.deepEqual([drawn[0].title, drawn[1].title], ["Jetzt buchen", "Book a demo"]);
  // One undo per edit, and the last removal drops the map.
  removeVariableTranslation(session, "event-date", "de");
  assert.equal("translations" in session.presentation.variables["event-date"], false);
  session.undo();
  assert.equal(session.presentation.variables["event-date"].translations.de.format, "d. MMMM yyyy");
  session.undo();
  assert.equal("translations" in session.presentation.variables["event-date"], false);
  // A value typed in the fill panel replaces the translations of the filled deck, as opf fill does.
  const fill = createTemplateFill(session);
  fill.set("cta", "Join us");
  const filled = fill.apply({ partial: true });
  assert.deepEqual(filled.presentation.slides.map((slide) => slide.title).slice(0, 2), ["Join us", "Join us"]);
}

console.log("Templates passed fields, previews, one undoable fill, partial fills, declarations and token insertion.");
