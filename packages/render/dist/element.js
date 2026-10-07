// RR-28: <opf-deck>, a framework-free web component that embeds an OPF deck. It draws the renderer's own SVG (renderSvg), so
// the slide a page shows is the slide the preview, the editor and the PDF show. Importing this module touches no DOM, so it
// is safe on a server (Next.js); `defineOpfDeck()` registers the tag in a browser.
import {
  DeckError, createCursor, createDeckStore, isRtlLanguage, localIsoDate, parseDeckDocument, parseSlideNumber, presentableIndexes,
  prepareSlideSvg, sanitizeSvgTree, slideInfo, slideLabel, svgDimensions, plainText,
} from "./deck-runtime.js";
import { loadPreviewFonts } from "./preview-fonts.js";
import { renderSlideSvg } from "./svg.js";

export { DeckError } from "./deck-runtime.js";
export { loadPreviewFonts, previewBaseFaces, previewFontLayout } from "./preview-fonts.js";

export const OPF_DECK_TAG = "opf-deck";

const SHEET = `
:host { display: block; min-width: 0; max-width: 100%; color: var(--opf-deck-fg, CanvasText); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.deck { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.viewport { position: relative; width: 100%; aspect-ratio: var(--ratio, 16 / 9); overflow: hidden; border-radius: var(--opf-deck-radius, 6px); background: var(--opf-deck-stage, #f1f1f1); border: 1px solid var(--opf-deck-border, rgb(128 128 128 / 0.35)); touch-action: pan-y; outline-offset: 2px; }
.viewport:focus-visible { outline: 3px solid var(--opf-deck-focus, Highlight); }
.slide { position: absolute; inset: 0; }
.slide svg.opf-slide { display: block; width: 100%; height: 100%; }
.status { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: var(--opf-deck-muted, GrayText); }
.error { color: var(--opf-deck-error, #b00020); }
.bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bar[hidden], .thumbs-wrap[hidden] { display: none; }
.spacer { flex: 1 1 auto; }
button { font: inherit; color: inherit; background: var(--opf-deck-button, transparent); border: 1px solid var(--opf-deck-border, rgb(128 128 128 / 0.5)); border-radius: var(--opf-deck-radius, 6px); min-width: 36px; min-height: 36px; padding: 4px 12px; cursor: pointer; }
button:hover:not([aria-disabled="true"]) { background: var(--opf-deck-hover, rgb(128 128 128 / 0.15)); }
button:focus-visible { outline: 3px solid var(--opf-deck-focus, Highlight); outline-offset: 1px; }
button[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.counter { min-width: 4.5em; text-align: center; font-variant-numeric: tabular-nums; }
.thumbs-wrap { min-width: 0; }
.thumbs { position: relative; display: flex; gap: 8px; margin: 0; padding: 4px 2px; list-style: none; overflow-x: auto; scroll-snap-type: x proximity; }
.thumbs li { flex: 0 0 auto; width: 132px; scroll-snap-align: center; }
.thumb { display: block; width: 100%; padding: 0; min-height: 0; overflow: hidden; background: var(--opf-deck-stage, #f1f1f1); }
.thumb[aria-current="true"] { outline: 3px solid var(--opf-deck-accent, Highlight); outline-offset: 0; }
.thumb .frame { display: block; width: 100%; aspect-ratio: var(--ratio, 16 / 9); }
.thumb svg.opf-slide { display: block; width: 100%; height: 100%; pointer-events: none; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.flip { display: inline-block; }
.rtl .flip { transform: scaleX(-1); }
.rtl .bar, .rtl .thumbs { direction: rtl; }
@media (prefers-reduced-motion: no-preference) { button { transition: background-color 120ms; } }
@media (forced-colors: active) { .viewport, button, .thumb[aria-current="true"] { border-color: CanvasText; } .thumb[aria-current="true"] { outline-color: Highlight; } }
`;

const supportsCustomElements = () => typeof customElements !== "undefined" && typeof HTMLElement !== "undefined";
const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
const truthy = (value) => value !== null && value !== undefined && !/^(?:false|0|off|no|none)$/i.test(String(value).trim());

let ElementClass;

/** The element class, created on first use so that importing this module never needs a DOM. Browser only. */
export function getOpfDeckElement() {
  if (!supportsCustomElements()) throw new DeckError("no-dom", "<opf-deck> needs a browser with custom elements.");
  ElementClass ??= createElementClass();
  return ElementClass;
}

/** Register `<opf-deck>` (or another tag name). Safe to call more than once and on a server, where it does nothing. */
export function defineOpfDeck(tagName = OPF_DECK_TAG) {
  if (!supportsCustomElements()) return undefined;
  const constructor = getOpfDeckElement();
  if (!customElements.get(tagName)) customElements.define(tagName, tagName === OPF_DECK_TAG ? constructor : class extends constructor {});
  return customElements.get(tagName);
}

function createElementClass() {
  const Base = HTMLElement;
  return class OpfDeckElement extends Base {
    static get observedAttributes() { return ["src", "slide", "fonts", "thumbnails", "controls", "present", "include-hidden", "label", "keyboard"]; }

    #root; #parts = {}; #built = false; #store; #cursor; #deck; #generation = 0; #abort; #documentValue; #fonts; #renderOptions = {};
    #readyPromise = Promise.resolve(); #state = "idle"; #error; #observer; #thumbsBuilt = false; #pointer; #session; #announce = false;
    #slideAttribute; #sheet;

    constructor() {
      super();
      this.#root = this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      this.#build();
      if (!this.#deck && this.#state === "idle") this.#start();
      else this.#sync();
    }

    disconnectedCallback() {
      this.#abort?.abort();
      this.#observer?.disconnect();
      this.#observer = undefined;
      this.#thumbsBuilt = false;
      this.#state = this.#state === "ready" ? "ready" : "idle";
    }

    attributeChangedCallback(name, before, after) {
      if (before === after || !this.#built) return;
      if (name === "src" || name === "fonts" || name === "include-hidden") { if (this.isConnected) this.#start(); return; }
      if (name === "slide") { this.#applySlideAttribute(); return; }
      this.#sync();
    }

    // --- public API -----------------------------------------------------------------------------------------------

    /** URL of an OPF JSON document. The one request the element makes besides the font files of `fonts`. */
    get src() { return this.getAttribute("src") ?? ""; }
    set src(value) { if (value === null || value === undefined || value === "") this.removeAttribute("src"); else this.setAttribute("src", String(value)); }

    /** The OPF document (an object, or a JSON string to set). Setting it replaces `src`. */
    get document() { return this.#deck; }
    set document(value) {
      this.#documentValue = value === null || value === undefined ? undefined : value;
      if (this.isConnected) this.#start();
    }

    /** The 1-based number of the showing slide, in the sequence that plays (hidden slides are not counted). */
    get slide() { return this.#cursor?.number ?? (parseSlideNumber(this.getAttribute("slide")) ?? 1); }
    set slide(value) { this.setAttribute("slide", String(value)); }

    /** Number of slides in the sequence that plays. */
    get total() { return this.#cursor?.total ?? 0; }

    /**
     * The fonts the deck draws with: the URL of the self-hosted font root (the `fonts` attribute; see the package README), or a
     * browser fonts handle the page already has (`loadFonts` from `/fonts-browser`), which wins over the attribute. Without either,
     * layout uses estimated widths and system fonts.
     */
    get fonts() { return this.#fonts ?? this.getAttribute("fonts") ?? ""; }
    set fonts(value) {
      if (value && typeof value === "object") { this.#fonts = value; if (this.isConnected && this.#built) this.#start(); return; }
      const had = this.#fonts !== undefined, before = this.getAttribute("fonts");
      this.#fonts = undefined;
      if (value) this.setAttribute("fonts", String(value)); else this.removeAttribute("fonts");
      // Dropping a handle changes what draws even when the attribute keeps its value.
      if (had && before === this.getAttribute("fonts") && this.isConnected && this.#built) this.#start();
    }

    /** Extra `renderSvg` options (catalogs, imageResolver, date, ...). Set before the deck loads, or call `reload()`. */
    get renderOptions() { return this.#renderOptions; }
    set renderOptions(value) { this.#renderOptions = value && typeof value === "object" ? value : {}; }

    get includeHidden() { return this.hasAttribute("include-hidden"); }
    set includeHidden(value) { this.toggleAttribute("include-hidden", Boolean(value)); }

    get thumbnails() { return this.hasAttribute("thumbnails"); }
    set thumbnails(value) { this.toggleAttribute("thumbnails", Boolean(value)); }

    /** Resolves when the deck is drawn (or rejects with the error the `error` event carries). */
    get ready() { return this.#readyPromise; }

    /** What the showing slide is: id, title, plain-text notes, section. */
    get currentSlide() { return this.#cursor && this.#deck ? { ...slideInfo(this.#deck, this.#cursor.index), slide: this.#cursor.number, total: this.#cursor.total } : undefined; }

    next() { return this.#go(() => this.#cursor?.next()); }
    previous() { return this.#go(() => this.#cursor?.previous()); }
    first() { return this.#go(() => this.#cursor?.first()); }
    last() { return this.#go(() => this.#cursor?.last()); }
    /** Show the slide with this 1-based number (clamped). */
    goto(number) { return this.#go(() => this.#cursor?.goto(Number(number))); }

    /** Re-read `src` and draw again. */
    reload() { this.#start(); return this.#readyPromise; }

    /** Open the full-screen slideshow (needs a user gesture to enter full screen). Loads the player on first use. */
    async present(options = {}) {
      if (this.#session && !this.#session.closed) return this.#session;
      await this.#readyPromise;
      if (!this.#store || !this.#cursor) throw new DeckError("not-ready", "The deck is not loaded yet.");
      const { present } = await import("./player.js");
      const session = await present(this.#deck, {
        store: this.#store, fonts: this.#fonts ?? this.#resolvedFonts, renderOptions: this.#renderOptions,
        includeHidden: this.includeHidden, startSlide: this.#cursor.number, returnFocus: this.#parts.viewport, ...options,
      });
      this.#session = session;
      session.addEventListener("slidechange", (event) => { if (this.#cursor && event.detail?.index !== undefined && this.#cursor.gotoIndex(event.detail.index)) { this.#show({ announce: false }); this.#emitChange(); } });
      session.addEventListener("close", () => {
        if (this.#session === session) this.#session = undefined;
        this.#show({ announce: false });
        this.#parts.viewport?.focus({ preventScroll: true });
        this.dispatchEvent(new CustomEvent("presentend", { detail: { slide: this.#cursor?.number } }));
      });
      this.dispatchEvent(new CustomEvent("presentstart", { detail: { slide: this.#cursor?.number } }));
      return session;
    }

    // --- loading ----------------------------------------------------------------------------------------------------

    #resolvedFonts;

    #start() {
      this.#abort?.abort();
      const abort = (this.#abort = new AbortController());
      const generation = ++this.#generation;
      this.#state = "loading";
      this.#error = undefined;
      this.#renderState();
      const run = this.#load(abort.signal, generation);
      this.#readyPromise = run;
      run.catch(() => {});
    }

    async #load(signal, generation) {
      const stale = () => generation !== this.#generation || signal.aborted;
      try {
        const deck = await this.#readDocument(signal);
        if (stale()) return;
        parseDeckDocument(deck);
        let registry = this.#fonts;
        const root = this.getAttribute("fonts");
        if (!registry && root) {
          try { registry = await loadPreviewFonts(root, { signal }); } catch (cause) {
            if (stale()) return;
            this.#report(new DeckError("fonts-unavailable", `The fonts at ${root} could not be loaded; the deck draws with estimated layout and system fonts.`, { cause }), false);
          }
        }
        this.#resolvedFonts = registry;
        const date = this.#renderOptions.date ?? localIsoDate();
        let store = createDeckStore({ document: deck, fonts: registry, renderOptions: this.#renderOptions, date });
        try { await store.ready(signal); } catch (cause) {
          if (stale()) return;
          if (!registry) throw cause;
          this.#report(cause, false);
          this.#resolvedFonts = undefined;
          store = createDeckStore({ document: deck, renderOptions: this.#renderOptions, date });
        }
        if (stale()) return;
        // Draw the first slide before accepting the deck, so an invalid document fails here and not on the first click.
        const sequence = presentableIndexes(deck, { includeHidden: this.includeHidden });
        if (sequence.length) store.svg(sequence[Math.min(Math.max((parseSlideNumber(this.getAttribute("slide")) ?? 1) - 1, 0), sequence.length - 1)]);
        this.#deck = deck;
        this.#store = store;
        this.#cursor = createCursor(sequence, (parseSlideNumber(this.getAttribute("slide")) ?? 1) - 1);
        this.#thumbsBuilt = false;
        this.#state = "ready";
        this.#show({ announce: false });
        this.dispatchEvent(new CustomEvent("ready", { detail: { total: this.#cursor.total, slide: this.#cursor.number } }));
        this.#prefetch();
      } catch (error) {
        if (stale() || error?.name === "AbortError") return;
        this.#state = "error";
        this.#error = error instanceof DeckError ? error : new DeckError(error?.code ?? "load-failed", error?.message ?? "The deck could not be loaded.", { cause: error });
        this.#renderState();
        this.#report(this.#error, true);
        throw this.#error;
      }
    }

    async #readDocument(signal) {
      if (this.#documentValue !== undefined) return parseDeckDocument(this.#documentValue);
      const src = this.getAttribute("src");
      if (src) {
        const response = await fetch(new URL(src, this.ownerDocument.baseURI), { signal, credentials: "same-origin" });
        if (!response.ok) throw new DeckError("fetch-failed", `The deck could not be loaded (${response.status}).`);
        return parseDeckDocument(await response.text());
      }
      const inline = this.querySelector(':scope > script[type="application/opf+json"], :scope > script[type="application/json"]');
      if (inline) return parseDeckDocument(inline.textContent ?? "");
      throw new DeckError("no-document", "Give <opf-deck> a src, a document property or an inline application/opf+json script.");
    }

    #report(error, fatal) {
      this.dispatchEvent(new CustomEvent("error", { detail: { code: error.code, message: error.message, fatal } }));
    }

    #prefetch() {
      const store = this.#store, cursor = this.#cursor;
      if (!store || !cursor) return;
      const next = cursor.sequence[cursor.position + 1];
      if (next === undefined) return;
      const run = () => { try { if (this.#store === store) store.svg(next); } catch { /* reported when the slide is shown */ } };
      if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 500 }); else setTimeout(run, 0);
    }

    // --- DOM ----------------------------------------------------------------------------------------------------------

    #build() {
      if (this.#built) return;
      this.#built = true;
      try { this.#sheet = new CSSStyleSheet(); this.#sheet.replaceSync(SHEET); this.#root.adoptedStyleSheets = [this.#sheet]; } catch {
        const style = this.ownerDocument.createElement("style"); style.textContent = SHEET; this.#root.append(style);
      }
      const doc = this.ownerDocument;
      const el = (tag, attributes = {}, ...children) => {
        const node = doc.createElement(tag);
        for (const [name, value] of Object.entries(attributes)) if (value !== undefined) node.setAttribute(name, value);
        node.append(...children);
        return node;
      };
      const parts = this.#parts;
      parts.deck = el("div", { class: "deck", part: "deck", role: "region", "aria-roledescription": "slide deck" });
      parts.viewport = el("div", { class: "viewport", part: "viewport", tabindex: "0", role: "group", "aria-roledescription": "slide" });
      parts.slide = el("div", { class: "slide", part: "slide" });
      parts.status = el("div", { class: "status", part: "status" });
      parts.viewport.append(parts.slide, parts.status);
      parts.prev = el("button", { type: "button", class: "previous", part: "button previous", "aria-label": "Previous slide" }, el("span", { class: "flip", "aria-hidden": "true" }, "\u25C0"));
      parts.counterText = el("span", { "aria-hidden": "true" });
      parts.counterLabel = el("span", { class: "sr-only" });
      parts.counter = el("span", { class: "counter", part: "counter" }, parts.counterText, parts.counterLabel);
      parts.next = el("button", { type: "button", class: "next", part: "button next", "aria-label": "Next slide" }, el("span", { class: "flip", "aria-hidden": "true" }, "\u25B6"));
      parts.present = el("button", { type: "button", class: "present", part: "button present" }, "Present");
      parts.bar = el("div", { class: "bar", part: "bar", role: "group", "aria-label": "Slide navigation" }, parts.prev, parts.counter, parts.next, el("span", { class: "spacer" }), parts.present);
      parts.thumbsWrap = el("div", { class: "thumbs-wrap", part: "thumbnails" });
      parts.thumbs = el("ul", { class: "thumbs", role: "list", "aria-label": "Slides" });
      parts.thumbsWrap.append(parts.thumbs);
      parts.live = el("div", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
      parts.deck.append(parts.viewport, parts.bar, parts.thumbsWrap, parts.live);
      this.#root.append(parts.deck);

      parts.prev.addEventListener("click", () => this.previous());
      parts.next.addEventListener("click", () => this.next());
      parts.present.addEventListener("click", () => { this.present().catch((error) => this.#report(error instanceof DeckError ? error : new DeckError("present-failed", error?.message ?? "Could not start the slideshow.", { cause: error }), false)); });
      parts.viewport.addEventListener("keydown", (event) => this.#onKey(event));
      parts.viewport.addEventListener("pointerdown", (event) => { if (event.pointerType !== "mouse") this.#pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }; });
      parts.viewport.addEventListener("pointerup", (event) => this.#onPointerUp(event));
      parts.viewport.addEventListener("pointercancel", () => { this.#pointer = undefined; });
      parts.thumbs.addEventListener("keydown", (event) => this.#onThumbKey(event));
      this.#renderState();
    }

    #onKey(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !truthy(this.getAttribute("keyboard") ?? "on")) return;
      const rtl = this.#parts.deck.classList.contains("rtl");
      const map = { ArrowRight: rtl ? "previous" : "next", ArrowLeft: rtl ? "next" : "previous", PageDown: "next", PageUp: "previous", Home: "first", End: "last" };
      const action = map[event.key];
      if (!action) return;
      event.preventDefault();
      this.#announce = true;
      this[action]();
    }

    #onThumbKey(event) {
      const buttons = [...this.#parts.thumbs.querySelectorAll("button")];
      const at = buttons.indexOf(this.#root.activeElement);
      if (at === -1) return;
      const rtl = this.#parts.deck.classList.contains("rtl");
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
      let target;
      if (step) target = buttons[Math.min(Math.max(at + step, 0), buttons.length - 1)];
      else if (event.key === "Home") target = buttons[0];
      else if (event.key === "End") target = buttons[buttons.length - 1];
      if (!target) return;
      event.preventDefault();
      for (const button of buttons) button.tabIndex = button === target ? 0 : -1;
      target.focus();
    }

    #onPointerUp(event) {
      const start = this.#pointer;
      this.#pointer = undefined;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const rtl = this.#parts.deck.classList.contains("rtl");
      this.#announce = true;
      if ((dx < 0) !== rtl) this.next(); else this.previous();
    }

    #go(move) {
      if (!this.#cursor) return false;
      const changed = move();
      if (changed) { this.#show({ announce: this.#announce }); this.#emitChange(); }
      this.#announce = false;
      return changed;
    }

    #applySlideAttribute() {
      const wanted = parseSlideNumber(this.getAttribute("slide"));
      if (!this.#cursor || wanted === undefined || wanted === this.#cursor.number) return;
      if (this.#cursor.goto(wanted)) { this.#show({ announce: false }); this.#emitChange(); }
    }

    #emitChange() {
      if (!this.#cursor || !this.#deck) return;
      const info = slideInfo(this.#deck, this.#cursor.index);
      this.dispatchEvent(new CustomEvent("slidechange", { detail: { slide: this.#cursor.number, total: this.#cursor.total, index: info.index, id: info.id, title: info.title, notes: info.notes, section: info.section }, bubbles: true, composed: true }));
    }

    #renderState() {
      const parts = this.#parts;
      if (!parts.status) return;
      const loading = this.#state === "loading" || this.#state === "idle";
      parts.deck.setAttribute("aria-busy", loading ? "true" : "false");
      parts.status.hidden = this.#state === "ready";
      parts.status.className = `status${this.#state === "error" ? " error" : ""}`;
      parts.status.setAttribute("role", this.#state === "error" ? "alert" : "status");
      parts.status.textContent = this.#state === "error" ? this.#error?.message ?? "The deck could not be loaded." : loading ? "Loading slides\u2026" : "";
      parts.deck.setAttribute("aria-label", this.getAttribute("label") || plainText(this.#deck?.name) || "Presentation");
    }

    #sync() { if (this.#built) { this.#renderState(); if (this.#state === "ready") this.#show({ announce: false }); } }

    /** Draw the showing slide, the counter and the strip. */
    #show({ announce }) {
      const parts = this.#parts, cursor = this.#cursor, store = this.#store;
      if (!cursor || !store) return;
      this.#renderState();
      // The page decides (a dir attribute, CSS direction); a deck in a right-to-left language decides when the page did not.
      const rtl = this.ownerDocument.defaultView?.getComputedStyle(this)?.direction === "rtl" || (!this.closest("[dir]") && isRtlLanguage(this.#deck?.language));
      parts.deck.classList.toggle("rtl", Boolean(rtl));
      const info = store.info(cursor.index);
      let svg;
      try { svg = store.svg(cursor.index); } catch (error) {
        this.#state = "error"; this.#error = error; this.#renderState(); this.#report(error, true); return;
      }
      const label = slideLabel(info, cursor.number, cursor.total);
      const template = this.ownerDocument.createElement("template");
      template.innerHTML = prepareSlideSvg(svg);
      const node = template.content.firstElementChild;
      if (node) { sanitizeSvgTree(node); parts.slide.replaceChildren(node); }
      const { width, height } = svgDimensions(svg);
      parts.deck.style.setProperty("--ratio", `${width} / ${height}`);
      parts.viewport.setAttribute("aria-label", label);
      parts.counterText.textContent = `${cursor.number} / ${cursor.total}`;
      parts.counterLabel.textContent = label;
      parts.prev.setAttribute("aria-disabled", String(cursor.number <= 1));
      parts.next.setAttribute("aria-disabled", String(cursor.number >= cursor.total));
      parts.bar.hidden = this.getAttribute("controls") === "none" || !cursor.total;
      parts.present.hidden = !this.hasAttribute("present");
      parts.thumbsWrap.hidden = !this.hasAttribute("thumbnails");
      if (announce) parts.live.textContent = label;
      if (this.hasAttribute("thumbnails")) this.#renderThumbnails();
      this.#markThumbnail();
      this.#prefetch();
    }

    #renderThumbnails() {
      const parts = this.#parts, store = this.#store, cursor = this.#cursor;
      if (!store || !cursor || this.#thumbsBuilt) return;
      this.#thumbsBuilt = true;
      this.#observer?.disconnect();
      const doc = this.ownerDocument;
      const sequence = cursor.sequence;
      const first = sequence.length ? svgDimensions(store.svg(sequence[0])) : { width: 16, height: 9 };
      const items = sequence.map((index, position) => {
        const info = store.info(index);
        const li = doc.createElement("li");
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "thumb";
        button.setAttribute("part", "thumbnail");
        button.setAttribute("aria-label", `Go to ${slideLabel(info, position + 1, sequence.length)}`);
        button.tabIndex = position === cursor.position ? 0 : -1;
        const frame = doc.createElement("span");
        frame.className = "frame";
        frame.style.setProperty("--ratio", `${first.width} / ${first.height}`);
        frame.setAttribute("aria-hidden", "true");
        button.append(frame);
        button.addEventListener("click", () => { this.#announce = true; this.#go(() => this.#cursor?.goto(position + 1)); });
        li.append(button);
        li._frame = frame; li._index = index;
        return li;
      });
      parts.thumbs.replaceChildren(...items);
      const fill = (li) => {
        if (li._filled) return; li._filled = true;
        try {
          const template = doc.createElement("template");
          template.innerHTML = prepareSlideSvg(store.svg(li._index), { idPrefix: "t-" });
          const node = template.content.firstElementChild;
          if (node) { sanitizeSvgTree(node); li._frame.replaceChildren(node); }
        } catch { /* the slide itself reports its error when shown */ }
      };
      if (typeof IntersectionObserver === "function") {
        this.#observer = new IntersectionObserver((entries) => { for (const entry of entries) if (entry.isIntersecting) { fill(entry.target); this.#observer?.unobserve(entry.target); } }, { root: parts.thumbs, rootMargin: "200px" });
        for (const li of items) this.#observer.observe(li);
      } else for (const li of items) fill(li);
    }

    #markThumbnail() {
      const parts = this.#parts, cursor = this.#cursor;
      if (!cursor || !parts.thumbs) return;
      const items = [...parts.thumbs.children];
      items.forEach((li, position) => {
        const button = li.firstElementChild;
        const current = position === cursor.position;
        if (current) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
        if (this.#root.activeElement !== button || current) button.tabIndex = current ? 0 : -1;
      });
      const li = items[cursor.position];
      if (li && parts.thumbs.scrollWidth > parts.thumbs.clientWidth) {
        // Measured against the strip itself (not offsetLeft, which depends on where the page positions the element).
        const strip = parts.thumbs.getBoundingClientRect(), item = li.getBoundingClientRect();
        const left = parts.thumbs.scrollLeft + (item.left - strip.left) - (strip.width - item.width) / 2;
        parts.thumbs.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
      }
    }
  };
}

// --- static fallback --------------------------------------------------------------------------------------------------

const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Server-side markup for a deck: the slides as inline SVG inside the tag, which a page that has not loaded JavaScript (or a
 * crawler, or a reader) shows as it is, and which the element replaces with its own shadow DOM when it upgrades. Pure and
 * synchronous; layout uses estimated widths unless you pass a fonts handle as `fonts` (an object: `loadFonts()` from
 * `/fonts-browser`, or one with a `textMeasurement` and `embeddedFonts`). A `fonts` string is the font root URL written to the
 * element's `fonts` attribute.
 *
 * `slides`: `"first"` (default: the first slide plus a list of titles), `"all"` or a list of 1-based slide numbers.
 * `embed` puts the document in an `application/opf+json` script child, so the element upgrades without a request.
 */
export function renderDeckHtml(input, options = {}) {
  const deck = parseDeckDocument(input);
  const tag = options.tagName ?? OPF_DECK_TAG;
  const sequence = presentableIndexes(deck, { includeHidden: options.includeHidden });
  const wanted = options.slides ?? "first";
  const shown = wanted === "all" ? sequence.map((_, position) => position) : wanted === "first" ? [0] : wanted.map((number) => number - 1).filter((position) => position >= 0 && position < sequence.length);
  const handle = options.fonts !== null && typeof options.fonts === "object" ? options.fonts : undefined;
  const attributes = { src: options.src, slide: options.slide, fonts: handle ? undefined : options.fonts, label: options.label, ...options.attributes };
  const attributeText = Object.entries(attributes).filter(([, value]) => value !== undefined && value !== false).map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`)).join("")
    + (options.thumbnails ? " thumbnails" : "") + (options.present ? " present" : "") + (options.includeHidden ? " include-hidden" : "");
  const date = options.renderOptions?.date ?? options.date;
  const figures = shown.map((position) => {
    const index = sequence[position];
    const svg = renderSlideSvg(deck, index, { ...options.renderOptions, ...(handle ? { fonts: handle } : {}), ...(date ? { date } : {}) });
    const { width, height } = svgDimensions(svg);
    const prepared = prepareSlideSvg(svg).replace(/^<svg\b/, `<svg style="display:block;width:100%;height:auto;aspect-ratio:${width} / ${height}"`);
    const label = slideLabel(slideInfo(deck, index), position + 1, sequence.length);
    return `<figure role="group" aria-roledescription="slide" aria-label="${escapeHtml(label)}" style="margin:0 0 8px">${prepared}</figure>`;
  });
  const titles = wanted === "first" && sequence.length > 1
    ? `<nav aria-label="Slides"><ol>${sequence.map((index) => `<li>${escapeHtml(slideInfo(deck, index).title)}</li>`).join("")}</ol></nav>` : "";
  const embedded = options.embed ? `<script type="application/opf+json">${JSON.stringify(deck).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>` : "";
  return `<${tag}${attributeText}>${figures.join("")}${titles}${embedded}</${tag}>`;
}
