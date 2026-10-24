// The shape hint (artifacts/source-editor/SPEC.md, section 8.2): a signature-like tooltip of the object around the caret, as parameter hints are for a
// call. Cmd/Ctrl+Shift+Space shows it (`showShapeHint`); typing `{` or `,` between the members of a slide that has a `layout` shows it by itself
// (`autoShapeHint`). Its rows are the fields to write, each `set` (the object has it), `next` (the first required one it has not) or `optional`:
// for a slide with a layout, the layout's regions (title, then the region's key, ...); for a block, the fields of its `type`; otherwise the
// required fields of the schema first, then the common ones. It follows the caret from member to member and closes when the caret leaves the object
// or on Escape; the arrow keys are not taken. It is a real CodeMirror tooltip (`showTooltip`), mirrored into the live region as one sentence.
// The reading of the text (`shapeAt`) is plain functions over the text, so it is tested without a browser. Loaded lazily by the code editor.
import { Prec, StateEffect, StateField } from "@codemirror/state";
import { EditorView, keymap, showTooltip } from "@codemirror/view";
import { findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser";
import { parseDocument } from "yaml";
import { describeField } from "@openpresentation/opf/schema";
import { fromMarkdown } from "@openpresentation/opf/markdown";
import { pathAt, scanMarkdown } from "@openpresentation/opf/source";
import { listCatalogRecords } from "./catalogs.js";
import { flatRegions, valueAt } from "./source-references.js";
import { SYNTAX_FIELDS, markdownRegionAt } from "./source-markdown.js";
import { yamlContextAt } from "./source-yaml.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isIndex = (segment) => typeof segment === "number" || /^(?:0|[1-9]\d*)$/.test(String(segment));
const present = (value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
const MAX_ROWS = 7;

// ---- the words ---------------------------------------------------------------------------------------------------------------------
const KEY_WORDS = {
  title: "Slide title", subtitle: "Subtitle", items: "List of points", text: "Body text", image: "Picture", video: "Video", chart: "Chart", table: "Table",
  quote: "Quote", code: "Code", metric: "Key number", timeline: "Timeline", notes: "Speaker notes", layout: "Layout of the slide", id: "A name for this object", type: "Content kind",
  region: "Region of the layout to place it in",
};
// The slide key that holds content of a kind a region accepts, and the other way round.
const KEY_OF_KIND = { text: "text", list: "items", image: "image", video: "video", chart: "chart", table: "table", quote: "quote", code: "code", metric: "metric", timeline: "timeline" };
const KIND_OF_KEY = Object.fromEntries(Object.entries(KEY_OF_KIND).map(([kind, key]) => [key, kind]));
// Which key a region that takes many kinds is filled by first (a slide's own list or text).
const KEY_PREFERENCE = ["items", "text", "image", "chart", "table", "quote", "code", "metric", "timeline", "video"];
const joinWords = (words) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words.at(-1)}` : (words[0] ?? ""));

function clip(text, length = 58) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  const first = /^.*?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
  return first.length <= length ? first : `${first.slice(0, first.lastIndexOf(" ", length - 1) > 20 ? first.lastIndexOf(" ", length - 1) : length - 1)}…`;
}

// ---- reading the text ----------------------------------------------------------------------------------------------------------------
const parseYamlValue = (text) => {
  try { return parseDocument(text, { strict: false, uniqueKeys: false }).toJS({ maxAliasCount: -1 }) ?? {}; } catch { return {}; }
};

/** Which slide of a Markdown text the position is in: the last one that starts before it, or the next when a `---` separator lies between. */
function markdownSlideAt(text, scan, position) {
  let index = -1;
  scan.slides.forEach((slide, number) => { if (slide.from <= position) index = number; });
  const from = index >= 0 ? scan.slides[index].to : (scan.frontMatter?.to ?? 0);
  if (/^-{3,}[ \t]*$/m.test(text.slice(from, Math.max(from, position)))) return index + 1;
  return Math.max(0, index);
}

/**
 * The draft around `position`: `{ path, firstIsObject, deck, read, where }` or null. `path` is where the caret is (the object when it sits between
 * members), `deck` the plain value of the whole text as far as it reads, `where` "text" when the caret is in the structured text and "body" in the
 * prose of a Markdown slide.
 */
function readDraft(format, text, position) {
  if (format === "json") {
    const root = parseTree(text, [], { allowTrailingComma: true });
    if (!root) return null;
    const found = pathAt(text, "json", position);
    if (!found || found.part === "none") return null;
    const deck = getNodeValue(root);
    return { path: found.path, firstIsObject: found.part === "between", deck, read: (path) => (path.length ? valueAt(deck, path) : deck), where: "text", node: (path) => findNodeAtLocation(root, path) };
  }
  if (format === "yaml") {
    const context = yamlContextAt(text, position, { explicit: true });
    const found = context ? null : pathAt(text, "yaml", position);
    if (!context && (!found || found.part === "none")) return null;
    const deck = parseYamlValue(text);
    return { path: context ? context.path : found.path, firstIsObject: context ? context.mode === "key" : found.part === "between", deck, read: (path) => (path.length ? valueAt(deck, path) : deck), where: "text" };
  }
  if (format === "md") {
    let deck;
    try { deck = fromMarkdown(text, { validate: false }).presentation ?? {}; } catch { deck = {}; }
    const where = markdownRegionAt(text, position);
    if (where.region === "front-matter") {
      const front = where.front;
      const context = yamlContextAt(text.slice(front.yamlFrom, front.closed ? front.yamlTo : text.length), position - front.yamlFrom, { explicit: true, exclude: ["slides"] });
      if (!context) return null;
      return { path: context.path, firstIsObject: context.mode === "key", deck, read: (path) => (path.length ? valueAt(deck, path) : deck), where: "text" };
    }
    if (where.region === "fence" && where.part === "body" && (where.fence.kind === "opf-slide" || where.fence.kind === "opf-block")) {
      const { fence } = where;
      const prefix = fence.kind === "opf-slide" ? ["slides", fence.slide] : ["slides", fence.slide, "blocks", 0];
      const context = yamlContextAt(text.slice(fence.bodyFrom, fence.bodyTo), position - fence.bodyFrom, { explicit: true, prefix });
      if (!context) return null;
      // An opf-block fence is read from its own YAML (its index among the blocks is not the 0 the context pictures).
      const own = fence.kind === "opf-block" ? parseYamlValue(text.slice(fence.bodyFrom, fence.bodyTo)) : null;
      const read = (path) => (own && path.length >= prefix.length && prefix.every((step, index) => String(path[index]) === String(step)) ? valueAt(own, path.slice(prefix.length)) : path.length ? valueAt(deck, path) : deck);
      return { path: context.path, firstIsObject: context.mode === "key", deck, read, where: "text" };
    }
    if (where.region === "front-matter-edge" || where.region === "fence" && where.part === "close") return null;
    const scan = where.scan ?? scanMarkdown(text);
    const slide = markdownSlideAt(text, scan, position);
    const path = ["slides", slide];
    return { path, firstIsObject: true, deck, read: (at) => (at.length ? valueAt(deck, at) : deck), where: "body" };
  }
  return null;
}

/** The innermost object at or above `path` that has a shape the schema knows: `{ path, value, info }`, null when the first object is not one. */
function targetFor(draft, path, firstIsObject) {
  for (let length = path.length; length >= 0; length--) {
    const candidate = path.slice(0, length);
    const value = draft.read(candidate);
    const object = isObject(value) || (length === path.length && firstIsObject && (value === undefined || value === null));
    if (!object) continue;
    let info;
    try { info = describeField(candidate, draft.deck); } catch { return null; }
    // The first object we meet decides: an object the schema has no shape for (`extensions`) has no hint, it does not borrow its parent's.
    if (!info.known || !info.children?.length) return null;
    return { path: candidate, value: isObject(value) ? value : {}, info };
  }
  return null;
}

// ---- the rows ----------------------------------------------------------------------------------------------------------------------------
const row = (key, description, set, required, extra = {}) => ({ key, description, state: set ? "set" : "optional", required, ...extra });

function layoutRows(record, slide) {
  const rows = [];
  const used = new Set();
  const blocks = Array.isArray(slide.blocks) ? slide.blocks.filter(isObject) : [];
  for (const region of flatRegions(record)) {
    const accepts = region.accepts;
    let keys;
    let description;
    if (region.name in KEY_WORDS && !["id", "type", "region", "layout", "notes"].includes(region.name)) {
      keys = [region.name];
      description = KEY_WORDS[region.name];
    } else if (!accepts.length) continue;
    else {
      const words = `The ${region.name} (${joinWords(accepts)})`;
      if (accepts.length <= 2) keys = [...new Set(accepts.map((kind) => KEY_OF_KIND[kind]).filter(Boolean))];
      else keys = [KEY_PREFERENCE.find((key) => accepts.includes(KIND_OF_KEY[key]) && !used.has(key))].filter(Boolean);
      description = words;
      if (!keys.length) keys = [];
    }
    keys.forEach((key) => used.add(key));
    const set = keys.some((key) => present(slide[key])) || blocks.some((block) => block.region === region.name);
    const required = region.name === "title" || region.role === "primary" || (Number.isFinite(region.min) && region.min >= 1);
    rows.push(row(keys.length ? keys.join(" / ") : region.name, description, set, required, { keys, region: region.name }));
  }
  rows.push(row("notes", KEY_WORDS.notes, present(slide.notes), false, { keys: ["notes"] }));
  return rows;
}

function genericRows(target) {
  const { info, value } = target;
  const required = info.requiredChildren?.length ? info.requiredChildren : info.children.filter((child) => child.required).map((child) => child.key);
  const byKey = new Map(info.children.map((child) => [child.key, child]));
  const keys = [...required.filter((key) => byKey.has(key)), ...info.children.filter((child) => !required.includes(child.key) && !child.advanced && !["extensions", "$schema"].includes(child.key)).map((child) => child.key)].slice(0, MAX_ROWS);
  return keys.map((key) => row(key, KEY_WORDS[key] && target.path[0] === "slides" && target.path.length === 2 ? KEY_WORDS[key] : clip(byKey.get(key)?.description) || KEY_WORDS[key] || "", present(value[key]), required.includes(key), { keys: [key] }));
}

function blockRows(target) {
  const { value } = target;
  const keys = Object.keys(KIND_OF_KEY).filter((key) => present(value[key]));
  const kind = typeof value.type === "string" ? value.type : keys.length ? KIND_OF_KEY[keys[0]] : undefined;
  const payload = kind ? (kind === "group" ? "blocks" : KEY_OF_KIND[kind]) : undefined;
  const rows = [row("type", `Content kind: ${joinWords(Object.keys(KEY_OF_KIND))}`, present(value.type) || (!kind ? false : keys.length > 0), !payload || !present(value[payload]) ? !kind : false, { keys: ["type"] })];
  if (payload) rows.push(row(payload, payload === "blocks" ? "The blocks of the group" : (KEY_WORDS[payload] ?? payload), present(value[payload]), true, { keys: [payload] }));
  rows.push(row("id", KEY_WORDS.id, present(value.id), false, { keys: ["id"] }), row("region", KEY_WORDS.region, present(value.region), false, { keys: ["region"] }));
  return { rows, kind };
}

const SINGULAR = { references: "reference", speakers: "speaker", organizations: "organization", slides: "slide", blocks: "block", datasets: "dataset", assets: "asset" };
const nounOf = (path) => {
  const names = path.filter((segment) => !isIndex(segment));
  const last = String(names.at(-1) ?? "deck");
  return path.length && isIndex(path.at(-1)) ? (SINGULAR[last] ?? last.replace(/s$/, "")) : last;
};

/**
 * The shape of `target`: `{ kind, path, title, aside, rows, sentence, layout }` with `rows` `{ key, description, state }`. `catalogs` are the host's.
 */
function buildModel(draft, target, catalogs, format) {
  const { path, value } = target;
  const slideIndex = path.length === 2 && path[0] === "slides" && isIndex(path[1]) ? Number(path[1]) : -1;
  const blockIndex = path.length >= 2 && path.at(-2) === "blocks" && isIndex(path.at(-1)) ? Number(path.at(-1)) : -1;
  let kind = "object", title, aside = "", rows, layout, unknownLayout = false, blockKind;
  if (slideIndex >= 0) {
    kind = "slide";
    layout = typeof value.layout === "string" && value.layout ? value.layout : undefined;
    let record;
    if (layout) {
      try { record = listCatalogRecords(draft.deck, "layouts", { catalogs }).find((entry) => entry.id === layout)?.record; } catch { record = undefined; }
      unknownLayout = !record;
    }
    rows = record ? layoutRows(record, value) : genericRows(target);
    title = layout ? `slide · layout "${layout}"${unknownLayout ? " (not found)" : ""}` : "slide";
    const count = Array.isArray(draft.deck?.slides) ? draft.deck.slides.length : 0;
    aside = count ? `slide ${slideIndex + 1} of ${Math.max(count, slideIndex + 1)}` : "";
  } else if (blockIndex >= 0) {
    kind = "block";
    const made = blockRows(target);
    ({ rows } = made);
    blockKind = made.kind;
    title = blockKind ? `block · type "${blockKind}"` : "block";
    const siblings = draft.read(path.slice(0, -1));
    aside = Array.isArray(siblings) && siblings.length ? `block ${blockIndex + 1} of ${siblings.length}` : "";
  } else {
    rows = genericRows(target);
    title = nounOf(path);
    const required = rows.filter((entry) => entry.required).length;
    aside = required ? `${required} required` : "";
  }
  // `next` is the first required row that is not set yet.
  const next = rows.findIndex((entry) => entry.required && entry.state !== "set");
  if (next >= 0) rows[next].state = "next";
  const written = format === "md" && kind === "slide" ? SYNTAX_FIELDS : null;
  const shown = rows.slice(0, MAX_ROWS + 1).map((entry) => {
    const hint = written && entry.keys?.length === 1 && entry.description === KEY_WORDS[entry.keys[0]] ? written[entry.keys[0]]?.written : undefined;
    return { key: entry.key, description: hint ? `${entry.description} · ${hint}` : entry.description, state: entry.state };
  });
  const noun = title.split(" ")[0];
  const head = `${noun[0].toUpperCase()}${noun.slice(1)}${layout ? ` with layout ${layout}` : blockKind ? ` of type ${blockKind}` : ""}`;
  const sentence = `${head}: ${shown.map((entry) => `${entry.key} ${entry.state}`).join(", ")}`;
  return { kind, path, title, aside, rows: shown, sentence, layout, next: next >= 0 ? rows[next].key : undefined };
}

/**
 * The shape hint at `position` of a text of `format` ("json", "yaml" or "md"), or null where the schema has no shape (`extensions`, free text, no
 * object around the caret). `atMember` is true when the caret sits between the members of the object (where a key goes), not inside a value or list.
 */
export function shapeAt(format, text, position, { catalogs } = {}) {
  const draft = readDraft(format, text, position);
  if (!draft) return null;
  const target = targetFor(draft, draft.path, draft.firstIsObject);
  if (!target) return null;
  const model = buildModel(draft, target, catalogs, format);
  const atMember = draft.where === "text" && draft.path.length === target.path.length;
  return { ...model, rawPath: draft.path, atMember, where: draft.where };
}

/** The shape of the object at `anchor`, while the caret (at `position`) is still inside it; null once it left. `undefined` when the text does not say. */
function shapeWithin(format, text, position, anchor, { catalogs }) {
  const draft = readDraft(format, text, position);
  if (!draft) return undefined;
  const inside = draft.path.length >= anchor.length && anchor.every((step, index) => String(draft.path[index]) === String(step));
  if (!inside) return null;
  const value = draft.read(anchor);
  if (!isObject(value) && value !== undefined && value !== null) return null;
  let info;
  try { info = describeField(anchor, draft.deck); } catch { return null; }
  if (!info.known || !info.children?.length) return null;
  return { ...buildModel(draft, { path: anchor, value: isObject(value) ? value : {}, info }, catalogs, format), rawPath: draft.path };
}

// ---- the tooltip ---------------------------------------------------------------------------------------------------------------------------
const setHint = StateEffect.define();

const same = (a, b) => a && b && a.title === b.title && a.aside === b.aside && a.sentence === b.sentence && a.rows.length === b.rows.length
  && a.rows.every((entry, index) => entry.key === b.rows[index].key && entry.state === b.rows[index].state && entry.description === b.rows[index].description);

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The DOM of a model. */
function render(dom, model) {
  dom.replaceChildren();
  dom.setAttribute("aria-label", `Shape hint: ${model.title}`);
  const head = el("div", "opf-hint-head");
  head.append(el("span", "opf-hint-title", model.title));
  if (model.aside) head.append(el("span", "opf-hint-aside", model.aside));
  const list = el("ul", "opf-hint-rows");
  list.setAttribute("role", "list");
  for (const entry of model.rows) {
    const item = el("li", "opf-hint-row");
    item.dataset.state = entry.state;
    item.dataset.key = entry.key;
    item.append(el("span", "opf-hint-key", entry.key), el("span", "opf-hint-description", entry.description), el("span", "opf-hint-state", entry.state));
    list.append(item);
  }
  dom.append(head, list);
}

// CodeMirror keeps a tooltip's DOM while its `create` function is the same one and calls `update` on it, so the hint moves with the caret and is
// redrawn only when what it says changes.
function createHintView(view) {
  const dom = el("div", "opf-hint");
  dom.setAttribute("role", "tooltip");
  let drawn = null;
  const draw = (state) => {
    const value = state.field(hintField, false);
    if (value && value.model !== drawn) { drawn = value.model; render(dom, value.model); }
  };
  draw(view.state);
  return { dom, update: (update) => draw(update.state) };
}

/** The field: `{ model, anchor, config }` while a hint is open (`anchor` the path of its object, `config` `{ format, catalogs }`), null otherwise. */
const hintField = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setHint)) return effect.value;
    if (!value || (!tr.docChanged && !tr.selection)) return value;
    const { state } = tr;
    const found = shapeWithin(value.config.format, state.doc.toString(), state.selection.main.head, value.anchor, value.config);
    // The text does not say where the caret is (a half-typed line): the hint stays as it was.
    if (found === undefined) return value;
    if (found === null) return null;
    return same(found, value.model) ? value : { ...value, model: found };
  },
  // Anchored to the start of the caret's line: it follows the caret from line to line and does not jitter along a line.
  provide: (field) => showTooltip.compute([field, "selection"], (state) => (state.field(field) ? { pos: state.doc.lineAt(state.selection.main.head).from, above: true, strictSide: false, arrow: false, create: createHintView } : null)),
});

const keys = Prec.highest(keymap.of([{
  key: "Escape",
  run: (view) => {
    if (!view.state.field(hintField, false)) return false;
    view.dispatch({ effects: setHint.of(null) });
    return true;
  },
}]));

// Leaving the editor closes the hint, as it does in VS Code.
const closeOnBlur = EditorView.domEventHandlers({
  blur(_event, view) {
    if (view.state.field(hintField, false)) view.dispatch({ effects: setHint.of(null) });
  },
});

/** Adds the hint's field, its Escape key and the close on blur to the editor the first time. */
function install(view) {
  if (view.state.field(hintField, false) === undefined) view.dispatch({ effects: StateEffect.appendConfig.of([hintField, keys, closeOnBlur]) });
}

/** Open (or move) the hint on `model`; says it in the live region when it is new or changed. */
function open(view, context, model, anchor) {
  const before = view.state.field(hintField, false);
  view.dispatch({ effects: setHint.of({ model, anchor, config: { format: context.format, catalogs: context.catalogs } }) });
  if (!before || before.model.sentence !== model.sentence) context.say(model.sentence);
}

/** Cmd/Ctrl+Shift+Space: show the shape of the object around the caret, or say there is none. */
export function showShapeHint(view, context) {
  install(view);
  const found = shapeAt(context.format, view.state.doc.toString(), view.state.selection.main.head, { catalogs: context.catalogs });
  if (!found) {
    if (view.state.field(hintField, false)) view.dispatch({ effects: setHint.of(null) });
    context.say("No shape hint here");
    return true;
  }
  open(view, context, found, found.path);
  return true;
}

/**
 * After a `{` or a `,` was typed: shows the hint when the caret sits between the members of a slide that has a layout (an open hint keeps itself up
 * to date). Returns whether it opened one.
 */
export function autoShapeHint(view, context, typed) {
  if (typed !== "{" && typed !== ",") return false;
  const { state } = view;
  const head = state.selection.main.head;
  if (state.selection.ranges.length !== 1 || !state.selection.main.empty || state.sliceDoc(head - 1, head) !== typed) return false;
  if (state.field(hintField, false)) return false;
  const found = shapeAt(context.format, state.doc.toString(), head, { catalogs: context.catalogs });
  if (!found || found.kind !== "slide" || !found.layout || !found.atMember) return false;
  install(view);
  open(view, context, found, found.path);
  return true;
}
