// CE-18, the studio kit: DOM helpers every studio part shares. `createDom` binds element, icon and button factories to one document and
// one class prefix (Layout Studio passes "opf-lx", so its classes are unchanged), the inline Lucide icons, `openMenu` (the menu behind every
// context menu), the typing-target guard of the shortcuts, and small formatting helpers. Plain DOM; no network; nothing about a document
// format.

// Lucide icons (ISC license), as path data.
export const ICONS = {
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
  Video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  Gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  CalendarRange: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/>',
  Type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  Menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  FileCode: '<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>',
  PanelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  Presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  Keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
  EyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  Ungroup: '<rect width="8" height="6" x="5" y="4" rx="1"/><rect width="8" height="6" x="11" y="14" rx="1"/>',
  ArrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  ArrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  Group: '<path d="M3 7V5c0-1.1.9-2 2-2h2"/><path d="M17 3h2c1.1 0 2 .9 2 2v2"/><path d="M21 17v2c0 1.1-.9 2-2 2h-2"/><path d="M7 21H5c-1.1 0-2-.9-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/>',
};

const SVG = "http://www.w3.org/2000/svg";
let serial = 0;
/** A unique id for this page: `prefix-1`, `prefix-2`... (one counter for every part, so ids never collide across parts). */
export const nextId = (prefix) => `${prefix}-${++serial}`;

/** The default class prefix of kit parts; Layout Studio passes "opf-lx". */
export const KIT_PREFIX = "opf-kit";

/**
 * DOM helpers bound to one document and one class prefix: `el(tag, className, attributes)` (`text` sets the text; `undefined`, `null` and
 * `false` attributes are skipped), `icon(name, size)` (an inline Lucide icon, `aria-hidden`), and `button(className, options)` (a real
 * button; with a `label` and only an icon, the label is its accessible name).
 */
export function createDom(doc, { prefix = KIT_PREFIX } = {}) {
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
    svg.setAttribute("class", `${prefix}-icon ${prefix}-icon-${name.toLowerCase()}`);
    svg.innerHTML = ICONS[name] ?? "";
    return svg;
  };
  const button = (className, { label, text, iconName, size = 16, pressed, title, attributes = {} } = {}) => {
    const node = el("button", className, { type: "button", "aria-label": label, title: title ?? (text ? undefined : label), ...attributes });
    if (pressed !== undefined) node.setAttribute("aria-pressed", String(pressed));
    if (iconName) node.append(icon(iconName, size));
    if (text) node.append(el("span", `${prefix}-button-text`, { text }));
    return node;
  };
  return { doc, prefix, el, icon, button };
}

/** Whether keyboard events from this element belong to a field the person is typing in (so a shortcut must not fire). */
export function isTypingTarget(target) {
  if (!target || target.nodeType !== 1) return false;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "reset"].includes(target.type);
  return target.isContentEditable === true;
}
export const isMac = (win) => /Mac|iPhone|iPad/.test(win?.navigator?.platform ?? "");

/** A unit fraction as a CSS percentage, rounded to 0.01%. */
export const pct = (fraction) => `${Math.round(fraction * 10000) / 100}%`;

/**
 * A menu (`role="menu"`) at a client point, inside `host` (a positioned element). Items are `{ label, onSelect, disabled, role, checked, hint }`.
 * Arrow keys, Home, End, Enter and Space work; Escape closes and returns focus to `returnFocus`; a press outside closes it. Returns
 * `{ element, close }`.
 */
export function openMenu(dom, host, { x, y, items, label, returnFocus, onClose, className = "" }) {
  const p = dom.prefix;
  const menu = dom.el("div", `${p}-menu ${className}`.trim(), { role: "menu", "aria-label": label });
  // CE-20: items may carry an `icon` (a Lucide name), a `media` element (a layout diagram), a `description` (a second line), a `title` (why
  // it is disabled), `pointerdown(event, item)` (an item that can also be dragged out of the menu) and a `group` name: consecutive items of
  // one group sit in a `role="group"` under a visible heading. `{ separator: true }` draws a separator.
  let parent = menu, groupName;
  const buttons = [];
  for (const item of items) {
    if (item.separator) { menu.append(dom.el("div", `${p}-menu-separator`, { role: "separator" })); parent = menu; groupName = undefined; continue; }
    if (item.group !== groupName) {
      groupName = item.group;
      if (groupName) {
        parent = dom.el("div", `${p}-menu-group`, { role: "group", "aria-label": groupName });
        parent.append(dom.el("div", `${p}-menu-heading`, { "aria-hidden": "true", text: groupName }));
        menu.append(parent);
      } else parent = menu;
    }
    const role = item.role ?? "menuitem";
    const node = dom.el("button", `${p}-menuitem`, { type: "button", role, tabindex: "-1", title: item.title, "aria-disabled": item.disabled ? "true" : undefined, "aria-checked": role === "menuitemcheckbox" ? String(Boolean(item.checked)) : undefined, "aria-keyshortcuts": item.keyshortcuts });
    if (item.media) node.append(item.media);
    else if (item.icon) node.append(dom.icon(item.icon, 16));
    if (item.description) {
      const text = dom.el("span", `${p}-menu-text`);
      text.append(dom.el("span", `${p}-menu-label`, { text: item.label }), dom.el("span", `${p}-menu-description`, { text: item.description }));
      node.append(text);
    } else node.append(dom.el("span", `${p}-menu-label`, { text: item.label }));
    if (item.hint) node.append(dom.el("span", `${p}-menu-hint`, { text: item.hint }));
    if (role === "menuitemcheckbox") node.prepend(dom.icon(item.checked ? "Check" : "Square", 14));
    if (item.pointerdown) node.addEventListener("pointerdown", (event) => item.pointerdown(event, item, { close: () => close({ restore: false }) }));
    node.addEventListener("click", () => {
      if (item.disabled) return;
      close();
      item.onSelect?.();
    });
    parent.append(node);
    buttons.push(node);
  }
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
