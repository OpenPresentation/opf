// The shape picker (SH-06): the DOM control that chooses one of the 187 preset shapes, laid out as PowerPoint's Insert > Shapes gallery (Lines,
// Rectangles, Basic Shapes, Block Arrows, Equation Shapes, Flowchart, Stars and Banners, Callouts, Action Buttons), with a search over the DrawingML
// name, the Aspose name and common words (arrow, callout, star, flowchart, speech bubble, cylinder...). Each tile is drawn from the preset's own
// geometry (`presetGeometry`, loaded on first use), so it shows the shape PowerPoint draws. `createShapePicker` is the control alone (an `onPick`
// callback, no document state); `createShapeMenu` puts it in a popover under a button, to insert a shape or change one's preset. Keyboard: the search
// takes focus, Enter picks the first match, the arrow keys move between tiles, Escape closes the menu. Importing this module needs no DOM; mounting does.
import { SHAPE_CATEGORIES, searchShapeCatalog, shapeCatalogEntry, shapeThumbnail, shapesInCategory } from "@openpresentation/opf/shape-catalog";
import { presetAspect } from "@openpresentation/opf/composition";
import { loadShapeEngine } from "./shape-engine.js";
import { shapeLabel } from "./shape-options.js";

const SVG = "http://www.w3.org/2000/svg";
let instances = 0;
const thumbnails = new Map();

/** The drawing of a preset (`{ viewBox, paths }`), cached: its geometry at the preset's default frame, fitted in a 48-unit box. */
function thumbnailOf(engine, name) {
  let thumb = thumbnails.get(name);
  if (!thumb) {
    const aspect = presetAspect(name);
    const width = aspect >= 1 ? 48 : 48 * aspect;
    const height = aspect >= 1 ? 48 / aspect : 48;
    thumb = shapeThumbnail(engine.presetGeometry(name, width, height), width, height);
    thumbnails.set(name, thumb);
  }
  return thumb;
}

/** An `<svg class="opf-sp-thumb" aria-hidden>` of a preset, from its geometry. */
export function shapeThumbnailNode(doc, engine, name, size = 32) {
  const thumb = thumbnailOf(engine, name);
  const svg = doc.createElementNS(SVG, "svg");
  for (const [key, value] of Object.entries({ viewBox: thumb.viewBox, width: size, height: size, "aria-hidden": "true", focusable: "false", class: "opf-sp-thumb", preserveAspectRatio: "xMidYMid meet" })) svg.setAttribute(key, String(value));
  for (const part of thumb.paths) {
    const path = doc.createElementNS(SVG, "path");
    path.setAttribute("d", part.d);
    path.setAttribute("data-fill", part.fill);
    if (!part.stroke) path.setAttribute("data-nostroke", "");
    svg.append(path);
  }
  return svg;
}

/**
 * Mount the picker into `container` and return `{ element, focus, setSelected, refresh, destroy }`.
 *
 * Options: `onPick(name, entry)` (called with the preset's DrawingML name and its catalog entry), `selected` (the preset to mark; `setSelected`
 * changes it), `idPrefix` (to keep ids unique when there are several), `autofocus` (focus the search on mount), `labels`
 * (`{ search, none }` texts). The tiles appear once the preset geometry has loaded, a few milliseconds the first time.
 */
export function createShapePicker(container, options = {}) {
  if (!container || typeof container.appendChild !== "function") throw new TypeError("createShapePicker needs a container element.");
  const doc = container.ownerDocument;
  const uid = `${options.idPrefix ?? "opf-sp"}-${++instances}`;
  const state = { query: "", selected: options.selected, engine: undefined, destroyed: false };
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

  const searchId = `${uid}-search`;
  const search = h("input", { id: searchId, type: "search", "data-role": "shape-search", placeholder: "arrow, callout, star, flowchart…", autocomplete: "off", spellcheck: "false", "aria-controls": `${uid}-results` });
  const count = h("p", { class: "opf-sp-count", role: "status", "aria-live": "polite", "data-role": "shape-count" });
  const results = h("div", { class: "opf-sp-results", id: `${uid}-results`, "data-role": "shape-results" });
  const root = h("div", { class: "opf-shape-picker", "data-opf-component": "shape-picker" }, h("div", { class: "opf-dc-field" }, h("label", { for: searchId }, options.labels?.search ?? "Search shapes"), search), count, results);
  container.appendChild(root);

  function tile(name) {
    const entry = shapeCatalogEntry(name);
    const label = shapeLabel(name);
    const button = h("button", { type: "button", class: "opf-sp-tile", "data-shape": name, "aria-label": label, title: `${label} (${name})`, "aria-pressed": name === state.selected ? "true" : "false", tabindex: "-1" });
    button.append(shapeThumbnailNode(doc, state.engine, name));
    button.addEventListener("click", () => options.onPick?.(name, entry));
    return button;
  }

  function draw() {
    if (state.destroyed || !state.engine) return;
    const query = state.query;
    if (query === "") {
      results.replaceChildren(
        ...SHAPE_CATEGORIES.map((category) => {
          const heading = h("h4", { class: "opf-sp-heading", id: `${uid}-${category.id}` }, category.title);
          const grid = h("div", { class: "opf-sp-grid", role: "group", "aria-labelledby": heading.id }, shapesInCategory(category.id).map((entry) => tile(entry.name)));
          return h("section", { class: "opf-sp-group", "data-category": category.id }, heading, grid);
        }),
      );
      count.textContent = "187 shapes in 9 groups";
    } else {
      const found = searchShapeCatalog(query);
      results.replaceChildren(h("div", { class: "opf-sp-grid", role: "group", "aria-label": "Matching shapes" }, found.map((result) => tile(result.entry.name))));
      count.textContent = found.length === 0 ? `No shapes match "${query}".` : `${found.length} shape${found.length === 1 ? "" : "s"}`;
    }
    const selected = results.querySelector('[aria-pressed="true"]');
    (selected ?? results.querySelector(".opf-sp-tile"))?.setAttribute("tabindex", "0");
  }

  const tiles = () => [...results.querySelectorAll(".opf-sp-tile")];
  function move(from, key) {
    const all = tiles();
    const at = all.indexOf(from);
    let next;
    if (key === "ArrowRight") next = all[at + 1];
    else if (key === "ArrowLeft") next = all[at - 1];
    else if (key === "Home") next = all[0];
    else if (key === "End") next = all.at(-1);
    else {
      // Up and down: the tile in the nearest row above or below whose center is nearest this one's.
      const box = from.getBoundingClientRect();
      const direction = key === "ArrowDown" ? 1 : -1;
      const candidates = all.filter((node) => (node.getBoundingClientRect().top - box.top) * direction > box.height / 2);
      if (candidates.length) {
        const row = direction > 0 ? Math.min(...candidates.map((node) => node.getBoundingClientRect().top)) : Math.max(...candidates.map((node) => node.getBoundingClientRect().top));
        next = candidates.filter((node) => Math.abs(node.getBoundingClientRect().top - row) < 2).sort((a, b) => Math.abs(a.getBoundingClientRect().left - box.left) - Math.abs(b.getBoundingClientRect().left - box.left))[0];
      }
    }
    if (!next) return;
    for (const node of all) node.setAttribute("tabindex", node === next ? "0" : "-1");
    next.focus();
  }
  results.addEventListener("keydown", (event) => {
    const tileNode = event.target.closest?.(".opf-sp-tile");
    if (tileNode && ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      move(tileNode, event.key);
    }
  });
  search.addEventListener("input", () => {
    state.query = search.value.trim();
    draw();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      results.querySelector(".opf-sp-tile")?.click();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      (results.querySelector('.opf-sp-tile[tabindex="0"]') ?? results.querySelector(".opf-sp-tile"))?.focus();
    }
  });

  count.textContent = "Loading shapes…";
  const ready = loadShapeEngine().then((engine) => {
    state.engine = engine;
    draw();
    if (options.autofocus) search.focus();
  });
  ready.catch((error) => {
    if (!state.destroyed) count.textContent = `The shapes could not be loaded: ${error?.message ?? error}`;
  });

  return {
    element: root,
    /** Resolves once the tiles are drawn. */
    ready,
    focus: () => search.focus(),
    /** Mark the preset that is in use (undefined clears the mark). */
    setSelected(name) {
      state.selected = name;
      for (const node of tiles()) node.setAttribute("aria-pressed", node.dataset.shape === name ? "true" : "false");
    },
    /** Clear the search and show the gallery. */
    reset() {
      search.value = "";
      state.query = "";
      draw();
    },
    destroy() {
      state.destroyed = true;
      root.remove();
    },
  };
}

/**
 * A button's popover with the picker in it: `createShapeMenu(button, { onPick, selected, placements })` opens under the button on a click, closes on Escape, on a press
 * outside it and after a pick, and returns focus to the button. `open()`, `close()`, `toggle()` and `isOpen` drive it from outside; `setSelected(name)` marks the
 * preset in use. With `placements: true` the panel has a choice under the gallery, "In the layout" (a block composition places) or "On the slide" (an overlay shape you place
 * and size), remembered between picks, and `onPick(name, entry, { placement })` hears `block` or `overlay`. The panel is `position: fixed` under the button, so it is not clipped by a toolbar.
 */
export function createShapeMenu(button, options = {}) {
  if (!button?.ownerDocument) throw new TypeError("createShapeMenu needs the button that opens it.");
  const doc = button.ownerDocument;
  const win = doc.defaultView;
  const panel = doc.createElement("div");
  panel.className = "opf-shape-menu";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", options.label ?? "Shapes");
  panel.setAttribute("data-opf-component", "shape-menu");
  panel.hidden = true;
  doc.body.append(panel);
  let picker;
  let placement = options.placement ?? "block";
  let choice;
  if (options.placements) {
    const name = `opf-sm-place-${++instances}`;
    const radio = (value, label) => {
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      input.checked = value === placement;
      input.addEventListener("change", () => (placement = value));
      const text = doc.createElement("label");
      text.className = "opf-sm-choice";
      text.append(input, doc.createTextNode(` ${label}`));
      return text;
    };
    choice = doc.createElement("fieldset");
    choice.className = "opf-sm-place";
    choice.setAttribute("data-role", "shape-placement");
    const legend = doc.createElement("legend");
    legend.textContent = "Place the shape";
    choice.append(legend, radio("block", "In the layout"), radio("overlay", "On the slide"));
  }
  let open = false;
  const place = () => {
    const box = button.getBoundingClientRect();
    const width = Math.min(380, win.innerWidth - 16);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(box.left, win.innerWidth - width - 8))}px`;
    panel.style.top = `${box.bottom + 4}px`;
    panel.style.maxHeight = `${Math.max(240, win.innerHeight - box.bottom - 16)}px`;
  };
  const api = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      picker ??= createShapePicker(panel, {
        selected: options.selected,
        idPrefix: "opf-sm",
        onPick: (name, entry) => {
          api.close();
          options.onPick?.(name, entry, { placement });
        },
      });
      if (choice) panel.append(choice);
      picker.reset();
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      place();
      picker.focus();
    },
    close(restoreFocus = true) {
      if (!open) return;
      open = false;
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (restoreFocus) button.focus();
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    setSelected(name) {
      options.selected = name;
      picker?.setSelected(name);
    },
    destroy() {
      button.removeEventListener("click", onClick);
      doc.removeEventListener("pointerdown", onOutside, true);
      doc.removeEventListener("keydown", onKey, true);
      win.removeEventListener("resize", place);
      picker?.destroy();
      panel.remove();
    },
    element: panel,
  };
  const onClick = () => api.toggle();
  const onOutside = (event) => {
    if (open && !panel.contains(event.target) && !button.contains(event.target)) api.close(false);
  };
  const onKey = (event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      api.close();
    }
  };
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", onClick);
  doc.addEventListener("pointerdown", onOutside, true);
  doc.addEventListener("keydown", onKey, true);
  win.addEventListener("resize", place);
  return api;
}
