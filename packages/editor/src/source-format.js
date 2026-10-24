// Format document for the source pane (Shift+Alt+F, Cmd/Ctrl+Shift+F and the Format button): whitespace only, in every format, and nothing the
// author wrote is dropped. JSON is laid out token by token (so a draft that does not parse is laid out too), YAML goes through the `yaml`
// library's document round trip (comments, anchors, key order and scalar styles stay), and Markdown gets one blank line between blocks with its
// front matter formatted as YAML. Plain functions, no DOM: `formatSource(format, text, { unit })` returns `{ text }` or `{ error }`.
import { parseDocument } from "yaml";
import { formatJsonSource } from "./json-format.js";

const lineEnding = (source) => /\r\n|\r|\n/.exec(source)?.[0] ?? "\n";

/** YAML text laid out with a 2-space indent, long lines kept whole; its comments, blank lines, scalar styles and key order stay as written. */
export function formatYamlSource(source) {
  if (source.trim() === "") return { text: source };
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const eol = lineEnding(source);
  const document = parseDocument(bom ? source.slice(1) : source, { prettyErrors: false, customTags: keepNumberSpelling });
  if (document.errors.length) return { error: "The YAML has errors, so it cannot be formatted. Fix them first." };
  // Only comments: there is no document to write, and writing one would add a `null`.
  if (document.contents === null || document.contents === undefined) return { text: source };
  let text = document.toString({ indent: 2, lineWidth: 0, flowCollectionPadding: false });
  // The library ends every document with a newline; keep the author's choice.
  if (!/[\r\n]\s*$/.test(source) && text.endsWith("\n")) text = text.slice(0, -1);
  if (eol !== "\n") text = text.replaceAll("\n", eol);
  return { text: bom + text };
}

// The library writes a number from its value (1e3 becomes 1e+3, 0x1F 0x1f, .5 0.5, +1 1); the author's spelling is kept instead.
const NUMBER_TAGS = new Set(["tag:yaml.org,2002:int", "tag:yaml.org,2002:float"]);
const keepNumberSpelling = (tags) => tags.map((tag) => (
  typeof tag === "object" && tag && typeof tag.stringify === "function" && NUMBER_TAGS.has(tag.tag)
    ? { ...tag, stringify: (item, context, onComment, onChompKeep) => (typeof item.source === "string" && item.source !== "" ? item.source : tag.stringify(item, context, onComment, onChompKeep)) }
    : tag
));

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const INDENTED = /^(?: {4}|\t)/;

/**
 * Markdown laid out with at most one blank line between blocks (code fences and runs inside an indented block are left as written), the front
 * matter formatted as YAML, one line ending (the first one found) and one newline at the end.
 */
export function formatMarkdownSource(source) {
  const eol = lineEnding(source);
  const lines = source.split(/\r\n|\r|\n/);
  let body = 0;
  const out = [];
  if (lines[0] === "---") {
    const close = lines.findIndex((line, index) => index > 0 && (line === "---" || line === "..."));
    if (close > 0) {
      const front = formatYamlSource(lines.slice(1, close).join("\n"));
      out.push("---", ...(front.error || front.text === "" ? lines.slice(1, close) : front.text.replace(/\n$/, "").split("\n")), lines[close]);
      body = close + 1;
    }
  }
  let fence = null, blanks = 0, lastIndented = false;
  for (let index = body; index < lines.length; index++) {
    const line = lines[index];
    if (fence) {
      out.push(line);
      const marker = FENCE.exec(line)?.[1];
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      continue;
    }
    if (line.trim() === "") { blanks++; continue; }
    if (blanks) {
      // A blank run inside an indented block (code) is content; elsewhere it is one blank line.
      const keep = lastIndented && INDENTED.test(line) ? blanks : 1;
      for (let count = 0; count < keep; count++) out.push("");
    }
    blanks = 0;
    out.push(line);
    lastIndented = INDENTED.test(line);
    const opened = FENCE.exec(line)?.[1];
    if (opened) fence = opened;
  }
  // A document that ends inside a fence keeps its last lines as written; otherwise it ends with one newline.
  while (!fence && out.length && out[out.length - 1].trim() === "") out.pop();
  return { text: out.length ? out.join(eol) + (fence ? "" : eol) : "" };
}

/**
 * Format `text` as `format` ("json", "yaml" or "md"). `unit` is the editor's indentation unit for JSON (a tab or spaces). Returns `{ text }`
 * (possibly the same text) or `{ error }` with a sentence for the author.
 */
export function formatSource(format, text, { unit } = {}) {
  try {
    if (format === "yaml") return formatYamlSource(text);
    if (format === "md") return formatMarkdownSource(text);
    return { text: formatJsonSource(text, unit) };
  } catch (error) {
    return { error: `Formatting failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
