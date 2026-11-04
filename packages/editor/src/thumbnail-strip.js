// Thumbnail strip (RR-98): a `nav` of real slide renders, each with a mono index and the slide title; the current one has `aria-current` and an
// accent ring. Thumbnails are drawn by the same renderer, catalogs and fonts handle the canvas uses, through the thumbnail cache: a slide whose
// content did not change is never rendered again, and the strip is lazy (items near the viewport render first, through IntersectionObserver when
// the browser has it). Plain DOM, no framework, no network.
//
// CE-29: with `actions: true` the strip also manages slides, for embeds that have neither the Sorter nor the Studio: a trailing "+" button
// adds a slide (through a layout menu when the host passes `layoutOptions`), and a context menu on each thumbnail (right-click, Shift+F10,
// the ContextMenu key) duplicates, deletes, hides or shows, and moves it (also Alt+Arrow and Delete on a focused thumbnail). Each action is
// one undoable session change from slides.js, the same functions the slide manager uses.
import { mergeCatalogs } from "./index.js";
import { toSvg } from "@openpresentation/opf-render/svg";
import { whenFontsReady } from "./font-gate.js";
import { normalizeIcons, resolveIcon } from "./icons.js";
import { addSlide, duplicateSlides, moveSlidesBy, removeSlides, setHidden, slideTitle } from "./slides.js";
import { groupLayoutChoices } from "./layout-templates.js";
import { createThumbnailCache } from "./thumbnail-cache.js";
import { clearContinuations, continuationOf, pageCount } from "./continuation.js";

const DEFAULT_LABELS = {
  navigation: "Slides",
  untitled: "Untitled",
  hidden: "hidden",
  unavailable: "Preview unavailable",
  /** LH-99: the page count of a slide the export continues on further pages. */
  pages: "{count} pages",
  add: "Add slide",
  layouts: "Layouts",
  slideActions: "Slide actions",
  duplicate: "Duplicate slide",
  delete: "Delete slide",
  hideSlide: "Hide in slide show",
  showSlide: "Show in slide show",
  moveLeft: "Move left",
  moveRight: "Move right",
  moveUp: "Move up",
  moveDown: "Move down",
  statusAdded: "Slide added at position {position}",
  statusDuplicated: "Slide duplicated",
  statusDeleted: "Slide deleted. {count} left",
  statusHidden: "Slide hidden from the slide show",
  statusShown: "Slide shown in the slide show",
  statusMoved: "Slide moved to position {position} of {count}",
  atStart: "Already the first slide",
  atEnd: "Already the last slide",
  lastSlide: "A presentation needs at least one slide",
};
const META = { source: "thumbnail-strip", rejectInvalid: true };
const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
const pad = (value, count) => String(value).padStart(Math.max(2, String(count).length), "0");

/**
 * Mount the thumbnail strip into `container`.
 *
 * Options: `editor` (required session), `fonts` (the renderer's fonts handle the canvas uses), `renderOptions` (extra `toSvg` options, such as
 * `catalogs`; the thumbnails always draw with `text: "system"` and `trace: false`), `slideIndex`, `onSelect(index)` (the user chose a slide),
 * `density` (`"comfortable"` or `"touch"`), `size` (thumbnail width in pixels; default 128, or 104 for touch), `orientation` (`"horizontal"`,
 * the default, or `"vertical"`), `labels` (`navigation`, `untitled`, `hidden`, `unavailable`), `cache` (a thumbnail cache to share; default:
 * its own), `lazy` (default true), `autoRefresh` (default true: follow the editor's changes on its own), `continuation` (default true: LH-99,
 * a slide the export continues on further pages (LH-90) is drawn as a stack of pages with its page count; its index does not change) and
 * `onError(error)`.
 *
 * Slide management (CE-29, off by default): `actions` (true adds the "+" button and the thumbnail context menu), `layoutOptions(presentation)`
 * (layout choices `{ id, label, record? }` for a layout menu behind "+"; without it, or when it returns none, "+" adds a slide directly after
 * the current one), `readOnly` (no "+", menu items disabled; change it with `setReadOnly`) and `onStatus(message)` (a screen-reader line
 * after each action; without it the strip announces in its own live region). `labels` also names every control and status line.
 *
 * Returns `{ element, getSlide(), setSlide(index), setReadOnly(readOnly), refresh({ clear }), destroy() }`.
 */
export function createThumbnailStrip(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { editor } = options;
  if (!editor || typeof editor.subscribe !== "function") throw new TypeError("createThumbnailStrip needs an editor session.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const icons = normalizeIcons(options.icons, ["add"], "createThumbnailStrip icons");
  const density = options.density === "touch" ? "touch" : "comfortable";
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  const size = Number(options.size) > 0 ? Number(options.size) : density === "touch" ? 104 : 128;
  const lazy = options.lazy !== false && typeof win?.IntersectionObserver === "function";
  const actions = options.actions === true;
  let readOnly = options.readOnly === true;

  // The renderer draws with the session's registered catalogs (plus any `renderOptions.catalogs`): the same list the canvas and core resolve with.
  const resolveOptions = () => ({ variables: false, ...(options.renderOptions ?? {}), catalogs: mergeCatalogs(editor.catalogs, options.renderOptions?.catalogs) });
  const cache = options.cache ?? createThumbnailCache({
    toSvg,
    getOptions: () => ({ ...resolveOptions(), fonts: options.fonts, text: "system", trace: false }),
  });

  let active = 0;
  let focusIndex = 0;
  let deck = editor.presentation;
  let disposed = false;
  let scheduled;
  let renderToken = 0;
  let observer;
  let menu;
  let addSlot;
  let addButton;
  let status;
  const visible = new Set();
  const items = [];

  const element = doc.createElement("nav");
  element.className = "opf-thumbs";
  element.dataset.orientation = orientation;
  element.dataset.density = density;
  element.setAttribute("aria-label", labels.navigation);
  if (actions) element.dataset.actions = "true";
  if (actions && readOnly) element.dataset.readonly = "true";
  element.style.setProperty("--opf-thumbs-w", `${size}px`);
  const list = doc.createElement("ol");
  list.className = "opf-thumbs-list";
  element.append(list);
  container.append(element);

  const clamp = (value, total) => (total === 0 ? 0 : Math.max(0, Math.min(total - 1, value)));
  active = clamp(Math.trunc(Number(options.slideIndex) || 0), deck.slides.length);
  focusIndex = active;

  function makeItem(index) {
    const li = doc.createElement("li");
    li.className = "opf-thumbs-slot";
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "opf-thumbs-item";
    button.dataset.index = String(index);
    const frame = doc.createElement("span");
    frame.className = "opf-thumbs-frame";
    frame.dataset.state = "pending";
    frame.setAttribute("aria-hidden", "true");
    const label = doc.createElement("span");
    label.className = "opf-thumbs-label";
    const indexNode = doc.createElement("span");
    indexNode.className = "opf-thumbs-index";
    const titleNode = doc.createElement("span");
    titleNode.className = "opf-thumbs-title";
    const note = doc.createElement("span");
    note.className = "opf-thumbs-note";
    const pages = doc.createElement("span");
    pages.className = "opf-thumbs-pages";
    pages.hidden = true;
    label.append(indexNode, " ", titleNode, note, pages);
    button.append(frame, label);
    li.append(button);
    return { li, button, frame, indexNode, titleNode, note, pages, index, html: undefined };
  }

  /** Grow or shrink to `count` slots, and write each slot's index, title and state. Cheap: no rendering. */
  function syncItems() {
    const slides = deck.slides;
    while (items.length < slides.length) {
      const item = makeItem(items.length);
      items.push(item);
      list.insertBefore(item.li, addSlot?.parentNode === list ? addSlot : null);
      observer?.observe(item.button);
    }
    while (items.length > slides.length) {
      const item = items.pop();
      observer?.unobserve(item.button);
      visible.delete(item.index);
      item.li.remove();
    }
    active = clamp(active, slides.length);
    focusIndex = clamp(focusIndex, slides.length);
    slides.forEach((slide, index) => {
      const item = items[index];
      const title = slideTitle(slide);
      item.indexNode.textContent = pad(index + 1, slides.length);
      item.titleNode.textContent = title || labels.untitled;
      item.titleNode.dataset.untitled = String(!title);
      item.note.textContent = slide.hidden === true ? ` ${labels.hidden}` : "";
      item.button.dataset.hidden = String(slide.hidden === true);
    });
    paintActive();
  }
  function paintActive() {
    items.forEach((item, index) => {
      if (index === active) item.button.setAttribute("aria-current", "true");
      else item.button.removeAttribute("aria-current");
      item.button.tabIndex = index === focusIndex ? 0 : -1;
    });
  }

  function setThumbnail(item, html) {
    if (item.html === html) return;
    item.html = html;
    if (typeof html === "string" && /^\s*<svg[\s>]/.test(html)) {
      item.frame.innerHTML = html;
      item.frame.dataset.state = "ready";
      item.frame.querySelectorAll("[tabindex]").forEach((node) => node.removeAttribute("tabindex"));
      // Follow the deck's slide shape (16:9, 4:3, ...) once a real render shows it.
      const box = item.frame.querySelector("svg")?.viewBox?.baseVal;
      if (box?.width > 0 && box?.height > 0) element.style.setProperty("--opf-thumbs-ratio", `${box.width} / ${box.height}`);
    } else {
      item.frame.textContent = labels.unavailable;
      item.frame.dataset.state = "error";
    }
  }
  const markFrames = (state) => items.forEach((item) => { if (item.frame.dataset.state !== "ready") item.frame.dataset.state = state; });

  /** The slots to draw now: the active one and every slot near the viewport (all of them without IntersectionObserver). */
  function wanted() {
    if (!lazy) return items.map((_, index) => index);
    const set = new Set(visible);
    if (items.length) set.add(active);
    return [...set].filter((index) => index < items.length).sort((a, b) => a - b);
  }
  function draw() {
    const indices = wanted();
    if (!indices.length) return;
    const snapshot = deck;
    cache.prepare(snapshot, indices);
    for (const index of indices) setThumbnail(items[index], cache.html(snapshot, index));
    paintPages(snapshot);
  }
  /**
   * LH-99: a slide the export continues on further pages is drawn as a stack with its page count: the thumbnail is its first page as
   * written (the slide being edited), and the slot keeps its index, so selection and numbering address source slides. Measured with
   * the fonts the thumbnails draw with, after they loaded.
   */
  function paintPages(snapshot) {
    const continuation = options.continuation === false ? null : continuationOf(snapshot, { fonts: options.fonts, catalogs: resolveOptions().catalogs, date: options.renderOptions?.date });
    items.forEach((item, index) => {
      const count = pageCount(continuation, index);
      if (count > 1) item.li.dataset.pages = String(count); else delete item.li.dataset.pages;
      item.pages.hidden = count < 2;
      item.pages.textContent = count > 1 ? fill(labels.pages, { count }) : "";
    });
  }
  /** Gate on the fonts the document needs (the canvas gate), then draw. Unchanged slides come from the cache; nothing else is rendered. */
  function paintThumbnails() {
    const token = ++renderToken;
    let loaded = false;
    try {
      return whenFontsReady(options.fonts, deck, {
        renderOptions: resolveOptions(),
        isCurrent: () => !disposed && token === renderToken,
        loading: () => { loaded = true; markFrames("loading"); },
        // Faces that loaded after thumbnails were drawn change how text measures: forget them, as the playground does.
        ready: () => { if (loaded) { cache.clear(); clearContinuations(); } draw(); },
        failed: (error) => { markFrames("error"); options.onError?.(error); },
      });
    } catch (error) {
      options.onError?.(error);
    }
  }

  function scrollToActive() {
    const item = items[active]?.li;
    if (!item || !element.clientWidth) return;
    const horizontal = orientation === "horizontal";
    const start = horizontal ? item.offsetLeft : item.offsetTop;
    const length = horizontal ? item.offsetWidth : item.offsetHeight;
    const view = horizontal ? element.clientWidth : element.clientHeight;
    const current = horizontal ? element.scrollLeft : element.scrollTop;
    const edge = 8;
    let target = current;
    if (start - edge < current) target = Math.max(0, start - edge);
    else if (start + length + edge > current + view) target = start + length + edge - view;
    if (target !== current) element[horizontal ? "scrollLeft" : "scrollTop"] = target;
  }

  function select(index) {
    if (index !== active) {
      active = index;
      if (!element.contains(doc.activeElement)) focusIndex = index;
      paintActive();
      scrollToActive();
      paintThumbnails();
    }
    options.onSelect?.(index);
  }
  list.addEventListener("click", (event) => {
    const button = event.target.closest?.(".opf-thumbs-item");
    if (button && list.contains(button)) select(Number(button.dataset.index));
  });
  list.addEventListener("focusin", (event) => {
    const button = event.target.closest?.(".opf-thumbs-item");
    if (!button) return;
    focusIndex = Number(button.dataset.index);
    paintActive();
  });
  // Arrow keys move focus along the strip (Enter or Space chooses); Home and End jump to the ends.
  list.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const button = event.target.closest?.(".opf-thumbs-item");
    if (actions && button && handleActionKey(event, button)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !button) return;
    const rtl = isRtl();
    const keys = orientation === "horizontal" ? { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1 } : { ArrowUp: -1, ArrowDown: 1 };
    const from = Number(button.dataset.index);
    let target;
    if (event.key in keys) target = from + keys[event.key];
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = items.length - 1;
    else return;
    event.preventDefault();
    target = clamp(target, items.length);
    items[target]?.button.focus();
  });

  // --- slide management (CE-29) ---------------------------------------------------------------------

  function isRtl() {
    return orientation === "horizontal" && win.getComputedStyle(element).direction === "rtl";
  }
  /** The step a move key asks for along the strip as it is drawn (left is forward in a right-to-left strip); 0 for any other key. */
  function moveStep(key) {
    if (orientation === "vertical") return key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
    const rtl = isRtl();
    return key === "ArrowLeft" ? (rtl ? 1 : -1) : key === "ArrowRight" ? (rtl ? -1 : 1) : 0;
  }
  function announce(message) {
    if (!message) return;
    if (options.onStatus) {
      options.onStatus(message);
      return;
    }
    if (!status) {
      status = doc.createElement("div");
      status.className = "opf-thumbs-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      element.prepend(status);
    }
    // The same line twice in a row is read twice.
    status.textContent = status.textContent === message ? `${message} ` : message;
  }

  /** After a change: show the slide it left current (the moved, copied, added or neighbouring one), keep focus on it and tell the host. */
  function follow(target, message, notify = true) {
    cancelScheduled();
    deck = editor.presentation;
    active = target;
    focusIndex = target;
    syncItems();
    paintThumbnails();
    scrollToActive();
    items[active]?.button.focus();
    if (notify) options.onSelect?.(active);
    announce(message);
  }
  /** One undoable change for the slide at `index`. Every kind is a function of slides.js, the ones the slide manager calls. */
  function perform(kind, index, extra = {}) {
    if (disposed || !actions || readOnly) return;
    const total = editor.presentation.slides.length;
    try {
      if (kind === "add") {
        const at = total ? clamp(index, total) + 1 : 0;
        const change = addSlide(editor, { at, ...(extra.layout ? { layout: extra.layout } : {}) }, META);
        const target = change.index ?? at;
        follow(target, fill(labels.statusAdded, { position: target + 1 }));
        return;
      }
      if (!Number.isInteger(index) || index < 0 || index >= total) return;
      if (kind === "duplicate") {
        const change = duplicateSlides(editor, [index], {}, META);
        follow(change.selection[0], labels.statusDuplicated);
      } else if (kind === "delete") {
        if (total <= 1) {
          announce(labels.lastSlide);
          return;
        }
        const change = removeSlides(editor, [index], META);
        follow(change.selection[0], fill(labels.statusDeleted, { count: total - 1 }));
      } else if (kind === "hide") {
        const change = setHidden(editor, [index], undefined, META);
        follow(index, change.hidden ? labels.statusHidden : labels.statusShown, false);
      } else if (kind === "move") {
        const change = moveSlidesBy(editor, [index], extra.step, {}, META);
        if (!change.changed) {
          announce(extra.step < 0 ? labels.atStart : labels.atEnd);
          return;
        }
        follow(change.selection[0], fill(labels.statusMoved, { position: change.selection[0] + 1, count: total }));
      }
    } catch (error) {
      announce(error?.message ?? String(error));
    }
  }

  function handleActionKey(event, button) {
    const index = Number(button.dataset.index);
    const { key } = event;
    if (event.ctrlKey || event.metaKey) return false;
    if (key === "ContextMenu" || (key === "F10" && event.shiftKey && !event.altKey)) {
      event.preventDefault();
      openSlideMenu(index, button);
      return true;
    }
    if (event.altKey && !event.shiftKey) {
      const step = moveStep(key);
      if (!step) return false;
      event.preventDefault();
      perform("move", index, { step });
      return true;
    }
    if (!event.altKey && !event.shiftKey && (key === "Delete" || key === "Backspace")) {
      event.preventDefault();
      perform("delete", index);
      return true;
    }
    return false;
  }

  // The "+" button: a trailing slot in the list, present while the strip can be edited.
  function mountAdd() {
    if (!actions || readOnly || disposed) {
      addSlot?.remove();
      return;
    }
    if (!addSlot) {
      addSlot = doc.createElement("li");
      addSlot.className = "opf-thumbs-add-slot";
      addButton = doc.createElement("button");
      addButton.type = "button";
      addButton.className = "opf-thumbs-add";
      addButton.setAttribute("aria-label", labels.add);
      addButton.title = labels.add;
      if (typeof options.layoutOptions === "function") {
        addButton.setAttribute("aria-haspopup", "menu");
        addButton.setAttribute("aria-expanded", "false");
      }
      addButton.append(resolveIcon(doc, icons.add, "M12 5v14M5 12h14", { name: "add", className: "opf-thumbs-add-icon" }));
      addSlot.append(addButton);
      addButton.addEventListener("click", onAddClick);
    }
    if (addSlot.parentNode !== list) list.append(addSlot);
  }
  function onAddClick() {
    if (readOnly || disposed) return;
    if (menu?.opener === addButton) {
      closeMenu();
      return;
    }
    let choices = [];
    if (typeof options.layoutOptions === "function") {
      try {
        choices = options.layoutOptions(editor.presentation) ?? [];
      } catch (error) {
        announce(error?.message ?? String(error));
        return;
      }
    }
    if (choices.length) openLayoutMenu(choices);
    else perform("add", active);
  }

  // --- menus ------------------------------------------------------------------------------------------

  const SHORTCUT_KEYS = { "←": "ArrowLeft", "→": "ArrowRight", "↑": "ArrowUp", "↓": "ArrowDown" };
  /**
   * Open a menu. `entries` are `{ label, shortcut?, disabled?, run }`, `{ separator: true }` and `{ heading }` (the entries up to the next
   * heading form a labelled group). It opens at `x`, `y`, or under (above, when there is no room) the `anchor` rectangle.
   */
  function openMenu({ label, opener, entries, x = 0, y = 0, anchor, toggle = false }) {
    closeMenu(false);
    const root = doc.createElement("div");
    root.className = "opf-thumbs-menu";
    root.setAttribute("role", "menu");
    root.setAttribute("aria-label", label);
    root.tabIndex = -1;
    const buttons = [];
    let target = root;
    for (const entry of entries) {
      if (entry.separator) {
        const rule = doc.createElement("div");
        rule.className = "opf-thumbs-menu-separator";
        rule.setAttribute("role", "separator");
        target.append(rule);
        continue;
      }
      if (entry.heading !== undefined) {
        target = doc.createElement("div");
        target.className = "opf-thumbs-menu-group";
        target.setAttribute("role", "group");
        target.setAttribute("aria-label", entry.heading);
        const heading = doc.createElement("div");
        heading.className = "opf-thumbs-menu-heading";
        heading.setAttribute("aria-hidden", "true");
        heading.textContent = entry.heading;
        target.append(heading);
        root.append(target);
        continue;
      }
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "opf-thumbs-menu-item";
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;
      item.disabled = entry.disabled === true;
      const text = doc.createElement("span");
      text.textContent = entry.label;
      item.append(text);
      if (entry.shortcut) {
        const keys = doc.createElement("kbd");
        keys.textContent = entry.shortcut;
        keys.setAttribute("aria-hidden", "true");
        item.append(keys);
        item.setAttribute("aria-keyshortcuts", entry.shortcut.replace(/[←→↑↓]/, (arrow) => SHORTCUT_KEYS[arrow]));
      }
      item.addEventListener("click", () => {
        // Focus goes back to where the menu came from first; a change then moves it to the slide it leaves current.
        closeMenu(true);
        entry.run();
      });
      target.append(item);
      if (!item.disabled) buttons.push(item);
    }
    (element.closest(".opf-ui") ?? doc.body).append(root);
    let box = root.getBoundingClientRect();
    let left = x;
    let top = y;
    if (anchor) {
      // Under the anchor, or above it when that side has more room; a menu taller than its side scrolls instead of covering the anchor.
      const below = win.innerHeight - anchor.bottom - 8;
      const above = anchor.top - 8;
      const placeAbove = box.height > below && above > below;
      const room = Math.max(96, placeAbove ? above : below);
      if (box.height > room) {
        root.style.maxHeight = `${room}px`;
        box = root.getBoundingClientRect();
      }
      left = isRtl() ? anchor.right - box.width : anchor.left;
      top = placeAbove ? anchor.top - box.height - 4 : anchor.bottom + 4;
    }
    root.style.left = `${Math.max(4, Math.min(left, win.innerWidth - box.width - 4))}px`;
    root.style.top = `${Math.max(4, Math.min(top, win.innerHeight - box.height - 4))}px`;
    // The key that opened the menu is released inside it: some platforms open their own menu on that keyup, which would take the focus.
    root.addEventListener("keyup", (event) => {
      if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) event.preventDefault();
    });
    root.addEventListener("keydown", (event) => {
      const at = buttons.indexOf(doc.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
      } else if (event.key === "Tab") closeMenu(false);
      else if (event.key === "ArrowDown") {
        event.preventDefault();
        buttons[(at + 1) % buttons.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        buttons[(at - 1 + buttons.length) % buttons.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        buttons[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        buttons.at(-1)?.focus();
      }
    });
    // A press outside closes it (the "+" button toggles its own menu on click); so does scrolling anything, which would leave it adrift.
    const onPointer = (event) => {
      if (!root.contains(event.target) && !(toggle && opener.contains(event.target))) closeMenu(false);
    };
    const onScroll = (event) => {
      if (!root.contains(event.target)) closeMenu(false);
    };
    doc.addEventListener("pointerdown", onPointer, true);
    // Scrolling that the opening itself caused (focus scrolls its element into view) arrives a frame late: listen only after it.
    const listenTimer = win.setTimeout(() => win.addEventListener("scroll", onScroll, true), 150);
    menu = {
      root,
      opener,
      off: () => {
        win.clearTimeout(listenTimer);
        doc.removeEventListener("pointerdown", onPointer, true);
        win.removeEventListener("scroll", onScroll, true);
      },
    };
    if (toggle) opener.setAttribute("aria-expanded", "true");
    (buttons[0] ?? root).focus();
  }
  function closeMenu(restore = true) {
    if (!menu) return;
    const { root, opener, off } = menu;
    menu = undefined;
    off();
    root.remove();
    if (opener?.getAttribute?.("aria-haspopup")) opener.setAttribute("aria-expanded", "false");
    if (restore && opener?.isConnected) opener.focus();
  }
  function openSlideMenu(index, opener, x, y) {
    const total = editor.presentation.slides.length;
    const slide = editor.presentation.slides[index];
    if (!slide) return;
    const off = readOnly;
    const vertical = orientation === "vertical";
    // "Left" steps back in a left-to-right strip and forward in a right-to-left one.
    const left = moveStep(vertical ? "ArrowUp" : "ArrowLeft");
    const canStep = (step) => index + step >= 0 && index + step < total;
    const entries = [
      { label: labels.duplicate, disabled: off, run: () => perform("duplicate", index) },
      { label: labels.delete, shortcut: "Delete", disabled: off || total <= 1, run: () => perform("delete", index) },
      { label: slide.hidden === true ? labels.showSlide : labels.hideSlide, disabled: off, run: () => perform("hide", index) },
      { separator: true },
      {
        label: vertical ? labels.moveUp : labels.moveLeft,
        shortcut: vertical ? "Alt+↑" : "Alt+←",
        disabled: off || !canStep(left),
        run: () => perform("move", index, { step: left }),
      },
      {
        label: vertical ? labels.moveDown : labels.moveRight,
        shortcut: vertical ? "Alt+↓" : "Alt+→",
        disabled: off || !canStep(-left),
        run: () => perform("move", index, { step: -left }),
      },
    ];
    openMenu({ label: labels.slideActions, opener, entries, x, y, anchor: x === undefined ? opener.getBoundingClientRect() : undefined });
  }
  function openLayoutMenu(choices) {
    const groups = groupLayoutChoices(choices).filter((group) => group.choices.length);
    const entries = [];
    for (const group of groups) {
      if (groups.length > 1) entries.push({ heading: group.name });
      for (const choice of group.choices) entries.push({ label: choice.label ?? choice.id, run: () => perform("add", active, { layout: choice.id }) });
    }
    openMenu({ label: labels.layouts, opener: addButton, entries, anchor: addButton.getBoundingClientRect(), toggle: true });
  }
  list.addEventListener("contextmenu", (event) => {
    if (!actions) return;
    const button = event.target.closest?.(".opf-thumbs-item");
    if (!button || !list.contains(button)) return;
    event.preventDefault();
    const index = Number(button.dataset.index);
    // A menu the keyboard just opened for this slide stays (some platforms also send a contextmenu event for the key).
    if (menu?.opener === button) return;
    if (index !== active) select(index);
    const keyboard = event.clientX === 0 && event.clientY === 0;
    openSlideMenu(index, button, keyboard ? undefined : event.clientX, keyboard ? undefined : event.clientY);
  });

  if (lazy) {
    const margin = orientation === "horizontal" ? "0px 240px 0px 240px" : "240px 0px 240px 0px";
    observer = new win.IntersectionObserver((entries) => {
      let added = false;
      for (const entry of entries) {
        const index = Number(entry.target.dataset.index);
        if (entry.isIntersecting) { if (!visible.has(index)) { visible.add(index); added = true; } }
        else visible.delete(index);
      }
      if (added && !disposed) paintThumbnails();
    }, { root: element, rootMargin: margin });
  }

  syncItems();
  mountAdd();
  paintThumbnails();
  scrollToActive();

  function cancelScheduled() {
    if (scheduled === undefined) return;
    (win.cancelAnimationFrame ?? clearTimeout).call(win, scheduled);
    scheduled = undefined;
  }
  function refresh({ clear = false } = {}) {
    if (disposed) return;
    cancelScheduled();
    if (clear) cache.clear();
    deck = editor.presentation;
    const before = items.length;
    syncItems();
    paintThumbnails();
    if (items.length !== before) scrollToActive();
  }
  // Several session events in one frame (typing, a patch with many operations) draw once.
  const unsubscribe = options.autoRefresh === false ? undefined : editor.subscribe(() => {
    if (scheduled !== undefined) return;
    scheduled = (win.requestAnimationFrame ?? ((callback) => setTimeout(callback, 16))).call(win, () => { scheduled = undefined; refresh(); });
  });

  return {
    element,
    /** The slide shown as current. */
    getSlide: () => active,
    /** Mark another slide as current, scroll it into view and draw it. Does not call `onSelect`. */
    setSlide(value) {
      if (disposed) return;
      // The host often calls this as soon as it added a slide, before the strip's own frame-delayed refresh has seen it.
      const total = editor.snapshot?.().presentation.slides.length ?? items.length;
      if (total !== items.length) {
        active = clamp(Math.trunc(Number(value) || 0), total);
        focusIndex = active;
        refresh();
        scrollToActive();
        return;
      }
      const next = clamp(Math.trunc(Number(value) || 0), items.length);
      if (next === active) { scrollToActive(); return; }
      active = next;
      if (!element.contains(doc.activeElement)) focusIndex = next;
      paintActive();
      scrollToActive();
      paintThumbnails();
    },
    /** Switch slide management off (true) or on again: no "+" button, menu items disabled, keys do nothing. Without `actions` it only records the state. */
    setReadOnly(value) {
      if (disposed) return;
      const next = Boolean(value);
      if (next === readOnly) return;
      readOnly = next;
      if (actions) {
        if (readOnly) element.dataset.readonly = "true";
        else delete element.dataset.readonly;
      }
      closeMenu(false);
      mountAdd();
    },
    /** Redraw from the session now. `{ clear: true }` also drops the cache, for example after the host loaded fonts. */
    refresh,
    destroy() {
      if (disposed) return;
      disposed = true;
      closeMenu(false);
      cancelScheduled();
      unsubscribe?.();
      observer?.disconnect();
      element.remove();
    },
  };
}
