// Snippets of the source editor (artifacts/source-editor/SPEC.md, section 5): a new slide, a chart slide, a quote and the like. Each is written once as an
// OPF fragment with numbered placeholders and rendered per format (JSON here; YAML and Markdown follow in phase 2), then handed to CodeMirror's
// snippet engine, which walks the tab stops. Plain functions, no DOM.

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

/** The JSON text of a snippet for insertion: `{ text, fields }`; a dataset is a `"name": { ... }` entry. */
export function snippetJson(snippet, { comma = false } = {}) {
  if (snippet.where !== "dataset") return renderJson(snippet.fragment, { comma });
  const body = renderJson(snippet.fragment, { comma });
  const key = `"${field(snippet.name)}"`;
  return { text: `${key}: ${body.text}`, fields: [{ index: snippet.name.index, text: snippet.name.text }, ...body.fields].sort((a, b) => a.index - b.index) };
}
