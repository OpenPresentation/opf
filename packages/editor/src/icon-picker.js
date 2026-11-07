// The icon picker (LH-166): the DOM control that sets, changes and removes the `icon` of the selected list entry, metric or group. It shows the
// icon the selection has, a "Choose icon" panel with a search over the icon sets the host registered (name and keywords, one set or all),
// the deck's own icons, and a box to paste an SVG, which goes into the deck's `icons` under a name and is referenced by it. Every choice
// is one undoable change through the session (`setIcon`, `setSvgIcon`, `removeIcon` of ./icon-options.js); an SVG that cannot be an icon is
// refused with the opf/icon-invalid finding's message, shown under the box. The picker owns no document state: `refresh` re-reads the
// session and the selection after every change. Importing this module needs no DOM; mounting does. No Node imports, no network.
import { mergeCatalogs } from "./catalogs.js";
import {
  deckIcons, iconGlyph, iconTargetForSelection, listIconSets, loadIconSets, readIcon, removeIcon, searchIcons, setIcon, setIconGlyph, setSvgIcon,
} from "./icon-options.js";
import { parseIconReference } from "@openpresentation/opf";

const SVG = "http://www.w3.org/2000/svg";
let instances = 0;
const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);
const TARGET_LABELS = { item: "List entry icon", metric: "Metric icon", group: "Group icon" };

/** An `<svg class="opf-ip-glyph" aria-hidden>` for plain glyph data (`setIconGlyph`, `iconGlyph`), or an `<img>` for a multicolor picture. */
export function glyphNode(doc, glyph, size = 20) {
  if (glyph?.picture) {
    const image = doc.createElement("img");
    image.className = "opf-ip-glyph opf-ip-picture";
    image.alt = "";
    image.width = size;
    image.height = size;
    // An <img> never runs script; the SVG was read by core's intake first.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(glyph.picture.svg)}`;
    return image;
  }
  const svg = doc.createElementNS(SVG, "svg");
  for (const [key, value] of Object.entries({ viewBox: glyph?.viewBox ?? "0 0 24 24", width: size, height: size, "aria-hidden": "true", focusable: "false", class: "opf-ip-glyph" })) svg.setAttribute(key, String(value));
  for (const part of glyph?.parts ?? []) {
    const path = doc.createElementNS(SVG, "path");
    path.setAttribute("d", part.d);
    if (part.mode === "fill") {
      path.setAttribute("fill", "currentColor");
      path.setAttribute("stroke", "none");
      if (part.evenOdd) path.setAttribute("fill-rule", "evenodd");
    } else {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", String(part.strokeWidth ?? glyph.strokeWidth ?? 2));
      path.setAttribute("stroke-linecap", part.linecap ?? glyph.linecap ?? "round");
      path.setAttribute("stroke-linejoin", part.linejoin ?? glyph.linejoin ?? "round");
    }
    svg.append(path);
  }
  return svg;
}

/**
 * Mount the picker into `container` and return `{ element, refresh, open, close, destroy }`.
 *
 * Options: `editor` (an editor session), `getSelectedPath()` (the host's current selection; call `refresh()` when it changes), `catalogs`
 * (host catalogs, merged after the session's registered ones: their `iconSets` are what the search reads), `pageSize` (icons per page,
 * default 60), `onChange(change)`, `onStatus(message, { error })`. Without a selection that has an icon of its own (a list entry, a
 * metric or a group) the picker is hidden.
 */
export function createIconPicker(container, options = {}) {
  const editor = options.editor;
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw new TypeError("createIconPicker needs an editor session.");
  if (!container || typeof container.appendChild !== "function") throw new TypeError("createIconPicker needs a container element.");
  const doc = container.ownerDocument;
  const uid = `opf-ip-${++instances}`;
  const pageSize = Math.max(1, options.pageSize ?? 60);
  const catalogs = () => mergeCatalogs(editor.catalogs, options.catalogs);
  const source = () => ({ catalogs: catalogs(), presentation: editor.presentation });
  const state = { target: undefined, open: false, query: "", set: "", shown: pageSize, epoch: 0, destroyed: false };

  const h = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false || value === null) continue;
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, String(value));
    }
    for (const child of children.flat()) if (child !== undefined && child !== null && child !== false) node.append(child);
    return node;
  };
  const say = (message) => options.onStatus?.(message, { error: false });
  const complain = (message) => options.onStatus?.(message, { error: true });

  // --- the icon the selection has ------------------------------------------------------------------------------------------------
  const label = h("span", { class: "opf-dc-row-label", "data-role": "icon-label" }, "Icon");
  const preview = h("span", { class: "opf-ip-preview", "aria-hidden": "true" });
  const value = h("code", { class: "opf-ip-value", "data-role": "icon-value" }, "None");
  const choose = h("button", { type: "button", class: "secondary", "data-role": "icon-choose", "aria-expanded": "false", "aria-controls": `${uid}-panel` }, "Choose icon…");
  const remove = h("button", { type: "button", class: "quiet", "data-role": "icon-remove" }, "Remove");
  const current = h("div", { class: "opf-ip-current" }, label, h("span", { class: "opf-ip-now" }, preview, value), h("span", { class: "opf-ip-actions" }, choose, remove));

  // --- the panel: search, results, the deck's icons, a pasted SVG -----------------------------------------------------------------
  const searchId = `${uid}-search`, setId = `${uid}-set`, svgId = `${uid}-svg`, nameId = `${uid}-name`;
  const search = h("input", { id: searchId, type: "search", "data-role": "icon-search", placeholder: "truck, security, chart…", autocomplete: "off", spellcheck: "false", "aria-controls": `${uid}-results` });
  const setSelect = h("select", { id: setId, "data-role": "icon-set" });
  const count = h("p", { class: "opf-ip-count", role: "status", "aria-live": "polite", "data-role": "icon-count" });
  const results = h("div", { class: "opf-ip-results", id: `${uid}-results`, role: "group", "aria-label": "Icons", "data-role": "icon-results" });
  const more = h("button", { type: "button", class: "quiet", "data-role": "icon-more", hidden: true }, "Show more");
  const deckBox = h("div", { class: "opf-ip-deck", "data-role": "icon-deck", role: "group", "aria-label": "This deck's icons" });
  const svg = h("textarea", { id: svgId, rows: 5, "data-role": "icon-svg", placeholder: '<svg viewBox="0 0 24 24">…</svg>', autocomplete: "off", spellcheck: "false", "aria-describedby": `${uid}-svg-error` });
  const nameInput = h("input", { id: nameId, type: "text", "data-role": "icon-name", placeholder: "my-icon (optional)", autocomplete: "off", spellcheck: "false" });
  const svgError = h("p", { class: "opf-ip-error", id: `${uid}-svg-error`, role: "alert", "data-role": "icon-svg-error" });
  const apply = h("button", { type: "button", class: "secondary", "data-role": "icon-svg-apply" }, "Use this SVG");
  const paste = h(
    "details",
    { class: "opf-ip-paste", "data-role": "icon-paste" },
    h("summary", {}, "Paste an SVG"),
    h("div", { class: "opf-dc-field" }, h("label", { for: svgId }, "SVG source"), svg),
    h("div", { class: "opf-dc-field" }, h("label", { for: nameId }, "Name in this deck"), nameInput),
    svgError,
    h("div", { class: "opf-ip-actions" }, apply),
  );
  const panel = h(
    "div",
    { class: "opf-ip-panel", id: `${uid}-panel`, "data-role": "icon-panel", hidden: true },
    h("div", { class: "opf-dc-field" }, h("label", { for: searchId }, "Search icons"), search),
    h("div", { class: "opf-dc-field" }, h("label", { for: setId }, "Icon set"), setSelect),
    count,
    results,
    more,
    deckBox,
    paste,
  );
  const root = h("div", { class: "opf-icon-picker", "data-opf-component": "icon-picker", hidden: true }, current, panel);
  container.appendChild(root);

  const tile = (reference, name, glyph, title, pressed) => {
    const button = h("button", { type: "button", class: "opf-ip-tile", "data-icon": reference, "aria-label": title, title, "aria-pressed": pressed ? "true" : "false" }, glyphNode(doc, glyph, 22));
    button.addEventListener("click", () => pick(reference));
    return button;
  };

  /** Give the target this icon (a set's or a deck's), as one change. */
  function pick(reference) {
    const path = state.target?.path;
    if (!path) return;
    try {
      const change = setIcon(editor, path, reference);
      if (change.changed === false) say("That icon is already set. Nothing changed.");
      else say(`Icon set to ${reference}.`);
      options.onChange?.(change);
    } catch (error) {
      complain(messageOf(error));
    }
    refresh();
  }

  // --- search ------------------------------------------------------------------------------------------------------------------------
  async function runSearch() {
    const epoch = ++state.epoch;
    const sets = listIconSets(source());
    if (!sets.length) {
      results.replaceChildren();
      more.hidden = true;
      count.textContent = "No icon sets are registered here, so there is nothing to search. Paste an SVG instead, or register the sets (galleryIconSets of @openpresentation/gallery/icon-sets) with the host's catalogs.";
      return;
    }
    count.textContent = "Searching…";
    let found;
    try {
      found = await searchIcons(source(), state.query, { set: state.set || undefined, limit: state.shown });
    } catch (error) {
      if (epoch === state.epoch) count.textContent = messageOf(error);
      return;
    }
    if (epoch !== state.epoch || state.destroyed) return;
    const records = await loadIconSets(source(), found.sets.map((entry) => entry.id));
    if (epoch !== state.epoch || state.destroyed) return;
    const now = state.target ? readIcon(editor.presentation, state.target.path)?.icon : undefined;
    results.replaceChildren(
      ...found.icons.map((entry) => {
        const glyph = setIconGlyph(records.get(entry.set), entry.name);
        const title = `${entry.name} (${entry.set})${entry.tags.length ? `: ${entry.tags.slice(0, 4).join(", ")}` : ""}`;
        return tile(entry.icon, entry.name, glyph, title, entry.icon === now);
      }),
    );
    more.hidden = found.returned >= found.total;
    count.textContent = found.total === 0 ? `No icons match "${state.query}".` : `${found.returned} of ${found.total} icon${found.total === 1 ? "" : "s"}`;
    // The set choices (with their names) are known once a set loads.
    const wanted = JSON.stringify(listIconSets(source()).map((entry) => [entry.id, entry.name]));
    if (setSelect.dataset.signature !== wanted) {
      setSelect.dataset.signature = wanted;
      setSelect.replaceChildren(h("option", { value: "" }, "All sets"), ...listIconSets(source()).map((entry) => h("option", { value: entry.id }, `${entry.name}${entry.license ? ` (${entry.license})` : ""}`)));
      setSelect.value = state.set;
    }
  }

  function drawDeckIcons() {
    const list = deckIcons(editor.presentation, { catalogs: catalogs() });
    deckBox.hidden = list.length === 0;
    if (!list.length) return deckBox.replaceChildren();
    const now = state.target ? readIcon(editor.presentation, state.target.path)?.icon : undefined;
    deckBox.replaceChildren(
      h("span", { class: "opf-dc-row-label" }, "This deck's icons"),
      h("div", { class: "opf-ip-results" }, ...list.map((entry) => tile(entry.name, entry.name, iconGlyph(editor.presentation, entry.name, { catalogs: catalogs() }), `${entry.name} (this deck)`, entry.name === now))),
    );
  }

  // --- the current icon -----------------------------------------------------------------------------------------------------------
  async function drawCurrent() {
    const target = state.target, reference = target ? readIcon(editor.presentation, target.path)?.icon : undefined;
    preview.replaceChildren();
    value.textContent = reference ?? "None";
    if (!reference) return;
    let glyph = iconGlyph(editor.presentation, reference, { catalogs: catalogs() });
    if (!glyph && parseIconReference(reference)?.kind === "set") {
      // The set is registered but not loaded yet: load it, then draw (unless the selection moved on).
      await loadIconSets(source());
      if (state.destroyed || state.target?.path !== target.path) return;
      glyph = iconGlyph(editor.presentation, reference, { catalogs: catalogs() });
    }
    if (glyph) preview.replaceChildren(glyphNode(doc, glyph, 22));
  }

  function refresh() {
    if (state.destroyed) return;
    const selected = options.getSelectedPath?.();
    const found = selected ? iconTargetForSelection(editor.presentation, selected) : undefined;
    const read = found ? readIcon(editor.presentation, found.path) : undefined;
    const moved = state.target?.path !== found?.path;
    state.target = found;
    root.hidden = !found;
    if (!found) return;
    label.textContent = TARGET_LABELS[found.target] ?? "Icon";
    // A nested entry is never marked: it can lose an icon it has, not get one.
    choose.disabled = Boolean(read?.nested);
    choose.title = read?.nested ? "Icons mark first-level list entries; this entry is nested, so an icon would not be drawn." : "";
    remove.disabled = read?.icon === undefined;
    if (read?.nested && state.open) setOpen(false);
    // A new selection starts closed: the panel belongs to the entry, metric or group it was opened for.
    if (moved) {
      svgError.textContent = "";
      if (state.open) setOpen(false);
    }
    void drawCurrent();
    drawDeckIcons();
    if (state.open) {
      // Mark the chosen tile without redrawing the search the person is typing in.
      for (const node of root.querySelectorAll(".opf-ip-tile")) node.setAttribute("aria-pressed", node.dataset.icon === read?.icon ? "true" : "false");
    }
  }

  function setOpen(next) {
    state.open = next;
    panel.hidden = !next;
    choose.setAttribute("aria-expanded", String(next));
    if (next) {
      void runSearch();
      drawDeckIcons();
    }
  }

  // --- events -------------------------------------------------------------------------------------------------------------------
  choose.addEventListener("click", () => {
    setOpen(!state.open);
    if (state.open) search.focus();
  });
  remove.addEventListener("click", () => {
    const path = state.target?.path;
    if (!path) return;
    try {
      const change = removeIcon(editor, path);
      say(change.changed === false ? "There is no icon to remove." : "Icon removed.");
      options.onChange?.(change);
    } catch (error) {
      complain(messageOf(error));
    }
    refresh();
  });
  search.addEventListener("input", () => {
    state.query = search.value.trim();
    state.shown = pageSize;
    void runSearch();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      choose.focus();
    } else if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      results.querySelector(".opf-ip-tile")?.click();
    }
  });
  setSelect.addEventListener("change", () => {
    state.set = setSelect.value;
    state.shown = pageSize;
    void runSearch();
  });
  more.addEventListener("click", () => {
    state.shown += pageSize;
    void runSearch();
  });
  apply.addEventListener("click", () => {
    const path = state.target?.path;
    const text = svg.value.trim();
    svgError.textContent = "";
    if (!path) return;
    try {
      // An icon reference (lucide:truck, asset:logo, ./icon.svg) is set as written; SVG text is stored in the deck's icons and referenced by name.
      const change = text !== "" && !text.startsWith("<") && parseIconReference(text) ? setIcon(editor, path, text) : setSvgIcon(editor, path, text, nameInput.value.trim() === "" ? {} : { name: nameInput.value.trim() });
      svg.value = "";
      nameInput.value = "";
      say(change.name !== undefined ? `SVG saved as ${change.name} and set as the icon.` : `Icon set to ${change.icon}.`);
      options.onChange?.(change);
    } catch (error) {
      svgError.textContent = messageOf(error);
      complain(messageOf(error));
    }
    refresh();
  });

  const unsubscribe = editor.subscribe(() => refresh());
  refresh();

  return {
    element: root,
    refresh,
    open: () => setOpen(true),
    close: () => setOpen(false),
    destroy() {
      state.destroyed = true;
      unsubscribe?.();
      root.remove();
    },
  };
}
