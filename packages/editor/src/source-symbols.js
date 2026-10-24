// The outline of an OPF document (artifacts/source-editor/SPEC.md, section 8.4): the symbols the picker (Cmd/Ctrl+Shift+O) and the outline panel list, for
// JSON, YAML and Markdown, read from text that may be broken. A symbol is `{ id, kind, label, detail, depth, from, to, line }` with source offsets:
// the slides in order ("3. Highlights"), the top-level sections (design, organization, speaker), the assets, datasets, variables and references the
// document declares, and the catalog records it embeds. Plain functions, no DOM.
import { parseTree } from "jsonc-parser";
import { isMap, parseDocument } from "yaml";
import { scanMarkdown } from "@openpresentation/opf/source";

const SECTIONS = ["design", "organization", "speaker"];
const DECLARED = [["assets", "asset"], ["datasets", "dataset"], ["variables", "variable"]];
const CATALOG_KINDS = { layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone" };

// ---- one tree for the three readers ------------------------------------------------------------------------------------------------------
// `{ type: "object" | "array" | "scalar", value?, from, to, entries?: [{ key, from, to, node }], items?: [node] }`, offsets in the text.
function fromJson(text) {
  const root = parseTree(text, [], { allowTrailingComma: true, disallowComments: false });
  const convert = (node) => {
    if (!node) return null;
    const base = { from: node.offset, to: node.offset + node.length };
    if (node.type === "object") return { ...base, type: "object", entries: (node.children ?? []).filter((property) => property.children?.[0]).map((property) => ({ key: String(property.children[0].value), from: property.offset, to: property.offset + property.length, node: convert(property.children[1]) })) };
    if (node.type === "array") return { ...base, type: "array", items: (node.children ?? []).map(convert) };
    return { ...base, type: "scalar", value: node.value };
  };
  return convert(root);
}

function fromYamlNode(node, shift = 0) {
  if (!node) return null;
  const range = node.range ?? [0, 0, 0];
  const base = { from: range[0] + shift, to: range[1] + shift };
  if (isMap(node)) {
    return { ...base, type: "object", entries: node.items.filter((pair) => pair.key).map((pair) => ({ key: String(pair.key.value ?? pair.key), from: (pair.key.range?.[0] ?? range[0]) + shift, to: (pair.value?.range?.[1] ?? pair.key.range?.[1] ?? range[1]) + shift, node: fromYamlNode(pair.value, shift) })) };
  }
  if (node.items) return { ...base, type: "array", items: node.items.map((item) => fromYamlNode(item, shift)) };
  return { ...base, type: "scalar", value: node.value };
}
function fromYaml(text, shift = 0) {
  try { return fromYamlNode(parseDocument(text, { strict: false, uniqueKeys: false }).contents, shift); } catch { return null; }
}

const lineStarts = (text) => { const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1); return starts; };
const lineOf = (starts, offset) => { let low = 0, high = starts.length - 1; while (low < high) { const mid = (low + high + 1) >> 1; if (starts[mid] <= offset) low = mid; else high = mid - 1; } return low + 1; };

// ---- helpers -----------------------------------------------------------------------------------------------------------------------------
const entry = (node, key) => (node?.type === "object" ? node.entries.find((candidate) => candidate.key === key) : undefined);
const scalar = (node) => (node?.type === "scalar" && typeof node.value === "string" ? node.value : undefined);
/** A title as text: a string, or the text of a list of runs. */
function titleOf(node) {
  if (!node) return "";
  if (node.type === "scalar") return typeof node.value === "string" ? node.value : "";
  if (node.type === "array") return node.items.map((item) => (item?.type === "scalar" ? String(item.value ?? "") : titleOf(entry(item, "text")?.node))).join("");
  return "";
}
const clip = (text, max = 80) => { const flat = text.replace(/\s+/g, " ").trim(); return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat; };

function symbolsOfTree(root, starts, { slides = true } = {}) {
  const out = [];
  const add = (kind, label, detail, depth, from, to) => out.push({ id: `${kind}:${out.length}`, kind, label, detail, depth, from, to, line: lineOf(starts, from) });
  if (root?.type !== "object") return out;
  if (slides) {
    const list = entry(root, "slides")?.node;
    if (list?.type === "array") {
      list.items.forEach((item, index) => {
        if (!item) return;
        const title = clip(titleOf(entry(item, "title")?.node));
        const layout = scalar(entry(item, "layout")?.node), type = scalar(entry(item, "type")?.node);
        add("slide", `${index + 1}. ${title || "Untitled slide"}`, [layout && `layout ${layout}`, !layout && type].filter(Boolean).join(" "), 0, item.from, item.to);
      });
    }
  }
  for (const key of SECTIONS) {
    const found = entry(root, key);
    if (found?.node?.type === "object") add("section", key, "", 0, found.from, found.to);
  }
  for (const [key, kind] of DECLARED) {
    const found = entry(root, key);
    if (found?.node?.type !== "object" || !found.node.entries.length) continue;
    add("section", key, `${found.node.entries.length}`, 0, found.from, found.to);
    for (const child of found.node.entries) add(kind, child.key, kind === "dataset" ? scalar(entry(child.node, "title")?.node) ?? "" : "", 1, child.from, child.to);
  }
  const references = entry(root, "references")?.node;
  if (references?.type === "array" && references.items.length) {
    add("section", "references", `${references.items.length}`, 0, entry(root, "references").from, entry(root, "references").to);
    for (const item of references.items) { const id = scalar(entry(item, "id")?.node); if (id && item) add("reference", id, clip(scalar(entry(item, "text")?.node) ?? "", 50), 1, item.from, item.to); }
  }
  const catalogs = entry(root, "catalogs");
  if (catalogs?.node?.type === "object") {
    for (const group of catalogs.node.entries) {
      if (group.node?.type !== "object") continue;
      for (const [kindKey, kindLabel] of Object.entries(CATALOG_KINDS)) {
        const records = entry(group.node, kindKey)?.node;
        if (records?.type === "object") for (const record of records.entries) add("record", `${kindLabel} ${record.key}`, group.key === "custom" ? "this document" : group.key, 0, record.from, record.to);
        else if (records?.type === "array") for (const record of records.items) { const id = scalar(entry(record, "id")?.node); if (id && record) add("record", `${kindLabel} ${id}`, group.key === "custom" ? "this document" : group.key, 0, record.from, record.to); }
      }
    }
  }
  // Slides first, as the document reads: sort the rest by position inside their kind order is not needed; the list keeps slides, then the sections in
  // the order of the text so the picker's order is the document's order.
  return out.sort((a, b) => a.from - b.from).map((symbol, index) => ({ ...symbol, id: `${symbol.kind}:${index}` }));
}

// ---- Markdown ----------------------------------------------------------------------------------------------------------------------------
function markdownSymbols(text, starts) {
  const scan = scanMarkdown(text);
  const out = [];
  if (scan.frontMatter?.closed) {
    const tree = fromYaml(text.slice(scan.frontMatter.yamlFrom, scan.frontMatter.yamlTo), scan.frontMatter.yamlFrom);
    out.push(...symbolsOfTree(tree, starts, { slides: false }));
  }
  const skipped = [...scan.fences, ...scan.comments].map((range) => [range.from, range.to]);
  for (const slide of scan.slides) {
    let title = "", layout;
    const slideComment = scan.comments.find((comment) => comment.kind === "slide" && comment.slide === slide.index);
    if (slideComment) layout = /\blayout=("?)([A-Za-z0-9_:-]+)\1/.exec(text.slice(slideComment.innerFrom, slideComment.innerTo))?.[2];
    const body = text.slice(slide.from, slide.to);
    let offset = 0;
    for (const line of body.split("\n")) {
      const at = slide.from + offset;
      offset += line.length + 1;
      if (skipped.some(([from, to]) => at >= from && at < to)) continue;
      const heading = /^#\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) { title = heading[1].replace(/[*_`[\]]/g, ""); break; }
    }
    out.push({ id: "", kind: "slide", label: `${slide.index + 1}. ${clip(title) || "Untitled slide"}`, detail: layout ? `layout ${layout}` : "", depth: 0, from: slide.from, to: slide.to, line: slide.line });
  }
  return out.sort((a, b) => a.from - b.from).map((symbol, index) => ({ ...symbol, id: `${symbol.kind}:${index}` }));
}

/** The symbols of `text` in `format` ("json", "yaml" or "md"), in document order. Never throws. */
export function documentSymbols(format, text) {
  try {
    const starts = lineStarts(text);
    const symbols = format === "md" ? markdownSymbols(text, starts) : symbolsOfTree(format === "yaml" ? fromYaml(text) : fromJson(text), starts);
    // A YAML block ends with its line break: the range of a symbol stops at its last visible character.
    return symbols.map((symbol) => { let to = Math.min(symbol.to, text.length); while (to > symbol.from + 1 && /\s/.test(text[to - 1])) to--; return { ...symbol, to }; });
  } catch { return []; }
}

/** The innermost symbol that contains `offset` (the slide the caret is in), or null. */
export function symbolAt(symbols, offset) {
  let found = null;
  for (const symbol of symbols) if (symbol.from <= offset && offset <= symbol.to && (!found || symbol.to - symbol.from <= found.to - found.from)) found = symbol;
  return found;
}

/** The symbols that match what was typed: every word is in the label, detail or kind; failing that, the letters in order (a fuzzy match). */
export function filterSymbols(symbols, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return symbols;
  const text = (symbol) => `${symbol.label} ${symbol.detail} ${symbol.kind}`.toLowerCase();
  const exact = symbols.filter((symbol) => words.every((word) => text(symbol).includes(word)));
  if (exact.length) return exact;
  const letters = words.join("");
  return symbols.filter((symbol) => { let at = 0; for (const character of text(symbol)) if (character === letters[at]) at++; return at === letters.length; });
}

