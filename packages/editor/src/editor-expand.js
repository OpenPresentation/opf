// CE-28: the "expand editor" part. `createExpandController` makes the editor's host element fill the viewport for editing (a fixed overlay driven by
// `data-opf-expanded` and src/styles/expand.css; the element is never moved, so the editor keeps its state), and `createExpandButton` is the toolbar
// control for it. This is not the presenter (src/presenter.js), which shows slides on black. Both share one idea with it: the Fullscreen API is only a
// bonus on top of the overlay, because it is refused without a user gesture, in an iframe without `allow="fullscreen"` and on iPhone Safari.
// Plain DOM, no framework, no network. `target.ownerDocument` is the document, so it works in iframes. Icons are the Lucide Maximize2 and Minimize2
// paths (ISC license), inlined.
import { normalizeIcons, resolveIcon } from "./icons.js";

// Each icon is a list of [tag, attributes]; a host replaces one with `icons: { expand, collapse }`.
const ICON_NAMES = ["expand", "collapse"];
const ICONS = {
  expand: ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"].map((d) => ["path", { d }]),
  collapse: ["m14 10 7-7", "M20 10h-6V4", "m3 21 7-7", "M4 14h6v6"].map((d) => ["path", { d }]),
};

const DEFAULT_LABELS = {
  /** The accessible name of the button while the editor is not expanded. */
  expand: "Expand editor",
  /** The accessible name of the button while the editor is expanded. */
  collapse: "Exit expanded editor",
  /** The key named in the tooltip of the expanded button: "Exit expanded editor (Esc)". */
  escape: "Esc",
  /** The status line when the editor expands. */
  expanded: "Editor expanded. Press Escape to exit.",
  /** The status line when it returns. */
  collapsed: "Editor restored.",
};

// ---- per-document state -------------------------------------------------------------------------------------------------------------------
// The scroll lock and "who is expanded" belong to the document, not to one controller: any number of editors can be mounted on a page.
const documentStates = new WeakMap(); // Document -> { active, locks, saved }
function stateOf(doc) {
  let state = documentStates.get(doc);
  if (!state) documentStates.set(doc, state = { active: null, locks: 0, saved: null });
  return state;
}
const SCROLL_PROPS = ["overflow-x", "overflow-y"];
// Page scroll is locked with `overflow: hidden !important` on the document element. What the page had there (value and priority of the shorthand
// and of both longhands) is saved by the first lock and written back by the last unlock, so a page that set `overflow: scroll` gets exactly that.
function lockScroll(doc) {
  const state = stateOf(doc);
  const style = doc.documentElement?.style;
  if (!style) return;
  if (state.locks++ > 0) return;
  state.saved = { shorthand: [style.getPropertyValue("overflow"), style.getPropertyPriority("overflow")], longhands: SCROLL_PROPS.map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]) };
  style.setProperty("overflow", "hidden", "important");
}
function unlockScroll(doc) {
  const state = stateOf(doc);
  const style = doc.documentElement?.style;
  if (!style || state.locks === 0) return;
  if (--state.locks > 0) return;
  const { shorthand, longhands } = state.saved;
  state.saved = null;
  style.removeProperty("overflow");
  if (shorthand[0]) style.setProperty("overflow", shorthand[0], shorthand[1]);
  else for (const [name, value, priority] of longhands) if (value) style.setProperty(name, value, priority);
  if (!doc.documentElement.getAttribute("style")) doc.documentElement.removeAttribute("style");
}

const fullscreenElementOf = (doc) => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"]);
// What owns Escape while the focus is in it: typing, an editor, a menu, a dialog. A dialog or menu that contains the target (the editor lives in a
// modal) does not count: it is the editor's surroundings, not something open over it.
const OWNS_ESCAPE = '[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],.cm-editor,[role="textbox"],[role="combobox"],[role="listbox"],[role="menu"],[role="menubar"],[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog[open]';
function ownsEscape(node, target) {
  if (!node || typeof node.closest !== "function") return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT" && !NON_TEXT_INPUTS.has((node.getAttribute("type") ?? "text").toLowerCase())) return true;
  // A trigger whose popup is open (a menu button) closes the popup first.
  if (node.hasAttribute("aria-haspopup") && node.getAttribute("aria-expanded") === "true") return true;
  let hit = node.closest(OWNS_ESCAPE);
  if (!hit) {
    try { hit = node.closest("[popover]:popover-open"); } catch { hit = null; }
  }
  return Boolean(hit) && !hit.contains(target);
}

// controller -> { labels, subscribe(fn), hint(element) }: what the button needs from the controller without widening the public API.
const internals = new WeakMap();

/**
 * Make `target` (the editor's host element) fill the viewport on request.
 *
 * Expanding sets `data-opf-expanded` on `target` (src/styles/expand.css turns it into a fixed overlay), locks page scroll on the document element,
 * moves the focus into `target`, and listens for Escape. Collapsing undoes each of those and returns the focus to the control that expanded. The
 * element keeps its place in the DOM, so the editor keeps its state. Only one controller per document is expanded at a time: expanding another
 * collapses the first (its `onChange` is called).
 *
 * Options: `onChange({ expanded })`, `fullscreen` (also ask the browser for full screen on `target`; best effort, the overlay is the fallback, and
 * the editor collapses when the browser leaves full screen by itself), `labels` (`expand`, `collapse`, `escape`, `expanded`, `collapsed`) and
 * `onStatus(message)` (screen-reader status lines for the two transitions), `inertOutside` (default true: while expanded, everything on the page
 * outside `target` is made `inert`, so keyboard and screen-reader users cannot reach what the overlay hides) and `keep` (elements, or a function
 * returning them, that stay interactive: a toolbar the host mounted outside `target`; read when the editor expands).
 *
 * Inert is applied to the siblings of `target` and of each of its ancestors, up to `body`; a sibling that contains a kept element is entered instead.
 * Elements that are already `inert`, `script`, `style` and `template` are left alone, and so is a running or mounted presenter (`.opf-presenter`).
 * Exactly the elements this controller marked are restored on collapse, destroy and hand-over. It is a snapshot: an element added to the page while
 * the editor is expanded (a menu appended to `body`) is not inert.
 *
 * Returns `{ expanded, expand(on = true), collapse(), toggle(), destroy() }`. The three methods return the resulting state.
 */
export function createExpandController(target, options = {}) {
  if (!target?.ownerDocument) throw new TypeError("A DOM element is required.");
  const doc = target.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const { onChange, onStatus } = options;
  const wantsFullscreen = options.fullscreen === true;
  const inertOutside = options.inertOutside !== false;
  let inertMarks = [];
  const subscribers = new Set();
  const yielded = new WeakSet(); // Escape events a typing field, menu, dialog or the presenter owns (decided before anyone handles them)
  let expanded = false, destroyed = false, enteredFullscreen = false, addedTabindex = false, returnTo = null, hinted = null;

  const slot = { target, release: (releaseOptions) => leave({ ...releaseOptions, restoreFocus: false }) };
  let handedOffFrom = null; // the target of the controller this one replaced while it was in full screen

  function announce() {
    for (const subscriber of [...subscribers]) subscriber(expanded);
    if (typeof onChange === "function") onChange({ expanded });
    if (typeof onStatus === "function") onStatus(expanded ? labels.expanded : labels.collapsed);
  }

  // ---- focus ------------------------------------------------------------------------------------------------------------------------------
  const isRealFocus = (node) => node && node !== doc.body && node !== doc.documentElement;
  function moveFocusIn() {
    const active = doc.activeElement;
    // The control that expanded, when it lives in the editor, keeps the focus (it is now the "exit" control); anything else in the editor too.
    if (hinted && target.contains(hinted) && typeof hinted.focus === "function") hinted.focus({ preventScroll: true });
    else if (!(isRealFocus(active) && target.contains(active))) {
      if (!target.hasAttribute("tabindex")) { target.setAttribute("tabindex", "-1"); addedTabindex = true; }
      target.focus({ preventScroll: true });
    }
  }
  // Only when nobody took the focus since (the host may move it in `onChange`). While the page is still full screen the page behind takes no
  // focus, so this runs again when the exit has finished.
  function restoreFocus() {
    const now = doc.activeElement;
    if (returnTo?.isConnected && typeof returnTo.focus === "function" && (!isRealFocus(now) || target.contains(now))) returnTo.focus({ preventScroll: true });
  }

  // ---- full screen ------------------------------------------------------------------------------------------------------------------------
  function exitFullscreen(then) {
    let result;
    try { result = (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc); } catch { result = undefined; }
    Promise.resolve(result).then(() => then?.(), () => then?.());
  }
  // The previous editor kept the screen for this one to take over; when this one did not get it, the previous one's element must not keep it.
  function reclaimHandedOff() {
    const previous = handedOffFrom;
    handedOffFrom = null;
    if (previous && fullscreenElementOf(doc) === previous) exitFullscreen(restoreFocus);
  }
  function requestFullscreen() {
    const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
    if (typeof request !== "function" || (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled) === false) return reclaimHandedOff();
    let attempt;
    try { attempt = Promise.resolve(request.call(target, { navigationUI: "hide" })); } catch (error) { attempt = Promise.reject(error); }
    attempt.then(
      () => {
        reclaimHandedOff();
        if (fullscreenElementOf(doc) !== target) return;
        // Collapsed (or destroyed) while the request was pending: the screen is ours now, so give it back.
        if (!expanded) exitFullscreen(restoreFocus);
        else enteredFullscreen = true;
      },
      reclaimHandedOff, // refused (no gesture, an iframe without allow="fullscreen", iPhone): the overlay is the expanded editor
    );
  }
  // The browser leaves full screen by itself (Esc, a swipe, the host): the expanded editor ends with it. An exit this controller asked for clears
  // `enteredFullscreen` first, so its event is not read as the user's. Another element taking the screen (the presenter) leaves the overlay in place.
  function onFullscreenChange() {
    if (!expanded) return;
    const holder = fullscreenElementOf(doc);
    if (holder === target) { if (wantsFullscreen) enteredFullscreen = true; return; }
    if (holder) { if (!target.contains(holder)) enteredFullscreen = false; return; }
    if (enteredFullscreen) leave({ exitFullscreen: false });
  }

  // ---- inert -----------------------------------------------------------------------------------------------------------------------------
  const INERT_SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);
  function applyInert() {
    const root = doc.body;
    if (!inertOutside || !root || !root.contains(target) || target === root) return;
    const wanted = typeof options.keep === "function" ? options.keep() : options.keep;
    // A mounted presenter lives outside the editor and must stay usable when it is opened from the expanded editor.
    const keeps = [...(wanted ? Array.from(wanted) : []), ...doc.querySelectorAll(".opf-presenter")].filter((node) => node?.nodeType === 1 && !target.contains(node) && !node.contains(target));
    const visit = (node) => {
      if (INERT_SKIP.has(node.tagName) || node.hasAttribute("inert") || keeps.includes(node)) return;
      if (keeps.some((kept) => node.contains(kept))) { for (const child of node.children) visit(child); return; }
      node.setAttribute("inert", "");
      inertMarks.push(node);
    };
    for (let current = target; current !== root; current = current.parentElement) {
      for (const sibling of current.parentElement.children) if (sibling !== current) visit(sibling);
    }
  }
  function removeInert() {
    for (const node of inertMarks) node.removeAttribute("inert");
    inertMarks = [];
  }

  // ---- Escape -----------------------------------------------------------------------------------------------------------------------------
  // Two listeners: the capture one decides whether Escape belongs to something else (the state of a menu or the presenter is gone once their own
  // handler ran); the bubbling one collapses unless the event was handled by then.
  function onKeydownCapture(event) {
    if (event.key !== "Escape") return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const presenterRunning = doc.querySelector(".opf-presenter:not([hidden])");
    if (presenterRunning || [event.target, path[0], doc.activeElement].some((node) => ownsEscape(node, target))) yielded.add(event);
  }
  function onKeydown(event) {
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (yielded.has(event)) return;
    event.preventDefault(); // handled: nobody else (the host's own Escape handler) should act on it too
    leave();
  }

  // ---- state ------------------------------------------------------------------------------------------------------------------------------
  function enter() {
    const state = stateOf(doc);
    handedOffFrom = null;
    if (state.active && state.active !== slot) {
      handedOffFrom = wantsFullscreen ? state.active.target : null;
      state.active.release({ exitFullscreen: !wantsFullscreen });
    }
    state.active = slot;
    const active = doc.activeElement;
    returnTo = hinted ?? (isRealFocus(active) ? active : null);
    expanded = true;
    target.setAttribute("data-opf-expanded", "true");
    lockScroll(doc);
    applyInert();
    doc.addEventListener("keydown", onKeydownCapture, true);
    doc.addEventListener("keydown", onKeydown, false);
    doc.addEventListener("fullscreenchange", onFullscreenChange);
    doc.addEventListener("webkitfullscreenchange", onFullscreenChange);
    moveFocusIn();
    if (wantsFullscreen) requestFullscreen();
  }
  function leave({ exitFullscreen: exit = true, restoreFocus: refocus = true, silent = false } = {}) {
    if (!expanded) return false;
    expanded = false;
    const state = stateOf(doc);
    if (state.active === slot) state.active = null;
    target.removeAttribute("data-opf-expanded");
    if (addedTabindex) { target.removeAttribute("tabindex"); addedTabindex = false; }
    unlockScroll(doc);
    removeInert();
    doc.removeEventListener("keydown", onKeydownCapture, true);
    doc.removeEventListener("keydown", onKeydown, false);
    if (enteredFullscreen) {
      enteredFullscreen = false;
      if (exit && fullscreenElementOf(doc) === target) exitFullscreen(refocus ? restoreFocus : undefined);
    }
    if (refocus) restoreFocus();
    if (!silent) announce();
    returnTo = null;
    hinted = null;
    return true;
  }
  function expand(on = true) {
    if (destroyed) return false;
    if (on === false) return collapse();
    if (!expanded) { enter(); announce(); }
    return expanded;
  }
  function collapse() {
    if (destroyed) return false;
    leave();
    return expanded;
  }

  const controller = {
    get expanded() { return expanded; },
    expand,
    collapse,
    toggle() { return expanded ? collapse() : expand(true); },
    destroy() {
      if (destroyed) return;
      leave({ silent: true });
      destroyed = true;
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
      doc.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      subscribers.clear();
    },
  };
  internals.set(controller, {
    labels,
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    // The button says which control is acting: Safari does not focus a button on click, so `activeElement` cannot name it.
    hint(element) { hinted = element; },
  });
  return controller;
}

// ---- the button ---------------------------------------------------------------------------------------------------------------------------
function icon(doc, name, given) {
  return resolveIcon(doc, given[name], ICONS[name], { name, className: "opf-expand-icon", size: 16 });
}

/**
 * Mount the expand button in `container`: an icon-only toggle (Lucide Maximize2 while the editor is not expanded, Minimize2 while it is) with
 * `aria-pressed`, the name "Expand editor" or "Exit expanded editor", and a tooltip that names the Escape key. It follows the controller, so it
 * is right when the editor collapses another way (Escape, the browser leaving full screen).
 *
 * Options: `controller` (from `createExpandController`, required), `density` (`"comfortable"` 32px, or `"touch"` 40px; a coarse pointer makes it
 * 44px either way) and `labels` (overrides the controller's).
 *
 * Returns `{ element, setDensity(density), setDisabled(disabled), menuItems(), destroy() }`. A disabled button stays focusable (`aria-disabled`)
 * and cannot expand the editor, but it can always exit it.
 */
export function createExpandButton(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { controller } = options;
  const link = internals.get(controller);
  if (!link) throw new TypeError("createExpandButton needs a controller from createExpandController.");
  const doc = container.ownerDocument;
  const labels = { ...link.labels, ...(options.labels ?? {}) };
  const icons = normalizeIcons(options.icons, ICON_NAMES, "createExpandButton icons");
  let disabled = false, destroyed = false;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "opf-expand-button opf-ui";
  button.dataset.density = options.density === "touch" ? "touch" : "comfortable";
  button.dataset.action = "expand";
  let shown = null;
  const paint = () => {
    const on = controller.expanded;
    const label = on ? labels.collapse : labels.expand;
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.setAttribute("aria-label", label);
    button.title = on ? `${label} (${labels.escape})` : label;
    if (on) button.setAttribute("aria-keyshortcuts", "Escape"); else button.removeAttribute("aria-keyshortcuts");
    // Disabled stops expanding only: an expanded editor must always be able to exit.
    if (disabled && !on) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled");
    if (shown !== on) {
      shown = on;
      button.replaceChildren(icon(doc, on ? "collapse" : "expand", icons));
    }
  };
  button.addEventListener("click", () => {
    if (destroyed || (disabled && !controller.expanded)) return;
    link.hint(button);
    controller.toggle();
  });
  const unsubscribe = link.subscribe(paint);
  paint();
  container.append(button);

  return {
    element: button,
    setDensity(density) { button.dataset.density = density === "touch" ? "touch" : "comfortable"; },
    setDisabled(value) { disabled = Boolean(value); paint(); },
    /** What the toolbar's overflow menu offers: one toggle item. */
    menuItems() {
      const on = controller.expanded;
      return [{ id: "expand", label: on ? labels.collapse : labels.expand, pressed: on, ...(disabled && !on ? { disabled: true } : {}), run: () => { controller.toggle(); } }];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      button.remove();
    },
  };
}
