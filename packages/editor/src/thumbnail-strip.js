// Thumbnail strip (RR-98): a `nav` of real slide renders, each with a mono index and the slide title; the current one has `aria-current` and an
// accent ring. Thumbnails are drawn by the same renderer, catalogs and fonts handle the canvas uses, through the thumbnail cache: a slide whose
// content did not change is never rendered again, and the strip is lazy (items near the viewport render first, through IntersectionObserver when
// the browser has it). Plain DOM, no framework, no network.
import { mergeCatalogs } from "./index.js";
import { toSvg } from "@openpresentation/opf-render/svg";
import { whenFontsReady } from "./font-gate.js";
import { slideTitle } from "./slides.js";
import { createThumbnailCache } from "./thumbnail-cache.js";

const DEFAULT_LABELS = {
  navigation: "Slides",
  untitled: "Untitled",
  hidden: "hidden",
  unavailable: "Preview unavailable",
};
const pad = (value, count) => String(value).padStart(Math.max(2, String(count).length), "0");

/**
 * Mount the thumbnail strip into `container`.
 *
 * Options: `editor` (required session), `fonts` (the renderer's fonts handle the canvas uses), `renderOptions` (extra `toSvg` options, such as
 * `catalogs`; the thumbnails always draw with `text: "system"` and `trace: false`), `slideIndex`, `onSelect(index)` (the user chose a slide),
 * `density` (`"comfortable"` or `"touch"`), `size` (thumbnail width in pixels; default 128, or 104 for touch), `orientation` (`"horizontal"`,
 * the default, or `"vertical"`), `labels` (`navigation`, `untitled`, `hidden`, `unavailable`), `cache` (a thumbnail cache to share; default:
 * its own), `lazy` (default true), `autoRefresh` (default true: follow the editor's changes on its own) and `onError(error)`.
 *
 * Returns `{ element, getSlide(), setSlide(index), refresh({ clear }), destroy() }`.
 */
export function createThumbnailStrip(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { editor } = options;
  if (!editor || typeof editor.subscribe !== "function") throw new TypeError("createThumbnailStrip needs an editor session.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const density = options.density === "touch" ? "touch" : "comfortable";
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  const size = Number(options.size) > 0 ? Number(options.size) : density === "touch" ? 104 : 128;
  const lazy = options.lazy !== false && typeof win?.IntersectionObserver === "function";

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
  const visible = new Set();
  const items = [];

  const element = doc.createElement("nav");
  element.className = "opf-thumbs";
  element.dataset.orientation = orientation;
  element.dataset.density = density;
  element.setAttribute("aria-label", labels.navigation);
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
    label.append(indexNode, " ", titleNode, note);
    button.append(frame, label);
    li.append(button);
    return { li, button, frame, indexNode, titleNode, note, index, html: undefined };
  }

  /** Grow or shrink to `count` slots, and write each slot's index, title and state. Cheap: no rendering. */
  function syncItems() {
    const slides = deck.slides;
    while (items.length < slides.length) {
      const item = makeItem(items.length);
      items.push(item);
      list.append(item.li);
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
        ready: () => { if (loaded) cache.clear(); draw(); },
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
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    const button = event.target.closest?.(".opf-thumbs-item");
    if (!button) return;
    const rtl = orientation === "horizontal" && win.getComputedStyle(element).direction === "rtl";
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
    /** Redraw from the session now. `{ clear: true }` also drops the cache, for example after the host loaded fonts. */
    refresh,
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelScheduled();
      unsubscribe?.();
      observer?.disconnect();
      element.remove();
    },
  };
}
