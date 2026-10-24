// The Markdown text adapter of the source editor (artifacts/source-editor/SPEC.md, section 3.3): what a position in an OPF Markdown draft means. Core's
// `scanMarkdown` finds the regions with the converter's own rules; this module turns the caret's region into a context for completion and hover:
// the YAML of the front matter and of `opf-slide` and `opf-block` fences (the YAML adapter, shifted into the text), the keys and values of a slide or
// block options comment, the info line of a fence, the lines of a metric fence, and the start of a line in the body (`Note:`, snippets). Plain
// functions, no DOM.
import { parse as parseYaml } from "yaml";
import { describeField } from "@openpresentation/opf/schema";
import { BLOCK_AS_VALUES, BLOCK_OPTION_KEYS, FENCE_ATTRIBUTES, LINE_KEYWORDS, METRIC_KEYS, SLIDE_OPTION_KEYS, SPAN_FLAGS, SPAN_VALUES, scanMarkdown, pathAt } from "@openpresentation/opf/source";
import { fromMarkdown } from "@openpresentation/opf/markdown";
import { yamlContextAt } from "./source-yaml.js";
import { snippetMarkdown, snippetsForMarkdown } from "./source-snippets.js";

const OPTION_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
const BARE = /^[A-Za-z0-9_-]+$/;
const LANGUAGES = ["javascript", "typescript", "python", "rust", "go", "bash", "json", "yaml", "toml", "ini", "markup", "css", "sql", "java", "csharp", "kotlin", "swift", "ruby", "php", "c", "hcl", "dockerfile", "js", "ts", "py", "sh", "html", "md"];
// Keys whose values come from a closed set the schema or the catalogs know; accepting the key opens that list.
const CHAIN_SLIDE = new Set(["layout", "type", "hidden"]);
const CHAIN_BLOCK = new Set(["type", "as", "region"]);
// The promoted regions of a slide that a block can be pinned to when the layout names none.
const PROMOTED = ["top", "middle", "bottom", "left", "center", "right", "top:left", "top:center", "top:right", "middle:left", "middle:center", "middle:right", "bottom:left", "bottom:center", "bottom:right"];

const lineAt = (text, position) => {
  const start = Math.max(text.lastIndexOf("\n", position - 1), text.lastIndexOf("\r", position - 1)) + 1;
  let end = position;
  while (end < text.length && text[end] !== "\n" && text[end] !== "\r") end++;
  return { start, end, text: text.slice(start, end) };
};

// ---- regions -----------------------------------------------------------------------------------------------------------------------
/**
 * Which part of a Markdown deck the caret is in: `{ region, ... }` with region `front-matter` (`yamlFrom`, `yamlTo`), `comment` (`comment`),
 * `fence` (`fence`, `part`: "info", "body" or "close"), `notes` or `body`. Used by the editing rules (Enter, Tab, pairs, comments) and the adapter.
 */
export function markdownRegionAt(text, position) {
  const scan = scanMarkdown(text);
  const front = scan.frontMatter;
  if (front) {
    if (position < front.yamlFrom + 1 && position <= front.yamlFrom) return { region: "front-matter-edge", front };
    if (position > front.yamlFrom && (front.closed ? position < front.yamlTo : true)) return { region: "front-matter", front, scan };
    if (front.closed && position >= front.yamlTo && position <= front.to) return { region: "front-matter-edge", front };
  }
  for (const fence of scan.fences) {
    if (position < fence.from || position > fence.to) continue;
    const opening = lineAt(text, fence.from);
    if (position <= opening.end) return { region: "fence", fence, part: "info", scan };
    if (fence.closed && position >= fence.to - lineAt(text, fence.to).text.length) return { region: "fence", fence, part: "close", scan };
    return { region: "fence", fence, part: "body", scan };
  }
  for (const comment of scan.comments) if (position >= comment.from && position <= comment.to) return { region: "comment", comment, scan };
  for (const notes of scan.notes) if (position >= notes.from && position <= notes.to) return { region: "notes", notes, scan };
  return { region: "body", scan };
}

const shiftToken = (token, base) => ({ ...token, start: token.start + base, end: token.end + base, from: token.from + base, to: token.to + base });

// The embedded catalogs of the front matter, so the options of a slide can list the records the deck carries.
function frontCatalogs(text, scan) {
  const front = scan.frontMatter;
  if (!front) return undefined;
  try { return parseYaml(text.slice(front.yamlFrom, front.yamlTo))?.catalogs; } catch { return undefined; }
}

function skeletonFor(text, scan, slide) {
  const document = { slides: Array.from({ length: Math.max(0, slide) + 1 }, () => ({})) };
  const catalogs = frontCatalogs(text, scan);
  if (catalogs) document.catalogs = catalogs;
  return document;
}

// ---- the context at a caret --------------------------------------------------------------------------------------------------------
/**
 * What the draft means at `position`, or null. A caret in YAML (front matter, an `opf-slide` or `opf-block` fence) gives the YAML adapter's context,
 * shifted into this text (`format: "yaml"`). Otherwise `{ format: "md", region, mode, token, ... }`:
 * - `region: "options"`: `optionKind` ("slide" or "block"), `mode` "key" or "value", `key`, `existing`, `needsSpace`, `slide`, `layout`
 * - `region: "comment-start"`: after `<!--` at the start of a line (offers `slide:` and `block:`)
 * - `region: "fence-info"`: `mode` "kind" (the first word), "type" (the chart type) or "attribute"; `word`
 * - `region: "metric"`: `mode` "key" or "value", `key`, `existing`
 * - `region: "body"`: the word at the start of a line (`Note:`, a snippet prefix), `separator` (a `---` goes first)
 */
export function markdownContextAt(text, position, { explicit = false } = {}) {
  const where = markdownRegionAt(text, position);
  const { scan } = where;
  switch (where.region) {
    case "front-matter": {
      const base = where.front.yamlFrom;
      const context = yamlContextAt(text.slice(base, where.front.closed ? where.front.yamlTo : text.length), position - base, { explicit, exclude: ["slides"] });
      return context ? { ...context, token: shiftToken(context.token, base) } : null;
    }
    case "fence":
      return fenceContext(text, position, where, explicit);
    case "comment":
      return commentContext(text, position, where, explicit);
    case "body":
      return bodyContext(text, position, where, explicit);
    default:
      void scan;
      return null;
  }
}

// ---- options comments --------------------------------------------------------------------------------------------------------------
/** The `key`, `key=value` tokens of an options comment between `from` and `to`: `{ start, end, key, keyEnd, eq, valueStart, quoted }`. */
function optionTokens(text, from, to) {
  const tokens = [];
  let index = from;
  while (index < to) {
    while (index < to && /\s/.test(text[index])) index++;
    if (index >= to) break;
    const start = index;
    while (index < to && /[A-Za-z0-9_-]/.test(text[index])) index++;
    const keyEnd = index;
    let eq = -1, valueStart = -1, quoted = false;
    if (text[index] === "=") {
      eq = index;
      index++;
      valueStart = index;
      if (text[index] === '"') {
        quoted = true;
        index++;
        while (index < to && text[index] !== '"') index += text[index] === "\\" ? 2 : 1;
        if (index < to) index++;
      } else while (index < to && !/[\s,]/.test(text[index])) index++;
    } else while (index < to && !/\s/.test(text[index])) index++;
    tokens.push({ start, end: index, key: text.slice(start, keyEnd), keyEnd, eq, valueStart, quoted });
    if (index === start) index++;
  }
  return tokens;
}

function slideLayout(text, scan, slide) {
  for (const comment of scan.comments) {
    if (comment.kind !== "slide" || comment.slide !== slide) continue;
    const tokens = optionTokens(text, comment.innerFrom, comment.innerTo);
    const found = tokens.find((token) => token.key === "layout" && token.eq >= 0);
    if (found) return text.slice(found.valueStart + (found.quoted ? 1 : 0), found.end - (found.quoted && text[found.end - 1] === '"' ? 1 : 0));
  }
  return undefined;
}

function commentContext(text, position, where, explicit) {
  const { comment, scan } = where;
  const line = lineAt(text, position);
  const before = text.slice(line.start, position);
  // `<!-- ` and nothing else on the line: the comment may be a slide or block options comment.
  const start = /^ {0,3}<!--[ \t]*([a-z]*)$/.exec(before);
  if (start && (comment.kind === "comment" || comment.kind === "slide" || comment.kind === "block") && !/^\s*(slide|block)\s*:/.test(text.slice(line.start + before.length - start[1].length - 0, line.end))) {
    const wordStart = position - start[1].length;
    const afterWord = text.slice(position, line.end);
    if (!explicit && start[1] === "" && !/[ \t]$/.test(before)) return null;
    return { format: "md", region: "comment-start", token: { quoted: false, closed: false, start: wordStart, end: position, from: wordStart, to: position }, closes: /-->/.test(afterWord), document: {}, path: [] };
  }
  if (comment.kind !== "slide" && comment.kind !== "block") return null;
  // A comment on one line only.
  const first = lineAt(text, comment.from);
  if (first.start !== line.start) return null;
  const colon = /^\s*(slide|block)\s*(:?)/.exec(text.slice(comment.innerFrom, line.end));
  if (!colon) return null;
  const keywordEnd = comment.innerFrom + colon[0].length;
  const innerEnd = comment.closed ? Math.min(comment.innerTo, line.end) : line.end;
  if (position < keywordEnd || position > innerEnd + 0) {
    if (!(position === keywordEnd - 0)) return null;
  }
  const kind = colon[1];
  const tokens = optionTokens(text, keywordEnd, innerEnd);
  const here = tokens.find((token) => position >= token.start && position <= token.end);
  const slide = comment.slide;
  const needsSpace = position === keywordEnd && colon[2] === ":" && text[position] !== " ";
  const keys = kind === "slide" ? SLIDE_OPTION_KEYS : BLOCK_OPTION_KEYS;
  const existing = new Set(tokens.filter((token) => token !== here && token.key !== "beat").map((token) => token.key));
  const base = { format: "md", region: "options", optionKind: kind, slide, existing, needsSpace, keys, document: skeletonFor(text, scan, slide), layout: slideLayout(text, scan, slide), path: [] };
  if (here && here.eq >= 0 && position > here.eq) {
    const first = here.valueStart;
    if (here.quoted) {
      const closed = text[here.end - 1] === '"' && here.end - 1 > first;
      const token = { quoted: true, closed, start: first, end: here.end, from: first + 1, to: closed ? here.end - 1 : Math.max(position, first + 1) };
      return { ...base, mode: "value", key: here.key, token };
    }
    return { ...base, mode: "value", key: here.key, token: { quoted: false, closed: false, start: first, end: here.end, from: first, to: here.end } };
  }
  if (here && !OPTION_KEY.test(text.slice(here.start, here.keyEnd) || "x")) return null;
  const start0 = here ? here.start : position;
  const end0 = here ? here.keyEnd : position;
  return { ...base, mode: "key", key: undefined, followedByEquals: Boolean(here && here.eq >= 0), token: { quoted: false, closed: false, start: start0, end: end0, from: start0, to: end0 } };
}

// ---- fences ------------------------------------------------------------------------------------------------------------------------
function fenceContext(text, position, where, explicit) {
  const { fence, part, scan } = where;
  if (part === "close") return null;
  if (part === "info") {
    const line = lineAt(text, fence.from);
    const indent = /^ */.exec(line.text)[0].length;
    const open = line.start + indent + fence.marker.length;
    if (position < open) return null;
    // Typed info: words separated by spaces; the caret is in one of them.
    const before = text.slice(open, position);
    const words = before.split(/\s+/);
    const typed = words.at(-1);
    const first = before.trimStart().split(/\s+/)[0];
    const tokenStart = position - typed.length;
    let tokenEnd = position;
    while (tokenEnd < line.end && /[A-Za-z0-9_+#.-]/.test(text[tokenEnd])) tokenEnd++;
    const token = { quoted: false, closed: false, start: tokenStart, end: tokenEnd, from: tokenStart, to: tokenEnd };
    const done = before.trim().split(/\s+/).filter(Boolean);
    const wordIndex = /\s$/.test(before) ? done.length : Math.max(0, done.length - 1);
    if (wordIndex === 0) return { format: "md", region: "fence-info", mode: "kind", word: first || "", token, document: {}, path: [] };
    const kind = first;
    if (kind === "chart" && wordIndex === 1 && !/=/.test(typed)) return { format: "md", region: "fence-info", mode: "type", word: kind, token, document: skeletonFor(text, scan, fence.slide), path: [] };
    if (!/=/.test(typed) && (kind === "chart" || kind === "timeline" || !["opf-slide", "opf-block", "metric"].includes(kind))) {
      const have = new Set(after(text, open, line.end).map((item) => item.key));
      return { format: "md", region: "fence-info", mode: "attribute", word: kind, existing: have, token, document: {}, path: [] };
    }
    return null;
  }
  // The body.
  if (fence.kind === "metric") return metricContext(text, position, fence, explicit, scan);
  if (fence.kind === "opf-slide" || fence.kind === "opf-block") {
    const base = fence.bodyFrom;
    const prefix = fence.kind === "opf-slide" ? ["slides", fence.slide] : ["slides", fence.slide, "blocks", 0];
    const context = yamlContextAt(text.slice(base, fence.bodyTo), position - base, { explicit, prefix });
    if (!context) return null;
    const catalogs = frontCatalogs(text, scan);
    if (catalogs && context.document && typeof context.document === "object") context.document.catalogs = catalogs;
    return { ...context, token: shiftToken(context.token, base) };
  }
  return null;
}

function after(text, from, to) {
  return optionTokens(text, from, to);
}

function metricContext(text, position, fence, explicit, scan) {
  void scan;
  const line = lineAt(text, position);
  const before = text.slice(line.start, position);
  const bodyLines = text.slice(fence.bodyFrom, fence.bodyTo).split(/\r\n|\r|\n/);
  const existing = new Set(bodyLines.map((item) => /^([A-Za-z]+):/.exec(item)?.[1]).filter(Boolean));
  const document = { slides: [{ metric: {} }] };
  const value = /^([A-Za-z]+):[ \t]*(.*)$/.exec(before);
  if (value) {
    const start = position - value[2].length;
    let end = position;
    while (end < line.end && !/\s/.test(text[end])) end++;
    return { format: "md", region: "metric", mode: "value", key: value[1], existing, token: { quoted: false, closed: false, start, end, from: start, to: end }, document, path: ["slides", 0, "metric", value[1]], needsSpace: value[2] === "" && !/:[ \t]$/.test(before) };
  }
  if (!/^[A-Za-z]*$/.test(before)) return null;
  let end = position;
  while (end < line.end && /[A-Za-z]/.test(text[end])) end++;
  const start = position - before.length;
  const self = /^([A-Za-z]+):/.exec(line.text)?.[1];
  if (self) existing.delete(self);
  return { format: "md", region: "metric", mode: "key", existing, token: { quoted: false, closed: false, start, end, from: start, to: end }, document, path: ["slides", 0, "metric"] };
}

// ---- the body ----------------------------------------------------------------------------------------------------------------------
function bodyContext(text, position, where, explicit) {
  const { scan } = where;
  const line = lineAt(text, position);
  const before = text.slice(line.start, position);
  // Inside the braces of an inline span: `[text]{bold color=#B42318}`.
  const span = /\]\{((?:[A-Za-z0-9_-]+(?:=(?:"[^"]*"|[^\s"}]*))?\s+)*)([A-Za-z]*)$/.exec(before);
  if (span) {
    let end = position;
    while (end < line.end && /[A-Za-z]/.test(text[end])) end++;
    const used = new Set([...span[1].matchAll(/([A-Za-z0-9_-]+)/g)].map((entry) => entry[1].toLowerCase()));
    const start = position - span[2].length;
    return { format: "md", region: "span", token: { quoted: false, closed: false, start, end, from: start, to: end }, existing: used, document: {}, path: [], explicit, opened: span[2] === "" };
  }
  if (!/^[A-Za-z][A-Za-z-]*$|^$/.test(before)) return null;
  if (before === "" && !explicit) return null;
  // Typing prose is not interrupted: a list opens by itself from the third letter on.
  if (!explicit && before.length < 3) return null;
  let end = position;
  while (end < line.end && /[A-Za-z-]/.test(text[end])) end++;
  // A slide follows another when there is content above that is not already a separator.
  const above = text.slice(0, line.start).replace(/\s+$/, "");
  const lastLine = above.slice(above.lastIndexOf("\n") + 1);
  const hasContent = above.trim() !== "" && !(scan.frontMatter && above.length <= scan.frontMatter.to);
  const separator = hasContent && !/^-{3,}[ \t]*$/.test(lastLine);
  const previousBlank = line.start === 0 || lineAt(text, line.start - 1).text.trim() === "";
  const slide = scan.slides.filter((item) => item.from < line.start).length;
  return { format: "md", region: "body", token: { quoted: false, closed: false, start: line.start, end, from: line.start, to: end }, separator, previousBlank, document: {}, path: [], slide };
}

// ---- the options -------------------------------------------------------------------------------------------------------------------
const kindOption = (label, type, detail, doc, boost, kind, extra = {}) => ({ label, type, detail, boost, opfDoc: doc, opf: { kind, ...extra } });

function regionNames(record) {
  const names = [];
  const walk = (regions) => {
    for (const region of Array.isArray(regions) ? regions : []) {
      if (typeof region?.name === "string" && region.name !== "title" && region.name !== "subtitle") names.push(region.name);
      if (region?.regions) walk(region.regions);
    }
  };
  walk(record?.regions);
  return names;
}

/** The completion options of a Markdown context: `{ options, validFor? }`, or null. `makers` are the option builders of the completion engine. */
export function markdownOptions(context, { catalogs, text, explicit, makers }) {
  const { literalOption, boostAt, docNode } = makers;
  const options = [];
  if (context.region === "comment-start") {
    options.push(kindOption("slide:", "keyword", "options", "Options of this slide: id, layout, section, ...", boostAt(0), "comment", { word: "slide:" }));
    options.push(kindOption("block:", "keyword", "options", "Options of the next block: id, type, as, region.", boostAt(1), "comment", { word: "block:" }));
    return { options, validFor: /^[a-z]*$/ };
  }
  if (context.region === "options") return optionsOptions(context, { catalogs, makers });
  if (context.region === "fence-info") {
    if (context.mode === "kind") {
      let order = 0;
      for (const kind of ["chart", "metric", "timeline", "opf-block", "opf-slide"]) {
        const doc = { chart: "A chart: the type, then CSV with a header row", metric: "One big number: value, label, unit, delta", timeline: "Events, one per line", "opf-block": "A content block written as YAML", "opf-slide": "Slide fields written as YAML" }[kind];
        options.push(kindOption(kind, "keyword", "fence", doc, boostAt(order++), "fence", { word: kind }));
      }
      for (const language of LANGUAGES) options.push(kindOption(language, "text", "code", `Code in ${language}`, boostAt(order++), "fence", { word: language }));
      return { options, validFor: /^[A-Za-z0-9_+#.-]*$/ };
    }
    if (context.mode === "type") {
      let info;
      try { info = describeField(["slides", 0, "chart", "type"], context.document); } catch { info = null; }
      for (const entry of info?.enum ?? []) options.push(literalOption(String(entry.value), JSON.stringify(entry.value), { value: entry.value, doc: entry.description ?? "", info: entry.description ? () => docNode({ title: String(entry.value), type: "chart type", description: entry.description }) : undefined }));
      return { options, validFor: /^[A-Za-z0-9_-]*$/ };
    }
    if (context.mode === "attribute") {
      const attributes = FENCE_ATTRIBUTES[context.word] ?? (["opf-slide", "opf-block", "metric"].includes(context.word) ? [] : FENCE_ATTRIBUTES.code);
      attributes.filter((name) => !context.existing.has(name)).forEach((name, index) => options.push(kindOption(name, "property", "attribute", `The ${name} of the ${context.word} fence`, boostAt(index), "fenceAttribute", { name })));
      return { options, validFor: /^[A-Za-z]*$/ };
    }
  }
  if (context.region === "metric") {
    if (context.mode === "key") {
      METRIC_KEYS.filter((key) => !context.existing.has(key)).forEach((key, index) => {
        let info;
        try { info = describeField(["slides", 0, "metric", key], context.document); } catch { info = null; }
        options.push({ label: key, type: "property", detail: info?.known ? (info.enum?.length ? "enum" : info.types.join(" | ")) : "string", boost: boostAt(index), opfDoc: info?.description ?? "", opf: { kind: "metricKey", key, chain: Boolean(info?.enum?.length) }, info: () => docNode({ title: key, type: info?.types.join(" | "), description: info?.description }) });
      });
      return { options, validFor: /^[A-Za-z]*$/ };
    }
    let info;
    try { info = describeField(context.path, context.document); } catch { info = null; }
    for (const entry of info?.enum ?? []) options.push(literalOption(String(entry.value), JSON.stringify(entry.value), { value: entry.value, doc: entry.description ?? "" }));
    return { options, validFor: /^[A-Za-z0-9_-]*$/ };
  }
  if (context.region === "span") {
    // Right after `{` or a space the list opens by itself (the characters that begin a new attribute); Ctrl+Space opens it anywhere in the braces.
    const docs = { bold: "Bold text", italic: "Italic text", underline: "Underlined text", strike: "Struck-through text", sup: "Superscript", sub: "Subscript", color: "Text color: a hex color, a scheme slot or var:name", size: "Font size in points", font: "Font family", lang: "Language of the text (a BCP-47 tag)" };
    [...SPAN_FLAGS.map((name) => [name, false]), ...SPAN_VALUES.map((name) => [name, true])].filter(([name]) => !context.existing.has(name)).forEach(([name, takesValue], index) => options.push(kindOption(name, "property", takesValue ? "value" : "flag", docs[name], boostAt(index), "spanAttribute", { name, takesValue })));
    return { options, validFor: /^[A-Za-z]*$/ };
  }
  if (context.region === "body") {
    const typed = text.slice(context.token.from, context.token.to).toLowerCase();
    let order = 0;
    for (const word of LINE_KEYWORDS) if (word.toLowerCase().startsWith(typed)) options.push(kindOption(word, "keyword", "speaker notes", "Speaker notes: every line to the end of the slide.", boostAt(order++), "keyword", { word }));
    for (const entry of snippetsForMarkdown()) if (entry.prefix.toLowerCase().startsWith(typed)) options.push({ label: entry.prefix, type: "snippet", detail: "snippet", boost: boostAt(order++), opfDoc: entry.description, opf: { kind: "snippet", prefix: entry.prefix }, info: () => docNode({ title: entry.prefix, type: "snippet", description: entry.description }) });
    return { options, validFor: /^[A-Za-z-]*$/ };
  }
  return null;
}

function optionsOptions(context, { catalogs, makers }) {
  const { literalOption, boostAt, docNode } = makers;
  const options = [];
  if (context.mode === "key") {
    const chain = context.optionKind === "slide" ? CHAIN_SLIDE : CHAIN_BLOCK;
    context.keys.filter((key) => !context.existing.has(key)).forEach((key, index) => {
      let info;
      try { info = context.optionKind === "slide" ? describeField(["slides", context.slide, key], context.document) : undefined; } catch { info = null; }
      const doc = info?.description ?? BLOCK_DOCS[key] ?? "";
      options.push({ label: key, type: "property", detail: info?.known ? info.typeLabel ?? info.types.join(" | ") : context.optionKind === "block" ? "option" : "string", boost: boostAt(index), opfDoc: doc, opf: { kind: "optionKey", key, chain: chain.has(key) }, info: () => docNode({ title: key, type: `${context.optionKind} option`, description: doc }) });
    });
    return { options, validFor: /^[A-Za-z0-9_-]*$/ };
  }
  const key = context.key;
  if (context.optionKind === "block") {
    if (key === "as") for (const value of BLOCK_AS_VALUES) options.push(literalOption(value, JSON.stringify(value), { value, doc: value === "bullets" ? "Store a list as bullets instead of items." : "Store an image line as video." }));
    else if (key === "region") {
      const names = [];
      if (context.layout) {
        try { const found = makers.listCatalogRecords(context.document, "layouts", { catalogs }).find((entry) => entry.id === context.layout); names.push(...regionNames(found?.record)); } catch { /* No regions known. */ }
      }
      for (const name of [...names, ...PROMOTED.filter((item) => !names.includes(item))]) options.push(literalOption(name, JSON.stringify(name), { value: name, doc: names.includes(name) ? `A region of the ${context.layout} layout` : "A promoted region of the slide", boost: names.includes(name) ? 99 : undefined }));
    } else if (key === "type") {
      let info;
      try { info = describeField(["slides", 0, "blocks", 0, "type"], context.document); } catch { info = null; }
      for (const entry of info?.enum ?? []) options.push(literalOption(String(entry.value), JSON.stringify(entry.value), { value: entry.value, doc: entry.description ?? "" }));
    }
    return { options, validFor: /^[A-Za-z0-9_:+-]*$/ };
  }
  if (!SLIDE_OPTION_KEYS.includes(key)) return null;
  const pseudo = { format: "md", mode: "value", path: ["slides", context.slide, key], document: context.document, key, token: context.token };
  const built = makers.valueOptions(pseudo, catalogs);
  options.push(...built.options);
  return { options, validFor: /^[A-Za-z0-9_:+-]*$/ };
}

const BLOCK_DOCS = {
  id: "A name for the block, so a finding or a patch can point at it.",
  type: "The block's content kind, when it cannot be told from the content.",
  as: "bullets stores a list as bullets; video stores an image line as a video.",
  region: "Pin the block to a region of the slide's layout, or to a promoted region (left, top:left, ...).",
};

// ---- accepting ---------------------------------------------------------------------------------------------------------------------
const escapeTemplate = (text) => text.replace(/[\\{}]/g, (character) => `\\${character}`);
const optionValue = (value) => (typeof value === "string" && BARE.test(value) ? value : JSON.stringify(value));

/** What accepting `completion` writes in a Markdown context: `{ template, fields, chain, choices, inner? }`. */
export function markdownPlan(context, completion, text, end) {
  const kind = completion.opf?.kind;
  if (context.region === "comment-start") {
    const word = completion.opf.word;
    return { template: context.closes ? `${word} ` : `${word} \${0} -->`, fields: context.closes ? 0 : 1, chain: true };
  }
  if (kind === "optionKey") {
    if (context.followedByEquals) return { template: escapeTemplate(completion.opf.key), fields: 0, chain: false };
    const lead = context.needsSpace ? " " : "";
    return { template: `${lead}${completion.opf.key}=`, fields: 0, chain: Boolean(completion.opf.chain) };
  }
  if (context.region === "options" && kind === "literal") {
    const value = completion.opf.value;
    if (context.token.quoted) {
      const inner = typeof value === "string" ? value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : String(value);
      return { template: escapeTemplate(inner), fields: 0, chain: false, inner: true };
    }
    return { template: escapeTemplate(optionValue(value)), fields: 0, chain: false };
  }
  if (kind === "fence") return { template: `${escapeTemplate(completion.opf.word)}${completion.opf.word === "chart" ? " " : ""}`, fields: 0, chain: completion.opf.word === "chart" };
  if (kind === "fenceAttribute") return { template: `${completion.opf.name}="\${1}"\${0}`, fields: 2, chain: false };
  if (context.region === "fence-info" && kind === "literal") return { template: escapeTemplate(String(completion.opf.value)), fields: 0, chain: false };
  if (kind === "metricKey") {
    if (/^[ \t]*:/.test(text.slice(end))) return { template: completion.opf.key, fields: 0, chain: false };
    return { template: `${completion.opf.key}: `, fields: 0, chain: Boolean(completion.opf.chain) };
  }
  if (context.region === "metric" && kind === "literal") return { template: `${context.needsSpace ? " " : ""}${escapeTemplate(String(completion.opf.value))}`, fields: 0, chain: false };
  if (kind === "spanAttribute") return { template: `${completion.opf.name}${completion.opf.takesValue ? "=" : ""}`, fields: 0, chain: false };
  if (kind === "keyword") return { template: `${escapeTemplate(completion.opf.word)} `, fields: 0, chain: false };
  if (kind === "snippet") {
    const entry = snippetsForMarkdown().find((candidate) => candidate.prefix === completion.opf.prefix);
    if (!entry) return null;
    const rendered = snippetMarkdown(entry, { separator: context.separator });
    // A separator needs a blank line above it.
    const lead = context.separator && !context.previousBlank ? "\n" : "";
    return { template: `${lead}${rendered.text}`, fields: rendered.fields.length, chain: false, choices: rendered.fields };
  }
  return null;
}

// ---- hover -------------------------------------------------------------------------------------------------------------------------
/**
 * The card for the front matter key or value, or the option of a slide, under `position`: `{ from, to, model }` or null. `describeFound` is the
 * completion engine's card builder.
 */
export function markdownHoverAt(text, position, { catalogs, describeFound }) {
  const where = markdownRegionAt(text, position);
  let inOptions = false;
  if (where.region === "comment") inOptions = where.comment.kind === "slide";
  if (where.region !== "front-matter" && !inOptions) return null;
  const found = pathAt(text, "md", position);
  if (!found?.range || (found.part !== "key" && found.part !== "value")) return null;
  const source = text.slice(found.range.offset, found.range.offset + found.range.length);
  let value;
  if (found.part === "value") value = /^[[{]/.test(source) ? undefined : source.replace(/^"|"$/g, "");
  let document;
  try { document = fromMarkdown(text, { validate: false }).presentation; } catch { document = { slides: [] }; }
  return describeFound({ kind: found.part, path: found.path, from: found.range.offset, to: found.range.offset + found.range.length, value, nodeType: /^[[{]/.test(source) ? "array" : "scalar" }, document, catalogs);
}
