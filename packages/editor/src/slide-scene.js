// CE-19: the slide scene model. One slide of a deck as the studio kit sees it: a tree of nodes (the slide, its headings, the regions of
// its layout or its promoted regions, groups, blocks, the parts of a block, and implicit content written on the slide itself), each with
// a stable key, its JSON Pointer, a box in slide units (0 to 1) read from the composed layout geometry, and, for a container, the tracks
// its children sit on. It is pure: the caller hands it the document and the `SlideComposition` of the slide (the canvas's render, or core
// composition), and nothing here edits or renders. Slides stay auto-layout (decision D2): no node has a free position, and a drop
// resolves to a container and an index, never to coordinates. The edits are in `slide-edits.js`; `slide-adapter.js` puts both behind
// the kit's document adapter over an editor session.
//
// Keys. A node's key is its id path: the JSON Pointer with every array index whose element has a unique `id` written as `@id`
// (`/slides/@intro/blocks/@kpi`), so it names the same node after edits by others; an element without an id keeps its index. A layout
// region has no place in the document (it is virtual: the blocks bound to it live in the slide's `blocks`) and is keyed `<slide key>#<name>`.
import { CONTENT_KIND_LABELS, readContent } from "@openpresentation/opf/convert";
import { formatPointer, parsePointer } from "@openpresentation/opf/patch";
import { boxesAt } from "./studio-kit/overlay.js";
import { clickTarget } from "./studio-kit/selection.js";

/** The content fields a slide, a promoted region or a block can hold, in the order implicit content becomes blocks. */
export const CONTENT_FIELDS = Object.freeze(["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"]);
const HEADINGS = ["tag", "title", "subtitle"];
const HEADING_LABELS = { tag: "Tag", title: "Title", subtitle: "Subtitle" };
const MODE_LABELS = { auto: "Group", grid: "Grid", row: "Row", column: "Column" };
const REGION_KEY = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/;
const NONE = Object.freeze({ move: false, group: false, delete: false, duplicate: false, resizeTracks: false });
const CONTAINERS = new Set(["slide", "region", "group"]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** Whether `key` names a promoted region of a slide (`left`, `center+right`, `top:left`, ...). */
export const isPromotedRegion = (key) => REGION_KEY.test(key);
/** The content fields `owner` holds itself, in conversion order. */
export const contentFieldsOf = (owner) => (isObject(owner) ? CONTENT_FIELDS.filter((key) => Object.hasOwn(owner, key)) : []);

/** The pointer token of `array[at]`: `@id` when that element has a unique, non-empty string id, else the index. */
function tokenOf(array, at) {
  const id = array[at]?.id;
  if (typeof id !== "string" || id === "") return String(at);
  return array.filter((item) => isObject(item) && item.id === id).length === 1 ? `@${id}` : String(at);
}

const unitBox = (box, width, height) => (box ? { x: box.x / width, y: box.y / height, w: box.width / width, h: box.height / height } : undefined);
function union(boxes) {
  const list = boxes.filter((box) => box && box.w >= 0 && box.h >= 0);
  if (!list.length) return undefined;
  const x = Math.min(...list.map((box) => box.x)), y = Math.min(...list.map((box) => box.y));
  return { x, y, w: Math.max(...list.map((box) => box.x + box.w)) - x, h: Math.max(...list.map((box) => box.y + box.h)) - y };
}
const prefixOf = (prefix, tokens) => prefix.length <= tokens.length && prefix.every((token, at) => token === tokens[at]);

// --- labels ----------------------------------------------------------------------------------------------------------------------

function plain(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => plain(entry, depth + 1)).join("");
  if (isObject(value)) return plain(value.text ?? value.value ?? value.label ?? "", depth + 1);
  return "";
}
const snippet = (text) => {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 32 ? `${clean.slice(0, 32).trimEnd()}…` : clean;
};
function contentSnippet(kind, content) {
  switch (kind) {
    case "text": return plain(content);
    case "list": return Array.isArray(content) && content.length ? plain(isObject(content[0]) ? content[0].text : content[0]) : "";
    case "chart": return isObject(content) ? plain(content.title) || (Array.isArray(content.data?.columns) ? content.data.columns.slice(1).map((column) => plain(column)).join(", ") : "") : "";
    case "table": return isObject(content) && Array.isArray(content.columns) ? content.columns.map((column) => plain(isObject(column) ? column.label ?? column.text ?? column.name : column)).join(", ") : "";
    case "metric": return isObject(content) ? plain(content.label) || plain(content.value) : plain(content);
    case "quote": return isObject(content) ? plain(content.text) : plain(content);
    case "code": return isObject(content) ? plain(content.filename) || plain(content.language) || plain(String(content.source ?? "").split("\n")[0]) : "";
    case "timeline": return Array.isArray(content) && content.length ? plain(content[0]?.what ?? content[0]?.when) : "";
    case "image":
    case "video": return isObject(content) ? plain(content.alt ?? content.caption) : "";
    default: return "";
  }
}
/** What the layers and the screen reader say for a block: "Text: Start with a clear…", "Row · 3". */
export function describeBlock(block) {
  if (isObject(block) && Array.isArray(block.blocks)) return `${MODE_LABELS[block.composition?.mode ?? "auto"] ?? "Group"} · ${block.blocks.length}`;
  const info = readContent(block);
  if (!info) return "Block";
  const label = CONTENT_KIND_LABELS[info.kind] ?? info.kind;
  const text = snippet(contentSnippet(info.kind, info.content));
  return text ? `${label}: ${text}` : label;
}
const kindOfField = (field) => (field === "items" || field === "bullets" ? "list" : field);

// --- containers --------------------------------------------------------------------------------------------------------------------

/** The container of a composed flow in slide units: its direction, tracks with their weights, gap and padding, and whether a divider drag can resize it. */
function flowContainer(flow, width, height) {
  const composition = flow.composition ?? {};
  const mode = composition.mode ?? "auto";
  const direction = mode === "column" ? "column" : "row";
  const list = direction === "column" ? flow.rows : flow.columns;
  const origin = direction === "column" ? flow.box.y : flow.box.x, extent = direction === "column" ? height : width;
  const weights = Array.isArray(composition.weights) ? composition.weights : [];
  const tracks = (list ?? []).map((track, index) => ({ start: (origin + track.offset) / extent, length: track.size / extent, weight: weights[index] ?? 1 }));
  return {
    mode, direction, columns: flow.columns?.length ?? 1, rows: flow.rows?.length ?? 1, tracks,
    gap: (flow.gap ?? 0) / extent, padding: composition.padding ?? 0,
    resizable: tracks.length >= 2 && tracks.length <= 12 && flow.itemCount === flow.slotCount,
    flowPath: flow.path,
  };
}
/** A container without a composed flow (a layout region, a slide of implicit content): its tracks are its children's boxes. */
function childContainer(mode, direction, children) {
  const boxes = children.map((child) => child.box).filter(Boolean);
  const along = direction === "column" ? (box) => ({ start: box.y, length: box.h }) : (box) => ({ start: box.x, length: box.w });
  return { mode, direction, columns: direction === "row" ? boxes.length : 1, rows: direction === "column" ? boxes.length : 1, tracks: boxes.map((box) => ({ ...along(box), weight: 1 })), gap: 0, padding: 0, resizable: false };
}

// --- the scene ---------------------------------------------------------------------------------------------------------------------

/**
 * The scene of slide `slideIndex` of `presentation`. `geometry` is the slide's `SlideComposition` (required: the boxes come from it);
 * `findings` are `{ path, message, severity?, code? }` entries (the session's validation findings) shown on the deepest node whose path
 * holds theirs, together with the composition's own diagnostics; `parts: false` leaves the parts of blocks out.
 */
export function slideScene(presentation, slideIndex, { geometry, findings = [], parts = true } = {}) {
  const slides = presentation?.slides;
  const slide = Array.isArray(slides) ? slides[slideIndex] : undefined;
  if (!isObject(slide)) throw new RangeError(`Slide ${slideIndex} does not exist.`);
  if (!geometry || !Number.isFinite(geometry.width) || !Number.isFinite(geometry.height)) throw new TypeError("slideScene needs the slide's composed geometry.");
  const width = geometry.width, height = geometry.height;
  const unit = (box) => unitBox(box, width, height);
  const items = new Map(), groups = new Map(), flows = new Map();
  for (const item of geometry.items ?? []) { const list = items.get(item.path) ?? []; list.push(item); items.set(item.path, list); }
  for (const group of geometry.groups ?? []) groups.set(group.path, group);
  for (const flow of geometry.flows ?? []) flows.set(flow.path, flow);
  const itemBox = (dotted) => union((items.get(dotted) ?? []).flatMap((item) => [unit(item.frameBox ?? item.box), item.caption?.box ? unit(item.caption.box) : undefined]));

  const nodes = [], byKey = new Map(), byPath = new Map();
  const slideTokens = ["slides", tokenOf(slides, slideIndex)], slidePath = ["slides", String(slideIndex)];
  const add = (node) => {
    nodes.push(node);
    byKey.set(node.key, node);
    if (!node.virtual) byPath.set(node.path, node);
    const parent = node.parent === null ? null : byKey.get(node.parent);
    if (parent) { node.index = parent.children.length; parent.children.push(node.key); }
    return node;
  };
  const base = (fields) => ({ children: [], findings: [], can: NONE, ...fields });

  const slideNode = add(base({
    key: formatPointer(slideTokens), path: formatPointer(slidePath), kind: "slide", type: "slide", parent: null, index: slideIndex, depth: 0,
    label: `Slide ${slideIndex + 1}${typeof slide.layout === "string" && slide.layout !== "auto" ? ` · ${slide.layout}` : ""}`,
    box: { x: 0, y: 0, w: 1, h: 1 }, hidden: slide.hidden === true,
  }));

  for (const field of HEADINGS) {
    if (slide[field] === undefined) continue;
    const box = itemBox(`slides.${slideIndex}.${field}`) ?? unit(geometry.headingAreas?.find((area) => area.name === field)?.box);
    add(base({ key: formatPointer([...slideTokens, field]), path: formatPointer([...slidePath, field]), kind: "heading", type: field, parent: slideNode.key, depth: 1, label: HEADING_LABELS[field], box }));
  }

  // Parts: the pieces of a block that composition places on their own (list items, metric value and label, quote body and footer,
  // timeline events, code body). Only a Cmd-click (deep select) reaches them; nothing structural applies to them.
  function addParts(owner, dotted) {
    if (!parts) return;
    const ownerTokens = parsePointer(owner.path), ownerKeyTokens = parsePointer(owner.key), at = ownerTokens.length;
    const found = new Map();
    const note = (path, box, label) => {
      if (typeof path !== "string" || !path.startsWith(`${dotted}.`) || !box || !(box.width > 0) || !(box.height > 0)) return;
      const entry = found.get(path) ?? { boxes: [], label };
      entry.boxes.push(unit(box));
      found.set(path, entry);
    };
    for (const item of items.get(dotted) ?? []) {
      for (const entry of item.text?.listEntries ?? []) {
        const label = snippet(plain(entry.value));
        note(`${item.path}.${entry.index}`, entry.textBox, `Item ${entry.index + 1}${label ? `: ${label}` : ""}`);
        if (entry.descriptionBox) note(`${item.path}.${entry.index}`, entry.descriptionBox);
      }
      for (const layout of [item.metricLayout, item.quoteLayout, item.timelineLayout, item.codeLayout]) {
        for (const part of layout?.parts ?? []) if (part.visible !== false && !part.generated) note(part.path, part.box, `${part.role.charAt(0).toUpperCase()}${part.role.slice(1).replace(/-/g, " ")}${part.text ? `: ${snippet(part.text)}` : ""}`);
      }
    }
    for (const [path, entry] of found) {
      const rest = path.split(".").slice(at);
      add(base({
        key: formatPointer([...ownerKeyTokens, ...rest]), path: formatPointer([...ownerTokens, ...rest]), kind: "part", type: owner.type, parent: owner.key,
        depth: owner.depth + 1, label: entry.label ?? "Part", box: union(entry.boxes),
      }));
    }
  }

  // A block of a `blocks` array: a group (with its own flow and children) or a leaf (with parts).
  function addBlock(block, pathTokens, keyTokens, parentKey, depth, blockIndex) {
    const dotted = pathTokens.join(".");
    const group = Array.isArray(block.blocks);
    const node = add(base({
      key: formatPointer(keyTokens), path: formatPointer(pathTokens), kind: group ? "group" : "block",
      type: group ? "group" : readContent(block)?.kind ?? kindOfField(contentFieldsOf(block)[0] ?? "block"),
      parent: parentKey, depth, blockIndex, label: describeBlock(block),
      box: group ? unit(groups.get(dotted)?.box) : itemBox(`${dotted}.${contentFieldsOf(block)[0]}`),
      can: { move: true, group: true, delete: true, duplicate: true, resizeTracks: false },
      ...(typeof block.region === "string" ? { pin: block.region } : {}),
    }));
    if (group) {
      block.blocks.forEach((child, at) => { if (isObject(child)) addBlock(child, [...pathTokens, "blocks", String(at)], [...keyTokens, "blocks", tokenOf(block.blocks, at)], node.key, depth + 1, at); });
      const flow = flows.get(dotted);
      node.box ??= union(node.children.map((key) => byKey.get(key).box));
      node.container = flow ? flowContainer(flow, width, height) : childContainer(block.composition?.mode ?? "auto", block.composition?.mode === "column" ? "column" : "row", node.children.map((key) => byKey.get(key)));
      node.can = { ...node.can, resizeTracks: node.container.resizable };
    } else addParts(node, `${dotted}.${contentFieldsOf(block)[0]}`);
    return node;
  }
  // Implicit content: a content field written on the slide or a promoted region instead of a block. A structural command converts it to
  // blocks first, in the same change, so it moves, groups, duplicates and deletes like a block.
  function addImplicit(owner, ownerTokens, ownerKeyTokens, field, parentKey, depth, fieldIndex) {
    const pathTokens = [...ownerTokens, field];
    const kind = kindOfField(field);
    const text = snippet(contentSnippet(kind, owner[field]));
    const node = add(base({
      key: formatPointer([...ownerKeyTokens, field]), path: formatPointer(pathTokens), kind: "implicit", type: kind, parent: parentKey, depth,
      field, blockIndex: fieldIndex, owner: formatPointer(ownerTokens),
      label: `${CONTENT_KIND_LABELS[kind] ?? kind} (slide)${text ? `: ${text}` : ""}`,
      box: itemBox(pathTokens.join(".")),
      can: { move: true, group: true, delete: true, duplicate: true, resizeTracks: false },
    }));
    addParts(node, pathTokens.join("."));
    return node;
  }
  // The content of an owner (the slide, a promoted region): its blocks, else its implicit fields.
  function addContent(owner, ownerTokens, ownerKeyTokens, parentKey, depth, only) {
    if (Array.isArray(owner.blocks)) {
      owner.blocks.forEach((block, at) => {
        if (!isObject(block) || (only && !only.has(`${ownerTokens.join(".")}.blocks.${at}`))) return;
        addBlock(block, [...ownerTokens, "blocks", String(at)], [...ownerKeyTokens, "blocks", tokenOf(owner.blocks, at)], parentKey, depth, at);
      });
    }
    contentFieldsOf(owner).forEach((field, at) => {
      if (only && !only.has(`${ownerTokens.join(".")}.${field}`)) return;
      addImplicit(owner, ownerTokens, ownerKeyTokens, field, parentKey, depth, at);
    });
  }

  const regions = Array.isArray(geometry.regions) ? geometry.regions : null;
  if (regions) {
    // A layout template: the regions are the slide's children, and each holds the root blocks or root content fields bound to it.
    const placed = new Set();
    for (const region of regions) {
      const node = add(base({
        key: `${slideNode.key}#${region.name}`, path: slideNode.path, kind: "region", type: "region", virtual: true, region: region.name, parent: slideNode.key, depth: 1,
        label: `Region ${region.name}`, box: unit(region.box), accepts: [...(region.accepts ?? [])], max: region.max, flow: region.flow, collapsed: region.collapsed === true,
      }));
      for (const dotted of [...(region.content ?? []), ...(region.overflow ?? [])]) {
        if (placed.has(dotted)) continue;
        placed.add(dotted);
        const tokens = dotted.split(".");
        if (tokens.length === 4 && tokens[2] === "blocks" && isObject(slide.blocks?.[Number(tokens[3])])) {
          const at = Number(tokens[3]);
          addBlock(slide.blocks[at], [...slidePath, "blocks", String(at)], [...slideTokens, "blocks", tokenOf(slide.blocks, at)], node.key, 2, at);
        } else if (tokens.length === 3 && CONTENT_FIELDS.includes(tokens[2]) && slide[tokens[2]] !== undefined) {
          addImplicit(slide, slidePath, slideTokens, tokens[2], node.key, 2, contentFieldsOf(slide).indexOf(tokens[2]));
        }
      }
      node.container = childContainer("region", region.arrangement === "row" || region.arrangement === "grid" ? "row" : "column", node.children.map((key) => byKey.get(key)));
    }
    // Content no region took (unbound, not even as overflow) stays a child of the slide.
    const rest = new Set([...(slide.blocks ?? []).map((_, at) => `slides.${slideIndex}.blocks.${at}`), ...contentFieldsOf(slide).map((field) => `slides.${slideIndex}.${field}`)].filter((dotted) => !placed.has(dotted)));
    if (rest.size) addContent(slide, slidePath, slideTokens, slideNode.key, 1, rest);
    slideNode.container = { mode: "layout", direction: "column", columns: 1, rows: regions.length, tracks: [], gap: 0, padding: 0, resizable: false, layout: true };
  } else {
    for (const key of Object.keys(slide)) {
      if (!isPromotedRegion(key) || !isObject(slide[key])) continue;
      const value = slide[key];
      const tokens = [...slidePath, key], keyTokens = [...slideTokens, key];
      const node = add(base({ key: formatPointer(keyTokens), path: formatPointer(tokens), kind: "region", type: "region", promoted: true, region: key, parent: slideNode.key, depth: 1, label: `Region ${key}` }));
      addContent(value, tokens, keyTokens, node.key, 2);
      const flow = flows.get(tokens.join("."));
      node.box = flow ? unit(flow.box) : union(node.children.map((child) => byKey.get(child).box));
      node.container = flow ? flowContainer(flow, width, height) : childContainer(value.composition?.mode ?? "auto", value.composition?.mode === "column" ? "column" : "row", node.children.map((child) => byKey.get(child)));
      node.can = { ...NONE, resizeTracks: node.container.resizable };
    }
    addContent(slide, slidePath, slideTokens, slideNode.key, 1);
    const flow = flows.get(slidePath.join("."));
    const body = slideNode.children.map((key) => byKey.get(key)).filter((child) => child.kind !== "heading");
    slideNode.container = flow ? flowContainer(flow, width, height) : childContainer(slide.composition?.mode ?? "auto", slide.composition?.mode === "column" ? "column" : "row", body);
    if (body.some((child) => child.promoted)) slideNode.container = { ...slideNode.container, promoted: true, resizable: false };
  }
  slideNode.can = { move: true, group: false, delete: true, duplicate: true, resizeTracks: slideNode.container.resizable };

  // Findings: each on the deepest real node whose path holds the finding's path.
  const toTokens = (path) => {
    if (typeof path !== "string") return null;
    try { return path.startsWith("/") ? parsePointer(path) : path.split(".").filter(Boolean); } catch { return null; }
  };
  for (const finding of [...findings, ...(geometry.diagnostics ?? [])]) {
    const tokens = toTokens(finding?.path);
    if (!tokens || !prefixOf(slidePath, tokens)) continue;
    let owner = slideNode;
    for (let length = tokens.length; length > 2; length -= 1) {
      const node = byPath.get(formatPointer(tokens.slice(0, length)));
      if (node) { owner = node; break; }
    }
    owner.findings.push({ message: finding.message, ...(finding.code ? { code: finding.code } : {}), ...(finding.severity ? { severity: finding.severity } : {}), path: finding.path });
  }

  const node = (key) => byKey.get(key);
  const content = (key) => (node(key)?.children ?? []).map(node).filter((child) => child.kind !== "heading" && child.kind !== "part");
  const boxed = nodes.filter((entry) => entry.box && entry.box.w > 0 && entry.box.h > 0).map((entry) => ({ ...entry.box, depth: entry.depth, key: entry.key, node: entry }));
  return {
    slideIndex, slideKey: slideNode.key, width, height, nodes, layout: Boolean(regions),
    /** The node with this key, or undefined. */
    node,
    /** The node at this index pointer (not a virtual region), or undefined. */
    nodeAtPath: (path) => byPath.get(path),
    /** The children of a node, in order (headings first on a slide). */
    children: (key) => (node(key)?.children ?? []).map(node),
    /** The children that content can be dropped between: no headings, no parts. */
    contentChildren: content,
    boxOf: (key) => { const found = node(key); return found?.box ? { ...found.box, depth: found.depth } : undefined; },
    containerOf: (key) => node(key)?.container,
    /** The composed flow of a container node, for track resize. */
    flowOf: (key) => { const path = node(key)?.container?.flowPath; return path ? flows.get(path) : undefined; },
    /** The nodes under a unit point, outermost first (`parts: true` adds the parts of blocks; `skip(hit)` leaves hits out). */
    hitChain(point, { parts: withParts = false, skip } = {}) {
      return boxesAt(boxed, point, { skip: (hit) => (!withParts && hit.node.kind === "part") || Boolean(skip?.(hit)) });
    },
    /**
     * The node a click on `chain` selects: the deepest node, or one level into the selected container (`primary`); `deep` (Cmd or Ctrl)
     * selects the deepest including parts (pass a chain made with `parts: true`).
     */
    target(chain, { primary = null, shift = false, deep = false } = {}) {
      if (!chain.length) return null;
      if (deep) return chain[chain.length - 1];
      const plainChain = chain.filter((hit) => hit.node.kind !== "part");
      return clickTarget(plainChain, primary, { shift, keyOf: (hit) => hit.key, isContainer: (hit) => CONTAINERS.has(hit.node.kind) });
    },
    /** The nearest node at or above `key` that still exists, for a selection after an edit (`null` for none). */
    survivor(key) {
      for (let at = key; at; ) {
        if (byKey.has(at)) return at;
        const hash = at.lastIndexOf("#");
        if (hash > 0) { at = at.slice(0, hash); continue; }
        const tokens = parsePointer(at);
        if (tokens.length <= 2) return null;
        tokens.pop();
        if (tokens.at(-1) === "blocks") tokens.pop();
        at = formatPointer(tokens);
      }
      return null;
    },
  };
}

/**
 * Where content dragged at `point` (slide units) would land: the container key and the index in its content children, the drop line in
 * slide units, and `into` (the group or region being dropped into, for its highlight). `keys` are the dragged nodes, which never take
 * part in the hit test. Headings and parts are never targets. `edge` is the band, as a share of a group's size along its parent's
 * direction, that drops before or after the group instead of into it. Returns null outside the slide.
 */
export function dropTarget(scene, point, keys = [], { edge = 0.2 } = {}) {
  const dragged = new Set(keys);
  const insideDragged = (key) => { for (let at = scene.node(key); at; at = scene.node(at.parent)) if (dragged.has(at.key)) return true; return false; };
  const chain = scene.hitChain(point, { skip: (hit) => hit.node.kind === "heading" || insideDragged(hit.key) });
  let hit = chain[chain.length - 1]?.node;
  if (!hit) return null;
  let target, index;
  if (hit.kind === "group" && hit.parent) {
    // Near a group's leading or trailing edge, the drop goes beside it; over its body, into it.
    const parent = scene.node(hit.parent);
    const row = parent.container?.direction !== "column";
    const along = row ? (point.x - hit.box.x) / hit.box.w : (point.y - hit.box.y) / hit.box.h;
    if (along < edge || along > 1 - edge) { target = parent; index = indexAmong(scene, parent, hit, along > 0.5); }
  }
  if (!target) {
    if (CONTAINERS.has(hit.kind)) { target = hit; index = insertionIndex(scene, hit, point, dragged); }
    else {
      target = scene.node(hit.parent);
      const row = target.container?.direction !== "column";
      const after = row ? point.x > hit.box.x + hit.box.w / 2 : point.y > hit.box.y + hit.box.h / 2;
      index = indexAmong(scene, target, hit, after);
    }
  }
  return { target: target.key, index, into: target.kind === "group" || target.kind === "region" ? target.key : null, line: dropLine(scene, target, index, dragged) };
}
// The index in the content children of `container` (dragged nodes included, as a move counts them before removal) of the gap beside `hit`.
function indexAmong(scene, container, hit, after) {
  const list = scene.contentChildren(container.key);
  const at = list.findIndex((child) => child.key === hit.key);
  return at < 0 ? list.length : at + (after ? 1 : 0);
}
// The gap a point over a container's body falls in: before the first child that comes after the point in reading order.
function insertionIndex(scene, container, point, dragged) {
  const list = scene.contentChildren(container.key);
  const column = container.container?.direction === "column";
  for (let at = 0; at < list.length; at += 1) {
    const box = list[at].box;
    if (!box || dragged.has(list[at].key)) continue;
    if (column ? point.y < box.y + box.h / 2 : point.y < box.y || (point.y <= box.y + box.h && point.x < box.x + box.w / 2)) return at;
  }
  return list.length;
}
// The drop line: at the leading edge of the child that will follow the drop, else after the last child, else along the container's start.
function dropLine(scene, container, index, dragged) {
  const list = scene.contentChildren(container.key).filter((child) => child.box);
  const column = container.container?.direction === "column";
  const next = list.slice(index).find((child) => !dragged.has(child.key)) ?? (index < list.length ? list[index] : undefined);
  const previous = list.slice(0, index).reverse().find((child) => !dragged.has(child.key));
  const half = (container.container?.gap ?? 0) / 2;
  if (column) {
    const ref = next ?? previous ?? null;
    const box = ref?.box ?? container.box;
    const y = next ? next.box.y - half : previous ? previous.box.y + previous.box.h + half : container.box.y;
    return { x: box.x, y, w: box.w, h: 0, orientation: "horizontal" };
  }
  const ref = next ?? previous ?? null;
  const box = ref?.box ?? container.box;
  const x = next ? next.box.x - half : previous ? previous.box.x + previous.box.w + half : container.box.x;
  return { x, y: box.y, w: 0, h: box.h, orientation: "vertical" };
}
