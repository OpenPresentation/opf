// RR-28: the slideshow player. `present()` takes a deck over the screen (full-screen, keyboard and swipe driven) and can open a
// speaker view in a second window with the current and next slide, plain-text notes, a timer and the clock. Every window
// shows the renderer's own SVG; windows of one deck follow each other over a BroadcastChannel (same origin). Hidden
// slides are skipped. No transitions or builds (deferred, opf#250) and no rich notes (opf#251): notes are plain text.
import {
  DeckError, createCursor, createDeckStore, createSync, createTimer, deckChannelName, formatDuration, localIsoDate, newSurfaceId,
  parseDeckDocument, plainText, presentableIndexes, prepareSlideSvg, sanitizeSvgTree, slideLabel, stateWins, svgDimensions,
} from "./deck-runtime.js";
import { loadPreviewFonts } from "./preview-fonts.js";

export { DeckError } from "./deck-runtime.js";

const AUDIENCE_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.player { position: fixed; inset: 0; z-index: 2147483000; background: #000; color: #fff; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; outline: none; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.player.idle { cursor: none; }
.stage { position: absolute; inset: 0; container-type: size; display: grid; place-items: center; }
.frame { width: min(100cqw, calc(100cqh * var(--ratio-n, 1.7778))); aspect-ratio: var(--ratio, 16 / 9); position: relative; }
.frame svg.opf-slide { display: block; width: 100%; height: 100%; }
.blank { position: absolute; inset: 0; }
.blank[hidden] { display: none; }
.blank.black { background: #000; }
.blank.white { background: #fff; }
.hud { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: linear-gradient(transparent, rgb(0 0 0 / 0.7)); }
.hud button { font: inherit; color: #fff; background: rgb(255 255 255 / 0.16); border: 1px solid rgb(255 255 255 / 0.5); border-radius: 6px; min-width: 40px; min-height: 40px; padding: 4px 12px; cursor: pointer; }
.hud button:hover { background: rgb(255 255 255 / 0.3); }
.hud button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.hud button[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.hud .counter { min-width: 5em; text-align: center; font-variant-numeric: tabular-nums; }
.player.idle .hud:not(:focus-within) { opacity: 0; pointer-events: none; }
@media (prefers-reduced-motion: no-preference) { .hud { transition: opacity 200ms; } }
.goto { position: absolute; top: 16px; right: 16px; padding: 8px 14px; border-radius: 6px; background: rgb(0 0 0 / 0.75); border: 1px solid rgb(255 255 255 / 0.5); font-size: 20px; }
.goto[hidden] { display: none; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.msg { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; }
@media (forced-colors: active) { .hud button { border-color: ButtonText; } }
`;

const PRESENTER_CSS = `
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; margin: 0; }
body { background: #15171a; color: #f2f4f7; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.pv { display: grid; grid-template-rows: auto 1fr auto; position: relative; height: 100vh; gap: 10px; padding: 12px; }
header, footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
header .grow { flex: 1 1 auto; }
.big { font-size: 22px; font-variant-numeric: tabular-nums; }
.muted { color: #aab2bd; }
.over { color: #ff8a80; }
main { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px; min-height: 0; }
.col { display: flex; flex-direction: column; gap: 10px; min-height: 0; min-width: 0; }
h2 { margin: 0 0 4px; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #aab2bd; }
.slidebox { position: relative; width: 100%; background: #000; border: 1px solid #3a3f47; border-radius: 6px; overflow: hidden; aspect-ratio: var(--ratio, 16 / 9); }
.slidebox svg.opf-slide { display: block; width: 100%; height: 100%; }
.slidebox .end { position: absolute; inset: 0; display: grid; place-items: center; color: #aab2bd; text-align: center; padding: 8px; }
.notes { flex: 1 1 auto; min-height: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #1d2024; border: 1px solid #3a3f47; border-radius: 6px; padding: 10px 12px; font-size: var(--notes-size, 20px); line-height: 1.45; }
.notes:focus-visible, button:focus-visible { outline: 3px solid #8ab4ff; outline-offset: 2px; }
button { font: inherit; color: inherit; background: #2a2e34; border: 1px solid #5b626c; border-radius: 6px; min-height: 36px; padding: 4px 12px; cursor: pointer; }
button:hover { background: #343941; }
button[aria-pressed="true"] { background: #3d5a99; }
button[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 760px) { main { grid-template-columns: 1fr; overflow: auto; } }
@media (forced-colors: active) { button, .notes, .slidebox { border-color: ButtonText; } }
`;

/** Document indexes in the presentation order, from the options. */
const sequenceOf = (document, options) => presentableIndexes(document, { includeHidden: options.includeHidden });

function drawInto(host, svg, doc, { aria } = {}) {
  const template = doc.createElement("template");
  template.innerHTML = prepareSlideSvg(svg);
  const node = template.content.firstElementChild;
  if (node) {
    sanitizeSvgTree(node);
    if (aria === "hidden") node.setAttribute("aria-hidden", "true");
    host.replaceChildren(node);
  }
  return svgDimensions(svg);
}

/** Adopt a stylesheet (not subject to a page's style-src for inline styles); a <style> element where that is unavailable. */
function adoptStyles(win, doc, node, css) {
  try {
    const sheet = new win.CSSStyleSheet();
    sheet.replaceSync(css);
    node.adoptedStyleSheets = [...node.adoptedStyleSheets, sheet];
  } catch {
    const style = doc.createElement("style");
    style.textContent = css;
    (node.head ?? node).append(style);
  }
}

function makeElement(doc) {
  return (tag, attributes = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  };
}

/** The keys both windows understand. Returns an action, or undefined when the key is not ours. */
function keyAction(event, buffer) {
  if (event.ctrlKey || event.altKey || event.metaKey) return undefined;
  const key = event.key;
  if (/^[0-9]$/.test(key)) return { type: "digit", digit: key };
  switch (key) {
    case "ArrowRight": case "ArrowDown": case "PageDown": return { type: "next" };
    case "ArrowLeft": case "ArrowUp": case "PageUp": return { type: "previous" };
    case " ": return { type: event.shiftKey ? "previous" : "next" };
    case "Enter": return buffer ? { type: "commit" } : { type: "next" };
    case "Backspace": return buffer ? { type: "erase" } : { type: "previous" };
    case "Home": return { type: "first" };
    case "End": return { type: "last" };
    case "Escape": return buffer ? { type: "cancel" } : { type: "exit" };
    case "n": case "N": return { type: "next" };
    case "p": case "P": return { type: "previous" };
    case "b": case "B": case ".": return { type: "blank", mode: "black" };
    case "w": case "W": case ",": return { type: "blank", mode: "white" };
    case "s": case "S": return { type: "speaker" };
    case "f": case "F": return { type: "fullscreen" };
    default: return undefined;
  }
}

/**
 * One window's view of the show. A surface owns its own position and blank state, draws it through a `view`, and keeps the
 * other windows of the deck in step over the channel; nothing else links the audience window and the speaker view.
 */
class Surface {
  constructor({ role, doc, win, store, cursor, session, view, channelName }) {
    Object.assign(this, { role, doc, win, store, cursor, session, view });
    this.blank = "none";
    this.digits = "";
    this.id = newSurfaceId();
    // The revision of the state this window shows (-1: nothing has been agreed yet) and whether it still waits for an answer to its hello.
    this.rev = -1;
    this.joining = false;
    // The opener's channel class serves every window of the show: one realm, one origin, whatever the popup's origin says.
    this.sync = createSync({
      name: channelName, id: this.id, BroadcastChannelImpl: session.win.BroadcastChannel,
      onState: (state) => this.receive(state),
      getState: () => this.state(),
    });
    this.keydown = (event) => this.onKey(event);
    this.digitTimer = undefined;
  }

  state() { return { index: this.cursor.index, blank: this.blank, rev: this.rev }; }

  /** Say hello: the other windows of the show answer with where it is, and this window takes the first answer. */
  join() { this.joining = true; this.sync.hello(); }

  /** A state from another window: the newcomer takes the first answer; after that the newer revision wins. */
  receive(state) {
    const adopt = (this.joining && state.reply) || stateWins(state, { rev: this.rev, from: this.id });
    if (!adopt) return;
    this.joining = false;
    this.rev = Math.max(this.rev, state.rev);
    this.apply(state, { broadcast: false });
  }

  /** Move to a state. `broadcast` is false for a state that came from another window. */
  apply({ index, blank }, { broadcast = true } = {}) {
    const moved = index !== undefined ? this.cursor.gotoIndex(index) : false;
    const blankChanged = blank !== undefined && blank !== this.blank;
    if (blankChanged) this.blank = blank;
    if (!moved && !blankChanged) return false;
    if (broadcast) { this.rev += 1; this.joining = false; }
    if (moved) this.setDigits("");
    this.view.render(this);
    this.session.notify(this, { moved, blankChanged });
    if (broadcast) {
      this.sync.post(this.state());
      // Without BroadcastChannel the windows of one show still follow each other directly.
      if (!this.sync.active) for (const peer of this.session.surfaces) if (peer !== this) { peer.rev = this.rev; peer.apply(this.state(), { broadcast: false }); }
    }
    return true;
  }

  navigate(position) {
    const sequence = this.cursor.sequence;
    const target = Math.min(Math.max(position, 0), sequence.length - 1);
    if (target === this.cursor.position) return false;
    return this.apply({ index: sequence[target] });
  }
  next() { return this.navigate(this.cursor.position + 1); }
  previous() { return this.navigate(this.cursor.position - 1); }
  first() { return this.navigate(0); }
  last() { return this.navigate(this.cursor.total - 1); }
  goto(number) { return this.navigate(number - 1); }
  setBlank(mode) { return this.apply({ blank: this.blank === mode ? "none" : mode }); }

  setDigits(value) {
    this.digits = value;
    this.win.clearTimeout(this.digitTimer);
    if (value) this.digitTimer = this.win.setTimeout(() => { this.digits = ""; this.view.renderDigits?.(this); }, 3000);
    this.view.renderDigits?.(this);
  }

  /** A navigating key shows the slide again if the screen was blanked. */
  onKey(event) {
    if (event.defaultPrevented) return;
    const target = event.composedPath?.()[0] ?? event.target;
    if (target?.closest?.("input, textarea, select")) return;
    const action = keyAction(event, this.digits);
    if (!action) return;
    // A focused button handles its own Enter and Space.
    if (action.type === "next" && (event.key === "Enter" || event.key === " ") && target?.localName === "button") return;
    event.preventDefault();
    switch (action.type) {
      case "digit": this.setDigits((this.digits + action.digit).slice(0, 4)); break;
      case "erase": this.setDigits(this.digits.slice(0, -1)); break;
      case "cancel": this.setDigits(""); break;
      case "commit": { const number = Number.parseInt(this.digits, 10); this.setDigits(""); if (number >= 1) this.goto(number); break; }
      case "blank": this.setBlank(action.mode); break;
      case "exit": this.session.exit(this); break;
      case "speaker": this.session.openPresenterView(); break;
      case "fullscreen": this.session.toggleFullscreen(); break;
      default:
        this.setDigits("");
        if (this.blank !== "none") this.apply({ blank: "none" });
        else if (action.type === "next") this.next();
        else if (action.type === "previous") this.previous();
        else if (action.type === "first") this.first();
        else if (action.type === "last") this.last();
    }
  }

  dispose() {
    this.win.clearTimeout(this.digitTimer);
    this.sync.close();
    this.view.dispose?.();
  }
}

// --- the audience view: the full-screen overlay ---------------------------------------------------------------------------

function mountAudience({ doc, win, container, session }) {
  const el = makeElement(doc);
  const host = doc.createElement("div");
  host.setAttribute("data-opf-player", "");
  const root = host.attachShadow({ mode: "open" });
  adoptStyles(win, doc, root, AUDIENCE_CSS);
  const parts = {};
  parts.frame = el("div", { class: "frame" });
  parts.slide = el("section", { role: "group", "aria-roledescription": "slide" });
  parts.slide.style.cssText = "position:absolute;inset:0";
  parts.frame.append(parts.slide);
  parts.message = el("div", { class: "msg", role: "status" }, "Loading slides…");
  parts.stage = el("div", { class: "stage" }, parts.frame);
  parts.blank = el("div", { class: "blank", "aria-hidden": "true" });
  parts.blank.hidden = true;
  parts.prev = el("button", { type: "button", "aria-label": "Previous slide" }, "◀");
  parts.next = el("button", { type: "button", "aria-label": "Next slide" }, "▶");
  parts.counterText = el("span", { "aria-hidden": "true" });
  parts.counter = el("span", { class: "counter" }, parts.counterText);
  parts.speaker = el("button", { type: "button", "aria-label": "Open speaker view (S)" }, "Speaker view");
  parts.exit = el("button", { type: "button", "aria-label": "Exit slideshow (Escape)" }, "Exit");
  parts.hud = el("div", { class: "hud", role: "group", "aria-label": "Slideshow controls" }, parts.prev, parts.counter, parts.next, parts.speaker, parts.exit);
  parts.goto = el("div", { class: "goto", role: "status" });
  parts.goto.hidden = true;
  parts.live = el("div", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  parts.root = el("div", { class: "player", role: "dialog", "aria-modal": "true", "aria-label": "Slideshow", tabindex: "-1" }, parts.stage, parts.blank, parts.message, parts.hud, parts.goto, parts.live);
  root.append(parts.root);

  const view = {
    host, parts, surface: undefined, idleTimer: undefined, swiped: false, start: undefined, previouslyInert: [], drawn: false, returnFocus: undefined,
    setName(name) { parts.root.setAttribute("aria-label", `Slideshow: ${name}`); },
    failed(message) { parts.message.setAttribute("role", "alert"); parts.message.hidden = false; parts.message.textContent = message; },
    render(surface) {
      const { cursor, store } = surface;
      const info = store.info(cursor.index);
      let svg;
      try { svg = store.svg(cursor.index); } catch (error) { view.failed(error.message); return; }
      parts.message.hidden = true;
      const { width, height } = drawInto(parts.slide, svg, doc);
      parts.frame.style.setProperty("--ratio", `${width} / ${height}`);
      parts.frame.style.setProperty("--ratio-n", String(width / height));
      const label = slideLabel(info, cursor.number, cursor.total);
      parts.slide.setAttribute("aria-label", label);
      parts.counterText.textContent = `${cursor.number} / ${cursor.total}`;
      parts.prev.setAttribute("aria-disabled", String(cursor.number <= 1));
      parts.next.setAttribute("aria-disabled", String(cursor.number >= cursor.total));
      parts.blank.hidden = surface.blank === "none";
      parts.blank.className = `blank ${surface.blank === "white" ? "white" : "black"}`;
      // Announce a new slide, and a blank screen; not the first draw.
      if (view.drawn) parts.live.textContent = surface.blank !== "none" ? `${surface.blank === "white" ? "White" : "Black"} screen` : label;
      view.drawn = true;
      this.renderDigits(surface);
      const next = cursor.sequence[cursor.position + 1];
      if (next !== undefined) win.setTimeout(() => { try { store.svg(next); } catch { /* shown (and reported) when reached */ } }, 0);
    },
    renderDigits(surface) {
      parts.goto.hidden = !surface.digits;
      parts.goto.textContent = surface.digits ? `Go to slide ${surface.digits}` : "";
    },
    wake() {
      parts.root.classList.remove("idle");
      win.clearTimeout(view.idleTimer);
      view.idleTimer = win.setTimeout(() => parts.root.classList.add("idle"), 2500);
    },
    attach(returnFocus) {
      view.returnFocus = returnFocus;
      container.append(host);
      // The rest of the page is inert (not focusable, not announced) while the dialog is open.
      let node = host;
      while (node && node !== doc.documentElement) {
        for (const sibling of Array.from(node.parentElement?.children ?? [])) {
          if (sibling !== node && !sibling.inert && sibling.localName !== "script" && sibling.localName !== "style") { sibling.inert = true; view.previouslyInert.push(sibling); }
        }
        node = node.parentElement;
      }
      parts.root.focus({ preventScroll: true });
      view.wake();
    },
    dispose() {
      win.clearTimeout(view.idleTimer);
      for (const node of view.previouslyInert) node.inert = false;
      view.previouslyInert = [];
      host.remove();
      const target = view.returnFocus;
      if (target && target.isConnected) target.focus?.({ preventScroll: true });
    },
  };

  parts.prev.addEventListener("click", () => view.surface?.previous());
  parts.next.addEventListener("click", () => view.surface?.next());
  parts.speaker.addEventListener("click", () => session.openPresenterView());
  parts.exit.addEventListener("click", () => session.close());
  parts.root.addEventListener("pointermove", () => view.wake());
  parts.root.addEventListener("pointerdown", (event) => { view.swiped = false; view.start = { x: event.clientX, y: event.clientY, id: event.pointerId }; view.wake(); });
  parts.root.addEventListener("pointerup", (event) => {
    const start = view.start; view.start = undefined;
    if (!start || start.id !== event.pointerId || !view.surface) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) >= Math.abs(dy) * 1.5) { view.swiped = true; if (dx < 0) view.surface.next(); else view.surface.previous(); }
  });
  parts.root.addEventListener("click", (event) => {
    if (view.swiped) { view.swiped = false; return; }
    if (!view.surface || event.composedPath().includes(parts.hud)) return;
    if (view.surface.blank !== "none") { view.surface.apply({ blank: "none" }); return; }
    const box = parts.root.getBoundingClientRect();
    if (event.clientX - box.left < box.width / 3) view.surface.previous(); else view.surface.next();
  });
  // Keep Tab inside the dialog.
  parts.root.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const buttons = [...parts.hud.querySelectorAll("button")];
    const at = buttons.indexOf(root.activeElement);
    if (event.shiftKey && at <= 0) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && at === buttons.length - 1) { event.preventDefault(); buttons[0].focus(); }
  });
  return view;
}

// --- the speaker view ------------------------------------------------------------------------------------------------

/**
 * The speaker view's DOM. `target` is where it goes (a popup's body, or a shadow root) and `styleTarget` takes its styles;
 * `setTitle` names a popup window. Text from the deck (notes, section) is only ever set as text.
 */
function mountPresenter({ doc, win, name, session, now, duration, parent, target, styleTarget, setTitle }) {
  const el = makeElement(doc);
  if (setTitle) { doc.title = `Speaker view: ${name}`; doc.documentElement.lang = parent.documentElement.lang || "en"; }
  const parts = {};
  parts.position = el("span", { class: "big" });
  parts.section = el("span", { class: "muted" });
  parts.timer = el("span", { class: "big", role: "timer", "aria-label": "Elapsed time" });
  parts.target = el("span", { class: "muted" });
  parts.toggle = el("button", { type: "button" }, "Pause");
  parts.reset = el("button", { type: "button" }, "Reset timer");
  parts.clock = el("span", { class: "big", "aria-label": "Time of day" });
  parts.header = el("header", {}, parts.position, parts.section, el("span", { class: "grow" }), parts.timer, parts.target, parts.toggle, parts.reset, parts.clock);
  parts.currentBox = el("div", { class: "slidebox" });
  parts.currentSlide = el("div", { role: "group", "aria-roledescription": "slide" });
  parts.currentSlide.style.cssText = "position:absolute;inset:0";
  parts.currentBox.append(parts.currentSlide);
  parts.nextBox = el("div", { class: "slidebox" });
  parts.nextSlide = el("div", { "aria-hidden": "true" });
  parts.nextSlide.style.cssText = "position:absolute;inset:0";
  parts.end = el("div", { class: "end" }, "End of slideshow");
  parts.nextBox.append(parts.nextSlide, parts.end);
  parts.notes = el("div", { class: "notes", tabindex: "0", role: "region", "aria-label": "Speaker notes" });
  parts.left = el("div", { class: "col" }, el("div", {}, el("h2", {}, "Current slide"), parts.currentBox));
  parts.right = el("div", { class: "col" }, el("div", {}, el("h2", {}, "Next slide"), parts.nextBox), el("h2", {}, "Notes"), parts.notes);
  parts.main = el("main", {}, parts.left, parts.right);
  parts.prev = el("button", { type: "button" }, "◀ Previous");
  parts.next = el("button", { type: "button" }, "Next ▶");
  parts.black = el("button", { type: "button", "aria-pressed": "false", title: "Black screen (B)" }, "Black screen");
  parts.white = el("button", { type: "button", "aria-pressed": "false", title: "White screen (W)" }, "White screen");
  parts.smaller = el("button", { type: "button", "aria-label": "Smaller notes text" }, "A−");
  parts.larger = el("button", { type: "button", "aria-label": "Larger notes text" }, "A+");
  parts.goto = el("span", { class: "muted", role: "status" });
  parts.live = el("div", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  parts.grow = el("span", { class: "grow" });
  parts.footer = el("footer", {}, parts.prev, parts.next, parts.black, parts.white, parts.grow, parts.goto, parts.smaller, parts.larger);
  parts.heading = el("h1", { class: "sr-only" }, `Speaker view: ${name}`);
  parts.header.prepend(parts.heading);
  parts.root = el("div", { class: "pv" }, parts.header, parts.main, parts.footer, parts.live);
  target.replaceChildren(parts.root);
  adoptStyles(win, doc, styleTarget.getRootNode?.() ?? styleTarget, PRESENTER_CSS);

  const timer = createTimer(now);
  timer.start();
  const targetMs = Number.isFinite(duration) && duration > 0 ? duration * 60000 : undefined;
  const clockFormat = (() => { try { return new win.Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return undefined; } })();
  let fontSize = 20;
  const synced = new WeakSet();
  const view = {
    parts, surface: undefined, drawn: false, interval: undefined, timer,
    // Fonts live in the document that loaded them; the speaker view's own document gets the same faces.
    syncFonts() {
      if (doc === parent) return;
      try { for (const face of parent.fonts) if (!synced.has(face)) { synced.add(face); doc.fonts.add(face); } } catch { /* the notes still read; slides draw with the next best font */ }
    },
    render(surface) {
      view.syncFonts();
      const { cursor, store } = surface;
      const info = store.info(cursor.index);
      let svg;
      try { svg = store.svg(cursor.index); } catch (error) { parts.currentSlide.textContent = error.message; return; }
      const { width, height } = drawInto(parts.currentSlide, svg, doc);
      parts.root.style.setProperty("--ratio", `${width} / ${height}`);
      parts.currentSlide.setAttribute("aria-label", slideLabel(info, cursor.number, cursor.total));
      parts.position.textContent = `Slide ${cursor.number} of ${cursor.total}`;
      parts.section.textContent = info.section ? `Section: ${info.section}` : "";
      const nextIndex = cursor.sequence[cursor.position + 1];
      parts.end.hidden = nextIndex !== undefined;
      if (nextIndex !== undefined) { try { drawInto(parts.nextSlide, store.svg(nextIndex), doc, { aria: "hidden" }); } catch { parts.nextSlide.replaceChildren(); } }
      else parts.nextSlide.replaceChildren();
      // Plain text only: notes are never parsed as markup.
      parts.notes.textContent = info.notes || "No notes for this slide.";
      parts.notes.style.color = info.notes ? "" : "#aab2bd";
      parts.notes.scrollTop = 0;
      parts.prev.setAttribute("aria-disabled", String(cursor.number <= 1));
      parts.next.setAttribute("aria-disabled", String(cursor.number >= cursor.total));
      parts.black.setAttribute("aria-pressed", String(surface.blank === "black"));
      parts.white.setAttribute("aria-pressed", String(surface.blank === "white"));
      if (view.drawn) parts.live.textContent = slideLabel(info, cursor.number, cursor.total);
      view.drawn = true;
      this.renderDigits(surface);
      view.tick();
    },
    renderDigits(surface) { parts.goto.textContent = surface.digits ? `Go to slide ${surface.digits}` : ""; },
    tick() {
      const elapsed = timer.elapsed();
      parts.timer.textContent = formatDuration(elapsed);
      parts.timer.classList.toggle("over", targetMs !== undefined && elapsed > targetMs);
      parts.target.textContent = targetMs !== undefined ? `of ${formatDuration(targetMs)}` : "";
      parts.toggle.textContent = timer.running ? "Pause" : "Resume";
      const date = new Date(now());
      parts.clock.textContent = clockFormat ? clockFormat.format(date) : date.toTimeString().slice(0, 5);
    },
    dispose() { win.clearInterval(view.interval); },
  };
  view.interval = win.setInterval(() => view.tick(), 1000);
  parts.prev.addEventListener("click", () => view.surface?.previous());
  parts.next.addEventListener("click", () => view.surface?.next());
  parts.black.addEventListener("click", () => view.surface?.setBlank("black"));
  parts.white.addEventListener("click", () => view.surface?.setBlank("white"));
  parts.toggle.addEventListener("click", () => { timer.toggle(); view.tick(); });
  parts.reset.addEventListener("click", () => { timer.reset(); view.tick(); });
  const resize = (delta) => { fontSize = Math.min(48, Math.max(12, fontSize + delta)); parts.notes.style.setProperty("--notes-size", `${fontSize}px`); };
  parts.smaller.addEventListener("click", () => resize(-2));
  parts.larger.addEventListener("click", () => resize(2));
  return view;
}

// --- the session -------------------------------------------------------------------------------------------------------

/**
 * A running slideshow. It is an EventTarget: `slidechange` (detail `{ slide, total, index, id, title, notes, section }`),
 * `blank` (`{ mode }`), `presenterview` (`{ open }`) and `close` (`{ slide, index }`). Slide and blank changes made in the
 * speaker view reach it too, so the page sees one stream of events.
 */
export class PlayerSession extends EventTarget {
  constructor({ doc, win, now, abort }) {
    super();
    Object.assign(this, { doc, win, now, abort });
    this.surfaces = new Set();
    this.closed = false;
    this.presenter = undefined;
    this.enteredFullscreen = false;
    this.primary = undefined;
    this.audienceHost = undefined;
    // Leaving full screen without a key of ours (Escape: the browser keeps that key to itself) ends the show. A window of our own
    // taking focus, the speaker view, also leaves full screen in some browsers; that must not end it.
    this.keepUntil = 0;
    this.onFullscreen = () => {
      if (!this.enteredFullscreen || this.doc.fullscreenElement) return;
      this.enteredFullscreen = false;
      if (this.win.performance.now() < this.keepUntil) return;
      this.close();
    };
    // Escape while the deck is still loading ends the show; once it plays the surface handles every key.
    this.onEarlyKey = (event) => { if (event.key === "Escape" && !this.primary) this.close(); };
    /** Settles when the first slide is drawn (or the start failed). */
    this.ready = new Promise((resolve, reject) => { this.markReady = resolve; this.markFailed = reject; });
    this.ready.catch(() => {});
  }

  /** The 1-based number of the showing slide, in the sequence that plays (hidden slides are not counted). */
  get slide() { return this.primary?.cursor.number ?? 0; }
  get total() { return this.primary?.cursor.total ?? 0; }
  /** `"none"`, `"black"` or `"white"`. */
  get blankMode() { return this.primary?.blank ?? "none"; }
  /** Whether the speaker view window is open. */
  get presenterViewOpen() { return Boolean(this.presenter && !this.presenter.win.closed); }

  next() { return this.primary?.next() ?? false; }
  previous() { return this.primary?.previous() ?? false; }
  first() { return this.primary?.first() ?? false; }
  last() { return this.primary?.last() ?? false; }
  /** Show the slide with this 1-based number (clamped). */
  goto(number) { return this.primary?.goto(number) ?? false; }
  /** Black or white screen; `"none"` shows the slide again. */
  blank(mode = "black") { return this.primary?.apply({ blank: mode }) ?? false; }

  notify(surface, { moved, blankChanged }) {
    if (this.closed || surface !== this.primary) return;
    if (moved) {
      const info = surface.store.info(surface.cursor.index);
      this.dispatchEvent(new CustomEvent("slidechange", { detail: { slide: surface.cursor.number, total: surface.cursor.total, index: info.index, id: info.id, title: info.title, notes: info.notes, section: info.section } }));
    }
    if (blankChanged) this.dispatchEvent(new CustomEvent("blank", { detail: { mode: surface.blank } }));
  }

  /** The Escape key in a window: the speaker view closes by itself; in the audience window it ends the show. */
  exit(surface) {
    if (surface.role === "presenter" && this.primary.role === "audience") this.closePresenterView();
    else this.close();
  }

  toggleFullscreen() {
    if (!this.audienceHost) return;
    // Leaving full screen with the key keeps the show running; leaving it any other way (Escape) ends it.
    if (this.doc.fullscreenElement) { this.enteredFullscreen = false; this.doc.exitFullscreen?.()?.catch?.(() => {}); }
    else this.requestFullscreen();
  }

  requestFullscreen() {
    try {
      const result = this.audienceHost?.requestFullscreen?.();
      if (result?.then) result.then(() => { this.enteredFullscreen = true; }, () => {});
    } catch { /* the overlay still fills the window */ }
  }

  /**
   * Open the speaker view in a second window: the current and next slide, the plain-text notes, a timer and the clock, kept
   * in step with the show over a BroadcastChannel. Call it from a user gesture (a key press or a click), or the browser
   * blocks the window. Returns the window, or `null` when it was blocked.
   */
  openPresenterView() {
    if (this.closed || !this.primary) return null;
    if (this.presenterViewOpen) { this.presenter.win.focus(); return this.presenter.win; }
    this.keepUntil = this.win.performance.now() + 3000;
    const win = this.win.open("", `opf-deck-speaker-${this.channelName || "show"}`, "popup,width=1180,height=760");
    if (!win) return null;
    const doc = win.document;
    doc.open(); doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'); doc.close();
    const view = mountPresenter({ doc, win, name: this.name, session: this, now: this.now, duration: this.duration, parent: this.doc, target: doc.body, styleTarget: doc.head, setTitle: true });
    const surface = new Surface({ role: "presenter", doc, win, store: this.primary.store, cursor: createCursor(this.primary.cursor.sequence, this.primary.cursor.position), session: this, view, channelName: this.channelName });
    view.surface = surface;
    surface.blank = this.primary.blank;
    this.surfaces.add(surface);
    this.presenter = surface;
    doc.addEventListener("keydown", surface.keydown, true);
    surface.rev = this.primary.rev;
    view.render(surface);
    surface.join();
    const close = () => { if (this.presenter === surface) this.closePresenterView(); };
    win.addEventListener("pagehide", close, { once: true });
    this.win.addEventListener("pagehide", close, { once: true });
    this.dispatchEvent(new CustomEvent("presenterview", { detail: { open: true } }));
    return win;
  }

  closePresenterView() {
    const surface = this.presenter;
    if (!surface) return;
    this.presenter = undefined;
    this.surfaces.delete(surface);
    surface.doc.removeEventListener("keydown", surface.keydown, true);
    surface.dispose();
    try { if (!surface.win.closed) surface.win.close(); } catch { /* already gone */ }
    if (!this.closed) this.dispatchEvent(new CustomEvent("presenterview", { detail: { open: false } }));
  }

  /** End the slideshow: leave full screen, close the speaker view, give focus back. Fires `close`. Safe to call twice. */
  close() {
    if (this.closed) return;
    const slide = this.slide, index = this.primary?.cursor.index;
    this.closePresenterView();
    this.closed = true;
    this.doc.removeEventListener("fullscreenchange", this.onFullscreen);
    this.doc.removeEventListener("keydown", this.onEarlyKey, true);
    this.markFailed?.(new DeckError("closed", "The slideshow was closed before it started."));
    for (const surface of this.surfaces) { surface.doc.removeEventListener("keydown", surface.keydown, true); surface.dispose(); }
    this.surfaces.clear();
    this.abort?.abort();
    if (this.doc.fullscreenElement && this.enteredFullscreen) this.doc.exitFullscreen?.()?.catch?.(() => {});
    this.dispatchEvent(new CustomEvent("close", { detail: { slide, index } }));
  }
}

// One slideshow per document: pressing a Present button twice shows the same show.
const shows = new WeakMap();

const isNodeLike = (value) => value && typeof value === "object" && typeof value.nodeType === "number";

async function readSource(source, signal) {
  if (typeof source === "string") {
    if (/^\s*\{/.test(source)) return parseDeckDocument(source);
    const response = await fetch(source, { signal, credentials: "same-origin" });
    if (!response.ok) throw new DeckError("fetch-failed", `The deck could not be loaded (${response.status}).`);
    return parseDeckDocument(await response.text());
  }
  if (isNodeLike(source)) {
    if (!source.document) throw new DeckError("not-ready", "The <opf-deck> has no document yet.");
    return parseDeckDocument(source.document);
  }
  return parseDeckDocument(source);
}

/**
 * Start a slideshow. `source` is an OPF document (an object or JSON text), the URL of one, or an `<opf-deck>` element. The
 * player covers the page at once (and asks for full screen), then resolves with the running session when the first slide is
 * drawn. Call it from a click or key handler: full screen and the speaker view both need a user gesture.
 *
 * Options: `fonts` (the self-hosted font root URL, or a browser fonts handle from `loadFonts`), `renderOptions` (extra `renderSlideSvg` options),
 * `startSlide` (1-based), `includeHidden`, `fullscreen` (default true), `presenterView` (open the speaker view too),
 * `role: "presenter"` (this window is the speaker view: for a second tab or window of your page), `channel` (name, or `false`
 * for no sync), `container`, `signal` and `now` (an injectable clock).
 */
export async function present(source, options = {}) {
  const container = options.container ?? globalThis.document?.body;
  if (!container) throw new DeckError("no-dom", "present() needs a browser document.");
  const doc = container.ownerDocument, win = doc.defaultView;
  const role = options.role === "presenter" ? "presenter" : "audience";
  const abort = new AbortController();
  if (options.signal) options.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const running = role === "audience" ? shows.get(doc) : undefined;
  if (running && !running.closed) { await running.ready; return running; }
  const session = new PlayerSession({ doc, win, now: options.now ?? (() => Date.now()), abort });
  if (role === "audience") { shows.set(doc, session); session.addEventListener("close", () => { if (shows.get(doc) === session) shows.delete(doc); }); }

  // Cover the page and ask for full screen before awaiting anything: the click that called us must still count.
  let view;
  if (role === "audience") {
    view = mountAudience({ doc, win, container, session });
    session.audienceHost = view.host;
    view.attach(options.returnFocus ?? doc.activeElement);
    if (options.fullscreen !== false) session.requestFullscreen();
  }
  doc.addEventListener("keydown", session.onEarlyKey, true);
  doc.addEventListener("fullscreenchange", session.onFullscreen);
  const fail = (error) => { doc.removeEventListener("keydown", session.onEarlyKey, true); doc.removeEventListener("fullscreenchange", session.onFullscreen); session.markFailed(error); session.closed = true; if (shows.get(doc) === session) shows.delete(doc); session.abort.abort(); view?.dispose(); if (doc.fullscreenElement) doc.exitFullscreen?.()?.catch?.(() => {}); throw error; };

  let deck, store;
  try {
    deck = await readSource(source, abort.signal);
    const sequence = presentableIndexes(deck, { includeHidden: options.includeHidden });
    if (!sequence.length) throw new DeckError("no-slides", "The deck has no slides to present: every slide is hidden.");
    let fonts = options.fonts;
    if (typeof fonts === "string") { try { fonts = await loadPreviewFonts(fonts, { signal: abort.signal }); } catch { fonts = undefined; } }
    const date = options.renderOptions?.date ?? localIsoDate();
    store = options.store ?? createDeckStore({ document: deck, fonts, renderOptions: options.renderOptions ?? {}, date });
    try { await store.ready(abort.signal); } catch (error) {
      if (!fonts || options.store) throw error;
      store = createDeckStore({ document: deck, renderOptions: options.renderOptions ?? {}, date });
    }
    abort.signal.throwIfAborted?.();
    session.name = plainText(deck.name) || "Presentation";
    session.duration = Number(deck.duration);
    session.channelName = options.channel === false ? "" : (options.channel ?? deckChannelName(deck));
    const cursor = createCursor(sequence, Number.isInteger(options.startSlide) ? options.startSlide - 1 : 0);
    if (!view) {
      // The speaker view in this window (a second tab or window of the host page): its own shadow root over the page.
      const host = doc.createElement("div");
      host.setAttribute("data-opf-player", "");
      host.style.cssText = "position:fixed;inset:0;z-index:2147483000;overflow:auto;background:#15171a";
      const root = host.attachShadow({ mode: "open" });
      container.append(host);
      view = mountPresenter({ doc, win, name: session.name, session, now: session.now, duration: session.duration, parent: doc, target: root, styleTarget: root, setTitle: false });
      const dispose = view.dispose;
      view.dispose = () => { dispose(); host.remove(); };
    } else view.setName(session.name);
    const surface = new Surface({ role, doc, win, store, cursor, session, view, channelName: session.channelName });
    view.surface = surface;
    session.primary = surface;
    session.surfaces.add(surface);
  } catch (error) { return fail(error); }

  doc.removeEventListener("keydown", session.onEarlyKey, true);
  doc.addEventListener("keydown", session.primary.keydown, true);
  view.render(session.primary);
  session.primary.join();
  session.markReady(session);
  if (options.presenterView && role === "audience") session.openPresenterView();
  return session;
}
