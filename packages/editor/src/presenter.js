// RR-98: the presenter and the Present button. `createPresenter` shows the deck full screen (the Fullscreen API on its own element, with a fixed
// overlay when the browser refuses), one slide at a time, letterboxed on black. Slides are drawn by the renderer the canvas and the thumbnails
// use (`toSvg` with the host's one fonts handle and catalogs); the next and previous slides are drawn ahead, so advancing is instant. Hidden
// slides are skipped, as the exports skip them (`slidesToConvert`). `createPresentButton` is the icon-only trigger and `bindPresentShortcut`
// binds F5. Plain DOM, no framework, no network; styles in src/styles/presenter.css (classes `opf-presenter-*` and `opf-present-button`).
import { toSvg } from "@openpresentation/opf-render/svg";
import { mergeCatalogs } from "./catalogs.js";
import { el, icon } from "./export-dom.js";
import { whenFontsReady } from "./font-gate.js";
import { formatSlideCounter } from "./slide-navigator.js";

const COUNTER_MS = 2000;
const PRELOAD_DELAY_MS = 20;
const SWIPE_MIN = 48;
const SWIPE_MAX_MS = 800;
const TAP_SLOP = 10;
const TAP_MAX_MS = 600;
const CLICK_GUARD_MS = 450;
const NEXT_KEYS = new Set(["ArrowRight", " ", "PageDown", "Enter"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "PageUp", "Backspace"]);

const DEFAULT_LABELS = {
  /** The accessible name of the presenter dialog. */
  dialog: "Presentation",
  exit: "Exit presentation",
  exitTitle: "Exit (Esc)",
  /** What the live region announces, for example "Slide 3 of 12". */
  position: (position, count) => `Slide ${position} of ${count}`,
  loading: "Loading fonts…",
  empty: "No visible slides to present. Unhide a slide first.",
};

/** The slides a presentation shows: the deck's indexes without the hidden ones, as the exports select them (`slidesToConvert`). */
function visibleIndices(deck, includeHidden) {
  const list = Array.isArray(deck?.slides) ? deck.slides : [];
  const found = [];
  list.forEach((slide, index) => { if (includeHidden || slide?.hidden !== true) found.push(index); });
  return found;
}

const clampIndex = (deck, wanted) => Math.max(0, Math.min((Array.isArray(deck?.slides) ? deck.slides.length : 1) - 1, Math.trunc(Number(wanted) || 0)));

/**
 * Mount the presenter in `container` (it stays hidden until `start`).
 *
 * Options: `editor` (an editor session) or `presentation` (an OPF object, or a function returning the current one), `fonts` (the renderer's fonts
 * handle the canvas uses), `renderOptions` (extra `toSvg` options, such as `catalogs`; slides are drawn with `text: "system"`, `trace: false` and
 * their `{{variables}}` resolved), `slideIndex` (the slide `start()` shows, 0-based), `onExit(index)` (the presenter closed, on the slide it showed),
 * `onSlideChange(index)` (the shown slide changed), `density` (`"comfortable"` or `"touch"`), `includeHidden` (default false) and `labels`. Indexes are always positions in the deck, hidden slides included.
 *
 * Returns `{ element, start(slideIndex?), stop(), next(), previous(), goTo(index), getSlide(), isRunning(), destroy() }`.
 */
export function createPresenter(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { editor } = options;
  const source = options.presentation;
  if (!editor && source === undefined) throw new TypeError("createPresenter needs an editor session or a presentation.");
  if (editor && typeof editor.subscribe !== "function") throw new TypeError("createPresenter needs an editor session.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const density = options.density === "touch" ? "touch" : "comfortable";
  const includeHidden = options.includeHidden === true;

  // The snapshot is cached between edits, so reading it on every move is cheap.
  const deckNow = () => (editor ? (editor.snapshot?.().presentation ?? editor.presentation) : typeof source === "function" ? source() : source);
  const resolveOptions = () => ({ ...(options.renderOptions ?? {}), catalogs: mergeCatalogs(editor?.catalogs, options.renderOptions?.catalogs) });
  const drawOptions = () => ({ ...resolveOptions(), fonts: options.fonts, text: "system", trace: false });
  // Drawn slides by deck index, for the deck object they were drawn from: a new snapshot (an edit) or a new start() draws again.
  let drawn = new Map(), drawnFor;

  let active = false, destroyed = false, current = -1, opener = null, enteredFullscreen = false, leaving = false, returnTo = null;
  let counterTimer, preloadTimer, renderToken = 0, swipe = null, clickGuardUntil = 0;

  // ---- the DOM ----------------------------------------------------------------------------------------------------------------------------
  const slide = el(doc, "div", { class: "opf-presenter-slide" });
  const message = el(doc, "p", { class: "opf-presenter-message", hidden: true });
  const counter = el(doc, "span", { class: "opf-presenter-counter", "aria-hidden": "true" });
  const closeButton = el(doc, "button", { type: "button", class: "opf-presenter-close", "aria-label": labels.exit, title: labels.exitTitle }, icon(doc, "X", 18));
  const live = el(doc, "div", { class: "opf-presenter-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const root = el(doc, "div", {
    class: "opf-presenter opf-ui", role: "dialog", "aria-modal": "true", "aria-label": labels.dialog, tabindex: "-1", hidden: true,
    "data-density": density, "data-mode": "overlay", "data-chrome": "hidden",
  }, slide, message, counter, closeButton, live);
  container.append(root);

  // ---- slides -----------------------------------------------------------------------------------------------------------------------------
  /** The slide to show for a requested index: that slide, else the next one that is not hidden, else the last one before it. -1: none. */
  function resolve(deck, wanted) {
    const shown = visibleIndices(deck, includeHidden);
    if (!shown.length) return -1;
    const target = clampIndex(deck, wanted);
    return shown.find((index) => index >= target) ?? shown[shown.length - 1];
  }
  function showMessage(text) {
    slide.replaceChildren();
    message.textContent = text;
    message.hidden = false;
  }
  function paint(html) {
    if (typeof html === "string" && /^\s*<svg[\s>]/.test(html)) {
      message.hidden = true;
      slide.innerHTML = html;
    } else showMessage(typeof html === "string" ? html : "Preview unavailable");
  }
  // Draw the listed slides that are not drawn yet, in one renderer call (it composes the deck once). A slide that cannot be drawn keeps the renderer's message.
  function draw(deck, indices) {
    if (deck !== drawnFor) { drawn = new Map(); drawnFor = deck; }
    const missing = indices.filter((index) => !drawn.has(index));
    if (!missing.length) return;
    const options = drawOptions();
    try {
      const images = toSvg(deck, missing.map((index) => index + 1), options);
      missing.forEach((index, position) => drawn.set(index, images[position]));
    } catch {
      // One bad slide must not hide the others.
      for (const index of missing) {
        try { drawn.set(index, toSvg(deck, index + 1, options)); } catch (error) { drawn.set(index, error?.message ?? "Preview unavailable"); }
      }
    }
  }
  function preload(deck, shown, index) {
    win.clearTimeout(preloadTimer);
    const at = shown.indexOf(index);
    const wanted = [shown[at - 1], shown[at + 1]].filter((value) => value !== undefined);
    if (!wanted.length) return;
    preloadTimer = win.setTimeout(() => {
      if (active) draw(deck, wanted);
    }, PRELOAD_DELAY_MS);
  }
  // Draw the slide once the faces its deck needs are loaded (a deck in loaded faces draws synchronously).
  function render(index) {
    const token = ++renderToken;
    const deck = deckNow();
    const renderOptions = resolveOptions();
    return whenFontsReady(options.fonts, deck, {
      renderOptions,
      isCurrent: () => active && token === renderToken,
      loading: () => showMessage(labels.loading),
      ready: () => {
        draw(deck, [index]);
        paint(drawn.get(index));
        preload(deck, visibleIndices(deck, includeHidden), index);
      },
      failed: (error) => showMessage(error?.message ?? "Preview unavailable"),
    });
  }
  function announce(deck, index) {
    const shown = visibleIndices(deck, includeHidden);
    const position = shown.indexOf(index);
    counter.textContent = formatSlideCounter(Math.max(0, position), shown.length);
    live.textContent = position < 0 ? "" : labels.position(position + 1, shown.length);
  }

  function show(wanted, { notify = true } = {}) {
    const deck = deckNow();
    const index = resolve(deck, wanted);
    if (index < 0) {
      current = -1;
      renderToken++;
      showMessage(labels.empty);
      counter.textContent = formatSlideCounter(0, 0);
      live.textContent = labels.empty;
      return false;
    }
    const changed = index !== current;
    current = index;
    announce(deck, index);
    render(index);
    if (changed && notify) options.onSlideChange?.(index);
    return changed;
  }
  function move(step) {
    if (!active || current < 0) return false;
    const shown = visibleIndices(deckNow(), includeHidden);
    const at = shown.indexOf(current);
    // The shown slide can be gone (the deck changed under it): step from where it was.
    const target = at >= 0 ? shown[at + step] : step > 0 ? shown.find((index) => index > current) : [...shown].reverse().find((index) => index < current);
    return target === undefined ? false : show(target);
  }

  // ---- the counter ------------------------------------------------------------------------------------------------------------------------
  function showCounter() {
    if (!active) return;
    root.dataset.chrome = "visible";
    win.clearTimeout(counterTimer);
    counterTimer = win.setTimeout(() => { root.dataset.chrome = "hidden"; }, COUNTER_MS);
  }

  // ---- full screen ------------------------------------------------------------------------------------------------------------------------
  // The element is always a fixed overlay; the Fullscreen API only makes the browser give the screen to it. When the browser refuses (no
  // user gesture, an iframe without `allow="fullscreen"`, iPhone Safari), the overlay is the presentation.
  function enterFullscreen() {
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (typeof request !== "function" || doc.fullscreenEnabled === false) return Promise.resolve("overlay");
    let attempt;
    try { attempt = Promise.resolve(request.call(root, { navigationUI: "hide" })); } catch (error) { attempt = Promise.reject(error); }
    return attempt.then(
      () => {
        if (doc.fullscreenElement !== root) return "overlay";
        // stop() ran while the request was pending (a quick Esc or close), so it saw no full screen to leave: give the screen back now, or the
        // page stays full screen behind a hidden presenter.
        if (!active) { leaveFullscreen(); return "overlay"; }
        enteredFullscreen = true;
        root.dataset.mode = "fullscreen";
        return "fullscreen";
      },
      () => "overlay",
    );
  }
  // Ask the browser to leave full screen; onFullscreenChange then sees `leaving` and does not read the exit as the user's. Focus goes back to the
  // element that opened the presentation once the exit is done, because the page behind a full screen element takes no focus until then.
  function leaveFullscreen() {
    leaving = true;
    Promise.resolve(doc.exitFullscreen?.()).then(restoreFocus, () => { leaving = false; });
  }
  // Only when nobody took focus since: the host may move it in `onExit`.
  function restoreFocus() {
    const now = doc.activeElement;
    if (returnTo?.isConnected && typeof returnTo.focus === "function" && (!now || now === doc.body || now === root)) returnTo.focus({ preventScroll: true });
  }
  // The browser takes full screen away with Esc (that key never reaches the page) or the host exits it: the presentation ends with it.
  function onFullscreenChange() {
    if (doc.fullscreenElement === root) return;
    if (leaving) {
      // The exit that stop() asked for finished. If the host started again meanwhile, full screen is gone and the overlay carries on.
      leaving = false;
      if (active && enteredFullscreen) { enteredFullscreen = false; root.dataset.mode = "overlay"; }
      return;
    }
    if (active && enteredFullscreen) stop();
  }

  // ---- input ------------------------------------------------------------------------------------------------------------------------------
  function onKeydown(event) {
    if (!active || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const key = event.key;
    const onButton = event.target === closeButton;
    let handled = true;
    if (key === "Escape") stop();
    else if (key === "Tab") (doc.activeElement === closeButton ? root : closeButton).focus();
    else if (onButton && (key === "Enter" || key === " ")) handled = false; // the button's own click exits
    else if (NEXT_KEYS.has(key)) move(1);
    else if (PREVIOUS_KEYS.has(key)) move(-1);
    else if (key === "Home") show(0);
    else if (key === "End") show(Number.MAX_SAFE_INTEGER);
    else handled = false;
    if (handled) { event.preventDefault(); event.stopPropagation(); }
  }
  // A press on the left third goes back, anywhere else forward.
  function byZone(clientX) {
    const box = root.getBoundingClientRect();
    return move(clientX < box.left + box.width / 3 ? -1 : 1);
  }
  function onClick(event) {
    if (!active || closeButton.contains(event.target)) return;
    // A touch is handled on pointerup (below); the click the browser adds after it must not move a second time.
    if (win.performance.now() < clickGuardUntil) return;
    byZone(event.clientX);
  }
  function onPointerdown(event) {
    showCounter();
    swipe = event.pointerType === "mouse" ? null : { id: event.pointerId, x: event.clientX, y: event.clientY, at: win.performance.now() };
  }
  // Touch and pen: a swipe moves, and a tap uses the click zones. Both are read here, so they do not depend on the browser's click for touch.
  function onPointerup(event) {
    const start = swipe;
    swipe = null;
    if (!active || !start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y, now = win.performance.now(), elapsed = now - start.at;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) >= Math.abs(dy) * 1.5 && elapsed <= SWIPE_MAX_MS) {
      clickGuardUntil = now + CLICK_GUARD_MS;
      move(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP && elapsed <= TAP_MAX_MS && !closeButton.contains(event.target)) {
      clickGuardUntil = now + CLICK_GUARD_MS;
      byZone(event.clientX);
    }
  }
  // Focus stays inside the dialog: the page behind it is not reachable while it is open.
  function onFocusin(event) {
    if (active && !root.contains(event.target)) root.focus({ preventScroll: true });
  }

  root.addEventListener("click", onClick);
  root.addEventListener("pointermove", showCounter);
  root.addEventListener("pointerdown", onPointerdown);
  root.addEventListener("pointerup", onPointerup);
  root.addEventListener("pointercancel", () => { swipe = null; });
  closeButton.addEventListener("click", () => stop());
  // Always listening: the exit that stop() asks for arrives after stop() returned.
  doc.addEventListener("fullscreenchange", onFullscreenChange);
  doc.addEventListener("webkitfullscreenchange", onFullscreenChange);

  // ---- start and stop ---------------------------------------------------------------------------------------------------------------------
  function start(slideIndex) {
    if (destroyed) return Promise.resolve("overlay");
    const wanted = slideIndex ?? options.slideIndex ?? 0;
    if (active) { show(wanted); return Promise.resolve(root.dataset.mode); }
    active = true;
    opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    current = -1;
    drawn = new Map();
    drawnFor = undefined;
    root.hidden = false;
    root.dataset.mode = "overlay";
    root.dataset.chrome = "hidden";
    doc.addEventListener("keydown", onKeydown, true);
    doc.addEventListener("focusin", onFocusin, true);
    // Full screen must be requested inside the user's gesture, so before anything is drawn.
    const entering = enterFullscreen();
    root.focus({ preventScroll: true });
    show(wanted, { notify: false });
    // The host asked for a slide that is hidden: tell it which slide the presentation really opened on.
    if (current >= 0 && current !== clampIndex(deckNow(), wanted)) options.onSlideChange?.(current);
    return entering;
  }
  function stop() {
    if (!active) return;
    const index = current;
    active = false;
    enteredFullscreen = false;
    renderToken++;
    win.clearTimeout(counterTimer);
    win.clearTimeout(preloadTimer);
    doc.removeEventListener("keydown", onKeydown, true);
    doc.removeEventListener("focusin", onFocusin, true);
    const fullscreen = doc.fullscreenElement === root;
    root.hidden = true;
    slide.replaceChildren();
    swipe = null;
    returnTo = opener;
    opener = null;
    restoreFocus();
    if (fullscreen) leaveFullscreen();
    // The deck index the presentation ended on (-1 when no slide was shown: there was nothing to present).
    options.onExit?.(index);
  }

  return {
    element: root,
    /** Open the presentation on `slideIndex` (default: the `slideIndex` option). Resolves `"fullscreen"` or `"overlay"` once the browser answered. */
    start,
    /** Close the presentation. `onExit(index)` is called with the slide it showed. */
    stop,
    /** Show the next slide that is not hidden. Returns false at the end. */
    next: () => move(1),
    /** Show the previous slide that is not hidden. Returns false at the start. */
    previous: () => move(-1),
    /** Show a slide by its deck index; a hidden slide shows the next one that is not hidden. Returns false when the slide did not change. */
    goTo: (index) => (active ? show(index) : false),
    /** The deck index of the shown slide (-1 when stopped or empty). */
    getSlide: () => (active ? current : -1),
    isRunning: () => active,
    destroy() {
      if (destroyed) return;
      stop();
      destroyed = true;
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
      doc.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      root.remove();
    },
  };
}

// ---- the Present button ---------------------------------------------------------------------------------------------------------------------

/** True when a key press belongs to something else: typing, an editor, a menu or a dialog. */
function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest('[contenteditable=""],[contenteditable="true"],.cm-editor,[role="textbox"],[role="combobox"],[role="listbox"],[role="menu"],[role="slider"],[role="spinbutton"],dialog[open],[role="dialog"]'));
}

/**
 * Mount the Present button in `container`: an icon-only button (Lucide Presentation) named "Present", titled "Present (F5)".
 *
 * Options: `onPresent(event)`, `disabled` (`true`, or a string that says why and is the title), `density` (`"comfortable"` 32px, or `"touch"` 40px)
 * `label` (the accessible name, default "Present") and `variant` (`"quiet"`, the default: a transparent icon button like the toolbar's undo and redo,
 * or `"primary"`: the filled accent look of the Export trigger). A disabled button stays focusable (`aria-disabled`) and does nothing.
 *
 * Returns `{ element, setDisabled(reason), setDensity(density), setVariant(variant), destroy() }`.
 */
export function createPresentButton(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const label = options.label ?? "Present";
  let disabledReason = options.disabled === true ? "Nothing to present." : typeof options.disabled === "string" && options.disabled ? options.disabled : undefined;
  let destroyed = false;
  const button = el(doc, "button", {
    type: "button", class: "opf-present-button opf-ui", "aria-label": label, title: "Present (F5)", "aria-keyshortcuts": "F5",
    "data-density": options.density === "touch" ? "touch" : "comfortable", "data-variant": options.variant === "primary" ? "primary" : "quiet",
  }, icon(doc, "Presentation", 16));
  const paint = () => {
    if (disabledReason) { button.setAttribute("aria-disabled", "true"); button.title = disabledReason; }
    else { button.removeAttribute("aria-disabled"); button.title = "Present (F5)"; }
  };
  button.addEventListener("click", (event) => {
    if (destroyed || disabledReason) return;
    options.onPresent?.(event);
  });
  paint();
  container.append(button);
  return {
    element: button,
    /** `true` disables with a default reason, a string with your own (it becomes the title), `false` enables. */
    setDisabled(reason) {
      disabledReason = reason === true ? "Nothing to present." : typeof reason === "string" && reason ? reason : undefined;
      paint();
    },
    setDensity(next) { button.dataset.density = next === "touch" ? "touch" : "comfortable"; },
    setVariant(next) { button.dataset.variant = next === "primary" ? "primary" : "quiet"; },
    destroy() { destroyed = true; button.remove(); },
  };
}

/**
 * F5 starts the presentation (`onPresent(event)`), and the browser's reload is suppressed when it does. `target` defaults to the document. F5 is
 * ignored while typing in inputs, selects and editors (CodeMirror, contenteditable), in menus and in dialogs, and with Ctrl, Alt, Meta or Shift held.
 * Returns a function that removes the listener.
 */
export function bindPresentShortcut(target, onPresent) {
  if (typeof onPresent !== "function") throw new TypeError("bindPresentShortcut needs onPresent().");
  const doc = target?.ownerDocument ?? target?.document ?? (typeof document === "undefined" ? undefined : document);
  const handler = (event) => {
    if (event.key !== "F5" || event.defaultPrevented || event.repeat || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isInteractiveTarget(event.target) || isInteractiveTarget(doc?.activeElement)) return;
    event.preventDefault();
    onPresent(event);
  };
  const listener = target ?? doc;
  listener.addEventListener("keydown", handler);
  return () => listener.removeEventListener("keydown", handler);
}
