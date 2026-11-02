// CE-29: the Design quick menu. A toolbar button that opens a compact popover with the deck-level design choices people reach for most: Theme,
// Colors (color scheme), Fonts (font scheme) and, for the current slide, its Layout. It is for small embeds that have no room for the full
// Design panel (`design-controls.js`); a host that has one passes `onOpenPanel` and the menu adds a "More design options…" row for it.
//
// The choices come from the same place the panel's pickers do: core's catalog records through `listSwitchOptions` / `currentSwitchValue`, and every
// choice is applied with `switchDimension` (`switches.js`) as ONE validated, undoable edit with `meta.source: "design-menu"`. Nothing else writes the
// document. The popover is a `role="dialog"` holding a `role="menu"` whose rows are `menuitemradio` (arrow keys move, Enter or Space applies), it stays
// open after a choice so people can try several, and on a phone (`(max-width: 600px)`) it is a bottom sheet. Plain DOM; styles in
// src/styles/design-menu.css (classes `opf-design-menu-*`); touch sizes in touch.css.
import { currentSwitchValue, listSwitchOptions, switchDimension } from "./switches.js";
import { normalizeIcons, resolveIcon } from "./icons.js";

const SHEET_QUERY = "(max-width: 600px)";
const GAP = 4;
const MARGIN = 8;
const SOURCE = "design-menu";

const SECTIONS = Object.freeze([
  { key: "theme", dimension: "themes", labelKey: "theme" },
  { key: "colors", dimension: "color-schemes", labelKey: "colors" },
  { key: "fonts", dimension: "font-schemes", labelKey: "fonts" },
  { key: "layout", dimension: "layouts", labelKey: "layout", slide: true },
]);

const DEFAULT_LABELS = {
  /** The visible text of the toolbar button. */
  trigger: "Design",
  /** The accessible name of the popover (the sheet's title on a phone). */
  title: "Design",
  theme: "Theme",
  colors: "Colors",
  fonts: "Fonts",
  layout: "This slide: Layout",
  more: "More design options…",
  /** What the toolbar's overflow menu lists. */
  menuItem: "Design…",
  close: "Close",
  empty: "No design choices are available. Register a catalog to offer themes, colors, fonts and layouts.",
  /** `kind` is "theme", "colors", "fonts" or "layout". */
  applied: (kind, name) => `${{ theme: "Theme", colors: "Colors", fonts: "Fonts", layout: "Layout" }[kind] ?? kind} set to ${name}.`,
  already: (name) => `${name} is already set. Nothing changed.`,
  shadowed: (count) => `${count === 1 ? "1 slide keeps" : `${count} slides keep`} its own.`,
};

const ICONS = {
  Palette: [
    ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor" }],
    ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor" }],
    ["path", { d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" }],
  ],
  Check: [["path", { d: "M20 6 9 17l-5-5" }]],
  X: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
};
// The built-in icon behind each `icons` name.
const ICON_KEYS = { Palette: "trigger", X: "close", Check: "check" };
const ICON_NAMES = Object.values(ICON_KEYS);
let counter = 0;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const HEX = /^#[0-9a-f]{3,8}$/i;

function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// An inline Lucide icon (ISC license; the path data is inlined, nothing is fetched). Decorative: the control that holds it carries the name.
// `given` is the host's replacement from `options.icons` (see src/icons.js); the part's own names are trigger, close and check.
function icon(doc, name, size, given) {
  return resolveIcon(doc, given, ICONS[name], { name: ICON_KEYS[name], size });
}

const idOf = (reference) => (isObject(reference) ? reference.id : reference);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * Mount the Design quick menu in `container`. See `design-menu.d.ts` for every option. Returns
 * `{ element, trigger, setDensity, setDisabled, setReadOnly, refresh, open, close, isOpen, menuItems, destroy }`.
 */
export function createDesignMenu(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { editor } = options;
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw new TypeError("createDesignMenu needs an editor session.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const icons = normalizeIcons(options.icons, ICON_NAMES, "createDesignMenu icons");
  const id = `opf-design-menu-${++counter}`;
  let density = options.density === "touch" ? "touch" : "comfortable";
  let readOnly = options.readOnly === true;
  let disabled = false;
  let isOpen = false;
  let destroyed = false;
  let mode = "popover";
  let opener = null;
  let typed = "";
  let typedTimer;

  const catalogsNow = () => (typeof options.catalogs === "function" ? options.catalogs() : (options.catalogs ?? editor.catalogs));
  const slideNow = () => {
    const value = Number(options.getSlideIndex?.());
    return Number.isInteger(value) && value >= 0 ? value : 0;
  };
  const deckNow = () => editor.snapshot?.().presentation ?? editor.presentation;
  const say = (message) => {
    live.textContent = "";
    live.textContent = message;
    options.onStatus?.(message);
  };

  // ---- the DOM ------------------------------------------------------------------------------------------------------------------------
  const trigger = el(doc, "button", { type: "button", class: "opf-design-menu-trigger", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": `${id}-popover` },
    icon(doc, "Palette", 14, icons.trigger), el(doc, "span", { class: "opf-design-menu-trigger-label", text: labels.trigger }));
  const closeButton = el(doc, "button", { type: "button", class: "opf-design-menu-close", "aria-label": labels.close }, icon(doc, "X", 18, icons.close));
  const head = el(doc, "div", { class: "opf-design-menu-head" }, el(doc, "span", { class: "opf-design-menu-title", text: labels.title }), closeButton);
  const menu = el(doc, "div", { class: "opf-design-menu-menu", role: "menu", "aria-label": labels.title, id: `${id}-menu` });
  const empty = el(doc, "p", { class: "opf-design-menu-empty", text: labels.empty, hidden: true });
  const moreRow = el(doc, "button", { type: "button", class: "opf-design-menu-item opf-design-menu-more", role: "menuitem", tabindex: "-1", text: labels.more, hidden: typeof options.onOpenPanel !== "function" });
  menu.append(empty);
  const popover = el(doc, "div", { class: "opf-design-menu-popover", role: "dialog", "aria-label": labels.title, id: `${id}-popover`, hidden: true },
    el(doc, "div", { class: "opf-design-menu-handle", "aria-hidden": "true" }), head, menu);
  const scrim = el(doc, "div", { class: "opf-design-menu-scrim", hidden: true });
  const live = el(doc, "div", { class: "opf-design-menu-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const root = el(doc, "div", { class: "opf-design-menu opf-ui", "data-density": density, "data-mode": mode }, trigger, popover, scrim, live);
  container.append(root);

  // One entry per section: its heading, list and rows (by option id), rebuilt only when the choices themselves change.
  const sections = SECTIONS.map((spec) => {
    const heading = el(doc, "div", { class: "opf-design-menu-group-label", id: `${id}-${spec.key}`, text: labels[spec.labelKey] });
    const list = el(doc, "div", { class: "opf-design-menu-list" });
    const group = el(doc, "div", { class: "opf-design-menu-group", role: "group", "aria-labelledby": heading.id, "data-section": spec.key, hidden: true }, heading, list);
    menu.append(group);
    return { ...spec, group, list, rows: new Map(), signature: undefined };
  });
  menu.append(moreRow);

  // ---- rows ---------------------------------------------------------------------------------------------------------------------------
  const cssColor = (value) => (typeof value === "string" && HEX.test(value) ? value : undefined);
  function swatches(record, slots) {
    const colors = slots.map((slot) => cssColor(record?.[slot])).filter(Boolean);
    if (!colors.length) return null;
    const strip = el(doc, "span", { class: "opf-design-menu-swatches", "aria-hidden": "true" });
    for (const color of colors) {
      const chip = el(doc, "span", { class: "opf-design-menu-swatch" });
      chip.style.backgroundColor = color;
      strip.append(chip);
    }
    return strip;
  }
  const schemeRecords = new Map();
  const loadedFamilies = () => {
    const families = new Set();
    try {
      for (const face of doc.fonts ?? []) if (face.status === "loaded") families.add(String(face.family).replace(/^["']|["']$/g, ""));
    } catch { /* an old engine without iterable FontFaceSet: names stay plain */ }
    return families;
  };
  // A font scheme's name in its own heading face, once that face is loaded in this document. Otherwise the name stays in the UI font.
  function paintFaces() {
    const fonts = sections.find((section) => section.key === "fonts");
    const loaded = loadedFamilies();
    for (const row of fonts.rows.values()) {
      const family = row.dataset.major;
      if (family && loaded.has(family)) row.querySelector(".opf-design-menu-label").style.fontFamily = `"${family.replace(/["\\]/g, "")}", var(--opf-ui-font)`;
      else row.querySelector(".opf-design-menu-label").style.removeProperty("font-family");
    }
  }

  function buildRow(section, option) {
    const record = isObject(option.record) ? option.record : {};
    let hint = null;
    if (section.key === "colors") hint = swatches(record, ["accent1", "accent2", "accent3", "accent4"]);
    else if (section.key === "theme") hint = swatches(schemeRecords.get(idOf(record.colorScheme)), ["accent1", "accent2", "accent3"]);
    const tip = [record.summary, record.description].find((text) => typeof text === "string" && text) ?? "";
    const row = el(doc, "button", { type: "button", class: "opf-design-menu-item", role: "menuitemradio", "aria-checked": "false", tabindex: "-1", "data-section": section.key, "data-value": option.id, title: tip || false },
      hint, el(doc, "span", { class: "opf-design-menu-label", text: option.label }), el(doc, "span", { class: "opf-design-menu-check" }, icon(doc, "Check", 14, icons.check)));
    if (section.key === "fonts" && typeof record.major === "string") row.dataset.major = record.major;
    row.addEventListener("click", () => choose(section, option));
    return row;
  }

  // The current value of a section. An unset color or font scheme is the one the theme brings.
  function currentOf(deck, section, options) {
    if (section.key === "layout") return currentSwitchValue(deck, "layouts", { slideIndex: slideNow(), catalogs: catalogsNow() }).value;
    const own = currentSwitchValue(deck, section.dimension, { catalogs: catalogsNow() }).value;
    if (own !== undefined || section.key === "theme") return own;
    const theme = currentSwitchValue(deck, "themes", { catalogs: catalogsNow() }).value;
    const record = theme === undefined ? undefined : options.themes.find((entry) => entry.id === theme)?.record;
    return idOf(section.key === "colors" ? record?.colorScheme : record?.fontScheme);
  }

  function paint() {
    if (destroyed) return;
    const deck = deckNow();
    const catalogs = catalogsNow();
    const lists = {};
    for (const section of sections) {
      lists[section.key] = listSwitchOptions(deck, section.dimension, { catalogs });
      if (section.key === "colors") for (const entry of lists.colors) schemeRecords.set(entry.id, entry.record);
    }
    // Colors are read before the theme row is drawn, so its swatches come from the scheme it brings.
    const focused = popover.contains(doc.activeElement) ? doc.activeElement : null;
    const focusedKey = focused?.dataset?.section ? `${focused.dataset.section}|${focused.dataset.value}` : focused === moreRow ? "more" : null;
    const hasSlides = Array.isArray(deck?.slides) && deck.slides.length > 0;
    let any = false;
    for (const section of sections) {
      const entries = lists[section.key];
      const visible = entries.length > 0 && (!section.slide || hasSlides);
      section.group.hidden = !visible;
      if (!visible) continue;
      any = true;
      const signature = JSON.stringify(entries.map((entry) => [entry.id, entry.label, section.key === "theme" ? idOf(entry.record?.colorScheme) : undefined]));
      if (signature !== section.signature) {
        section.signature = signature;
        section.rows = new Map(entries.map((entry) => [entry.id, buildRow(section, entry)]));
        section.list.replaceChildren(...section.rows.values());
      }
      const current = currentOf(deck, section, { themes: lists.theme });
      for (const [value, row] of section.rows) row.setAttribute("aria-checked", String(value === current));
      section.current = current;
    }
    empty.hidden = any;
    paintFaces();
    root.toggleAttribute("data-empty", !any);
    if (focusedKey && popover.contains(doc.activeElement) === false) {
      const row = focusedKey === "more" ? moreRow : [...menu.querySelectorAll("[data-value]")].find((item) => `${item.dataset.section}|${item.dataset.value}` === focusedKey);
      row?.focus({ preventScroll: true });
    }
  }

  // ---- applying a choice ---------------------------------------------------------------------------------------------------------------
  function choose(section, option) {
    if (destroyed || disabled || readOnly) return;
    // The checked row is what is in effect: choosing it again changes nothing (a theme would otherwise reset its bundled colors and fonts).
    if (option.id === section.current) {
      say(labels.already(option.label));
      return;
    }
    try {
      const change = switchDimension(editor, section.dimension, option.id, {
        catalogs: catalogsNow(),
        ...(section.slide ? { slideIndex: slideNow() } : {}),
        meta: { source: SOURCE },
      });
      if (change.changed === false) say(labels.already(option.label));
      else say(`${labels.applied(section.key, option.label)}${change.shadowed?.length ? ` ${labels.shadowed(change.shadowed.length)}` : ""}`);
    } catch (error) {
      say(error?.message ?? String(error));
    }
    if (isOpen) paint();
  }

  // ---- open, close, position ---------------------------------------------------------------------------------------------------------
  const media = win?.matchMedia?.(SHEET_QUERY);
  // A button that is hidden (the toolbar moved it into its overflow menu) cannot anchor a popover, and a fixed child of a hidden parent is not drawn either.
  const anchored = () => trigger.getClientRects().length > 0 && win.getComputedStyle(trigger).visibility !== "hidden";
  // The popover then borrows a surface of its own on the page body, and goes back into the part when it closes.
  let portal;
  function usePortal(on) {
    if (on && !portal) {
      portal = el(doc, "div", { class: "opf-design-menu opf-ui", "data-density": density, "data-mode": "sheet" });
      const themed = root.closest("[data-theme]");
      if (themed) portal.dataset.theme = themed.dataset.theme;
      if (root.closest(".dark")) portal.classList.add("dark");
      doc.body.append(portal);
      portal.append(popover, scrim, live);
    } else if (!on && portal) {
      root.append(popover, scrim, live);
      portal.remove();
      portal = undefined;
    }
  }
  function setMode() {
    mode = media?.matches || !anchored() ? "sheet" : "popover";
    (portal ?? root).dataset.mode = mode;
    root.dataset.mode = mode;
    popover.setAttribute("aria-modal", String(mode === "sheet"));
    scrim.hidden = !(isOpen && mode === "sheet");
  }
  function place() {
    if (!isOpen) return;
    setMode();
    if (mode === "sheet") {
      for (const property of ["left", "top", "max-height"]) popover.style.removeProperty(property);
      return;
    }
    popover.style.removeProperty("max-height");
    const viewWidth = win.innerWidth;
    const viewHeight = win.innerHeight;
    const anchor = trigger.getBoundingClientRect();
    const width = popover.offsetWidth;
    const natural = popover.offsetHeight;
    const below = viewHeight - anchor.bottom - GAP - MARGIN;
    const above = anchor.top - GAP - MARGIN;
    const flip = natural > below && above > below;
    const room = Math.max(120, Math.min(flip ? above : below, viewHeight - 2 * MARGIN));
    const height = Math.min(natural, room);
    const rtl = win.getComputedStyle(trigger).direction === "rtl";
    const left = clamp(rtl ? anchor.right - width : anchor.left, MARGIN, Math.max(MARGIN, viewWidth - width - MARGIN));
    popover.style.left = `${left}px`;
    popover.style.top = `${flip ? anchor.top - GAP - height : anchor.bottom + GAP}px`;
    if (natural > room) popover.style.maxHeight = `${room}px`;
  }
  const items = () => [...menu.querySelectorAll("[role^='menuitem']")].filter((item) => !item.closest("[hidden]") && !item.hidden);
  function focusItem(item) {
    item?.focus();
    item?.scrollIntoView?.({ block: "nearest" });
  }
  const onDocPointer = (event) => {
    if (!root.contains(event.target) && !portal?.contains(event.target)) close({ restoreFocus: false });
  };
  const onDocKey = (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) {
      event.preventDefault();
      close();
    }
  };
  const onReflow = () => place();
  const onFaces = () => paintFaces();

  function open() {
    if (destroyed || disabled || readOnly || isOpen) return;
    opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    isOpen = true;
    usePortal(!anchored());
    paint();
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    place();
    doc.addEventListener("pointerdown", onDocPointer, true);
    doc.addEventListener("keydown", onDocKey);
    win?.addEventListener("resize", onReflow);
    win?.addEventListener("scroll", onReflow, true);
    doc.fonts?.addEventListener?.("loadingdone", onFaces);
    const current = menu.querySelector("[aria-checked='true']");
    focusItem(current ?? items()[0] ?? closeButton);
  }
  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    popover.hidden = true;
    scrim.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    doc.removeEventListener("pointerdown", onDocPointer, true);
    doc.removeEventListener("keydown", onDocKey);
    win?.removeEventListener("resize", onReflow);
    win?.removeEventListener("scroll", onReflow, true);
    doc.fonts?.removeEventListener?.("loadingdone", onFaces);
    const returnTarget = anchored() && !trigger.disabled ? trigger : opener?.isConnected ? opener : null;
    usePortal(false);
    if (restoreFocus && !destroyed) {
      // The button when it is on screen, else what had focus when the menu opened (it came from the toolbar's overflow menu).
      returnTarget?.focus();
    }
    opener = null;
  }

  // ---- events -------------------------------------------------------------------------------------------------------------------------
  trigger.addEventListener("click", () => (isOpen ? close() : open()));
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && !isOpen && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      open();
    }
  });
  closeButton.addEventListener("click", () => close());
  scrim.addEventListener("click", () => close());
  moreRow.addEventListener("click", () => {
    close();
    options.onOpenPanel?.();
  });
  popover.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const list = items();
    const index = list.indexOf(doc.activeElement);
    let target;
    if (event.key === "ArrowDown") target = list[index < 0 ? 0 : Math.min(list.length - 1, index + 1)];
    else if (event.key === "ArrowUp") target = list[index < 0 ? list.length - 1 : Math.max(0, index - 1)];
    else if (event.key === "Home") target = list[0];
    else if (event.key === "End") target = list[list.length - 1];
    else if (event.key === "Tab") {
      // Tab leaves the menu: close and put focus on the button so the next Tab continues from it.
      close();
      return;
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Typeahead: the next row whose label starts with what was typed.
      typed += event.key.toLowerCase();
      win.clearTimeout(typedTimer);
      typedTimer = win.setTimeout(() => { typed = ""; }, 600);
      const from = typed.length === 1 ? index + 1 : Math.max(index, 0);
      const ordered = [...list.slice(from), ...list.slice(0, from)];
      target = ordered.find((item) => item.textContent.trim().toLowerCase().startsWith(typed));
      if (!target) return;
    } else return;
    event.preventDefault();
    if (target) focusItem(target);
  });

  const unsubscribe = editor.subscribe(() => {
    if (destroyed) return;
    if (isOpen) paint();
  });
  const onMedia = () => place();
  media?.addEventListener?.("change", onMedia);
  syncDisabled();

  function syncDisabled() {
    const off = disabled || readOnly;
    trigger.disabled = off;
    root.toggleAttribute("data-disabled", off);
    if (off && isOpen) close({ restoreFocus: false });
  }

  return {
    element: root,
    trigger,
    setDensity(value) {
      if (destroyed) return;
      density = value === "touch" ? "touch" : "comfortable";
      root.dataset.density = density;
      if (portal) portal.dataset.density = density;
      if (isOpen) place();
    },
    setDisabled(value) {
      if (destroyed) return;
      disabled = Boolean(value);
      syncDisabled();
    },
    setReadOnly(value) {
      if (destroyed) return;
      readOnly = Boolean(value);
      syncDisabled();
    },
    /** Read the document and the catalogs again (the menu follows the editor session on its own while it is open). */
    refresh() {
      if (destroyed) return;
      if (isOpen) { paint(); place(); }
    },
    open,
    close,
    isOpen: () => isOpen,
    menuItems: () => [{ id: "design", label: labels.menuItem, disabled: destroyed || disabled || readOnly, run: open }],
    destroy() {
      if (destroyed) return;
      close({ restoreFocus: false });
      destroyed = true;
      unsubscribe?.();
      media?.removeEventListener?.("change", onMedia);
      win?.clearTimeout(typedTimer);
      root.remove();
    },
  };
}
