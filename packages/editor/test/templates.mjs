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
  listTemplateFields,
  setTemplate,
  suggestVariableId,
  templateStatus,
  templatesAvailable,
  valueToFieldText,
  variableToken,
} from "../dist/templates.js";

assert.equal(templatesAvailable(), true);

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
assert.equal(isTemplateDocument(editor.document), true);
assert.equal(hasTemplateVariables(editor.document), true);
assert.equal(hasTemplateVariables({ variables: { risk: "#fff" }, slides: [] }), false);
assert.deepEqual(TEMPLATE_INPUT_TYPES.list, "list");

// Fields: typed, labelled, with state and uses.
const fields = Object.fromEntries(listTemplateFields(editor.document).map((field) => [field.id, field]));
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
assert.deepEqual(templateStatus(editor.document), { template: true, fieldCount: 6, requiredCount: 6 - 1, filledRequiredCount: 2, unfilled: ["client", "revenue", "wins"], complete: false });

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
assert.deepEqual(editor.document, template(), "previewing never edits the document");
assert.equal(editor.canUndo, false);

// Applying the fill: refused while required variables are unfilled, then one undoable edit.
assert.throws(() => fill.apply(), (error) => error.code === "unfilled-variables" && error.details.unfilled.join() === "revenue,wins");
assert.deepEqual(editor.document, template());
fill.setText("revenue", "1234567");
fill.set("wins", ["Shipped v2", "Won renewal"]);
fill.setText("logo", "asset:mark");
assert.equal(fill.status().complete, true);
const applied = fill.apply();
assert.equal(applied.complete, true);
assert.equal(editor.canUndo, true);
const filled = editor.document;
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
assert.deepEqual(editor.document, template(), "one undo restores the template");
editor.redo();
assert.deepEqual(editor.document, filled);

// A partial fill keeps the unfilled variables declared.
{
  const session = createEditorSession(template(), { rejectInvalid: true });
  const partial = createTemplateFill(session);
  partial.set("client", "Initech");
  assert.throws(() => partial.apply(), (error) => error.code === "unfilled-variables");
  partial.apply({ partial: true });
  const document = session.document;
  assert.equal(document.template, true);
  assert.deepEqual(Object.keys(document.variables).sort(), ["accent", "revenue", "wins"]);
  assert.equal(document.slides[0].title, "Quarterly review: Initech");
  assert.equal(document.slides[1].bullets[0], "Revenue {{revenue}}");
  assert.equal(session.validation.valid, true);
}

// Declaring variables, marking a template and inserting tokens are validated, undoable session edits.
{
  const session = createEditorSession({ slides: [{ id: "s", title: "Hello", text: [{ text: "Plain " }, { text: "bold", bold: true }] }] }, { rejectInvalid: true });
  assert.equal(suggestVariableId(session.document, "Client Name!"), "client-name");
  assert.equal(suggestVariableId({ variables: { "client-name": "#fff" } }, "Client Name"), "client-name-2");
  assert.equal(variableToken("client-name"), "{{client-name}}");
  assert.equal(variableToken("when", "dd MMM yyyy"), "{{when|dd MMM yyyy}}");
  assert.throws(() => variableToken("Bad Id"), (error) => error.code === "invalid-variable-id");

  // A required variable with no value is an error in a normal deck, so declaring it needs template mode first.
  assert.throws(() => declareVariable(session, "client", { type: "text" }), (error) => error.code === "invalid-opf-edit");
  assert.equal(session.document.variables, undefined);
  setTemplate(session, true);
  assert.equal(session.document.template, true);
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
  assert.equal(session.document.variables.total.type, "number");
  session.undo();
  assert.equal(session.document.variables.total, undefined);
  assert.equal(session.get("slides.0.title"), "{{client}}{{client}}");

  // Back to a normal deck: leaving template mode with an unfilled variable is refused.
  assert.throws(() => setTemplate(session, false), (error) => error.code === "invalid-opf-edit");
  assert.equal(session.document.template, true);
}

console.log("Templates passed fields, previews, one undoable fill, partial fills, declarations and token insertion.");
