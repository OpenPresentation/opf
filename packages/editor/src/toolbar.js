// CE-28: the editor's title bar. `createToolbar(container, { items })` builds one slot element per named item, in order, and keeps the row on one
// line: when the items do not fit the width of the bar (a ResizeObserver on the bar, so the container decides, not the window), the collapsible
// items are hidden lowest priority first and what they offer appears in the `more` (⋯) menu, built from each mounted part's `menuItems()`.
// It only arranges: the parts (the deck title, the history buttons, the counter, Export, Present, the expand button) are mounted in its slots by
// the workspace (src/workspace.js) or by a host, and registered with `mount(id, part)`. Plain DOM, styled by src/styles/toolbar.css (tokens only).

/**
 * The items a toolbar knows, with their default priority (higher stays visible longer) and whether they can move into the `more` menu.
 * `spacer` takes the free space; `|` is a divider, shown only between two visible items.
 */
export const TOOLBAR_ITEMS = Object.freeze({
  title: Object.freeze({ priority: 95, collapsible: false }),
  history: Object.freeze({ priority: 80, collapsible: true }),
  counter: Object.freeze({ priority: 85, collapsible: true }),
  views: Object.freeze({ priority: 40, collapsible: true }),
  find: Object.freeze({ priority: 50, collapsible: true }),
  zoom: Object.freeze({ priority: 45, collapsible: true }),
  design: Object.freeze({ priority: 35, collapsible: true }),
  review: Object.freeze({ priority: 30, collapsible: true }),
  autosave: Object.freeze({ priority: 20, collapsible: true }),
  export: Object.freeze({ priority: 65, collapsible: true }),
  present: Object.freeze({ priority: 75, collapsible: true }),
  expand: Object.freeze({ priority: 70, collapsible: true }),
  actions: Object.freeze({ priority: 25, collapsible: true }),
  help: Object.freeze({ priority: 10, collapsible: true }),
  more: Object.freeze({ priority: 100, collapsible: false }),
  spacer: Object.freeze({ priority: 0, collapsible: false }),
  "|": Object.freeze({ priority: 0, collapsible: false }),
});
const REPEATABLE = new Set(["spacer", "|"]);
const LABELS = Object.freeze({ more: "More", menu: "More actions" });

/**
 * Turn the `items` option (names, or `{ id, priority, collapsible }`) into the list the toolbar builds, with each item's priority and whether
 * it collapses. Throws on a name that is not an item and on a named item given twice (`spacer` and `|` may repeat).
 */
export function normalizeToolbarItems(items) {
  if (!Array.isArray(items)) throw new TypeError("toolbar items must be an array of item names or { id, priority } objects.");
  const seen = new Set();
  return items.map((item, index) => {
    const spec = typeof item === "string" ? { id: item } : item;
    if (!spec || typeof spec !== "object" || typeof spec.id !== "string") throw new TypeError(`toolbar item ${index} must be an item name or { id, priority }.`);
    const known = TOOLBAR_ITEMS[spec.id];
    if (!known) throw new RangeError(`"${spec.id}" is not a toolbar item (${Object.keys(TOOLBAR_ITEMS).join(", ")}).`);
    if (!REPEATABLE.has(spec.id)) {
      if (seen.has(spec.id)) throw new RangeError(`the toolbar item "${spec.id}" is given twice.`);
      seen.add(spec.id);
    }
    if (spec.priority !== undefined && !Number.isFinite(spec.priority)) throw new TypeError(`the priority of the toolbar item "${spec.id}" must be a number.`);
    return Object.freeze({
      id: spec.id,
      priority: spec.priority ?? known.priority,
      collapsible: REPEATABLE.has(spec.id) || spec.id === "more" ? false : spec.collapsible ?? known.collapsible,
    });
  });
}

const make = (doc, tag, attributes = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children);
  return node;
};
const SVG = "http://www.w3.org/2000/svg";
function dotsIcon(doc) {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const cx of [3, 8, 13]) {
    const dot = doc.createElementNS(SVG, "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", "8");
    dot.setAttribute("r", "1.5");
    dot.setAttribute("fill", "currentColor");
    svg.append(dot);
  }
  return svg;
}

let toolbarIds = 0;

/**
 * Build a toolbar in `container`. Returns its handle; see `toolbar.d.ts`.
 */
export function createToolbar(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("createToolbar needs a DOM container.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const text = { ...LABELS, ...(options.labels ?? {}) };
  const items = normalizeToolbarItems(options.items ?? []);
  const id = `opf-tb-${++toolbarIds}`;
  let density = options.density === "touch" ? "touch" : "comfortable";
  let destroyed = false;
  let menuOpen = false;
  let collapsed = [];
  const parts = new Map();

  const bar = make(doc, "div", { class: "opf-tb opf-ui", "data-density": density });
  const slots = {};
  const entries = items.map((item, index) => {
    let element;
    if (item.id === "spacer") element = make(doc, "span", { class: "opf-tb-spacer opf-ws-spacer", "data-opf-toolbar-item": "spacer" });
    else if (item.id === "|") element = make(doc, "span", { class: "opf-tb-divider", "data-opf-toolbar-item": "|", "aria-hidden": "true" });
    else element = make(doc, "div", { class: "opf-tb-item", "data-opf-toolbar-item": item.id });
    if (!REPEATABLE.has(item.id)) slots[item.id] = element;
    bar.append(element);
    return { ...item, index, element };
  });

  // ---- the more menu ------------------------------------------------------------------------------------------------------------------
  const moreEntry = entries.find((entry) => entry.id === "more");
  let trigger;
  let menu;
  if (moreEntry) {
    trigger = make(doc, "button", { type: "button", class: "opf-tb-more-button", "aria-label": text.more, title: text.more, "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": `${id}-menu` }, dotsIcon(doc));
    menu = make(doc, "div", { class: "opf-tb-menu", role: "menu", id: `${id}-menu`, "aria-label": text.menu, hidden: true });
    moreEntry.element.classList.add("opf-tb-more");
    moreEntry.element.append(trigger, menu);
    moreEntry.element.hidden = true;
  }
  const menuButtons = () => (menu ? [...menu.querySelectorAll("[role^=menuitem]")] : []);
  function partItems(entry) {
    const part = parts.get(entry.id);
    if (typeof part?.menuItems !== "function") return [];
    try {
      return (part.menuItems() ?? []).filter((item) => item && typeof item.label === "string" && typeof item.run === "function");
    } catch (error) {
      options.onError?.(error);
      return [];
    }
  }
  /** What the more menu lists now: the items of every collapsed part, in bar order, one group per part. */
  function menuGroups() {
    return entries.filter((entry) => collapsed.includes(entry.id)).map((entry) => ({ id: entry.id, items: partItems(entry) })).filter((group) => group.items.length);
  }
  function buildMenu() {
    if (!menu) return;
    const nodes = [];
    for (const [at, group] of menuGroups().entries()) {
      if (at > 0) nodes.push(make(doc, "div", { class: "opf-tb-menu-separator", role: "separator" }));
      for (const item of group.items) {
        const role = item.pressed === undefined ? "menuitem" : "menuitemcheckbox";
        const button = make(doc, "button", {
          type: "button",
          class: "opf-tb-menu-item",
          role,
          tabindex: "-1",
          "data-opf-toolbar-menu-item": item.id ?? "",
          "data-opf-toolbar-part": group.id,
          "aria-checked": role === "menuitemcheckbox" ? String(Boolean(item.pressed)) : undefined,
          "aria-disabled": item.disabled ? "true" : undefined,
          text: item.label,
        });
        button.addEventListener("click", () => activate(item));
        nodes.push(button);
      }
    }
    menu.replaceChildren(...nodes);
  }
  function activate(item) {
    if (item.disabled) return;
    closeMenu({ restoreFocus: false });
    try {
      item.run();
    } catch (error) {
      options.onError?.(error);
    }
    // What the item did may have moved the focus (Find focuses its field); otherwise it goes back to the trigger.
    if (!doc.activeElement || doc.activeElement === doc.body) trigger?.focus();
  }
  function focusAt(which) {
    const list = menuButtons();
    if (!list.length) return;
    const at = list.indexOf(doc.activeElement);
    const next = which === "first" ? 0 : which === "last" ? list.length - 1 : (at + which + list.length) % list.length;
    list[next].focus();
  }
  function onOutside(event) {
    if (!moreEntry.element.contains(event.target)) closeMenu({ restoreFocus: false });
  }
  function onEscape(event) {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    }
  }
  function openMenu(which = "first") {
    if (destroyed || !menu || menuOpen || moreEntry.element.hidden) return false;
    buildMenu();
    if (!menuButtons().length) return false;
    menuOpen = true;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    doc.addEventListener("pointerdown", onOutside, true);
    doc.addEventListener("keydown", onEscape, true);
    focusAt(which);
    return true;
  }
  function closeMenu({ restoreFocus = true } = {}) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    doc.removeEventListener("pointerdown", onOutside, true);
    doc.removeEventListener("keydown", onEscape, true);
    if (restoreFocus) trigger.focus();
  }
  if (menu) {
    trigger.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu("first")));
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      if (menuOpen) focusAt(event.key === "ArrowUp" ? "last" : "first");
      else openMenu(event.key === "ArrowUp" ? "last" : "first");
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusAt(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusAt(event.key === "Home" ? "first" : "last");
      } else if (event.key === "Tab") {
        // Tab leaves the menu from its trigger, so the next stop is the one after the trigger.
        closeMenu();
      }
    });
  }

  // ---- fitting the row ----------------------------------------------------------------------------------------------------------------
  // An item counts when it shows something: a slot with content or a registered part (an empty slot takes no room and no gap).
  const present = (entry) => entry.id !== "spacer" && entry.id !== "|" && entry.id !== "more" && (entry.element.childNodes.length > 0 || parts.has(entry.id));
  const shown = (entry) => present(entry) && !entry.element.hasAttribute("data-collapsed");
  function syncDividers() {
    for (const [at, entry] of entries.entries()) {
      if (entry.id !== "|") continue;
      const side = (step) => {
        for (let i = at + step; i >= 0 && i < entries.length; i += step) {
          const other = entries[i];
          if (other.id === "|") return false;
          if (other.id === "more" ? !other.element.hidden : shown(other)) return true;
        }
        return false;
      };
      entry.element.hidden = !(side(-1) && side(1));
    }
  }
  function setCollapsed(entry, on) {
    entry.element.toggleAttribute("data-collapsed", on);
  }
  function fits() {
    const style = win.getComputedStyle(bar);
    const available = bar.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0);
    const gap = Number.parseFloat(style.columnGap) || 0;
    let needed = 0;
    let count = 0;
    for (const child of bar.children) {
      if (child.hidden || win.getComputedStyle(child).display === "none") continue;
      needed += child.getBoundingClientRect().width;
      count++;
    }
    needed += gap * Math.max(0, count - 1);
    return needed <= available + 0.5;
  }
  /** Fit the row now: show every item, then collapse the collapsible ones, lowest priority (and, at equal priority, the rightmost) first, until the row fits. */
  function update() {
    if (destroyed) return collapsed;
    // A bar that is not laid out (detached, or display: none) keeps what it shows.
    if (!bar.isConnected || bar.clientWidth === 0) {
      syncDividers();
      return collapsed;
    }
    const before = collapsed.join(",");
    bar.setAttribute("data-measuring", "");
    for (const entry of entries) if (entry.collapsible) setCollapsed(entry, false);
    if (moreEntry) moreEntry.element.hidden = true;
    syncDividers();
    const next = [];
    const candidates = entries.filter((entry) => entry.collapsible && present(entry)).sort((a, b) => a.priority - b.priority || b.index - a.index);
    for (const entry of candidates) {
      if (fits()) break;
      setCollapsed(entry, true);
      next.push(entry.id);
      if (moreEntry) moreEntry.element.hidden = !next.some((name) => partItems(entries.find((other) => other.id === name)).length);
      syncDividers();
    }
    bar.removeAttribute("data-measuring");
    collapsed = entries.filter((entry) => next.includes(entry.id)).map((entry) => entry.id);
    bar.toggleAttribute("data-overflowing", collapsed.length > 0);
    if (collapsed.join(",") !== before) {
      if (menuOpen) closeMenu({ restoreFocus: false });
      options.onCollapse?.({ collapsed: [...collapsed] });
    }
    return collapsed;
  }
  let frame = 0;
  function schedule() {
    if (destroyed || frame) return;
    const run = () => {
      frame = 0;
      update();
    };
    frame = typeof win?.requestAnimationFrame === "function" ? win.requestAnimationFrame(run) : (setTimeout(run, 16), -1);
  }
  let observer;
  const observed = new Set();
  const observe = (node) => {
    if (observer && !observed.has(node)) {
      observer.observe(node);
      observed.add(node);
    }
  };
  if (typeof win?.ResizeObserver === "function") {
    // Laid out again on the next frame, never inside the observer's callback, so a collapse never feeds back into the same notification.
    observer = new win.ResizeObserver(() => schedule());
    observe(bar);
    for (const entry of entries) if (entry.id !== "spacer" && entry.id !== "|") observe(entry.element);
  }
  // A part's content changing its own size (a longer status, a counter going to three digits) is caught by the observer on its slot; a slot
  // that gets its first child (a part that mounted late) is caught here.
  const mutations = typeof win?.MutationObserver === "function" ? new win.MutationObserver(() => schedule()) : undefined;
  for (const entry of entries) if (entry.id !== "spacer" && entry.id !== "|" && entry.id !== "more") mutations?.observe(entry.element, { childList: true });

  container.append(bar);
  syncDividers();
  update();

  return {
    element: bar,
    get items() {
      return items.map((item) => ({ ...item }));
    },
    slots,
    slot(name) {
      return slots[name];
    },
    /** The items moved into the more menu, in bar order. */
    get collapsed() {
      return [...collapsed];
    },
    get menuOpen() {
      return menuOpen;
    },
    mount(name, part) {
      if (destroyed || !slots[name] || REPEATABLE.has(name) || name === "more") return () => {};
      parts.set(name, part);
      schedule();
      return () => {
        if (parts.get(name) === part) parts.delete(name);
        schedule();
      };
    },
    /** What the more menu would list now, grouped by part. */
    menuItems() {
      return menuGroups();
    },
    update,
    openMenu,
    closeMenu,
    setDensity(next) {
      density = next === "touch" ? "touch" : "comfortable";
      bar.dataset.density = density;
      schedule();
    },
    destroy() {
      if (destroyed) return;
      closeMenu({ restoreFocus: false });
      destroyed = true;
      if (frame > 0) win.cancelAnimationFrame?.(frame);
      observer?.disconnect();
      mutations?.disconnect();
      parts.clear();
      bar.remove();
    },
  };
}
