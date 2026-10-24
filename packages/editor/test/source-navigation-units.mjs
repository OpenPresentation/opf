// Phase 4 of the source editor (artifacts/source-editor/SPEC.md, section 8.3): the pure part of go to definition, find references and rename. The same deck
// is written in JSON, YAML and Markdown; every case runs on all three, on text that is broken or half typed, with CRLF line ends, with ids that are
// prefixes of others (`logo` and `logo-dark`), `{{name|format}}` tokens, ids in escaped JSON strings, Markdown images and option comments.
import assert from "node:assert/strict";
import { parse as parseYaml } from "yaml";
import { gallery } from "@openpresentation/gallery";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { applyTextEdits } from "@openpresentation/opf/source";
import { toYaml } from "@openpresentation/opf/yaml";
import { analyze, analyzeInPieces, declarationsOf, definitionOf, lineAt, referenceList, renameBlocker, renameEdits, slideNumberAt, symbolAt, validateName } from "../src/source-navigation-model.js";
import { bigDeck } from "./support/source-perf.mjs";
import { navigationDeck } from "./support/source-nav-perf.mjs";
import { readYamlInPieces } from "../src/source-navigation-read.js";

const deck = {
  name: "Quarterly {{client}}",
  narrative: "problem-solution",
  references: [{ id: "gartner", text: "Gartner 2026" }, { id: "gartner-old", text: "Older" }],
  assets: { logo: "./l.svg", "logo-dark": "./d.svg" },
  variables: { client: { type: "text", value: "Acme" }, brand: "#336699" },
  datasets: { sales: { columns: ["Quarter", "Revenue"], rows: [["Q1", 1], ["Q2", 2]] }, "sales-eu": { columns: ["Quarter"], rows: [["Q1"]] } },
  catalogs: { custom: { layouts: { hero: { name: "Hero", regions: [{ name: "title", accepts: ["text"] }, { name: "body", accepts: ["text", "list"] }] }, "hero-wide": { name: "Wide", regions: [{ name: "title", accepts: ["text"] }] } } } },
  slides: [
    { id: "cover", layout: "hero", title: "Hello {{client|upper}}", subtitle: "Prepared for {{client}}" },
    { id: "logos", title: "Logos", image: "asset:logo", notes: "See asset:logo-dark" },
    { id: "chart", beat: "problem", layout: "two-column", title: [{ text: "Revenue", cite: "gartner" }], blocks: [{ chart: { type: "column", colors: ["var:brand"], data: { dataset: "sales", fields: ["Quarter", "Revenue"] } } }] },
    { id: "wide", layout: "hero-wide", title: "Wide", notes: "plain" },
  ],
};
const formats = { json: JSON.stringify(deck, null, 2), yaml: toYaml(deck).yaml, md: toMarkdown(deck).markdown };
const options = { catalogs: [gallery] };

const readDeck = (text, format) => (format === "json" ? JSON.parse(text) : format === "yaml" ? parseYaml(text) : fromMarkdown(text, { validate: false }).presentation);
const offsetOf = (text, needle, nth = 0, shift = 0) => {
  let at = -1;
  for (let count = 0; count <= nth; count++) { at = text.indexOf(needle, at + 1); assert.ok(at >= 0, `${JSON.stringify(needle)} #${nth} is in the text`); }
  return at + shift;
};
const symbolOf = (analysis, text, needle, nth = 0, shift = 0) => {
  const symbol = symbolAt(analysis, offsetOf(text, needle, nth, shift));
  assert.ok(symbol, `a symbol at ${JSON.stringify(needle)} #${nth}`);
  return symbol;
};
const rename = (text, format, needle, name, { nth = 0, shift = 0, sourceOptions = options } = {}) => {
  const analysis = analyze(text, format, sourceOptions);
  const symbol = symbolOf(analysis, text, needle, nth, shift);
  const result = renameEdits(analysis, symbol, name);
  assert.ok(result, "the rename has edits");
  const next = applyTextEdits(text, result.edits.map((edit) => ({ offset: edit.from, length: edit.to - edit.from, insert: edit.insert })));
  // The caret is on the renamed symbol, in the text after the edits.
  assert.equal(next.slice(result.caret[0], result.caret[1]), name, "the selection covers the new name");
  return next;
};

// The deck a rename must give: every id of the kind, in its declaration and in every use, changed.
function renamedDeck(source, kind, from, to) {
  const value = structuredClone(source);
  const swap = (map) => { if (map && from in map) { map[to] = map[from]; delete map[from]; } };
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach((item, index) => { node[index] = typeof item === "string" ? text(item) : (walk(item), item); }); return; }
    if (!node || typeof node !== "object") return;
    for (const [key, item] of Object.entries(node)) {
      if (key === "extensions") continue;
      if (typeof item === "string") node[key] = key === "dataset" && kind === "dataset" && item === from ? to : key === "cite" && kind === "cite" && item === from ? to : key === "layout" && kind === "layouts" && item === from ? to : text(item);
      else walk(item);
    }
  };
  const text = (value) => {
    if (kind === "asset") return value === `asset:${from}` ? `asset:${to}` : value.replace(new RegExp(`asset:${from}(?![\\w-])`, "g"), `asset:${to}`);
    if (kind === "variable") return value.replaceAll(new RegExp(`\\{\\{(\\s*)${from}(\\s*[|}])`, "g"), `{{$1${to}$2`).replace(new RegExp(`^var:${from}$`), `var:${to}`);
    return value;
  };
  if (kind === "asset") swap(value.assets);
  if (kind === "variable") swap(value.variables);
  if (kind === "dataset") swap(value.datasets);
  if (kind === "layouts") swap(value.catalogs.custom.layouts);
  if (kind === "cite") for (const reference of value.references) if (reference.id === from) reference.id = to;
  if (kind === "slide") for (const slide of value.slides) if (slide.id === from) slide.id = to;
  const { assets, variables, datasets, catalogs, references, ...rest } = value;
  walk(rest);
  return { ...rest, ...(assets ? { assets } : {}), ...(variables ? { variables } : {}), ...(datasets ? { datasets } : {}), ...(catalogs ? { catalogs } : {}), ...(references ? { references } : {}) };
}
const normalize = (value) => JSON.parse(JSON.stringify(value));
const sameDeck = (actual, expected, why) => assert.deepEqual(normalize(actual), normalize(expected), why);

// ---- the same deck, the same ids ---------------------------------------------------------------------------------------------------------
const shape = (analysis) => analysis.occurrences.map((o) => `${o.role}:${o.kind}:${o.scope}:${o.id}`).sort();
const reference = shape(analyze(formats.json, "json", options));
assert.ok(reference.length >= 25, `the corpus has ids: ${reference.length}`);
for (const format of ["yaml", "md"]) assert.deepEqual(shape(analyze(formats[format], format, options)), reference, `${format} has the ids of the JSON text`);

for (const [format, text] of Object.entries(formats)) {
  const analysis = analyze(text, format, options);
  const where = (needle, nth, shift) => symbolOf(analysis, text, needle, nth, shift);

  // ---- the symbol under the caret ------------------------------------------------------------------------------------------------------
  assert.equal(where("asset:logo", 0, 8).id, "logo", `${format}: inside the id`);
  assert.equal(where("asset:logo", 0, 2).id, "logo", `${format}: on the prefix of asset:logo`);
  assert.equal(where("asset:logo-dark").id, "logo-dark", `${format}: an id that starts with another is its own symbol`);
  assert.equal(where("asset:logo-dark", 0, 9).kind, "asset");
  assert.equal(where("{{client|upper}}", 0, 4).id, "client", `${format}: a token with a format`);
  assert.equal(where("{{client|upper}}", 0, 10).id, "client", `${format}: on the format of a token`);

  // ---- definitions -------------------------------------------------------------------------------------------------------------------
  const useOf = (kind, id) => analysis.occurrences.find((o) => o.kind === kind && o.id === id && o.role === "ref");
  const goTo = (kind, id) => {
    const use = useOf(kind, id);
    assert.ok(use, `${format}: ${kind} ${id} is used`);
    // The caret on the use finds that use, whatever the text around it.
    assert.equal(symbolAt(analysis, use.from), use, `${format}: ${kind} ${id} is under the caret at the start of its id`);
    assert.equal(symbolAt(analysis, use.to), use, `${format}: ... and at the end`);
    const definition = definitionOf(analysis, use);
    assert.equal(definition?.where, "document", `${format}: ${kind} ${id} is defined in the document`);
    assert.equal(definition.occurrence.role, "def");
    assert.equal(text.slice(definition.occurrence.from, definition.occurrence.to), id, `${format}: the definition's id range is the id`);
    return definition.occurrence;
  };
  assert.equal(goTo("asset", "logo").kind, "asset");
  assert.equal(goTo("asset", "logo-dark").id, "logo-dark");
  assert.equal(goTo("variable", "client").kind, "variable");
  assert.equal(goTo("dataset", "sales").kind, "dataset");
  assert.equal(goTo("cite", "gartner").kind, "cite");
  assert.equal(goTo("layouts", "hero").scope, "custom");
  assert.equal(goTo("variable", "brand").kind, "variable", `${format}: var:brand goes to the variable`);
  const column = analysis.occurrences.find((o) => o.kind === "column" && o.role === "ref" && o.id === "Revenue");
  assert.ok(column, `${format}: a column of the dataset is used by the chart`);
  assert.equal(definitionOf(analysis, column).occurrence.scope, "sales", `${format}: the column is the one of its dataset`);
  assert.equal(text.slice(definitionOf(analysis, column).occurrence.from, definitionOf(analysis, column).occurrence.to), "Revenue");
  // A layout only the app has is a card, not a place in the text.
  const registered = analysis.occurrences.find((o) => o.kind === "layouts" && o.role === "ref" && o.ref === "two-column");
  assert.equal(definitionOf(analysis, registered)?.where, "app", `${format}: two-column is provided by the app`);
  assert.ok(definitionOf(analysis, registered).record, "the card has the record");
  // The beat of a registered narrative, and the region of a layout the document embeds.
  const beat = analysis.occurrences.find((o) => o.kind === "beat" && o.role === "ref");
  assert.equal(definitionOf(analysis, beat)?.where, "app");
  // A built-in variable has no definition to go to and cannot be renamed.
  const builtin = analyze(text.replace("Acme", "Acme {{organization.name}}"), format, options).occurrences.find((o) => o.builtin);
  if (builtin) assert.equal(definitionOf(analyze(text.replace("Acme", "Acme {{organization.name}}"), format, options), builtin).where, "built-in");
  // Nothing defines it.
  const missing = analyze(text.replace("asset:logo-dark", "asset:nothing"), format, options);
  assert.equal(definitionOf(missing, missing.occurrences.find((o) => o.id === "nothing")), null, `${format}: no definition for an unknown asset`);

  // ---- references ----------------------------------------------------------------------------------------------------------------------
  const refs = (needle, nth = 0, shift = 0) => referenceList(analysis, where(needle, nth, shift));
  assert.deepEqual(refs("asset:logo", 0, 8).map((o) => o.role), ["def", "ref"], `${format}: logo has its declaration and one use (logo-dark is another id)`);
  assert.deepEqual(refs("asset:logo-dark", 0, 9).map((o) => o.role), ["def", "ref"]);
  assert.equal(refs("{{client}}", 0, 4).length, 4, `${format}: client is declared once and used in the name and two slides`);
  assert.equal(refs("{{client}}", 0, 4)[0].role, "def", "the declaration comes first");
  assert.deepEqual(referenceList(analysis, analysis.occurrences.find((o) => o.kind === "layouts" && o.id === "hero" && o.role === "ref")).map((o) => o.role), ["def", "ref"], `${format}: hero, not hero-wide`);
  assert.equal(refs("two-column", 0, 3).length, 1, `${format}: a layout of the app lists the slides that use it`);
  assert.equal(slideNumberAt(analysis, refs("two-column", 0, 3)[0].from), 3, `${format}: the use is in slide 3`);
  assert.equal(lineAt(analysis, refs("asset:logo", 0, 8)[0].from).text.includes("logo"), true);

  // ---- rename: each kind changes the declaration and every use, and the deck still reads the same -----------------------------------------
  const cases = [["asset", "logo", "brand"], ["variable", "client", "customer"], ["dataset", "sales", "revenue"], ["cite", "gartner", "analyst"], ["slide", "cover", "title-slide"], ["layouts", "hero", "banner"]];
  for (const [kind, id, name] of cases) {
    // Renamed from a use when the id has one, else from its declaration.
    const symbol = analysis.occurrences.find((o) => o.kind === kind && o.id === id && o.role === "ref") ?? analysis.occurrences.find((o) => o.kind === kind && o.id === id);
    const result = renameEdits(analysis, symbol, name);
    const next = applyTextEdits(text, result.edits.map((edit) => ({ offset: edit.from, length: edit.to - edit.from, insert: edit.insert })));
    assert.equal(next.slice(result.caret[0], result.caret[1]), name, `${format}: the selection covers the new ${kind} id`);
    sameDeck(readDeck(next, format), renamedDeck(readDeck(text, format), kind, id, name), `${format}: renaming the ${kind} ${id} gives the same deck with the new id`);
    // Renaming it back restores the text exactly.
    const back = analyze(next, format, options);
    const again = back.occurrences.find((o) => o.kind === kind && o.id === name && o.role === "def");
    const undone = renameEdits(back, again, id);
    assert.equal(applyTextEdits(next, undone.edits.map((edit) => ({ offset: edit.from, length: edit.to - edit.from, insert: edit.insert }))), text, `${format}: renaming ${name} back to ${id} restores the text`);
  }
  // `logo-dark` and `hero-wide` and `gartner-old` and `sales-eu` keep their names.
  const afterLogo = rename(text, format, "asset:logo", "brand", { shift: 8 });
  assert.ok(afterLogo.includes("logo-dark") && afterLogo.includes("asset:logo-dark"), `${format}: logo-dark is untouched`);
  assert.ok(!/asset:logo(?![-\w])/.test(afterLogo), `${format}: no use of logo is left`);
  const afterVariable = rename(text, format, "{{client|upper}}", "customer", { shift: 4 });
  assert.ok(afterVariable.includes("{{customer|upper}}") && afterVariable.includes("{{customer}}"), `${format}: the format after | is kept`);
  assert.ok(!afterVariable.includes("{{client"), `${format}: every {{client}} is renamed`);

  // ---- validation and who can be renamed ---------------------------------------------------------------------------------------------
  const logo = where("asset:logo", 0, 8);
  assert.equal(validateName(analysis, logo, ""), "The name cannot be empty");
  assert.equal(validateName(analysis, logo, "  "), "The name cannot be empty");
  assert.match(validateName(analysis, logo, "logo-dark"), /already exists/, `${format}: another asset has this id`);
  assert.match(validateName(analysis, logo, "bad name"), /letters, digits/);
  assert.match(validateName(analysis, logo, "-x"), /start with a letter or a digit/);
  assert.equal(validateName(analysis, logo, "logo"), "", "the same name is fine (and changes nothing)");
  assert.equal(renameEdits(analysis, logo, "logo"), null);
  assert.equal(validateName(analysis, logo, "My.Logo_2"), "");
  const client = where("{{client}}", 0, 4);
  assert.match(validateName(analysis, client, "Client"), /lowercase/, `${format}: variable ids are kebab-case`);
  assert.match(validateName(analysis, client, "brand"), /already exists/, "a variable with that id exists");
  assert.equal(validateName(analysis, client, "client-name"), "");
  const hero = analysis.occurrences.find((o) => o.kind === "layouts" && o.id === "hero" && o.role === "ref");
  assert.match(validateName(analysis, hero, "hero-wide"), /already exists/);
  assert.match(validateName(analysis, hero, "Hero"), /lowercase/);
  assert.equal(renameBlocker(analysis, hero), "");
  assert.match(renameBlocker(analysis, registered), /provided by the app/, `${format}: a record of the app cannot be renamed`);
  assert.match(renameBlocker(analysis, logo, { readOnly: true }), /read-only/);
  assert.match(renameBlocker(analysis, beat), /beat|narrative/);
  assert.match(renameBlocker(analysis, column), /column/);
}

// ---- built-in variables ---------------------------------------------------------------------------------------------------------------
{
  const text = JSON.stringify({ name: "{{organization.name}}", slides: [{ title: "Page {{slide.number}} of {{deck.slideCount}}" }] }, null, 2);
  const analysis = analyze(text, "json", options);
  const builtin = symbolAt(analysis, offsetOf(text, "organization.name", 0, 3));
  assert.equal(builtin.builtin, true);
  assert.equal(definitionOf(analysis, builtin).where, "built-in");
  assert.match(renameBlocker(analysis, builtin), /built-in/);
  assert.equal(analysis.occurrences.filter((o) => o.builtin).length, 3);
}

// ---- JSON: quotes and escapes -----------------------------------------------------------------------------------------------------------
{
  const text = `{\n  "assets": { "lo\\u0067o": "./a.svg", "a\\"b": "x" },\n  "slides": [ { "image": "asset:logo", "notes": "an \\"asset:logo\\" mention" } ]\n}`;
  const analysis = analyze(text, "json", options);
  const declared = analysis.occurrences.filter((o) => o.kind === "asset" && o.role === "def");
  assert.deepEqual(declared.map((o) => o.id), ["logo", 'a"b'], "keys are read with their escapes decoded");
  assert.equal(text.slice(declared[0].from, declared[0].to), "lo\\u0067o", "the id range is the raw text of the key");
  const use = analysis.occurrences.find((o) => o.role === "ref" && o.kind === "asset");
  assert.equal(use.id, "logo");
  // A mention inside prose, next to an escaped quote, is not an id to rename.
  assert.equal(analysis.occurrences.filter((o) => o.role === "ref" && o.kind === "asset").length, 1);
  const renamed = rename(text, "json", "asset:logo", "brand", { shift: 8 });
  assert.ok(renamed.includes('"brand": "./a.svg"') && renamed.includes('"asset:brand"'), "the escaped key is replaced whole");
  JSON.parse(renamed);
}

// ---- tolerance: broken and half-typed text ------------------------------------------------------------------------------------------------
{
  const broken = [
    ["json", `{\n  "assets": { "logo": "./l.svg",\n  "slides": [ { "image": "asset:logo" }, { "image": "asset:logo-dark"\n`],
    ["json", `{ "assets": { "logo": "./l.svg" }, "slides": [ { "image": "asset:logo", ] }`],
    ["json", `{ "assets": { "logo": "./l.svg" }, "slides": [ { "image": "asset:logo }`],
    ["yaml", `assets:\n  logo: ./l.svg\nslides:\n  - image: asset:logo\n   title: [oops\n  - image: "asset:logo`],
    ["yaml", `assets: {logo: ./l.svg\nslides:\n\t- image: asset:logo\n`],
    ["md", `---\nassets:\n  logo: ./l.svg\n\n<!-- slide: id=a -->\n# T\n\n![](asset:logo)\n`],
    ["md", `---\nassets:\n  logo: ./l.svg\n---\n<!-- slide: id=a layout=\n# T\n![](asset:logo)\n\`\`\`opf-slide\nid: [\n`],
  ];
  for (const [format, text] of broken) {
    const analysis = analyze(text, format, options);
    const use = analysis.occurrences.find((o) => o.kind === "asset" && o.role === "ref");
    assert.ok(use, `${format}: a use is found in broken text: ${JSON.stringify(text.slice(0, 40))}`);
    assert.equal(symbolAt(analysis, use.from + 1)?.id, use.id);
    assert.ok(Array.isArray(analysis.occurrences));
  }
  // Nothing at all is not an error either.
  for (const format of ["json", "yaml", "md"]) for (const text of ["", " ", "{", "[", "---", "- - -", "﻿"]) assert.deepEqual(analyze(text, format, options).occurrences.filter((o) => o.role === "def"), [], `${format}: ${JSON.stringify(text)}`);
}

// ---- CRLF ---------------------------------------------------------------------------------------------------------------------------------
for (const [format, text] of Object.entries(formats)) {
  const crlf = text.replaceAll("\n", "\r\n");
  const analysis = analyze(crlf, format, options);
  assert.deepEqual(shape(analysis), reference, `${format}: CRLF text has the same ids`);
  const next = rename(crlf, format, "asset:logo", "brand", { shift: 8 });
  assert.equal(next, crlf.replace(/asset:logo(?![-\w])/g, "asset:brand").replace(/^(\s*"?)logo("?:)/m, "$1brand$2"), `${format}: only the id changes, the line ends stay CRLF`);
  assert.ok(!/(?<!\r)\n/.test(next), "no bare LF appeared");
  // The line of a use counts a CRLF pair once.
  const use = analysis.occurrences.find((o) => o.kind === "asset" && o.role === "ref");
  assert.equal(lineAt(analysis, use.from).number, lineAt(analyze(text, format, options), analyze(text, format, options).occurrences.find((o) => o.kind === "asset" && o.role === "ref").from).number);
}

// ---- Markdown specifics ---------------------------------------------------------------------------------------------------------------------
{
  const text = [
    "---", "name: Demo", "assets:", "  logo: ./logo.svg", "  logo-dark: ./d.svg", "variables:", "  client: { type: text, value: Acme }", "---",
    "<!-- slide: id=cover layout=hero beat=a beat=\"b\" -->", "# Hello {{client}}", "", "![logo](asset:logo)", "", "```", "{{client}} and asset:logo in code", "```", "", "<!-- a plain comment with {{client}} -->", "", "---",
    "<!-- slide: id=\"two\" -->", "# Two", "", "![](asset:logo-dark \"title\")", "",
  ].join("\n");
  const analysis = analyze(text, "md", options);
  assert.deepEqual(referenceList(analysis, symbolOf(analysis, text, "asset:logo)", 0, 8)).map((o) => o.role), ["def", "ref"], "the image of a slide, not the text of a code fence");
  assert.equal(referenceList(analysis, symbolOf(analysis, text, "{{client}}", 0, 4)).length, 2, "a token in a code fence or a comment is not a use");
  const ids = analysis.occurrences.filter((o) => o.kind === "slide").map((o) => o.id);
  assert.deepEqual(ids, ["cover", "two"], "slide ids come from the options comments, quoted or not");
  const renamedSlide = rename(text, "md", "id=\"two\"", "second", { shift: 5 });
  assert.ok(renamedSlide.includes('<!-- slide: id="second" -->'), "the quotes of an option stay");
  const renamedCover = rename(text, "md", "id=cover", "intro", { shift: 4 });
  assert.ok(renamedCover.includes("<!-- slide: id=intro layout=hero"));
  // A name that YAML would read as a number or a boolean is quoted where it is a plain scalar.
  const yamlText = "assets:\n  logo: a.svg\nslides:\n  - id: cover\n";
  const asYaml = analyze(yamlText, "yaml", options);
  const slideId = asYaml.occurrences.find((o) => o.kind === "slide");
  const quotedEdit = renameEdits(asYaml, slideId, "123");
  assert.equal(quotedEdit.edits[0].insert, '"123"');
  assert.equal(applyTextEdits(yamlText, quotedEdit.edits.map((e) => ({ offset: e.from, length: e.to - e.from, insert: e.insert }))), 'assets:\n  logo: a.svg\nslides:\n  - id: "123"\n');
}

// ---- catalogs: groups, prefixes, and records only the app has -------------------------------------------------------------------------
{
  const text = JSON.stringify({ catalogs: { acme: { source: "https://example.com/c", layouts: { hero: { regions: [{ name: "main" }] } } }, custom: { layouts: { hero: { regions: [{ name: "title" }] } } } }, slides: [{ layout: "hero" }, { layout: "acme:hero" }, { layout: "custom:hero" }, { layout: "auto" }] }, null, 2);
  const analysis = analyze(text, "json", options);
  const uses = analysis.occurrences.filter((o) => o.role === "ref" && o.kind === "layouts");
  assert.deepEqual(uses.map((o) => [o.ref, o.scope]), [["hero", "custom"], ["acme:hero", "acme"], ["custom:hero", "custom"]], "a bare id reads from custom first; `auto` is not an id");
  assert.equal(text.slice(uses[1].from, uses[1].to), "hero", "the id after the group name is what a rename replaces");
  const next = rename(text, "json", '"acme:hero"', "banner", { shift: 8 });
  assert.ok(next.includes('"acme:banner"') && next.includes('"layout": "hero"') && next.includes('"layout": "custom:hero"'), "only the acme record and its uses change");
  const custom = rename(text, "json", '"layout": "hero"', "banner", { shift: 14 });
  assert.equal((custom.match(/"banner"/g) ?? []).length, 2, "the record and the bare use");
  assert.ok(custom.includes('"custom:banner"') && custom.includes('"layout": "banner"') && custom.includes('"acme:hero"'));
  assert.equal(declarationsOf(analysis, uses[0]).length, 1);
}

// ---- every kind of catalog id, beats of an embedded narrative -------------------------------------------------------------------------
{
  const value = {
    narrative: "story", audience: [{ id: "board" }, "mine"], purpose: { id: "inform" }, tone: "formal",
    design: { theme: "brand", colorScheme: { id: "ocean" }, fontScheme: "arial" },
    catalogs: {
      custom: {
        themes: { brand: { colorScheme: "ocean", fontScheme: "arial" } },
        colorSchemes: { ocean: { name: "Ocean" } },
        narratives: { story: { name: "Story", beats: [{ id: "hook", name: "Hook" }, { id: "close", name: "Close" }] } },
        layouts: { duo: { regions: [{ name: "left" }, { name: "right", regions: [{ name: "inner" }] }] } },
      },
    },
    slides: [{ layout: "duo", beat: ["hook", "close"], design: { theme: "minimal" }, blocks: [{ region: "left", text: "a" }, { region: "right", text: "b" }, { region: "inner", text: "c" }] }],
  };
  for (const [format, text] of Object.entries({ json: JSON.stringify(value, null, 2), yaml: toYaml({ ...value, slides: [{ ...value.slides[0], title: "t" }] }).yaml })) {
    const analysis = analyze(text, format, options);
    const use = (kind, id) => analysis.occurrences.find((o) => o.kind === kind && o.id === id && o.role === "ref");
    const where = (kind, id) => definitionOf(analysis, use(kind, id));
    assert.equal(where("themes", "brand").where, "document", `${format}: a theme the document embeds`);
    assert.equal(where("themes", "minimal").where, "app", `${format}: a theme only the app has`);
    assert.equal(where("colorSchemes", "ocean").where, "document", `${format}: a color scheme, written as an object with an id`);
    assert.equal(referenceList(analysis, use("colorSchemes", "ocean")).length, 3, `${format}: the record, design.colorScheme and the theme's colorScheme`);
    assert.equal(where("fontSchemes", "arial").where, "app");
    assert.equal(where("narratives", "story").where, "document");
    assert.equal(where("audiences", "board").where, "app", `${format}: an audience of a list`);
    assert.equal(where("purposes", "inform").where, "app");
    assert.equal(where("tones", "formal").where, "app");
    assert.equal(use("audiences", "mine") === undefined || definitionOf(analysis, use("audiences", "mine")) === null, true, `${format}: an audience nobody defines has no definition`);
    // Beats of an embedded narrative, regions of an embedded layout (nested ones too).
    const hook = use("beat", "hook");
    assert.equal(definitionOf(analysis, hook).where, "document");
    assert.equal(text.slice(definitionOf(analysis, hook).occurrence.from, definitionOf(analysis, hook).occurrence.to), "hook");
    assert.equal(definitionOf(analysis, use("beat", "close")).occurrence.scope, "custom:story");
    assert.equal(definitionOf(analysis, use("region", "inner")).where, "document", `${format}: a nested region`);
    assert.equal(definitionOf(analysis, use("region", "right")).where, "document", `${format}: the second region`);
    assert.equal(use("region", "left").scope, "custom:duo");
    // Records of the document are renamed with their uses; the app's are not.
    const brand = analysis.occurrences.find((o) => o.kind === "themes" && o.id === "brand" && o.role === "def");
    assert.equal(renameBlocker(analysis, brand), "");
    assert.match(renameBlocker(analysis, use("themes", "minimal")), /provided by the app/);
    assert.match(renameBlocker(analysis, hook), /narrative record/);
    assert.match(renameBlocker(analysis, use("region", "left")), /layout record/);
    const next = applyTextEdits(text, renameEdits(analysis, brand, "house").edits.map((e) => ({ offset: e.from, length: e.to - e.from, insert: e.insert })));
    assert.equal(readDeck(next, format).design.theme, "house");
    assert.ok(readDeck(next, format).catalogs.custom.themes.house, `${format}: the record is renamed`);
    const ocean = renameEdits(analysis, use("colorSchemes", "ocean"), "sea");
    const seaDeck = readDeck(applyTextEdits(text, ocean.edits.map((e) => ({ offset: e.from, length: e.to - e.from, insert: e.insert }))), format);
    assert.deepEqual([seaDeck.design.colorScheme.id, seaDeck.catalogs.custom.themes.brand.colorScheme, Object.keys(seaDeck.catalogs.custom.colorSchemes)], ["sea", "sea", ["sea"]], `${format}: an object reference, a theme's reference and the record all change`);
  }
}

// ---- a big YAML text read in pieces gives what reading it whole gives ---------------------------------------------------------------------
{
  const big = { ...navigationDeck(400), references: [{ id: "gartner", text: "G" }], variables: { client: { type: "text", value: "Acme" } }, datasets: { sales: { columns: ["Quarter", "Revenue"], rows: Array.from({ length: 900 }, (_, index) => [`Q${index}`, index]) } } };
  big.slides[3].title = [{ text: "Cited {{client}}", cite: "gartner" }];
  const whole = toYaml(big).yaml;
  const variants = {
    "block style": whole,
    "CRLF": whole.replaceAll("\n", "\r\n"),
    "comments between the keys": whole.replace(/^(slides:)/m, "# the slides\n$1").replace(/^(assets:)/m, "# assets\n$1"),
    "slides at the list's own indent": whole.replace(/^slides:\n((?:  .*\n)+)/m, (match, body) => `slides:\n${body.replace(/^  /gm, "")}`),
    "a flow list of slides": `${whole.replace(/^slides:\n(?:  .*\n)+/m, "")}slides: [{id: tail, title: x}]\n`,
    "a document marker": `---\n${whole}`,
    "slides first": `${whole.match(/^slides:\n(?:  .*\n)+/m)[0]}${whole.replace(/^slides:\n(?:  .*\n)+/m, "")}`,
  };
  // The usual shapes are read in pieces; the others are read whole.
  for (const name of ["block style", "CRLF", "comments between the keys", "slides first"]) assert.ok(await readYamlInPieces(variants[name]), `${name}: read in pieces`);
  for (const name of ["a document marker"]) assert.equal(await readYamlInPieces(variants[name]), null, `${name}: read whole`);
  for (const [name, text] of Object.entries(variants)) {
    assert.ok(text.length > 24_000, `${name}: the text is big enough to be read in pieces`);
    const expected = analyze(text, "yaml", options);
    const pieces = await analyzeInPieces(text, "yaml", options);
    assert.deepEqual(pieces.occurrences.map((o) => [o.role, o.kind, o.scope, o.id, o.from, o.to]), expected.occurrences.map((o) => [o.role, o.kind, o.scope, o.id, o.from, o.to]), `${name}: the same ids in the same places`);
    assert.ok(expected.occurrences.some((o) => o.kind === "slide") || name === "a flow list of slides", `${name}: the corpus has ids`);
  }
}

// ---- speed on 1000 slides --------------------------------------------------------------------------------------------------------------
for (const [format, text] of [["json", JSON.stringify(bigDeck(1000), null, 2)], ["yaml", toYaml(bigDeck(1000)).yaml], ["md", toMarkdown(bigDeck(1000)).markdown]]) {
  const started = performance.now();
  const analysis = analyze(text, format, options);
  const symbol = symbolAt(analysis, Math.floor(text.length / 2));
  void referenceList(analysis, symbol ?? analysis.occurrences[0] ?? { kind: "asset", scope: "", id: "x" });
  const took = performance.now() - started;
  console.log(`Navigation model, ${format} ${Math.round(text.length / 1024)} KB, 1000 slides: ${took.toFixed(0)} ms`);
  assert.ok(took < 250, `${format}: reading 1000 slides takes ${took.toFixed(0)} ms`);
}
console.log("Source navigation units: definitions, references and renames pass in JSON, YAML and Markdown.");
