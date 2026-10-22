// RR-28: the part of the slideshow player and the <opf-deck> element that has no DOM of its own. It reads an OPF document,
// decides which slides play (hidden ones do not), renders each slide once with the renderer's own SVG output (toSvg:
// there is no second layout engine) behind a face-level font gate, and synchronizes windows over a BroadcastChannel.
// Nothing here fetches anything but the font files the host's font root serves.
import { resolveSlideVariables } from "@openpresentation/opf";
import { toSvg } from "./svg.js";

/** Error raised for a deck that cannot be read, rendered or loaded. */
export class DeckError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "DeckError";
    this.code = code;
    if (options?.source) this.details = {source: options.source, status: options.status, contentType: options.contentType};
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Plain text of a title, text or notes value (a string, a run or an array of runs). Never markup. */
export function plainText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(plainText).join("");
  if (isObject(value) && typeof value.text === "string") return value.text;
  return "";
}

/** Read a deck: an OPF object, or a JSON string. Throws a DeckError (`invalid-document`) for anything else. */
export function parseDeckDocument(input) {
  let value = input;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch (cause) { throw new DeckError("invalid-document", "The deck is not valid JSON.", { cause }); }
  }
  if (!isObject(value) || !Array.isArray(value.slides)) throw new DeckError("invalid-document", "The deck is not an OPF document: it needs a slides array.");
  return value;
}

/**
 * The slides that play, as indexes into `document.slides`. A hidden slide is skipped unless `includeHidden` is set, so the
 * counter, number-and-Enter and the `slide` attribute all count the same sequence.
 */
export function presentableIndexes(document, { includeHidden = false } = {}) {
  const slides = Array.isArray(document?.slides) ? document.slides : [];
  const indexes = [];
  slides.forEach((slide, index) => { if (includeHidden || !(isObject(slide) && slide.hidden === true)) indexes.push(index); });
  return indexes;
}

/** Facts about one slide for a counter, a label, a thumbnail or the speaker view. `notes` is plain text only. */
export function slideInfo(document, index) {
  const authored = isObject(document?.slides?.[index]) ? document.slides[index] : {};
  // FA-31: the strings a counter, label or speaker view shows hold this slide's number, section and the deck's slide count, as the drawn slide does.
  const { title: shownTitle, subtitle, tag, notes, section } = resolveSlideVariables({ title: authored.title, subtitle: authored.subtitle, tag: authored.tag, notes: authored.notes, section: authored.section }, { slideNumber: Math.max(1, index + 1), slideCount: Math.max(1, document?.slides?.length ?? 1) });
  const slide = { ...authored, title: shownTitle, subtitle, tag, notes, section };
  const title = plainText(slide.title).trim() || plainText(slide.subtitle).trim() || plainText(slide.tag).trim();
  return {
    index,
    id: typeof slide.id === "string" ? slide.id : undefined,
    title: title || `Slide ${index + 1}`,
    hasTitle: Boolean(title),
    notes: plainText(slide.notes),
    section: typeof slide.section === "string" ? slide.section : undefined,
    hidden: slide.hidden === true,
  };
}

/** "Slide 3 of 8: Revenue grew" (the accessible name of a slide). */
export function slideLabel(info, position, total) {
  return `Slide ${position} of ${total}${info.hasTitle ? `: ${info.title}` : ""}`;
}

/** Whole numbers only: "3", " 3 " and 3 are slide 3; "", "3.5", "x" and 0 are not slide numbers. */
export function parseSlideNumber(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : undefined;
  if (typeof value !== "string" || !/^\s*\d+\s*$/.test(value)) return undefined;
  return Number.parseInt(value, 10);
}

/** A position in a sequence of slides. Positions are 0-based here; the public `slide` number is position + 1. */
export function createCursor(sequence, position = 0) {
  let list = sequence.slice();
  let at = 0;
  const clamp = (value) => (list.length ? Math.min(Math.max(Math.trunc(value), 0), list.length - 1) : 0);
  at = clamp(position);
  return {
    get total() { return list.length; },
    get position() { return at; },
    get number() { return list.length ? at + 1 : 0; },
    get index() { return list.length ? list[at] : -1; },
    get sequence() { return list.slice(); },
    set(next) { const before = at; at = clamp(next); return at !== before; },
    /** Go to the 1-based slide number (clamped to the sequence). */
    goto(number) { return this.set(number - 1); },
    next() { return this.set(at + 1); },
    previous() { return this.set(at - 1); },
    first() { return this.set(0); },
    last() { return this.set(list.length - 1); },
    /** Go to the slide at a document index, or the nearest one after it that plays. */
    gotoIndex(index) {
      const found = list.findIndex((candidate) => candidate >= index);
      return this.set(found === -1 ? list.length - 1 : found);
    },
    reset(nextSequence, keepIndex) {
      list = nextSequence.slice();
      const found = keepIndex === undefined ? -1 : list.findIndex((candidate) => candidate >= keepIndex);
      at = clamp(found === -1 ? (keepIndex === undefined ? at : list.length - 1) : found);
    },
  };
}

// --- SVG preparation -----------------------------------------------------------------------------------------------

/** The slide's own size from its root `viewBox`. */
export function svgDimensions(svg) {
  const match = /^<svg\b[^>]*\sviewBox="([\d.\s-]+)"/.exec(svg);
  const parts = match ? match[1].trim().split(/\s+/).map(Number) : [];
  const width = parts[2] > 0 ? parts[2] : 1280, height = parts[3] > 0 ? parts[3] : 720;
  return { width, height };
}

/**
 * The renderer's SVG made responsive and readable: the fixed `width` and `height` go (the viewBox scales it), and the root's
 * labelled-container attributes (`role="group"`, `aria-roledescription="slide"`, `aria-label`) go too, because the slide section or figure around it
 * carries the one accessible name, so a slide is announced once. The slide's own text nodes reach a screen reader in document order,
 * which is the reading order (tag, title, content, footnotes, then header and footer) the renderer paints; purely decorative drawing
 * keeps its `aria-hidden`.
 * `idPrefix` renames the ids the slide defines (gradients, patterns, clip paths) so a thumbnail of a slide and the slide
 * itself never share an id in one tree.
 */
export function prepareSlideSvg(svg, { idPrefix } = {}) {
  const match = /^<svg\b[^>]*>/.exec(svg);
  if (!match) return svg;
  let root = match[0].replace(/\s(?:width|height|role|aria-roledescription|aria-label)="[^"]*"/g, "");
  root = root.replace(/^<svg\b/, '<svg class="opf-slide" preserveAspectRatio="xMidYMid meet" focusable="false"');
  let rest = svg.slice(match[0].length);
  if (idPrefix) {
    rest = rest.replace(/\bid="opf-/g, `id="${idPrefix}opf-`).replace(/url\(#opf-/g, `url(#${idPrefix}opf-`).replace(/href="#opf-/g, `href="#${idPrefix}opf-`);
  }
  return root + rest;
}

const UNSAFE_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed", "animate", "set", "animatetransform", "animatemotion"]);

/**
 * Defence in depth for a parsed slide: the renderer escapes everything it writes, but a player may be pointed at a deck
 * nobody reviewed, so scripts, event handlers, foreign content and SMIL animation never reach the page.
 */
export function sanitizeSvgTree(root) {
  const doomed = [];
  const walk = (node) => {
    for (const child of Array.from(node.children ?? [])) {
      if (UNSAFE_ELEMENTS.has(child.localName.toLowerCase())) { doomed.push(child); continue; }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) child.removeAttribute(attribute.name);
        else if ((name === "href" || name === "xlink:href") && /^\s*(?:javascript|vbscript):/i.test(attribute.value)) child.removeAttribute(attribute.name);
      }
      walk(child);
    }
  };
  walk(root);
  for (const node of doomed) node.remove();
  return root;
}

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb", "iw"]);

/** Whether a deck's language (a BCP-47 tag such as `ar` or `he-IL`) is written right to left. Anything else, including a catalog id, is not. */
export function isRtlLanguage(language) {
  return typeof language === "string" && RTL_LANGUAGES.has(language.trim().toLowerCase().split(/[-_]/)[0]);
}

/** Today's local calendar date, ISO `YYYY-MM-DD`, for `date: true` header and footer furniture. The renderer reads no clock. */
export function localIsoDate(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// --- font gate -----------------------------------------------------------------------------------------------------

/**
 * The gate every render goes through: nothing draws a document before the faces it needs are loaded. `fonts` is a browser
 * fonts handle (`loadFonts` from `/fonts-browser`); one without `pending` and `ensure` gates nothing. Face level: only the
 * vendored and script faces the document draws are fetched, each hash-verified by the registry behind the handle.
 */
export function createFontGate(fonts) {
  // A document that does not resolve has nothing to load here: the renderer reports it when it draws.
  const pending = (document, options) => { try { return fonts?.pending?.(document, options) ?? []; } catch { return []; } };
  return {
    pending,
    async ensure(document, { signal, renderOptions } = {}) {
      if (!pending(document, renderOptions).length) return;
      try { await fonts.ensure(document, { ...renderOptions, signal }); } catch (cause) {
        if (signal?.aborted) throw cause;
        throw new DeckError("fonts-unavailable", `Fonts for this deck could not be loaded: ${cause?.message ?? cause}`, { cause });
      }
      const left = pending(document, renderOptions);
      if (left.length) throw new DeckError("fonts-unavailable", `Fonts for this deck did not finish loading: ${left.join(", ")}.`);
    },
  };
}

// --- slide store ---------------------------------------------------------------------------------------------------

/**
 * One deck's rendering, shared by the element, the full-screen player and the speaker view: font loading once, each slide
 * rendered once by `toSvg` and kept, so moving between slides never draws twice and every surface shows the same markup.
 *
 * `fonts` is a browser fonts handle (or nothing: layout then uses estimated widths and the visitor's system sans-serif).
 */
export function createDeckStore({ document, fonts, renderOptions = {}, date } = {}) {
  const deck = parseDeckDocument(document);
  const gate = fonts ? createFontGate(fonts) : undefined;
  const cache = new Map();
  const diagnostics = [];
  const options = () => ({
    ...renderOptions,
    // Inline slides use the page's own faces (the registry added them to the document), so only the measurement is passed: nothing is embedded.
    ...(fonts?.textMeasurement ? { fonts: { textMeasurement: fonts.textMeasurement } } : {}),
    ...(renderOptions.date === undefined && date !== undefined ? { date } : {}),
    onDiagnostic(diagnostic) { diagnostics.push(diagnostic); renderOptions.onDiagnostic?.(diagnostic); },
  });
  let validated = false, ready;
  const store = {
    document: deck,
    diagnostics,
    /** Load the faces the deck draws. Resolves once; a failed load can be retried by calling it again. */
    ready(signal) {
      if (!gate) return Promise.resolve();
      ready ??= gate.ensure(deck, { signal, renderOptions: renderOptions }).catch((error) => { ready = undefined; throw error; });
      return ready;
    },
    /** The renderer's SVG for the slide at a document index (after `ready()`). Rendered once. */
    svg(index) {
      let svg = cache.get(index);
      if (svg === undefined) {
        try {
          svg = toSvg(deck, index + 1, { ...options(), validate: !validated });
        } catch (cause) {
          if (cause instanceof DeckError) throw cause;
          // A document the schema rejects says where: the first finding's path and message.
          const finding = cause?.code === "invalid-opf" ? cause.findings?.[0] : undefined;
          const where = finding ? ` (${finding.path || "/"}: ${finding.message})` : "";
          throw new DeckError(cause?.code === "invalid-opf" ? "invalid-document" : "render-failed", `${cause?.message ?? "The slide could not be drawn."}${where}`, { cause });
        }
        validated = true;
        cache.set(index, svg);
      }
      return svg;
    },
    info(index) { return slideInfo(deck, index); },
    /** Forget every drawn slide (after the fonts or options change). */
    invalidate() { cache.clear(); },
  };
  return store;
}

// --- cross-window sync -----------------------------------------------------------------------------------------------

export const SYNC_VERSION = 1;

/** FNV-1a over a string: a short stable key (not a security measure). */
function fnv(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}

/** The default channel name of a deck: windows playing the same deck (same origin) hear each other, wherever each loaded it from. */
export function deckChannelName(document) {
  const slides = Array.isArray(document?.slides) ? document.slides : [];
  const identity = [document?.name ?? "", slides.length, ...slides.slice(0, 64).map((slide, index) => slide?.id ?? index)].join("|");
  return `opf-deck:${fnv(identity)}`;
}

/**
 * Whether a state from another window beats this window's own. Every state carries a revision (a logical clock: a window
 * that changes the show adds one to the highest revision it has seen), and the window id breaks a tie, so two windows that
 * change the show at the same moment settle on the same state instead of swapping them.
 */
export function stateWins(remote, local) {
  return remote.rev > local.rev || (remote.rev === local.rev && String(remote.from) > String(local.from));
}

/**
 * A BroadcastChannel carrying the one thing windows share: which slide is showing and whether the screen is blanked.
 * Messages are `{ v, type: "state" | "hello", from, rev, index, blank, reply? }`. A window ignores its own messages and keeps
 * a state only when it wins (`stateWins`); a new window says hello and the others answer with their state (`reply`), which
 * the newcomer takes. Malformed or foreign messages are ignored. Without BroadcastChannel it does nothing (`active` is false).
 */
export function createSync({ name, id, onState, BroadcastChannelImpl = globalThis.BroadcastChannel, getState }) {
  if (typeof BroadcastChannelImpl !== "function" || !name) return { active: false, post() {}, hello() {}, close() {} };
  const channel = new BroadcastChannelImpl(name);
  const send = (state, reply) => channel.postMessage({ v: SYNC_VERSION, type: "state", from: id, rev: state.rev, index: state.index, blank: state.blank, ...(reply ? { reply: true } : {}) });
  channel.onmessage = (event) => {
    const message = event.data;
    if (!isObject(message) || message.v !== SYNC_VERSION || message.from === id) return;
    if (message.type === "state" && Number.isInteger(message.index) && Number.isInteger(message.rev) && ["none", "black", "white"].includes(message.blank)) onState({ index: message.index, blank: message.blank, rev: message.rev, from: String(message.from), reply: message.reply === true });
    else if (message.type === "hello") { const state = getState?.(); if (state) send(state, true); }
  };
  return {
    active: true,
    post: (state) => send(state, false),
    hello() { channel.postMessage({ v: SYNC_VERSION, type: "hello", from: id }); },
    close() { channel.onmessage = null; channel.close(); },
  };
}

let counter = 0;
/** A window-local id for sync messages. */
export function newSurfaceId() { counter += 1; return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`; }

// --- time ---------------------------------------------------------------------------------------------------------

/** `1:05` or `1:02:03` for a number of milliseconds (negative values show a leading minus). */
export function formatDuration(milliseconds) {
  const sign = milliseconds < 0 ? "-" : "";
  const total = Math.floor(Math.abs(milliseconds) / 1000);
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
  const two = (value) => String(value).padStart(2, "0");
  return hours ? `${sign}${hours}:${two(minutes)}:${two(seconds)}` : `${sign}${minutes}:${two(seconds)}`;
}

/** A stopwatch the speaker view reads. `now` is injectable so tests are exact. */
export function createTimer(now = () => Date.now()) {
  let started, elapsed = 0;
  return {
    get running() { return started !== undefined; },
    elapsed() { return elapsed + (started === undefined ? 0 : now() - started); },
    start() { if (started === undefined) started = now(); },
    pause() { if (started !== undefined) { elapsed += now() - started; started = undefined; } },
    toggle() { if (started === undefined) this.start(); else this.pause(); },
    reset() { elapsed = 0; started = started === undefined ? undefined : now(); },
  };
}
