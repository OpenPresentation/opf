// Shared pieces of the layout editor's parts (RR-99): the studio kit's DOM helpers with the "opf-lx" class prefix, the layout commands and
// the keyboard shortcuts every part honors (one command registry, CE-18), the context menu items, and the region wireframe. Plain DOM; no
// network. The icons, `openMenu` and the typing-target guard live in the studio kit (src/studio-kit/dom.js) and are re-exported here.
import { createDom as createKitDom, isMac, isTypingTarget, nextId, openMenu, pct } from "./studio-kit/dom.js";
import { createCommandRegistry } from "./studio-kit/commands.js";

export { isMac, isTypingTarget, nextId, openMenu, pct };
export { isHandled, markHandled } from "./studio-kit/commands.js";

/** The class prefix of every layout editor part. */
export const LAYOUT_PREFIX = "opf-lx";
/** The studio kit's DOM helpers bound to one document, with the layout editor's class prefix. */
export const createDom = (doc) => createKitDom(doc, { prefix: LAYOUT_PREFIX });

/** The Lucide icon for a content kind, shown in the wireframe and on the chips. */
export const KIND_ICONS = { text: "AlignLeft", list: "List", image: "Image", video: "Play", chart: "ChartColumn", table: "Table", code: "Code", metric: "Hash", quote: "Quote", timeline: "GitCommitHorizontal", group: "Group" };

/** `[` and `]` by character or by physical key, so a layout where they need AltGr still has the shortcut elsewhere. */
export const bracket = (event) => (event.key === "[" || event.code === "BracketLeft" ? -1 : event.key === "]" || event.code === "BracketRight" ? 1 : 0);

export const TOOL_KEYS = Object.freeze({ v: "select", r: "split-row", c: "split-column", i: "insert", t: "heading", h: "hand" });
const TOOL_LABELS = { select: "Select", "split-row": "Split into a row", "split-column": "Split into a column", insert: "Insert region", heading: "Heading regions", hand: "Hand" };

// The commands of the layout editor. The "global" scope is honored by every part (undo and redo, the tool letters, Preview); the "selection"
// scope by the canvas and the layers when something is selected. A command's ctx is `{ model, surface, paths }`.
const one = ({ paths }) => paths.length === 1;
const some = ({ paths }) => paths.length > 0;
const last = (paths) => paths[paths.length - 1];
const singleNode = ({ model, paths }) => (paths.length === 1 ? model.nodeAt(paths[0]) : null);
const isSplitNode = (node) => Boolean(node) && node.name === undefined;

/** The layout editor's command registry (the same commands for the keyboard, the context menu and `layoutCommands.list()`). */
export const layoutCommands = createCommandRegistry({
  commands: [
    { id: "layout.undo", label: "Undo", group: "Edit", keys: ["Mod-z"], run: ({ model }) => model.undo() },
    { id: "layout.redo", label: "Redo", group: "Edit", keys: ["Shift-Mod-z", "Ctrl-y", "Shift-Ctrl-y"], run: ({ model }) => model.redo() },
    ...Object.entries(TOOL_KEYS).map(([key, tool]) => ({ id: `layout.tool.${tool}`, label: TOOL_LABELS[tool], group: "Tools", keys: [key], repeat: false, run: ({ model }) => model.setTool(tool) })),
    { id: "layout.preview", label: "Preview", group: "View", keys: ["p"], repeat: false, run: ({ model }) => model.setPreview(!model.preview) },
    { id: "layout.move.earlier", label: "Move earlier", group: "Structure", scope: "selection", keys: ["["], when: some, run: ({ model, paths }) => model.reorder(last(paths), -1) },
    { id: "layout.move.later", label: "Move later", group: "Structure", scope: "selection", keys: ["]"], when: some, run: ({ model, paths }) => model.reorder(last(paths), 1) },
    { id: "layout.move.intoPrevious", label: "Move into the previous split", group: "Structure", scope: "selection", keys: ["Shift-["], when: some, run: ({ model, paths }) => model.moveInto(last(paths), -1) },
    { id: "layout.move.intoNext", label: "Move into the next split", group: "Structure", scope: "selection", keys: ["Shift-]"], when: some, run: ({ model, paths }) => model.moveInto(last(paths), 1) },
    { id: "layout.wrap.row", label: "Wrap in row", group: "Structure", scope: "selection", when: some, run: ({ model, paths }) => model.wrap(paths, "row") },
    { id: "layout.wrap.column", label: "Wrap in column", group: "Structure", scope: "selection", when: some, run: ({ model, paths }) => model.wrap(paths, "column") },
    { id: "layout.unwrap", label: "Unwrap", group: "Structure", scope: "selection", when: (ctx) => isSplitNode(singleNode(ctx)), run: ({ model, paths }) => model.unwrap(paths[0]) },
    { id: "layout.duplicate", label: "Duplicate", group: "Edit", scope: "selection", keys: ["Mod-d"], when: some, run: ({ model, paths }) => model.duplicate(paths) },
    { id: "layout.delete", label: "Delete", group: "Edit", scope: "selection", keys: ["Delete", "Backspace", "Shift-Delete", "Shift-Backspace"], hint: "⌫", when: some, run: ({ model, paths }) => model.remove(paths) },
    { id: "layout.rename", label: "Rename", group: "Edit", scope: "selection", keys: ["F2"], when: (ctx) => one(ctx) && Boolean(singleNode(ctx)) && !isSplitNode(singleNode(ctx)), run: ({ model, paths, surface }) => model.requestRename(paths[0], surface) },
  ],
});
const NODE_MENU = ["layout.wrap.row", "layout.wrap.column", "layout.unwrap", "layout.duplicate", "layout.delete", "layout.rename"];

/**
 * The shortcuts every part honors: undo and redo, the tool letters, and Preview. Returns true when the event was handled. Not while the person
 * types in a field (the browser's own undo applies there).
 */
export function handleGlobalShortcut(event, model) {
  return layoutCommands.handle(event, { model, surface: null, paths: model.selection }, { scope: "global" });
}

/**
 * The shortcuts for a selection (the canvas and the layers): reorder with `[` and `]`, duplicate, delete, rename. Returns true when handled.
 * `Shift` with a bracket moves the node into the neighboring split.
 */
export function handleSelectionShortcut(event, model, surface = "canvas") {
  return layoutCommands.handle(event, { model, surface, paths: model.selection }, { scope: "selection" });
}

/** The items of the context menu for the selection `paths` (wrap in row or column, unwrap, duplicate, delete, rename). */
export function nodeMenuItems(model, paths, surface, win) {
  return layoutCommands.menu(NODE_MENU, { model, surface, paths }, { win });
}

/** A small wireframe of the kinds a region accepts: up to three blocks, one glyph and a word each (or every kind: text, list, image). */
export function buildWireframe(dom, accepts, { count = 3, flow = "auto" } = {}) {
  const kinds = Array.isArray(accepts) && accepts.length ? accepts : ["text", "list", "image"];
  const wire = dom.el("div", "opf-lx-wire", { "aria-hidden": "true", "data-flow": flow });
  const shown = Math.max(1, Math.min(count, kinds.length > 1 ? Math.min(3, kinds.length) : flow === "none" ? 1 : 2));
  for (let index = 0; index < shown; index++) {
    const kind = kinds[index % kinds.length];
    const block = dom.el("span", "opf-lx-wire-block", { "data-kind": kind });
    block.append(dom.icon(KIND_ICONS[kind] ?? "Square", 14), dom.el("span", "opf-lx-wire-name", { text: kind }));
    wire.append(block);
  }
  return wire;
}

export const SIZE_LABEL = (entry, direction) => {
  const size = entry.size;
  if (size === "auto") return "auto";
  if (size === undefined) return entry.name === "title" || entry.name === "subtitle" ? (direction === "column" ? "auto" : "1") : "1";
  return String(size);
};
