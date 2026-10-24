// Snippets of the source editor (artifacts/source-editor/SPEC.md, section 5): a new slide, a chart slide, a quote and the like. Each is written once as an
// OPF fragment with numbered placeholders and rendered per format (JSON here; YAML and Markdown follow in phase 2), then handed to CodeMirror's
// snippet engine, which walks the tab stops. Plain functions, no DOM.

import { Document as YamlDocument } from "yaml";

const PLACEHOLDER = Symbol("opf-placeholder");

/**
 * A placeholder inside a fragment: tab stop `index` (1 first; 0 is where the caret ends), `text` is what it holds until typed over, `raw` keeps it
 * out of string quotes (a number), `choice` opens the list of the field's values when the tab stop is reached (`value` is what a document has
 * when the stop is left empty, for tests).
 */
export const ph = (index, text = "", options = {}) => ({ [PLACEHOLDER]: true, index, text, ...options });
const isPlaceholder = (value) => value !== null && typeof value === "object" && value[PLACEHOLDER] === true;

const tabs = (depth) => "\t".repeat(depth);
// The snippet syntax treats braces and backslashes in a placeholder's text as markup.
const escapeText = (text) => text.replace(/[\\{}]/g, (character) => `\\${character}`);
const field = (placeholder) => `\${${placeholder.index}${placeholder.text ? `:${escapeText(JSON.stringify(placeholder.text).slice(1, -1))}` : ""}}`;

/** `{ text, fields }`: the fragment as JSON text with CodeMirror snippet markers (indentation as leading tabs, which become the editor's unit). */
export function renderJson(fragment, { comma = false } = {}) {
  const fields = [];
  const render = (value, depth) => {
    if (isPlaceholder(value)) {
      fields.push({ index: value.index, text: value.text, ...(value.choice ? { choice: true } : {}) });
      return value.raw ? field(value) : `"${field(value)}"`;
    }
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
      if (!value.length) return "[]";
      return `[\n${value.map((item) => `${tabs(depth + 1)}${render(item, depth + 1)}`).join(",\n")}\n${tabs(depth)}]`;
    }
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries.map(([key, item]) => `${tabs(depth + 1)}${JSON.stringify(key)}: ${render(item, depth + 1)}`).join(",\n")}\n${tabs(depth)}}`;
  };
  let text = render(fragment, 0);
  if (comma) text += ",";
  return { text: `${text}\${0}`, fields: fields.sort((a, b) => a.index - b.index) };
}

/** The same fragment with every placeholder replaced by its text (what a document has when the placeholders are left as they are). */
export function fragmentValue(fragment, { empty = false, literal = false } = {}) {
  const visit = (value) => {
    if (isPlaceholder(value)) return value.raw ? Number(value.text || 0) : (empty ? "" : (literal ? value.text : (value.value ?? value.text)));
    if (Array.isArray(value)) return value.map(visit);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  };
  return visit(fragment);
}

const columns = (first, second) => [ph(first, "Category"), ph(second, "Value")];

/**
 * The snippets. `where`: "slide" (an entry of `slides`), "reference" (an entry of `references`), "dataset" (a new key of `datasets`), "deck" (a blank
 * document). `fragment` is the OPF fragment; for "dataset" `name` is the entry's key.
 */
export const SNIPPETS = Object.freeze([
  { prefix: "slide", where: "slide", description: "A slide with a title and a list", fragment: { title: ph(1, "Slide title"), items: [ph(2, "First point")] } },
  { prefix: "slide-text", where: "slide", description: "A slide with a title and a paragraph", fragment: { title: ph(1, "Title"), text: ph(2, "Body text") } },
  { prefix: "slide-image", where: "slide", description: "A slide with a picture and its alt text", fragment: { title: ph(1, "Title"), image: { src: ph(2, "asset:photo"), alt: ph(3, "Describe the picture") } } },
  { prefix: "slide-chart", where: "slide", description: "A slide with a chart", fragment: { title: ph(1, "Title"), chart: { type: ph(2, "", { choice: true, value: "column" }), data: { columns: columns(3, 4), rows: [[ph(5, "A"), ph(6, "1", { raw: true })]] } } } },
  { prefix: "slide-quote", where: "slide", description: "A slide with a quote", fragment: { quote: { text: ph(1, "Quote"), attribution: ph(2, "Name, Title") } } },
  { prefix: "slide-metric", where: "slide", description: "A slide with one big number", fragment: { metric: { value: ph(1, "42"), label: ph(2, "Label") } } },
  { prefix: "slide-table", where: "slide", description: "A slide with a table", fragment: { title: ph(1, "Title"), table: { columns: [ph(2, "Name"), ph(3, "Value")], rows: [[ph(4, "A"), ph(5, "1")]] } } },
  { prefix: "slide-code", where: "slide", description: "A slide with a piece of code", fragment: { code: { source: ph(1, "code"), language: ph(2, "js") } } },
  { prefix: "slide-two-column", where: "slide", description: "A slide with two columns", fragment: { title: ph(1, "Title"), layout: "two-column", left: { items: [ph(2, "Left")] }, right: { items: [ph(3, "Right")] } } },
  { prefix: "section", where: "slide", description: "A section divider", fragment: { layout: "section", title: ph(1, "Section title") } },
  { prefix: "reference", where: "reference", description: "A reference a slide can cite", fragment: { id: ph(1, "smith2020"), text: ph(2, "Citation") } },
  { prefix: "dataset", where: "dataset", description: "A table of data that charts and tables can share", name: ph(1, "sales"), fragment: { columns: [ph(2, "Category"), ph(3, "Value")], rows: [[ph(4, "A"), ph(5, "1", { raw: true })]] } },
  { prefix: "deck", where: "deck", description: "A starter deck", fragment: { name: ph(1, "Deck name"), slides: [{ title: ph(2, "Title") }] } },
  // Speaker notes in Markdown: a `Note:` line (JSON and YAML have the `notes` property for it).
  { prefix: "notes", where: "markdown", key: "notes", description: "Speaker notes for the slide", fragment: ph(1, "Speaker notes") },
]);

/**
 * Snippets a KEY of the deck is accepted as (SPEC 5: `design`, `organization`, `speaker`): not items of the list on their own (`SNIPPETS` holds
 * those), but what accepting the property writes, as VS Code does for a property with default snippets. The fragment is the value of the key. They hold
 * the required members of the object, each a tab stop (SPEC 5 lists only `name` for the speaker; the Speaker schema requires an id too), and `design`
 * opens the list of the catalog at each stop.
 */
export const KEY_SNIPPETS = Object.freeze([
  { prefix: "design", where: "deck-key", key: "design", description: "The design of the deck: a theme, a color scheme and a font scheme", fragment: { theme: ph(1, "", { choice: true }), colorScheme: ph(2, "", { choice: true }), fontScheme: ph(3, "", { choice: true }) } },
  { prefix: "organization", where: "deck-key", key: "organization", description: "The organization presenting the deck: an id and a name", fragment: { id: ph(1, "acme"), name: ph(2, "Acme Inc.") } },
  { prefix: "speaker", where: "deck-key", key: "speaker", description: "The person presenting the deck: an id and a name", fragment: { id: ph(1, "alice"), name: ph(2, "Name") } },
]);

/** The snippets that fit where the caret is: `where` and the path of the node (see source-json.js). */
export function snippetsFor(mode, path) {
  const last = path.at(-1);
  return SNIPPETS.filter((snippet) => {
    if (snippet.where === "slide") return mode === "item" && path.length === 2 && path[0] === "slides" && typeof last === "number";
    if (snippet.where === "reference") return mode === "item" && path.length === 2 && path[0] === "references" && typeof last === "number";
    if (snippet.where === "dataset") return mode === "key" && path.length === 1 && path[0] === "datasets";
    if (snippet.where === "deck") return mode === "value" && path.length === 0;
    return false;
  });
}

/**
 * The snippets a key of the object at `path` is accepted as (the deck's `design`, `organization`, `speaker`): not items of their own in the list,
 * but what accepting that property writes, as VS Code does for a property with default snippets.
 */
export function keySnippetsFor(path) {
  return path.length === 0 ? KEY_SNIPPETS : [];
}

/** The JSON text of a snippet for insertion: `{ text, fields }`; a dataset is a `"name": { ... }` entry. */
export function snippetJson(snippet, { comma = false } = {}) {
  if (snippet.key !== undefined) {
    const body = renderJson(snippet.fragment, { comma });
    return { text: `${JSON.stringify(snippet.key)}: ${body.text}`, fields: body.fields };
  }
  if (snippet.where !== "dataset") return renderJson(snippet.fragment, { comma });
  const body = renderJson(snippet.fragment, { comma });
  const key = `"${field(snippet.name)}"`;
  return { text: `${key}: ${body.text}`, fields: [{ index: snippet.name.index, text: snippet.name.text }, ...body.fields].sort((a, b) => a.index - b.index) };
}

// ---- YAML ------------------------------------------------------------------------------------------------------------------------------
const yamlText = (text) => {
  try { return new YamlDocument(text).toString({ lineWidth: 0 }).trimEnd(); } catch { return JSON.stringify(text); }
};
// A placeholder as YAML: its text between the markers, quoted when plain YAML would read it as another type or as syntax (`42`, `a: b`).
function yamlField(placeholder) {
  const marker = (text) => `\${${placeholder.index}${text ? `:${escapeText(text)}` : ""}}`;
  const text = placeholder.text || (placeholder.choice ? (placeholder.value ?? "") : "");
  if (placeholder.raw || !text) return marker(text);
  return yamlText(text) === text ? marker(text) : `"${marker(JSON.stringify(text).slice(1, -1))}"`;
}

/** The lines of a mapping as `[{ depth, text }]` (block style; lists of lists and `columns` in flow style), recording placeholders in `fields`. */
function yamlLines(mapping, depth, fields) {
  const scalar = (value) => {
    if (isPlaceholder(value)) {
      fields.push({ index: value.index, text: value.text || (value.choice ? (value.value ?? "") : ""), ...(value.choice ? { choice: true } : {}) });
      return yamlField(value);
    }
    if (value === null) return "null";
    return typeof value === "string" ? yamlText(value) : String(value);
  };
  const flow = (value) => (Array.isArray(value) ? `[${value.map(flow).join(", ")}]` : scalar(value));
  const isCollection = (value) => value !== null && typeof value === "object" && !isPlaceholder(value);
  const lines = [];
  for (const [key, item] of Object.entries(mapping)) {
    if (!isCollection(item)) { lines.push({ depth, text: `${key}: ${scalar(item)}` }); continue; }
    if (Array.isArray(item)) {
      if (!item.length) { lines.push({ depth, text: `${key}: []` }); continue; }
      if (key === "columns") { lines.push({ depth, text: `${key}: ${flow(item)}` }); continue; }
      lines.push({ depth, text: `${key}:` });
      for (const entry of item) {
        if (Array.isArray(entry)) lines.push({ depth: depth + 1, text: `- ${flow(entry)}` });
        else if (isCollection(entry)) {
          const inner = yamlLines(entry, depth + 2, fields);
          if (inner.length) inner[0] = { depth: depth + 1, text: `- ${inner[0].text}` };
          lines.push(...inner);
        } else lines.push({ depth: depth + 1, text: `- ${scalar(entry)}` });
      }
      continue;
    }
    if (!Object.keys(item).length) { lines.push({ depth, text: `${key}: {}` }); continue; }
    lines.push({ depth, text: `${key}:` }, ...yamlLines(item, depth + 1, fields));
  }
  return lines;
}

/**
 * `{ text, fields }`: a fragment as block-style YAML with CodeMirror snippet markers. The first line starts where the caret is (after a dash or
 * at a key position); the others are indented relative to the line the caret is on, and `dash` more columns when the caret follows a list dash.
 * `entry` writes the fragment as the value of that key; `name` (a placeholder) writes it under a key the author names.
 */
export function renderYaml(fragment, { dash = 0, entry, name } = {}) {
  const fields = [];
  let lines;
  if (name !== undefined) {
    fields.push({ index: name.index, text: name.text });
    lines = [{ depth: 0, text: `${yamlField(name)}:` }, ...yamlLines(fragment, 1, fields)];
  } else if (entry !== undefined) lines = yamlLines({ [entry]: fragment }, 0, fields);
  else lines = yamlLines(fragment, 0, fields);
  const pad = " ".repeat(dash);
  const text = lines.map((line, index) => (index === 0 ? line.text : `${pad}${"  ".repeat(line.depth)}${line.text}`)).join("\n");
  return { text: `${text}\${0}`, fields: fields.sort((a, b) => a.index - b.index) };
}

/** The YAML text of a snippet for insertion: `{ text, fields }`. `dash` is the width of the list dash the caret follows (2), else 0. */
export function snippetYaml(snippet, { dash = 0 } = {}) {
  if (snippet.key !== undefined) return renderYaml(snippet.fragment, { dash, entry: snippet.key });
  if (snippet.where === "dataset") return renderYaml(snippet.fragment, { dash, name: snippet.name });
  return renderYaml(snippet.fragment, { dash });
}

// ---- Markdown --------------------------------------------------------------------------------------------------------------------------
// A placeholder as Markdown text: the marker with its text (a choice starts with its default, `column`).
function mdField(placeholder, fields) {
  const text = placeholder.text || (placeholder.choice ? (placeholder.value ?? "") : "");
  fields.push({ index: placeholder.index, text, ...(placeholder.choice ? { choice: true } : {}) });
  return `\${${placeholder.index}${text ? `:${escapeText(text)}` : ""}}`;
}

const SLIDE_OPTION_FIELDS = ["id", "type", "layout", "section", "tag"];

/**
 * `{ text, fields }`: a slide fragment as the Markdown dialect writes it (options comment, `#` title, blocks, `Note:`), with CodeMirror snippet
 * markers. `separator` puts `---` and a blank line first (a slide after another). A `notes` snippet is one `Note:` line. The shape follows
 * core's writer, so the result reads back as the slide the fragment describes.
 */
export function renderMarkdown(fragment, { separator = false, entry } = {}) {
  const fields = [];
  const value = (item) => (isPlaceholder(item) ? mdField(item, fields) : item === null || item === undefined ? "" : String(item));
  if (entry === "notes") return { text: `Note: ${value(fragment)}\${0}`, fields };
  const blocks = [];
  const options = [];
  for (const key of SLIDE_OPTION_FIELDS) if (typeof fragment[key] === "string" || isPlaceholder(fragment[key])) options.push(`${key}=${value(fragment[key])}`);
  // The options comment sits directly above what follows it, as core writes it.
  const lead = options.length ? `<!-- slide: ${options.join(" ")} -->` : "";
  if (fragment.title !== undefined) blocks.push(`${lead ? `${lead}\n` : ""}# ${value(fragment.title)}`);
  else if (lead) blocks.push(lead);
  if (fragment.subtitle !== undefined) blocks.push(`## ${value(fragment.subtitle)}`);
  const bullets = (items) => items.map((item) => `- ${value(item)}`).join("\n");
  const csv = (rows) => rows.map((row) => row.map((cell) => value(cell)).join(",")).join("\n");
  if (fragment.text !== undefined) blocks.push(value(fragment.text));
  if (Array.isArray(fragment.items)) blocks.push(bullets(fragment.items));
  for (const region of ["left", "right"]) {
    if (fragment[region]) blocks.push(`<!-- block: region=${region} -->\n${bullets(fragment[region].items ?? [])}`);
  }
  if (fragment.image) blocks.push(`![${value(fragment.image.alt)}](${value(fragment.image.src)})`);
  if (fragment.chart) blocks.push(`\`\`\`chart ${value(fragment.chart.type)}\n${csv([fragment.chart.data.columns, ...fragment.chart.data.rows])}\n\`\`\``);
  if (fragment.quote) blocks.push(`> ${value(fragment.quote.text)}${fragment.quote.attribution === undefined ? "" : `\n> — ${value(fragment.quote.attribution)}`}`);
  if (fragment.metric) blocks.push(`\`\`\`metric\nvalue: ${value(fragment.metric.value)}\nlabel: ${value(fragment.metric.label)}\n\`\`\``);
  if (fragment.table) {
    const row = (cells) => `| ${cells.map((cell) => value(cell)).join(" | ")} |`;
    blocks.push([row(fragment.table.columns), row(fragment.table.columns.map(() => "---")), ...fragment.table.rows.map(row)].join("\n"));
  }
  if (fragment.code) blocks.push(`\`\`\`${value(fragment.code.language)}\n${value(fragment.code.source)}\n\`\`\``);
  if (fragment.notes !== undefined) blocks.push(`Note: ${value(fragment.notes)}`);
  const body = blocks.join("\n\n");
  return { text: `${separator ? "---\n\n" : ""}${body}\${0}`, fields: fields.sort((a, b) => a.index - b.index) };
}

/** The Markdown text of a snippet for insertion at the start of a line: `{ text, fields }`. `separator`: a slide follows another. */
export function snippetMarkdown(snippet, { separator = false } = {}) {
  if (snippet.key !== undefined) return renderMarkdown(snippet.fragment, { entry: snippet.key });
  return renderMarkdown(snippet.fragment, { separator });
}

/** The snippets of the Markdown body: a slide of each kind and the speaker notes. */
export function snippetsForMarkdown() {
  return SNIPPETS.filter((snippet) => snippet.where === "slide" || snippet.where === "markdown");
}
