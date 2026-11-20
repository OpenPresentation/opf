// RR-98: the presenter and the Present button. `createPresenter` shows the deck full screen (the Fullscreen API on its own element, with a fixed
// overlay when the browser refuses), one slide at a time, letterboxed on black. Slides are drawn by the renderer the canvas and the thumbnails
// use (`toSvg` with the host's one fonts handle and catalogs); the next and previous slides are drawn ahead, so advancing is instant. Hidden
// slides are skipped, as the exports skip them (`slidesToConvert`). `createPresentButton` is the icon-only trigger and `bindPresentShortcut`
// binds F5. Plain DOM, no framework, no network; styles in src/styles/presenter.css (classes `opf-presenter-*` and `opf-present-button`).
import { toSvg } from "@openpresentation/opf-render/svg";
import { mergeCatalogs } from "./catalogs.js";
import { el, icon } from "./export-dom.js";
import { whenFontsReady } from "./font-gate.js";
import { normalizeIcons, resolveIcon } from "./icons.js";
import { formatSlideCounter } from "./slide-navigator.js";
import { continuationOf, pageCount } from "./continuation.js";

const COUNTER_MS = 2000;
const PRELOAD_DELAY_MS = 20;
const SWIPE_MIN = 48;
const SWIPE_MAX_MS = 800;
const TAP_SLOP = 10;
const TAP_MAX_MS = 600;
const CLICK_GUARD_MS = 450;
const NEXT_KEYS = new Set(["ArrowRight", " ", "PageDown", "Enter"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "PageUp", "Backspace"]);

// Full screen belongs to the document, not to one presenter, and the browser answers a request later than it was made. Two things follow, and
// both are kept per document so that presenters (any number can be mounted) see the same facts.
// 1. An exit a presenter asked for can run after a newer presenter took full screen, and the browser then ends that one's full screen too.
//    A presenter whose request resolved after it was closed therefore leaves full screen only when no newer request is in flight (that request
//    replaces it); otherwise it marks its element abandoned, and the newer presenter gives the screen back if its own request does not get it.
// 2. The `fullscreenchange` an exit answers must not read as the user leaving. The exits presenters asked for are listed until their event is
//    seen and the exit has settled, in whichever order those two happen. An event that finds the screen taken by an element drops the exits that
//    already settled, since events arrive in the order of the changes: a later exit event is the user's, however soon it follows.
const documentStates = new WeakMap(); // Document -> { requests (counted), inFlight (their numbers, until answered), exits, abandoned (elements) }
const attributedEvents = new WeakMap(); // fullscreenchange Event -> whether it answered an exit a presenter asked for
function stateOf(doc) {
  let state = documentStates.get(doc);
  if (!state) documentStates.set(doc, state = { requests: 0, inFlight: new Set(), exits: new Set(), abandoned: new WeakSet() });
  return state;
}
function noteExit(doc) {
  const { exits } = stateOf(doc);
  const exit = { settled: false, seen: false };
  exits.add(exit);
  return {
    // The browser reports an exit with an event; when none came (the exit was refused, or two exits became one event) it is not waited for.
    settle: (done) => { if (!done || exit.seen) exits.delete(exit); else exit.settled = true; },
  };
}
function forgetSettledExits(doc) {
  const { exits } = stateOf(doc);
  for (const exit of exits) if (exit.settled) exits.delete(exit);
}
function answersAnExit(doc, event) {
  if (attributedEvents.has(event)) return attributedEvents.get(event);
  const { exits } = stateOf(doc);
  let ours = false;
  if (doc.fullscreenElement) {
    forgetSettledExits(doc);
  } else {
    const exit = [...exits].find((candidate) => !candidate.seen);
    if (exit) { ours = true; if (exit.settled) exits.delete(exit); else exit.seen = true; }
  }
  attributedEvents.set(event, ours);
  return ours;
}

const DEFAULT_LABELS = {
  /** The accessible name of the presenter dialog. */
  dialog: "Presentation",
  exit: "Exit presentation",
  exitTitle: "Exit (Esc)",
  /** What the live region announces, for example "Slide 3 of 12". */
  position: (position, count) => `Slide ${position} of ${count}`,
  /** LH-99: added after the position on a page of a slide the export continues, for example ", page 2 of 2". */
  page: (page, count) => `, page ${page} of ${count}`,
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
 * LH-99: a slide the export continues on further pages (LH-90) shows those pages as steps after it (`continuation: false` draws every slide
 * as written): `next` and `previous` step through them, `goTo(index)` and every index stay source slides, `getPage()` is the 0-based page
 * shown and `onPageChange(index, page)` hears every page step.
 *
 * Returns `{ element, start(slideIndex?), stop(), next(), previous(), goTo(index), getSlide(), getPage(), isRunning(), destroy() }`.
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
  // Drawn slides by deck index and page, for the deck object they were drawn from: a new snapshot (an edit) or a new start() draws again.
  let drawn = new Map(), drawnFor;
  // LH-99: the export's continuation of the deck, measured with the fonts the slides draw with. When a slide continues, every slide is
  // drawn from the export's deck, so each page and its slide number are the ones the PDF and the PPTX draw.
  const continuationNow = (deck) => (options.continuation === false ? null : continuationOf(deck, { fonts: options.fonts, catalogs: resolveOptions().catalogs, date: options.renderOptions?.date, exact: true }));
  const pagesOf = (deck, index) => pageCount(continuationNow(deck), index);
  const stepKey = (index, page) => `${index}:${page}`;

  let active = false, destroyed = false, current = -1, currentPage = 0, opener = null, enteredFullscreen = false, returnTo = null, pendingRequests = 0;
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
  // Draw the listed steps (`[index, page]`) that are not drawn yet, in one renderer call (it composes the deck once). A slide that cannot be drawn keeps the renderer's message.
  function draw(deck, steps) {
    if (deck !== drawnFor) { drawn = new Map(); drawnFor = deck; }
    const missing = steps.filter(([index, page]) => !drawn.has(stepKey(index, page)));
    if (!missing.length) return;
    const options = drawOptions();
    const continuation = continuationNow(deck);
    const source = continuation ? continuation.presentation : deck;
    const numberOf = ([index, page]) => (continuation ? continuation.pages[index][Math.min(page, continuation.pages[index].length - 1)] : index) + 1;
    try {
      const images = toSvg(source, missing.map(numberOf), options);
      missing.forEach((step, position) => drawn.set(stepKey(...step), images[position]));
    } catch {
      // One bad slide must not hide the others.
      for (const step of missing) {
        try { drawn.set(stepKey(...step), toSvg(source, numberOf(step), options)); } catch (error) { drawn.set(stepKey(...step), error?.message ?? "Preview unavailable"); }
      }
    }
  }
  /** The step before and after `[index, page]` among the slides shown: the pages of a continued slide, then the next slide. */
  function neighbors(deck, shown, index, page) {
    const at = shown.indexOf(index);
    const before = page > 0 ? [index, page - 1] : shown[at - 1] !== undefined ? [shown[at - 1], pagesOf(deck, shown[at - 1]) - 1] : undefined;
    const after = page + 1 < pagesOf(deck, index) ? [index, page + 1] : shown[at + 1] !== undefined ? [shown[at + 1], 0] : undefined;
    return [before, after].filter(Boolean);
  }
  function preload(deck, shown, index, page) {
    win.clearTimeout(preloadTimer);
    const wanted = neighbors(deck, shown, index, page);
    if (!wanted.length) return;
    preloadTimer = win.setTimeout(() => {
      if (active) draw(deck, wanted);
    }, PRELOAD_DELAY_MS);
  }
  // Draw the slide once the faces its deck needs are loaded (a deck in loaded faces draws synchronously).
  function render(index, page = 0) {
    const token = ++renderToken;
    const deck = deckNow();
    const renderOptions = resolveOptions();
    return whenFontsReady(options.fonts, deck, {
      renderOptions,
      isCurrent: () => active && token === renderToken,
      loading: () => showMessage(labels.loading),
      ready: () => {
        // The pages are known once the faces are: a slide shown before that is shown again on its page.
        const pages = pagesOf(deck, index);
        const shownPage = Math.min(page, pages - 1);
        if (index === current && shownPage !== currentPage) currentPage = shownPage;
        announce(deck, index, shownPage, pages);
        draw(deck, [[index, shownPage]]);
        paint(drawn.get(stepKey(index, shownPage)));
        preload(deck, visibleIndices(deck, includeHidden), index, shownPage);
      },
      failed: (error) => showMessage(error?.message ?? "Preview unavailable"),
    });
  }
  function announce(deck, index, page = 0, pages = 1) {
    const shown = visibleIndices(deck, includeHidden);
    const position = shown.indexOf(index);
    counter.textContent = `${formatSlideCounter(Math.max(0, position), shown.length)}${pages > 1 ? ` \u00B7 ${page + 1}/${pages}` : ""}`;
    live.textContent = position < 0 ? "" : `${labels.position(position + 1, shown.length)}${pages > 1 ? labels.page(page + 1, pages) : ""}`;
  }

  function show(wanted, { notify = true, page = 0 } = {}) {
    const deck = deckNow();
    const index = resolve(deck, wanted);
    if (index < 0) {
      current = -1;
      currentPage = 0;
      renderToken++;
      showMessage(labels.empty);
      counter.textContent = formatSlideCounter(0, 0);
      live.textContent = labels.empty;
      return false;
    }
    const changed = index !== current;
    const pageChanged = changed || page !== currentPage;
    current = index;
    currentPage = page;
    announce(deck, index);
    render(index, page);
    if (changed && notify) options.onSlideChange?.(index);
    if (pageChanged && notify) options.onPageChange?.(index, page);
    return pageChanged;
  }
  function move(step) {
    if (!active || current < 0) return false;
    const deck = deckNow();
    // LH-99: the pages of a slide the export continues are steps of that slide.
    const pages = pagesOf(deck, current);
    if (step > 0 && currentPage + 1 < pages) return show(current, { page: currentPage + 1 });
    if (step < 0 && currentPage > 0) return show(current, { page: Math.min(currentPage, pages) - 1 });
    const shown = visibleIndices(deck, includeHidden);
    const at = shown.indexOf(current);
    // The shown slide can be gone (the deck changed under it): step from where it was.
    const target = at >= 0 ? shown[at + step] : step > 0 ? shown.find((index) => index > current) : [...shown].reverse().find((index) => index < current);
    // Back from a slide lands on the last page of the slide before, as reading backwards does.
    return target === undefined ? false : show(target, { page: step < 0 ? pagesOf(deck, target) - 1 : 0 });
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
    const state = stateOf(doc);
    const ticket = ++state.requests;
    state.inFlight.add(ticket);
    pendingRequests++;
    state.abandoned.delete(root);
    const answered = () => { state.inFlight.delete(ticket); pendingRequests--; };
    let attempt;
    try { attempt = Promise.resolve(request.call(root, { navigationUI: "hide" })); } catch (error) { attempt = Promise.reject(error); }
    return attempt.then(
      () => {
        answered();
        if (doc.fullscreenElement !== root) return reclaimAbandoned();
        if (!active) {
          // stop() ran while the request was pending (a quick Esc or close), so it saw no full screen to leave: give the screen back now, or the
          // page stays full screen behind a hidden presenter. Not when a newer request is still in flight: it replaces this element, and an exit asked
          // for now would run after it and end the newer presenter's full screen.
          if ([...state.inFlight].some((newer) => newer > ticket)) state.abandoned.add(root); else leaveFullscreen();
          return "overlay";
        }
        enteredFullscreen = true;
        root.dataset.mode = "fullscreen";
        return "fullscreen";
      },
      () => { answered(); return reclaimAbandoned(); },
    );
  }
  // This presenter did not get the screen (refused, or taken by another element): if an earlier, closed presenter's element still holds it
  // because that presenter left the exit to this request, give it back.
  function reclaimAbandoned() {
    const holder = doc.fullscreenElement, { abandoned } = stateOf(doc);
    if (holder && holder !== root && abandoned.has(holder)) { abandoned.delete(holder); leaveFullscreen(); } else if (!active) restoreFocus();
    return "overlay";
  }
  // Ask the browser to leave full screen; onFullscreenChange then sees that the event answers an exit asked for (by this presenter or an earlier
  // one) and does not read it as the user's. Focus goes back to the element that opened the presentation once the exit is done (or refused: the
  // screen was already gone), because the page behind a full screen element takes no focus until then.
  function leaveFullscreen() {
    const exit = noteExit(doc);
    Promise.resolve(doc.exitFullscreen?.()).then(() => { exit.settle(true); restoreFocus(); }, () => { exit.settle(false); restoreFocus(); });
  }
  // Only when nobody took focus since (focus still inside the hidden presenter, on the exit button after a click, counts as nobody: the browser
  // moves it to the body only at its next render, which can come after the `fullscreenchange` that ends the exit): the host may move it in `onExit`. While the screen is still full screen the page behind takes no focus, and
  // a browser reports the end of an exit's promise before the end of full screen; so the element is kept until the `fullscreenchange` that ends it (and while a request of this presenter is unanswered: it may still take the screen).
  function restoreFocus() {
    const now = doc.activeElement;
    if (returnTo?.isConnected && typeof returnTo.focus === "function" && (!now || now === doc.body || root.contains(now))) returnTo.focus({ preventScroll: true });
    if (!doc.fullscreenElement && !pendingRequests) returnTo = null;
  }
  // The browser takes full screen away with Esc (that key never reaches the page) or the host exits it: the presentation ends with it.
  function onFullscreenChange(event) {
    if (doc.fullscreenElement === root) {
      // Our own full screen. An exit that settled without an event of its own (a browser merges an exit and the next request into one change) will
      // never be answered: events come in the order of the changes, so a later exit event is the user's and must not be read as that exit.
      forgetSettledExits(doc);
      return;
    }
    if (!active && !doc.fullscreenElement) restoreFocus();
    if (answersAnExit(doc, event)) {
      // An exit that a presenter asked for finished: ours from stop(), or an earlier presenter's that ran after this one took full screen. A
      // presentation still running carries on as the overlay.
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
    else if (key === "End") { const deck = deckNow(), last = resolve(deck, Number.MAX_SAFE_INTEGER); show(last, { page: last < 0 ? 0 : pagesOf(deck, last) - 1 }); }
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
    returnTo = null;
    opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    current = -1;
    currentPage = 0;
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
    /** LH-99: the 0-based page shown of a slide the export continues (0 for every other slide, and when stopped). */
    getPage: () => (active && current >= 0 ? currentPage : 0),
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
 * or `"primary"`: the filled accent look of the Export trigger) and `icons` (`{ present }`, see `src/icons.js`). A disabled button stays focusable (`aria-disabled`) and does nothing.
 *
 * Returns `{ element, setDisabled(reason), setDensity(density), setVariant(variant), destroy() }`.
 */
export function createPresentButton(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const label = options.label ?? "Present";
  const icons = normalizeIcons(options.icons, ["present"], "createPresentButton icons");
  const glyph = resolveIcon(doc, icons.present, null, { name: "present", size: 16 }) ?? icon(doc, "Presentation", 16);
  glyph.setAttribute("data-opf-icon", "present");
  let disabledReason = options.disabled === true ? "Nothing to present." : typeof options.disabled === "string" && options.disabled ? options.disabled : undefined;
  let destroyed = false;
  const button = el(doc, "button", {
    type: "button", class: "opf-present-button opf-ui", "aria-label": label, title: "Present (F5)", "aria-keyshortcuts": "F5",
    "data-density": options.density === "touch" ? "touch" : "comfortable", "data-variant": options.variant === "primary" ? "primary" : "quiet",
  }, glyph);
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
