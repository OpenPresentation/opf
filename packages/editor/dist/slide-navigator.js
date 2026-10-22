// Slide navigator (RR-98): previous and next buttons around a mono "01 / 03" counter. It owns no document state, only the slide index the host
// shows; the slide count follows the editor session (or a presentation the host hands in). Plain DOM, no framework, no network.
// Icons are the Lucide ChevronLeft and ChevronRight paths (ISC license), inlined.
const SVG_NS = "http://www.w3.org/2000/svg";
const CHEVRONS = { previous: "m15 18-6-6 6-6", next: "m9 18 6-6-6-6" };

const DEFAULT_LABELS = {
  navigation: "Slide navigation",
  previous: "Previous slide",
  next: "Next slide",
  /** The accessible description of the position, for example "Slide 2 of 3". */
  position: (index, count) => (count === 0 ? "No slides" : `Slide ${index + 1} of ${count}`),
};

/** The counter text: both numbers are zero-padded to two digits, or to the width of the slide count from 100 slides. */
export function formatSlideCounter(index, count) {
  const width = Math.max(2, String(Math.max(0, count)).length);
  const pad = (value) => String(value).padStart(width, "0");
  return `${pad(count === 0 ? 0 : index + 1)} / ${pad(count)}`;
}

function chevron(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "opf-nav-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", CHEVRONS[name]);
  svg.append(path);
  return svg;
}

/** True when a page-level key press belongs to something else: typing, an editor, a menu or a dialog. */
function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest('[contenteditable=""],[contenteditable="true"],.cm-editor,[role="textbox"],[role="combobox"],[role="listbox"],[role="menu"],[role="slider"],[role="spinbutton"],dialog[open],[role="dialog"]'));
}

/**
 * Mount previous and next buttons with a "01 / 03" counter into `container`.
 *
 * Options: `editor` (an editor session; the slide count follows it) or `presentation` (an OPF object, or a function returning the current
 * one), `slideIndex` (0-based, default 0), `onChange(index)` (called when the user moves, and when a shrinking deck clamps the index),
 * `density` (`"comfortable"` 32px controls, or `"touch"` 40px), `labels` (`navigation`, `previous`, `next`, `position(index, count)`) and
 * `autoRefresh` (default true: follow the editor's changes on its own).
 *
 * Returns `{ element, getSlide(), setSlide(index), refresh(), bindKeys(target?), destroy() }`.
 */
export function createSlideNavigator(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const density = options.density === "touch" ? "touch" : "comfortable";
  const { editor } = options;
  const source = options.presentation;
  let index = Math.max(0, Math.trunc(Number(options.slideIndex) || 0));
  let disposed = false;
  const unbinders = new Set();

  const count = () => {
    // The snapshot is cached between edits; `editor.presentation` clones the whole deck on every read.
    const deck = editor ? (editor.snapshot?.().presentation ?? editor.presentation) : typeof source === "function" ? source() : source;
    return Array.isArray(deck?.slides) ? deck.slides.length : 0;
  };

  const element = doc.createElement("div");
  element.className = "opf-nav";
  element.dataset.density = density;
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", labels.navigation);
  const button = (name) => {
    const node = doc.createElement("button");
    node.type = "button";
    node.className = "opf-nav-button";
    node.dataset.action = name;
    node.setAttribute("aria-label", labels[name]);
    node.title = labels[name];
    node.append(chevron(name));
    return node;
  };
  const previous = button("previous");
  const next = button("next");
  const counter = doc.createElement("span");
  counter.className = "opf-nav-counter";
  counter.setAttribute("role", "status");
  counter.setAttribute("aria-atomic", "true");
  element.append(previous, counter, next);
  container.append(element);

  function clamp(value, total) {
    return total === 0 ? 0 : Math.max(0, Math.min(total - 1, value));
  }
  function paint() {
    const total = count();
    index = clamp(index, total);
    counter.textContent = formatSlideCounter(index, total);
    counter.title = labels.position(index, total);
    element.dataset.count = String(total);
    element.dataset.index = String(index);
    const atStart = index <= 0;
    const atEnd = index >= total - 1;
    // A button that becomes disabled while it has focus would drop focus to the page: hand it to the other button.
    const focused = doc.activeElement;
    previous.disabled = total === 0 || atStart;
    next.disabled = total === 0 || atEnd;
    if (focused === previous && previous.disabled && !next.disabled) next.focus();
    else if (focused === next && next.disabled && !previous.disabled) previous.focus();
  }
  function go(target, notify = true) {
    const total = count();
    const clamped = clamp(target, total);
    if (clamped === index) return false;
    index = clamped;
    paint();
    if (notify) options.onChange?.(index);
    return true;
  }

  previous.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));
  // The arrow keys act when focus is inside the navigator. preventDefault marks the event as handled so a page-level `bindKeys` does not repeat it.
  element.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    const rtl = doc.defaultView?.getComputedStyle(element).direction === "rtl";
    const step = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (step !== undefined) { event.preventDefault(); go(index + step); }
    else if (event.key === "Home") { event.preventDefault(); go(0); }
    else if (event.key === "End") { event.preventDefault(); go(count() - 1); }
  });

  paint();
  const unsubscribe = editor && options.autoRefresh !== false && typeof editor.subscribe === "function" ? editor.subscribe(() => refresh()) : undefined;

  function refresh() {
    if (disposed) return;
    const before = index;
    paint();
    // The deck shrank under the current slide: the host's index is stale too.
    if (index !== before) options.onChange?.(index);
  }

  /**
   * Page-level Left and Right arrows (default target: the document). Ignores typing in inputs, selects and editors, menus, dialogs, modified keys and
   * events another handler already took. Returns a function that removes the listener; `destroy()` removes every one.
   */
  function bindKeys(target = doc) {
    const handler = (event) => {
      if (disposed || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isInteractiveTarget(event.target) || isInteractiveTarget(doc.activeElement)) return;
      const rtl = doc.defaultView?.getComputedStyle(element).direction === "rtl";
      const step = event.key === "ArrowLeft" ? (rtl ? 1 : -1) : rtl ? -1 : 1;
      if (go(index + step)) event.preventDefault();
    };
    target.addEventListener("keydown", handler);
    const unbind = () => { target.removeEventListener("keydown", handler); unbinders.delete(unbind); };
    unbinders.add(unbind);
    return unbind;
  }

  return {
    element,
    /** The slide index the navigator shows. */
    getSlide: () => index,
    /** Show another slide without calling `onChange` (the host already knows). */
    setSlide(value) {
      if (disposed) return;
      index = clamp(Math.trunc(Number(value) || 0), count());
      paint();
    },
    /** Read the slide count again (it follows the session on its own unless `autoRefresh` is false). */
    refresh,
    bindKeys,
    destroy() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      for (const unbind of [...unbinders]) unbind();
      element.remove();
    },
  };
}
