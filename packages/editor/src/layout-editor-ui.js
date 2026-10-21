// Shared pieces of the layout editor's parts (RR-99): DOM helpers, the inline icons (Lucide, ISC license), the menu used by the context
// menu and the heading tool, and the keyboard shortcuts every part honors. Plain DOM; no network.

// Lucide icons (ISC license), as path data.
const ICONS = {
  MousePointer2: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  Columns2: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
  Rows2: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/>',
  Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  Heading: '<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>',
  Hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  Eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  Undo2: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  Redo2: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  CircleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  Info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  Trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  GripVertical: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  ZoomIn: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
  ZoomOut: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
  Maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  Square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  Layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  Pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  Unfold: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  BetweenHorizontalStart: '<rect width="13" height="7" x="8" y="3" rx="1"/><path d="m2 9 3 3-3 3"/><rect width="13" height="7" x="8" y="14" rx="1"/>',
  AlignLeft: '<path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 6H3"/>',
  List: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  Image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  Play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  ChartColumn: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  Table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  Code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  Hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  Quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  GitCommitHorizontal: '<circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/>',
  Group: '<path d="M3 7V5c0-1.1.9-2 2-2h2"/><path d="M17 3h2c1.1 0 2 .9 2 2v2"/><path d="M21 17v2c0 1.1-.9 2-2 2h-2"/><path d="M7 21H5c-1.1 0-2-.9-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/>',
};
/** The Lucide icon for a content kind, shown in the wireframe and on the chips. */
export const KIND_ICONS = { text: "AlignLeft", list: "List", image: "Image", video: "Play", chart: "ChartColumn", table: "Table", code: "Code", metric: "Hash", quote: "Quote", timeline: "GitCommitHorizontal", group: "Group" };

const SVG = "http://www.w3.org/2000/svg";
let serial = 0;
export const nextId = (prefix) => `${prefix}-${++serial}`;

/** DOM helpers bound to one document. */
export function createDom(doc) {
  const el = (tag, className, attributes = {}) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "text") node.textContent = value; else node.setAttribute(key, value === true ? "" : String(value));
    }
    return node;
  };
  const icon = (name, size = 16) => {
    const svg = doc.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", `opf-lx-icon opf-lx-icon-${name.toLowerCase()}`);
    svg.innerHTML = ICONS[name] ?? "";
    return svg;
  };
  /** A real button; with `label` and an icon only, the label is its accessible name. */
  const button = (className, { label, text, iconName, size = 16, pressed, title, attributes = {} } = {}) => {
    const node = el("button", className, { type: "button", "aria-label": label, title: title ?? (text ? undefined : label), ...attributes });
    if (pressed !== undefined) node.setAttribute("aria-pressed", String(pressed));
    if (iconName) node.append(icon(iconName, size));
    if (text) node.append(el("span", "opf-lx-button-text", { text }));
    return node;
  };
  return { doc, el, icon, button };
}

/** Whether keyboard events from this element belong to a field the person is typing in. */
export function isTypingTarget(target) {
  if (!target || target.nodeType !== 1) return false;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "reset"].includes(target.type);
  return target.isContentEditable === true;
}
export const isMac = (win) => /Mac|iPhone|iPad/.test(win?.navigator?.platform ?? "");
const modifier = (event) => event.metaKey || event.ctrlKey;
/** `[` and `]` by character or by physical key, so a layout where they need AltGr still has the shortcut elsewhere. */
export const bracket = (event) => (event.key === "[" || event.code === "BracketLeft" ? -1 : event.key === "]" || event.code === "BracketRight" ? 1 : 0);

export const TOOL_KEYS = Object.freeze({ v: "select", r: "split-row", c: "split-column", i: "insert", t: "heading", h: "hand" });

/**
 * The shortcuts every part honors: undo and redo, the tool letters, and Preview. Returns true when the event was handled. Not while the person
 * types in a field (the browser's own undo applies there).
 */
export function handleGlobalShortcut(event, model) {
  if (event.opfLayoutHandled || event.defaultPrevented || isTypingTarget(event.target) || event.isComposing) return false;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (modifier(event) && !event.altKey) {
    if (key === "z") { event.preventDefault(); (event.shiftKey ? model.redo() : model.undo()); event.opfLayoutHandled = true; return true; }
    if (key === "y" && event.ctrlKey) { event.preventDefault(); model.redo(); event.opfLayoutHandled = true; return true; }
    return false;
  }
  if (event.altKey || event.shiftKey) return false;
  if (TOOL_KEYS[key] && !event.repeat) { event.preventDefault(); model.setTool(TOOL_KEYS[key]); event.opfLayoutHandled = true; return true; }
  if (key === "p" && !event.repeat) { event.preventDefault(); model.setPreview(!model.preview); event.opfLayoutHandled = true; return true; }
  return false;
}

/**
 * The shortcuts for a selection (the canvas and the layers): reorder with `[` and `]`, duplicate, delete, rename. Returns true when handled.
 * `Shift` with a bracket moves the node into the neighboring split.
 */
export function handleSelectionShortcut(event, model, surface = "canvas") {
  if (event.opfLayoutHandled || event.defaultPrevented || isTypingTarget(event.target) || event.isComposing) return false;
  const paths = model.selection;
  if (!paths.length) return false;
  const done = () => { event.preventDefault(); event.opfLayoutHandled = true; return true; };
  const delta = bracket(event);
  if (delta && !modifier(event) && !event.altKey) {
    if (event.shiftKey) model.moveInto(paths[paths.length - 1], delta); else model.reorder(paths[paths.length - 1], delta);
    return done();
  }
  if (modifier(event) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "d") { model.duplicate(paths); return done(); }
  if (!modifier(event) && !event.altKey && (event.key === "Delete" || event.key === "Backspace")) { model.remove(paths); return done(); }
  if (!modifier(event) && !event.altKey && !event.shiftKey && event.key === "F2" && paths.length === 1) { model.requestRename(paths[0], surface); return done(); }
  return false;
}

/**
 * A menu (`role="menu"`) at a point, inside `host` (a positioned element). Items are `{ label, onSelect, disabled, role, checked, hint }`.
 * Arrow keys, Home, End, Enter and Space work; Escape closes and returns focus to `returnFocus`. Returns `{ element, close }`.
 */
export function openMenu(dom, host, { x, y, items, label, returnFocus, onClose, className = "" }) {
  const menu = dom.el("div", `opf-lx-menu ${className}`.trim(), { role: "menu", "aria-label": label });
  const buttons = items.map((item) => {
    const role = item.role ?? "menuitem";
    const node = dom.el("button", "opf-lx-menuitem", { type: "button", role, tabindex: "-1", "aria-disabled": item.disabled ? "true" : undefined, "aria-checked": role === "menuitemcheckbox" ? String(Boolean(item.checked)) : undefined });
    node.append(dom.el("span", "opf-lx-menu-label", { text: item.label }));
    if (item.hint) node.append(dom.el("span", "opf-lx-menu-hint", { text: item.hint }));
    if (role === "menuitemcheckbox") node.prepend(dom.icon(item.checked ? "Check" : "Square", 14));
    node.addEventListener("click", () => {
      if (item.disabled) return;
      close();
      item.onSelect?.();
    });
    return node;
  });
  menu.append(...buttons);
  let closed = false;
  const outside = (event) => { if (!menu.contains(event.target)) close({ restore: false }); };
  function close({ restore = true } = {}) {
    if (closed) return;
    closed = true;
    dom.doc.removeEventListener("pointerdown", outside, true);
    menu.remove();
    if (restore) returnFocus?.focus?.({ preventScroll: true });
    onClose?.();
  }
  const enabled = () => buttons.filter((node) => node.getAttribute("aria-disabled") !== "true");
  menu.addEventListener("keydown", (event) => {
    const list = enabled();
    const at = list.indexOf(dom.doc.activeElement);
    const go = (index) => { event.preventDefault(); event.stopPropagation(); list[(index + list.length) % list.length]?.focus(); };
    if (event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowUp") go(at < 0 ? -1 : at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(-1);
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "Tab") close({ restore: false });
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); if (dom.doc.activeElement?.click) dom.doc.activeElement.click(); }
  });
  host.append(menu);
  const bounds = host.getBoundingClientRect();
  const width = menu.offsetWidth || 200, height = menu.offsetHeight || buttons.length * 32;
  menu.style.left = `${Math.max(4, Math.min(x - bounds.left, bounds.width - width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y - bounds.top, bounds.height - height - 4))}px`;
  dom.doc.addEventListener("pointerdown", outside, true);
  enabled()[0]?.focus();
  return { element: menu, close };
}

/** The items of the context menu for the selection `paths` (wrap in row or column, unwrap, duplicate, delete, rename). */
export function nodeMenuItems(model, paths, surface, win) {
  const node = paths.length === 1 ? model.nodeAt(paths[0]) : null;
  const split = Boolean(node) && node.name === undefined;
  const mod = isMac(win) ? "⌘" : "Ctrl+";
  return [
    { label: "Wrap in row", onSelect: () => model.wrap(paths, "row") },
    { label: "Wrap in column", onSelect: () => model.wrap(paths, "column") },
    { label: "Unwrap", disabled: !split, onSelect: () => model.unwrap(paths[0]) },
    { label: "Duplicate", hint: `${mod}D`, onSelect: () => model.duplicate(paths) },
    { label: "Delete", hint: "⌫", onSelect: () => model.remove(paths) },
    { label: "Rename", hint: "F2", disabled: !node || split, onSelect: () => model.requestRename(paths[0], surface) },
  ];
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

/** `+/- x`: round a fraction to a CSS percentage. */
export const pct = (fraction) => `${Math.round(fraction * 10000) / 100}%`;

export const SIZE_LABEL = (entry, direction) => {
  const size = entry.size;
  if (size === "auto") return "auto";
  if (size === undefined) return entry.name === "title" || entry.name === "subtitle" ? (direction === "column" ? "auto" : "1") : "1";
  return String(size);
};
