// CE-29: the Design quick menu. A toolbar button that opens the editor's one panel (src/panel.js, shared with Find and Export) with the deck-level
// design choices people reach for most, one section at a time behind a segmented switch: Theme, Colors (color scheme), Fonts (font scheme) and,
// for the current slide, its Layout. It is for small embeds that have no room for the full Design panel (`design-controls.js`); a host that has
// one passes `onOpenPanel` and the menu adds a "More design options…" row for it.
//
// The choices come from the same place the panel's pickers do: core's catalog records through `listSwitchOptions` / `currentSwitchValue`, and every
// choice is applied with `switchDimension` (`switches.js`) as ONE validated, undoable edit with `meta.source: "design-menu"`. Nothing else writes the
// document, except the foot's Undo, which is the session's undo of that edit. The panel is a `role="dialog"`; the switch is a `tablist` (arrow keys
// move, the shown section is its `tabpanel`); each section's choices are a `role="menu"` of `menuitemradio` rows (arrow keys move, in a grid by
// rows and columns, Enter or Space applies). It stays open after a choice so people can try several. The font section lists the schemes for the
// deck's language (its script's slot: Latin, East Asian or complex script), grouped by type under the one in use, with a filter. On a phone
// (`(max-width: 600px)`) the panel is a bottom sheet. Plain DOM; styles in src/styles/panel.css and design-menu.css (classes `opf-design-menu-*`).
import { normalizeLanguageFamily } from "@openpresentation/opf";
import { resolveScriptFonts } from "@openpresentation/opf/composition";
import { el, icon as lucide } from "./export-dom.js";
import { normalizeIcons, resolveIcon } from "./icons.js";
import { PANEL_SHEET_QUERY, claimPanel, createPanelFrame, panelLabel, placePanel, releasePanel, shown, tabWithin } from "./panel.js";
import { currentSwitchValue, listSwitchOptions, switchDimension } from "./switches.js";

const SOURCE = "design-menu";

const SECTIONS = Object.freeze([
  { key: "theme", dimension: "themes", labelKey: "theme" },
  { key: "colors", dimension: "color-schemes", labelKey: "colors" },
  { key: "fonts", dimension: "font-schemes", labelKey: "fonts" },
  { key: "layout", dimension: "layouts", labelKey: "layout", slide: true },
]);
const FONT_TYPES = ["sans-serif", "serif", "monospace"];

const DEFAULT_LABELS = {
  /** The visible text of the toolbar button. */
  trigger: "Design",
  /** The panel's title and accessible name. */
  title: "Design",
  theme: "Theme",
  colors: "Colors",
  fonts: "Fonts",
  layout: "This slide: Layout",
  /** The layout section's tab. */
  layoutTab: "Layout",
  more: "More design options…",
  /** What the toolbar's overflow menu lists. */
  menuItem: "Design…",
  close: "Close",
  empty: "No design choices are available. Register a catalog to offer themes, colors, fonts and layouts.",
  /** The small label over a section's choices. `kind` is "theme", "colors" or "layout"; `slide` is 0-based. */
  count: (kind, count, slide) => (kind === "layout" ? `Slide ${String(slide + 1).padStart(2, "0")} · ${count} layouts` : `${kind === "theme" ? "Theme" : "Color scheme"} · ${count}`),
  filterFonts: "Filter fonts",
  filterPlaceholder: (count) => `Filter ${count} fonts`,
  noFonts: (query) => `No font matches “${query}”.`,
  inUse: "In use",
  fontTypes: { "sans-serif": "Sans serif", serif: "Serif", monospace: "Monospace", other: "Other" },
  /** The foot's line on the Fonts section: `language` is the deck language's name. */
  fontsFor: (language) => `Fonts for ${language}. Each name is drawn in its own face once it is loaded.`,
  themeHint: "A theme sets colors, fonts and backgrounds together. Each choice is one undo step.",
  undo: "Undo",
  undone: "Undone.",
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

// An inline Lucide icon (ISC license; the path data is inlined, nothing is fetched). Decorative: the control that holds it carries the name.
// `given` is the host's replacement from `options.icons` (see src/icons.js); the part's own names are trigger, close and check.
function icon(doc, name, size, given) {
  return resolveIcon(doc, given, ICONS[name], { name: ICON_KEYS[name], size });
}

const idOf = (reference) => (isObject(reference) ? reference.id : reference);
const cssColor = (value) => (typeof value === "string" && HEX.test(value) ? value : undefined);
const paint = (node, color) => {
  if (color) node.style.backgroundColor = color;
  return node;
};

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
  // The foot: what the last choice did (with Undo while that edit is the last one), else the open section's hint.
  let status = "";
  let undoable = false;
  let applying = false;

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
  const frame = createPanelFrame(doc, { id: `${id}-popover`, title: labels.title, closeLabel: labels.close, closeIcon: icon(doc, "X", 16, icons.close), className: "opf-design-menu-popover" });
  const { element: popover, body: menu, close: closeButton } = frame;
  frame.head.classList.add("opf-design-menu-head");
  frame.heading.classList.add("opf-design-menu-title");
  closeButton.classList.add("opf-design-menu-close");
  popover.firstChild.classList.add("opf-design-menu-handle");
  menu.classList.add("opf-design-menu-menu");
  const tabs = el(doc, "div", { class: "opf-panel-tabs opf-design-menu-tabs", role: "tablist", "aria-label": labels.title });
  // The tabs are in the document only while the panel is open, so a closed menu has no tabs for a screen reader (or a host's query) to find.
  const empty = el(doc, "p", { class: "opf-panel-empty opf-design-menu-empty", text: labels.empty, hidden: true });
  const moreRow = el(doc, "button", { type: "button", class: "opf-panel-row opf-design-menu-item opf-design-menu-more", tabindex: "-1", text: labels.more, hidden: typeof options.onOpenPanel !== "function" });
  const undoButton = el(doc, "button", { type: "button", class: "opf-panel-button", text: labels.undo, hidden: true });
  frame.foot.append(undoButton);
  menu.append(empty);
  const scrim = el(doc, "div", { class: "opf-panel-scrim opf-design-menu-scrim", hidden: true });
  const live = el(doc, "div", { class: "opf-design-menu-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const root = el(doc, "div", { class: "opf-design-menu opf-ui", "data-density": density, "data-mode": mode }, trigger, popover, scrim, live);
  container.append(root);

  // The font filter: it narrows the Fonts list by name.
  const filterInput = el(doc, "input", { type: "text", "aria-label": labels.filterFonts, autocomplete: "off", spellcheck: "false", "aria-controls": `${id}-fonts-menu` });
  const filter = el(doc, "label", { class: "opf-panel-field opf-design-menu-filter" }, lucide(doc, "Search", 14), filterInput);
  const noFonts = el(doc, "p", { class: "opf-panel-empty", hidden: true });

  // One entry per section: its tab, panel, label and menu, and its rows (by option id), rebuilt only when the choices themselves change.
  const sections = SECTIONS.map((spec) => {
    // A tab shows its section's name; its accessible name also says the current choice ("Theme Classic"), as the phone's switch did.
    const name = el(doc, "span", { class: "opf-design-menu-tab-label", id: `${id}-${spec.key}-tab-label`, text: spec.slide ? labels.layoutTab : labels[spec.labelKey] });
    const value = el(doc, "span", { class: "opf-design-menu-tab-value" });
    const tab = el(doc, "button", { type: "button", role: "tab", class: "opf-panel-tab opf-design-menu-tab", id: `${id}-${spec.key}-tab`, "aria-selected": "false", "aria-controls": `${id}-${spec.key}-group`, tabindex: "-1", "data-section": spec.key, hidden: true }, name, value);
    const heading = panelLabel(doc, "", { class: "opf-design-menu-group-label" });
    const list = el(doc, "div", { class: "opf-panel-list opf-design-menu-list", role: "menu", id: `${id}-${spec.key}-menu`, "aria-label": labels[spec.labelKey], "data-section": spec.key });
    const group = el(doc, "div", { class: "opf-design-menu-group", role: "tabpanel", "aria-labelledby": name.id, "data-section": spec.key, id: `${id}-${spec.key}-group`, hidden: true },
      ...(spec.key === "fonts" ? [filter, noFonts] : [heading]), list);
    menu.append(group);
    tabs.append(tab);
    return { ...spec, group, list, tab, value, heading, rows: new Map(), signature: undefined, count: 0 };
  });
  const fontSection = sections[2];
  menu.append(moreRow);
  /** The section the panel shows, remembered from one opening to the next. */
  let active = "theme";
  const activeSection = () => sections.find((section) => section.key === active);
  function showSection(key, { focus = false } = {}) {
    const visible = sections.filter((section) => !section.tab.hidden);
    const chosen = visible.find((section) => section.key === key) ?? visible[0];
    if (!chosen) return;
    const changed = active !== chosen.key;
    active = chosen.key;
    for (const section of sections) {
      const on = section === chosen;
      section.group.hidden = !on;
      section.group.toggleAttribute("data-active", on);
      section.tab.setAttribute("aria-selected", String(on));
      section.tab.tabIndex = on ? 0 : -1;
    }
    rove();
    paintFoot();
    if (focus) chosen.tab.focus();
    // The section opens at its current choice.
    if (changed || focus) {
      menu.scrollTop = 0;
      chosen.list.querySelector("[aria-checked='true']")?.scrollIntoView?.({ block: "nearest" });
    }
    if (isOpen) place();
  }
  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".opf-design-menu-tab");
    if (tab) showSection(tab.dataset.section, { focus: true });
  });
  tabs.addEventListener("keydown", (event) => {
    const visible = sections.filter((section) => !section.tab.hidden);
    const focused = visible.findIndex((section) => section.tab === event.target);
    const at = focused >= 0 ? focused : visible.findIndex((section) => section.key === active);
    const rtl = win?.getComputedStyle(tabs).direction === "rtl";
    let to;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") to = at + ((event.key === "ArrowRight") !== rtl ? 1 : -1);
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = visible.length - 1;
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      focusItem(activeSection().key === "fonts" ? filterInput : (current() ?? items()[0]));
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    showSection(visible[(to + visible.length) % visible.length]?.key, { focus: true });
  });

  // ---- rows ---------------------------------------------------------------------------------------------------------------------------
  const schemeRecords = new Map();
  const fontRecords = new Map();
  const loadedFamilies = () => {
    const families = new Set();
    try {
      for (const face of doc.fonts ?? []) if (face.status === "loaded") families.add(String(face.family).replace(/^["']|["']$/g, ""));
    } catch { /* an old engine without iterable FontFaceSet: names stay plain */ }
    return families;
  };
  // A font scheme's sample and name in its own heading face, once that face is loaded in this document. Otherwise they stay in the UI font.
  function paintFaces() {
    const loaded = loadedFamilies();
    for (const row of fontSection.rows.values()) {
      const family = row.dataset.major;
      for (const node of row.querySelectorAll(".opf-design-menu-label, .opf-design-menu-sample")) {
        if (family && loaded.has(family)) node.style.fontFamily = `"${family.replace(/["\\]/g, "")}", var(--opf-ui-font)`;
        else node.style.removeProperty("font-family");
      }
    }
  }

  // A small slide in the theme's own colors: its background, a title bar, two lines of text and an accent.
  function themeThumb(record) {
    const scheme = schemeRecords.get(idOf(record.colorScheme)) ?? {};
    const slot = typeof record.background?.slot === "string" ? record.background.slot : "light1";
    const dark = /^dark/.test(slot);
    const ink = cssColor(scheme[dark ? "light1" : "dark1"]);
    const line = () => paint(el(doc, "span", { class: "opf-design-menu-thumb-line" }), ink);
    return paint(el(doc, "span", { class: "opf-design-menu-thumb", "aria-hidden": "true" },
      paint(el(doc, "span", { class: "opf-design-menu-thumb-title" }), ink), line(), line(),
      paint(el(doc, "span", { class: "opf-design-menu-thumb-accent" }), cssColor(scheme.accent1))), cssColor(scheme[slot]));
  }
  // A schematic of a layout from its record: the title as a bar, each region as a block, nested regions in their own direction, sized by
  // their share. What a region holds shapes its block: a picture, chart, table or diagram fills it in the accent, metrics are three accent
  // tiles, a group of cards three tiles, a list or text three lines, a supporting region is quiet.
  function layoutThumb(record) {
    const block = (region) => {
      if (Array.isArray(region.regions)) return el(doc, "span", { class: "opf-design-menu-thumb-row", "data-direction": region.direction === "column" ? "column" : "row", style: grow(region) }, ...region.regions.filter(isObject).map(block));
      const accepts = Array.isArray(region.accepts) ? region.accepts : [];
      const first = accepts[0];
      const shape = region.role === "media" || ["image", "video", "chart", "table", "diagram", "code", "timeline"].includes(first) ? "fill"
        : first === "metric" ? "metrics" : accepts.includes("group") && (accepts.includes("metric") || accepts.includes("image")) ? "tiles"
        : first === "list" || first === "text" || first === "quote" ? "lines" : "fill";
      const parts = shape === "metrics" || shape === "tiles" || shape === "lines" ? [0, 1, 2].map(() => el(doc, "span", { class: "opf-design-menu-thumb-part" })) : [];
      return el(doc, "span", { class: "opf-design-menu-thumb-block", "data-shape": shape, "data-tone": shape === "fill" && first !== "text" ? "accent" : region.role === "supporting" ? "quiet" : "plain", style: grow(region) }, ...parts);
    };
    const grow = (region) => (typeof region.share === "number" && region.share > 0 ? `flex-grow:${region.share}` : region.size === "auto" || region.role === "supporting" ? "flex-grow:0.5" : undefined);
    const regions = (Array.isArray(record.regions) ? record.regions : []).filter(isObject);
    const title = regions.find((region) => region.name === "title");
    const rest = regions.filter((region) => region !== title);
    return el(doc, "span", { class: "opf-design-menu-thumb", "aria-hidden": "true", "data-section": "layout" },
      title ? el(doc, "span", { class: "opf-design-menu-thumb-title", "data-alone": rest.length ? undefined : "true" }) : null,
      rest.length ? el(doc, "span", { class: "opf-design-menu-thumb-row", "data-direction": record.direction === "row" ? "row" : "column" }, ...rest.map(block)) : null);
  }

  function buildRow(section, option, index) {
    const record = isObject(option.record) ? option.record : {};
    const nameId = `${id}-${section.key}-${index}`;
    const name = el(doc, "span", { class: "opf-panel-name opf-design-menu-label", id: nameId, text: option.label });
    const parts = [];
    let sub;
    if (section.key === "theme") {
      const words = [schemeRecords.get(idOf(record.colorScheme)), fontRecords.get(idOf(record.fontScheme))].map((entry) => entry?.label).filter(Boolean).join(" · ");
      sub = words ? el(doc, "span", { class: "opf-design-menu-sub", id: `${nameId}-sub`, text: words }) : null;
      parts.push(themeThumb(record), el(doc, "span", { class: "opf-design-menu-names" }, name, sub));
    } else if (section.key === "colors") {
      const strip = el(doc, "span", { class: "opf-design-menu-swatches", "aria-hidden": "true" });
      for (const slot of ["accent1", "accent2", "accent3", "accent4"]) if (cssColor(record[slot])) strip.append(paint(el(doc, "span", { class: "opf-design-menu-swatch" }), record[slot]));
      parts.push(strip.childElementCount ? strip : null, name);
    } else if (section.key === "fonts") parts.push(el(doc, "span", { class: "opf-design-menu-sample", "aria-hidden": "true", text: "Ag" }), name);
    else parts.push(layoutThumb(record), name);
    const tip = [record.summary, record.description].find((text) => typeof text === "string" && text) ?? "";
    const row = el(doc, "button", { type: "button", class: "opf-panel-row opf-design-menu-item", role: "menuitemradio", "aria-checked": "false", "aria-labelledby": nameId, "aria-describedby": sub ? sub.id : undefined, tabindex: "-1", "data-section": section.key, "data-value": option.id, title: tip || false },
      ...parts, el(doc, "span", { class: "opf-panel-check opf-design-menu-check" }, icon(doc, "Check", 14, icons.check)));
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

  // The deck's language and the font schemes for it: a scheme for the script slot the language writes in (Latin, East Asian or complex
  // script), and for a language-specific scheme one that names the language. With none for the language, the Latin schemes.
  let language = { name: "", bcp47: "en-US" };
  let fontsInUse = null;
  function fontsFor(deck, entries) {
    let script = { bcp47: "en-US", scriptRole: "latin" };
    try {
      script = resolveScriptFonts(deck ?? {}, { catalogs: catalogsNow() });
    } catch { /* an unreadable language: the Latin schemes */ }
    let name = script.bcp47;
    try {
      name = new Intl.DisplayNames([doc.documentElement.lang || "en"], { type: "language" }).of(script.bcp47) ?? name;
    } catch { /* no display names: the tag */ }
    language = { name, bcp47: script.bcp47 };
    const primary = script.bcp47.split("-")[0].toLowerCase();
    const slot = { latin: "latin", eastAsian: "ea", complexScript: "cs" }[script.scriptRole] ?? "latin";
    const family = (entry) => normalizeLanguageFamily(entry.record?.languageFamily) ?? "latin";
    const serves = (entry) => {
      const tags = Array.isArray(entry.record?.languages) ? entry.record.languages : [];
      return !tags.length || tags.some((tag) => typeof tag === "string" && (tag === script.bcp47 || tag.split("-")[0].toLowerCase() === primary));
    };
    const own = entries.filter((entry) => family(entry) === slot && (slot === "latin" || serves(entry)));
    return own.length ? own : entries.filter((entry) => family(entry) === "latin");
  }

  // The rows of the font section: the scheme in use first, then the others by type.
  function buildFonts(entries, current) {
    const group = (key, text, rows) => {
      const label = panelLabel(doc, text, { id: `${id}-fonts-${key}` });
      return el(doc, "div", { class: "opf-design-menu-font-group", role: "group", "aria-labelledby": label.id, "data-type": key }, label, ...rows);
    };
    const typeOf = (entry) => (FONT_TYPES.includes(entry.record?.type) ? entry.record.type : "other");
    const inUse = entries.filter((entry) => entry.id === current);
    const groups = inUse.length ? [group("in-use", labels.inUse, inUse.map((entry) => fontSection.rows.get(entry.id)))] : [];
    for (const type of [...FONT_TYPES, "other"]) {
      const rows = entries.filter((entry) => entry.id !== current && typeOf(entry) === type).map((entry) => fontSection.rows.get(entry.id));
      if (rows.length) groups.push(group(type, labels.fontTypes?.[type] ?? DEFAULT_LABELS.fontTypes[type], rows));
    }
    return groups;
  }
  function applyFilter() {
    const query = filterInput.value.trim().toLowerCase();
    let any = false;
    for (const node of fontSection.list.querySelectorAll(".opf-design-menu-font-group")) {
      let some = false;
      for (const row of node.querySelectorAll(".opf-design-menu-item")) {
        const hit = !query || row.querySelector(".opf-design-menu-label").textContent.toLowerCase().includes(query);
        row.hidden = !hit;
        some ||= hit;
      }
      node.hidden = !some;
      any ||= some;
    }
    noFonts.hidden = any;
    noFonts.textContent = any ? "" : labels.noFonts(filterInput.value.trim());
    rove();
  }
  filterInput.addEventListener("input", applyFilter);
  filterInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      focusItem(items()[0]);
    } else if (event.key === "Escape" && filterInput.value) {
      event.preventDefault();
      event.stopPropagation();
      filterInput.value = "";
      applyFilter();
    }
  });

  function paintMenu() {
    if (destroyed) return;
    const deck = deckNow();
    const catalogs = catalogsNow();
    const lists = {};
    for (const section of sections) lists[section.key] = listSwitchOptions(deck, section.dimension, { catalogs });
    // Colors and fonts are read before the theme rows are drawn, so a theme shows the scheme it brings and names its fonts.
    for (const entry of lists.colors) schemeRecords.set(entry.id, { ...entry.record, label: entry.label });
    for (const entry of lists.fonts) fontRecords.set(entry.id, entry);
    const focused = popover.contains(doc.activeElement) ? doc.activeElement : null;
    const focusedKey = focused?.dataset?.value !== undefined ? `${focused.dataset.section}|${focused.dataset.value}` : focused === moreRow ? "more" : null;
    const hasSlides = Array.isArray(deck?.slides) && deck.slides.length > 0;
    let any = false;
    for (const section of sections) {
      const current = currentOf(deck, section, { themes: lists.theme });
      const entries = section.key === "fonts" ? fontsFor(deck, lists.fonts) : lists[section.key];
      const visible = entries.length > 0 && (!section.slide || hasSlides);
      section.tab.hidden = !visible;
      if (!visible) {
        section.group.hidden = true;
        continue;
      }
      any = true;
      // "In use" is the scheme in use when the panel opened: a choice moves the check, not the rows.
      if (section.key === "fonts" && fontsInUse === null) fontsInUse = current;
      const signature = JSON.stringify([entries.map((entry) => [entry.id, entry.label, section.key === "theme" ? [idOf(entry.record?.colorScheme), idOf(entry.record?.fontScheme)] : undefined]), section.key === "fonts" ? fontsInUse : undefined]);
      if (signature !== section.signature) {
        section.signature = signature;
        section.rows = new Map(entries.map((entry, index) => [entry.id, buildRow(section, entry, index)]));
        if (section.key === "fonts") section.list.replaceChildren(...buildFonts(entries, fontsInUse));
        else section.list.replaceChildren(...section.rows.values());
      }
      for (const [value, row] of section.rows) row.setAttribute("aria-checked", String(value === current));
      section.current = current;
      section.count = entries.length;
      section.value.textContent = section.rows.get(current)?.querySelector(".opf-design-menu-label")?.textContent ?? "";
      if (section.key === "fonts") filterInput.placeholder = labels.filterPlaceholder(entries.length);
      else section.heading.textContent = labels.count(section.key, entries.length, slideNow());
    }
    empty.hidden = any;
    tabs.hidden = !any;
    root.toggleAttribute("data-empty", !any);
    applyFilter();
    showSection(active);
    paintFaces();
    if (focusedKey && popover.contains(doc.activeElement) === false) {
      const row = focusedKey === "more" ? moreRow : [...menu.querySelectorAll("[data-value]")].find((item) => `${item.dataset.section}|${item.dataset.value}` === focusedKey);
      row?.focus({ preventScroll: true });
    }
  }

  // The foot: what the last choice did, with Undo; else the open section's hint (the deck's language on Fonts).
  function paintFoot() {
    const hint = active === "theme" ? labels.themeHint : active === "fonts" && language.name ? labels.fontsFor(language.name) : "";
    frame.note.textContent = status || hint;
    undoButton.hidden = !(status && undoable);
    frame.foot.hidden = !frame.note.textContent;
  }

  // ---- applying a choice ---------------------------------------------------------------------------------------------------------------
  function choose(section, option) {
    if (destroyed || disabled || readOnly) return;
    // The checked row is what is in effect: choosing it again changes nothing (a theme would otherwise reset its bundled colors and fonts).
    if (option.id === section.current) {
      status = labels.already(option.label);
      undoable = false;
      say(status);
      paintFoot();
      return;
    }
    applying = true;
    try {
      const change = switchDimension(editor, section.dimension, option.id, {
        catalogs: catalogsNow(),
        ...(section.slide ? { slideIndex: slideNow() } : {}),
        meta: { source: SOURCE },
      });
      undoable = change.changed !== false && typeof editor.undo === "function";
      status = change.changed === false ? labels.already(option.label) : `${labels.applied(section.key, option.label)}${change.shadowed?.length ? ` ${labels.shadowed(change.shadowed.length)}` : ""}`;
    } catch (error) {
      undoable = false;
      status = error?.message ?? String(error);
    } finally {
      applying = false;
    }
    say(status);
    if (isOpen) paintMenu();
  }
  undoButton.addEventListener("click", () => {
    if (!undoable) return;
    undoable = false;
    editor.undo();
    status = labels.undone;
    say(status);
    paintFoot();
    (current() ?? closeButton).focus();
  });

  // ---- open, close, position ---------------------------------------------------------------------------------------------------------
  const media = win?.matchMedia?.(PANEL_SHEET_QUERY);
  // A button that is hidden (the toolbar moved it into its overflow menu) cannot anchor a popover, and a fixed child of a hidden parent is not drawn either.
  const anchored = () => shown(trigger);
  const anchorNow = () => {
    const given = typeof options.anchor === "function" ? options.anchor() : options.anchor;
    return shown(given) ? given : anchored() ? trigger : null;
  };
  // The panel then borrows a surface of its own on the page body, and goes back into the part when it closes.
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
  function place() {
    if (!isOpen) return;
    const anchor = anchorNow();
    mode = media?.matches || !anchor ? "sheet" : "popover";
    (portal ?? root).dataset.mode = mode;
    root.dataset.mode = mode;
    popover.setAttribute("aria-modal", String(mode === "sheet"));
    scrim.hidden = mode !== "sheet";
    placePanel(popover, anchor, mode === "sheet");
  }
  // The rows of the open section that are on screen, then the More row.
  const items = () => [...activeSection().list.querySelectorAll("[role='menuitemradio']"), moreRow].filter((item) => !item.hidden && !item.closest("[hidden]"));
  const current = () => items().find((item) => item.getAttribute("aria-checked") === "true");
  // One row of the open section is in the Tab order: the focused one, else the current choice, else the first.
  function rove(to) {
    const list = items();
    const keep = to ?? (list.includes(doc.activeElement) ? doc.activeElement : current() ?? list[0]);
    for (const section of sections) for (const row of section.rows.values()) row.tabIndex = row === keep ? 0 : -1;
    moreRow.tabIndex = moreRow === keep ? 0 : -1;
  }
  function focusItem(item) {
    if (!item) return;
    if (item !== filterInput) rove(item);
    item.focus();
    item.scrollIntoView?.({ block: "nearest" });
  }
  const swapClose = () => close({ restoreFocus: false });
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
  // A change of the open panel's size (another section, the font filter) lays it out again, on the next frame.
  const resizer = win?.ResizeObserver ? new win.ResizeObserver(() => win.requestAnimationFrame(onReflow)) : null;

  function open() {
    if (destroyed || disabled || readOnly || isOpen) return;
    claimPanel(doc, swapClose);
    opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    isOpen = true;
    status = "";
    undoable = false;
    filterInput.value = "";
    fontsInUse = null;
    usePortal(!anchored());
    paintMenu();
    frame.head.after(tabs);
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    place();
    doc.addEventListener("pointerdown", onDocPointer, true);
    doc.addEventListener("keydown", onDocKey);
    win?.addEventListener("resize", onReflow);
    win?.addEventListener("scroll", onReflow, true);
    doc.fonts?.addEventListener?.("loadingdone", onFaces);
    resizer?.observe(popover);
    focusItem(current() ?? items()[0] ?? closeButton);
  }
  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    releasePanel(doc, swapClose);
    popover.hidden = true;
    tabs.remove();
    scrim.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    doc.removeEventListener("pointerdown", onDocPointer, true);
    doc.removeEventListener("keydown", onDocKey);
    win?.removeEventListener("resize", onReflow);
    win?.removeEventListener("scroll", onReflow, true);
    doc.fonts?.removeEventListener?.("loadingdone", onFaces);
    resizer?.disconnect();
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
  popover.addEventListener("focusin", (event) => {
    if (items().includes(event.target)) rove(event.target);
  });
  popover.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.key === "Tab") {
      // Tab moves through the panel's controls; from the last one (Shift+Tab from the first) the focus leaves and the popover closes. The sheet keeps it.
      if (!tabWithin(popover, event, mode === "sheet")) close({ restoreFocus: false });
      return;
    }
    const list = items();
    const index = list.indexOf(doc.activeElement);
    if (index < 0) return;
    // In a grid (Colors, Layout) Up and Down move by a row and Left and Right by one; in a list Left and Right do nothing.
    const grid = win.getComputedStyle(activeSection().list).display === "grid";
    const columns = grid ? win.getComputedStyle(activeSection().list).gridTemplateColumns.split(" ").length : 1;
    const rtl = win.getComputedStyle(popover).direction === "rtl";
    const rows = list.filter((item) => item !== moreRow);
    let target;
    if (event.key === "ArrowDown") target = doc.activeElement === moreRow ? moreRow : (rows[index + columns] ?? (index >= rows.length - columns ? list[list.length - 1] : rows[rows.length - 1]));
    else if (event.key === "ArrowUp") target = doc.activeElement === moreRow ? rows[rows.length - 1] : index - columns >= 0 ? rows[index - columns] : active === "fonts" ? filterInput : tabs.querySelector("[aria-selected='true']");
    else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && grid && doc.activeElement !== moreRow) target = rows[index + ((event.key === "ArrowRight") !== rtl ? 1 : -1)];
    else if (event.key === "Home") target = list[0];
    else if (event.key === "End") target = list[list.length - 1];
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Typeahead: the next row whose name starts with what was typed.
      typed += event.key.toLowerCase();
      win.clearTimeout(typedTimer);
      typedTimer = win.setTimeout(() => { typed = ""; }, 600);
      const from = typed.length === 1 ? index + 1 : Math.max(index, 0);
      const ordered = [...list.slice(from), ...list.slice(0, from)];
      target = ordered.find((item) => (item.querySelector(".opf-design-menu-label") ?? item).textContent.trim().toLowerCase().startsWith(typed));
      if (!target) return;
    } else return;
    event.preventDefault();
    if (target === filterInput || target?.getAttribute("role") === "tab") target.focus();
    else if (target) focusItem(target);
  });

  const unsubscribe = editor.subscribe(() => {
    if (destroyed) return;
    // Undo undoes the menu's own edit only: any other change since takes it away.
    if (!applying) undoable = false;
    if (isOpen) paintMenu();
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
      if (isOpen) { paintMenu(); place(); }
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
      resizer?.disconnect();
      win?.clearTimeout(typedTimer);
      root.remove();
    },
  };
}
