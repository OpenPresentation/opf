// CE-30: `<opf-editor>`, the editor as a custom element: one tag, no framework, for a CMS, WordPress or plain HTML.
//
//   import { defineOpfEditorElement } from "@openpresentation/opf-editor/element";
//   defineOpfEditorElement();                       // or: import "@openpresentation/opf-editor/element/define";
//   <opf-editor layout="embed" src="/decks/q3.json"></opf-editor>
//
// The element wraps `createOpfEditor` (workspace.js) the way react.js does: the workspace module is imported on demand (a page that defines the
// element and never uses the tag loads none of it), the editor is created once the element is connected and the page has parsed its content,
// `destroy()` runs when it is removed, and the editor handle is the single owner of everything it mounted. Importing this module has no side
// effect and runs on a server (no `HTMLElement` is touched until `defineOpfEditorElement` is called). The editor mounts in a `div` inside the
// element, so inline `<script type="application/json">` children stay where the author put them. No network is used unless the page sets `src`.

import { readDeckFile } from "./read-deck-file.js";

const DEFAULT_TAG = "opf-editor";

/**
 * Every event of the workspace handle, re-dispatched on the element as a `CustomEvent` named `opf-<name>` (camelCase to kebab-case). A drift test
 * keeps this list a superset of the keys of `OpfEditorEvents` in workspace.d.ts: the chrome's events (CE-28) `deckName` (`opf-deck-name`),
 * `expand`, `dirty`, `save` and `review-open` among them.
 */
export const OPF_EDITOR_EVENTS = Object.freeze([
  "mounted", "ready", "change", "selection", "zoom", "layout", "command", "layoutStudio", "cursor", "slide", "view", "source", "checking", "fonts",
  "geometry", "sync", "render", "draft", "commit", "cancel", "status", "error", "kept", "rename", "export", "persistence", "review", "review-goto",
  "review-focus", "panel", "destroy", "deckName", "expand", "dirty", "save", "review-open",
]);

/** The DOM event type of a workspace event: `layoutStudio` becomes `opf-layout-studio`. */
export const opfEventType = (name) => `opf-${String(name).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const OBSERVED = ["layout", "toolbar", "readonly", "theme", "density", "slide", "src", "fonts"];
const SCRIPT_TYPES = [
  { name: "deck.json", test: (type) => type === "application/json" || /\+json$/.test(type) },
  { name: "deck.yaml", test: (type) => /^(?:application|text)\/(?:x-)?yaml$/.test(type) || /\+yaml$/.test(type) },
  { name: "deck.md", test: (type) => type === "text/markdown" || type === "text/x-markdown" },
];
const HOST_ATTRIBUTE = "data-opf-element-host";

// The workspace chunk and the default fonts are loaded once per page and shared by every element.
let workspaceModule;
const loadWorkspace = () => {
  workspaceModule ??= import("./workspace.js");
  workspaceModule.catch(() => { workspaceModule = undefined; });
  return workspaceModule;
};
// A font root (the attribute `fonts="/opf-fonts"`, or a string given as `fonts`) is loaded the way `<opf-deck fonts>` loads it: the renderer's
// `loadPreviewFonts`, on demand, one shared handle per root. The renderer is an optional peer, so a page that gives a handle never loads it.
const loadFontRoot = (root) =>
  import("@openpresentation/opf-render/preview-fonts").then(({ loadPreviewFonts }) => loadPreviewFonts(root), (cause) => {
    throw new Error("A font root needs @openpresentation/opf-render (an optional peer of the editor): install it, or give the element a fonts handle.", { cause });
  });

const styled = new WeakMap();
/** The default box of the element, once per document or shadow root. `:where()` keeps the specificity at zero, so any page rule wins. */
function ensureStyle(element, tag) {
  const root = element.getRootNode?.();
  const target = root && root.nodeType === 11 ? root : element.ownerDocument?.head;
  if (!target) return;
  const done = styled.get(target) ?? new Set();
  if (done.has(tag)) return;
  done.add(tag);
  styled.set(target, done);
  const style = element.ownerDocument.createElement("style");
  style.setAttribute("data-opf-element-style", tag);
  style.textContent = `:where(${tag}){display:block;position:relative;height:600px;min-height:240px}:where(${tag}[hidden]){display:none}:where(${tag})>[${HOST_ATTRIBUTE}]{height:100%;min-height:0}`;
  target.prepend(style);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function deckNameFor(src, contentType = "") {
  let last = "";
  try {
    last = decodeURIComponent(new URL(src, "http://x/").pathname.split("/").pop() ?? "");
  } catch {
    last = "";
  }
  if (/\.(?:json|opf|ya?ml|md|markdown)$/i.test(last)) return last;
  const type = contentType.split(";")[0].trim().toLowerCase();
  const kind = SCRIPT_TYPES.find((entry) => entry.test(type));
  return kind ? kind.name : last || "deck.json";
}

function slideIndexOf(value) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`slide must be a whole number from 0 (the first slide), not "${value}".`);
  return index;
}

function parseToolbar(value) {
  if (value === null || value.trim() === "") return undefined;
  if (value.trim().toLowerCase() === "none") return false;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

/**
 * Define the custom element (once) and return its class. `defaults` are the `fonts` and `catalogs` of every element of this name; a property on
 * the element wins. Calling it again returns the class already defined under that name.
 */
export function defineOpfEditorElement(name = DEFAULT_TAG, defaults = {}) {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined") throw new TypeError("defineOpfEditorElement needs a browser (customElements).");
  const existing = customElements.get(name);
  if (existing) {
    if (existing.opfEditorElement) return existing;
    throw new Error(`"${name}" is already defined by another element.`);
  }
  const { fonts: defaultFontsOption, catalogs: defaultCatalogs } = defaults ?? {};

  class OpfEditorElement extends HTMLElement {
    static opfEditorElement = true;
    static get observedAttributes() {
      return OBSERVED;
    }

    #connected = false;
    #editor = null;
    #host = null;
    #isReady = false;
    #starting = false;
    #generation = 0;
    #leave = 0;
    #loaded = null;
    #explicit = false;
    #pending = null;
    #fetching = null;
    #cancelParse = null;
    #remountQueued = false;
    #upgraded = false;
    #deferred = null;
    #options = {};
    #fonts;
    #catalogs;

    constructor() {
      super();
      this.#deferred = this.#newDeferred();
    }

    // ---- properties ---------------------------------------------------------------------------------------------------------------
    /** The editor handle once it is created, else `null`. */
    get editor() {
      return this.#editor;
    }

    /** Settles with the handle when the editor has mounted and drawn; rejects when it could not be created. Read it again after a remount. */
    get ready() {
      return this.#deferred.promise;
    }

    /** The document: live once the editor is mounted, else the one it will open. Set an object, or JSON, YAML or Markdown text. */
    get document() {
      if (this.#editor) return this.#editor.getDocument();
      return this.#loaded?.document ?? null;
    }

    set document(value) {
      if (value === null || value === undefined) return;
      if (typeof value === "string") {
        this.#adoptText(value, "deck.json", "document").then((loaded) => this.#receive(loaded), (error) => this.#fail("document", error));
        return;
      }
      this.#receive({ document: value });
    }

    /** More `createOpfEditor` options. Read when the editor mounts: setting another object remounts a mounted editor. */
    get options() {
      return this.#options;
    }

    set options(value) {
      const next = value && typeof value === "object" ? value : {};
      if (shallowEqual(next, this.#options)) return;
      this.#options = next;
      this.#remountIfMounted();
    }

    /** The fonts the editor draws with: a handle, a lease, a promise or a function of either (`OpfEditorFontsOption`), or the URL of a font root. */
    get fonts() {
      return this.#fonts ?? defaultFontsOption ?? this.#options.fonts ?? (this.getAttribute("fonts") || undefined);
    }

    set fonts(value) {
      if (value === this.#fonts) return;
      this.#fonts = value ?? undefined;
      this.#remountIfMounted();
    }

    get catalogs() {
      return this.#catalogs ?? defaultCatalogs;
    }

    set catalogs(value) {
      if (value === this.#catalogs) return;
      this.#catalogs = value ?? undefined;
      this.#remountIfMounted();
    }

    /** The slide on show (0-based): the editor's, once mounted. Setting it also sets the `slide` attribute. */
    get slide() {
      return this.#editor ? this.#editor.slideIndex : Number(this.getAttribute("slide")) || 0;
    }

    set slide(value) {
      this.setAttribute("slide", String(value));
      if (this.#editor) this.#guard("slide", () => this.#editor.setSlide(slideIndexOf(value)));
    }

    get readOnly() {
      return this.hasAttribute("readonly");
    }

    set readOnly(value) {
      this.toggleAttribute("readonly", Boolean(value));
    }

    // ---- lifecycle ----------------------------------------------------------------------------------------------------------------
    connectedCallback() {
      this.#connected = true;
      this.#leave++;
      this.#upgradeProperties();
      ensureStyle(this, name);
      if (!this.#editor && !this.#starting) this.#schedule();
    }

    disconnectedCallback() {
      this.#connected = false;
      const token = ++this.#leave;
      // A move in the DOM is a disconnect and a connect in one task: the editor is destroyed one microtask later, and not at all if it came back.
      queueMicrotask(() => {
        if (!this.#connected && token === this.#leave) this.#teardown();
      });
    }

    attributeChangedCallback(attribute, before, after) {
      if (before === after) return;
      if (attribute === "src") {
        this.#fetching?.abort();
        if (!this.#editor) {
          // Not mounted yet: the new address replaces whatever was loading or loaded, and a start in flight gives way to a fresh one.
          if (!this.#explicit) this.#loaded = null;
          this.#generation++;
          this.#starting = false;
          if (this.#connected) this.#schedule();
          return;
        }
        if (after) this.#loadSrc(after);
        return;
      }
      const editor = this.#editor;
      if (!editor) {
        this.#retry();
        return;
      }
      this.#guard(attribute, () => {
        if (attribute === "readonly") editor.setReadOnly(after !== null);
        else if (attribute === "density") editor.setDensity(after ?? this.#options.density ?? "auto");
        else if (attribute === "slide") editor.setSlide(slideIndexOf(after ?? "0"));
        else if (attribute === "theme") editor.setTheme(this.#theme());
        else if (attribute === "toolbar" && typeof editor.setToolbar === "function") editor.setToolbar(parseToolbar(after));
        else this.#remountIfMounted();
      });
    }

    // ---- start and stop -----------------------------------------------------------------------------------------------------------
    #schedule() {
      this.#starting = true;
      if (this.#deferred.settled) this.#deferred = this.#newDeferred();
      const generation = this.#generation;
      queueMicrotask(() => {
        if (generation === this.#generation) this.#start(generation);
      });
    }

    #current(generation) {
      return generation === this.#generation && this.#connected;
    }

    async #start(generation) {
      try {
        await this.#whenParsed();
        if (!this.#current(generation)) return;
        this.setAttribute("data-opf-state", "loading");
        const loaded = this.#loaded ?? (await this.#initialContent());
        if (!this.#current(generation)) return;
        const { createOpfEditor } = await loadWorkspace();
        if (!this.#current(generation)) return;
        const host = this.ownerDocument.createElement("div");
        host.setAttribute(HOST_ATTRIBUTE, "");
        this.append(host);
        let editor;
        try {
          editor = createOpfEditor(host, this.#createOptions(loaded));
        } catch (error) {
          host.remove();
          throw error;
        }
        this.#host = host;
        this.#editor = editor;
        this.#starting = false;
        this.#loaded = null;
        this.#explicit = false;
        editor.ready.then(() => {
          if (this.#editor !== editor) return;
          this.#isReady = true;
          this.setAttribute("data-opf-state", "ready");
          const pending = this.#pending;
          this.#pending = null;
          if (pending) this.#apply(editor, pending);
          this.#deferred.resolve(editor);
        }, (error) => {
          if (this.#editor !== editor) return;
          this.setAttribute("data-opf-state", "error");
          this.#deferred.reject(error);
        });
      } catch (error) {
        if (generation !== this.#generation) return;
        this.#starting = false;
        this.setAttribute("data-opf-state", "error");
        this.#fail(error?.opfOrigin ?? "mount", error);
        this.#deferred.reject(error);
      }
    }

    // The parser creates the element before its children: wait until they exist (the element has a next sibling, or the document is parsed).
    #whenParsed() {
      const doc = this.ownerDocument;
      if (doc.readyState !== "loading" || this.nextSibling) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          doc.removeEventListener("DOMContentLoaded", done);
          this.#cancelParse = null;
          resolve();
        };
        this.#cancelParse = done;
        doc.addEventListener("DOMContentLoaded", done);
      });
    }

    #teardown() {
      this.#generation++;
      this.#starting = false;
      this.#remountQueued = false;
      this.#cancelParse?.();
      this.#fetching?.abort();
      this.#fetching = null;
      const editor = this.#editor;
      if (editor) {
        this.#loaded = this.#snapshot(editor) ?? this.#loaded;
        this.#editor = null;
        this.#isReady = false;
        try {
          editor.destroy();
        } catch (error) {
          this.#fail("destroy", error);
        }
      }
      this.#pending = null;
      this.#host?.remove();
      this.#host = null;
      this.removeAttribute("data-opf-state");
    }

    // An element whose start failed (or that has not started) tries again when something it reads changes.
    #retry() {
      if (!this.#editor && this.#connected && !this.#starting) this.#schedule();
    }

    #remountIfMounted() {
      if (!this.#editor) {
        this.#retry();
        return;
      }
      if (this.#remountQueued) return;
      this.#remountQueued = true;
      // `ready` is about the editor that is coming: a page that awaits it right after changing an attribute waits for the remount.
      if (this.#deferred.settled) this.#deferred = this.#newDeferred();
      queueMicrotask(() => {
        if (!this.#remountQueued) return;
        this.#remountQueued = false;
        if (!this.#editor) return;
        this.#teardown();
        if (this.#connected) this.#schedule();
      });
    }

    // What a new editor needs to open where the old one stood: its document (with the text as written), slide and name.
    #snapshot(editor) {
      try {
        const snapshot = { document: editor.getDocument(), slide: editor.slideIndex };
        if (editor.mounted) {
          const text = editor.readSource();
          const name = editor.getName();
          if (!text.draft) snapshot.source = { text: text.text, format: text.format, ...(name !== undefined ? { name } : {}) };
        }
        return snapshot;
      } catch {
        return null;
      }
    }

    // ---- content ------------------------------------------------------------------------------------------------------------------
    async #initialContent() {
      const src = this.getAttribute("src");
      if (src) return this.#fetchDeck(src);
      const script = this.#inlineScript();
      return script ? this.#adoptText(script.text, script.name, "inline") : null;
    }

    #inlineScript() {
      for (const child of this.children) {
        if (child.localName !== "script") continue;
        const type = (child.getAttribute("type") ?? "").split(";")[0].trim().toLowerCase();
        const kind = SCRIPT_TYPES.find((entry) => entry.test(type));
        if (kind && child.textContent.trim()) return { text: child.textContent, name: kind.name };
      }
      return null;
    }

    async #adoptText(text, name, origin) {
      try {
        const read = await readDeckFile({ name, text }, { catalogs: this.catalogs });
        return { document: read.document, source: { text, format: read.format, name: read.name } };
      } catch (error) {
        error.opfOrigin = origin;
        throw error;
      }
    }

    async #fetchDeck(src) {
      this.#fetching?.abort();
      const controller = new AbortController();
      this.#fetching = controller;
      try {
        let url = src;
        try {
          url = new URL(src, this.ownerDocument.baseURI).href;
        } catch {
          // No usable base (a page without an address): fetch reports the problem.
        }
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`${url} answered ${response.status} ${response.statusText}`.trim());
        const text = await response.text();
        controller.signal.throwIfAborted();
        return await this.#adoptText(text, deckNameFor(url, response.headers.get("content-type") ?? ""), "src");
      } catch (error) {
        error.opfOrigin = "src";
        throw error;
      } finally {
        if (this.#fetching === controller) this.#fetching = null;
      }
    }

    // `src` changed on a mounted editor: fetch the deck and open it in place.
    #loadSrc(src) {
      this.#fetchDeck(src).then((loaded) => this.#receive(loaded), (error) => {
        if (error?.name !== "AbortError") this.#fail("src", error);
      });
    }

    // A document arrived (the property, `src`, a string): open it now if the editor is ready, after `ready` if it is mounting, else at mount.
    #receive(loaded) {
      if (this.#editor && this.#isReady) this.#apply(this.#editor, loaded);
      else if (this.#editor) this.#pending = loaded;
      else {
        this.#loaded = loaded;
        this.#explicit = true;
        this.#generation++;
        this.#starting = false;
        this.#retry();
      }
    }

    #apply(editor, loaded) {
      this.#guard("document", () => {
        const opened = editor.setDocument(loaded.document, loaded.source ? { text: loaded.source.text, format: loaded.source.format, name: loaded.source.name } : undefined);
        if (opened === false) throw new Error("The editor could not open this document; it is listed in the source pane with its problems.");
      });
    }

    // ---- options ------------------------------------------------------------------------------------------------------------------
    #theme() {
      const scheme = this.getAttribute("theme");
      const base = this.#options.theme;
      return scheme ? { ...base, colorScheme: scheme } : base;
    }

    #createOptions(loaded) {
      const user = this.#options;
      const fromAttributes = {};
      const layout = this.getAttribute("layout");
      if (layout) fromAttributes.layout = layout;
      const toolbar = parseToolbar(this.getAttribute("toolbar"));
      if (toolbar !== undefined) fromAttributes.toolbar = toolbar;
      if (this.hasAttribute("readonly")) fromAttributes.readOnly = true;
      const theme = this.#theme();
      if (theme !== undefined) fromAttributes.theme = theme;
      const density = this.getAttribute("density");
      if (density) fromAttributes.density = density;
      let slide = loaded?.slide;
      if (slide === undefined && this.hasAttribute("slide")) this.#guard("slide", () => { slide = slideIndexOf(this.getAttribute("slide")); });
      if (slide !== undefined) fromAttributes.slideIndex = slide;

      const on = {};
      for (const event of OPF_EDITOR_EVENTS) {
        on[event] = (detail) => {
          user.on?.[event]?.(detail);
          this.dispatchEvent(new CustomEvent(opfEventType(event), { bubbles: true, composed: true, detail }));
        };
      }
      const options = { ...user, ...fromAttributes, on };
      if (loaded) {
        options.document = loaded.document;
        if (loaded.source) options.source = { ...user.source, ...loaded.source };
      }
      const fonts = this.fonts;
      if (typeof fonts === "string") options.fonts = () => loadFontRoot(fonts);
      else if (fonts !== undefined) options.fonts = fonts;
      else delete options.fonts;
      const catalogs = this.catalogs;
      if (catalogs !== undefined) options.catalogs = catalogs;
      return options;
    }

    // ---- errors and plumbing ------------------------------------------------------------------------------------------------------
    #guard(origin, task) {
      try {
        task();
      } catch (error) {
        this.#fail(origin, error);
      }
    }

    #fail(origin, error) {
      const value = error instanceof Error ? error : new Error(String(error));
      this.dispatchEvent(new CustomEvent("opf-error", { bubbles: true, composed: true, detail: { error: value, message: value.message, source: origin } }));
    }

    #newDeferred() {
      const deferred = { settled: false };
      deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = (value) => { if (!deferred.settled) { deferred.settled = true; resolve(value); } };
        deferred.reject = (error) => { if (!deferred.settled) { deferred.settled = true; reject(error); } };
      });
      // A page that never awaits `ready` must not get an unhandled rejection for a failure `opf-error` already reported.
      deferred.promise.catch(() => {});
      return deferred;
    }

    // A property set on the element before the class was defined shadows the accessor; hand it to the accessor.
    #upgradeProperties() {
      if (this.#upgraded) return;
      this.#upgraded = true;
      for (const property of ["options", "fonts", "catalogs", "document", "slide", "readOnly", "layout", "toolbar", "theme", "density", "src"]) {
        if (Object.prototype.hasOwnProperty.call(this, property)) {
          const value = this[property];
          delete this[property];
          this[property] = value;
        }
      }
    }
  }

  // The remaining attributes are plain reflections: `el.layout = "embed"` is `setAttribute("layout", "embed")`.
  for (const attribute of ["layout", "toolbar", "theme", "density", "src"]) {
    Object.defineProperty(OpfEditorElement.prototype, attribute, {
      configurable: true,
      enumerable: true,
      get() {
        return this.getAttribute(attribute);
      },
      set(value) {
        if (value === null || value === undefined || value === false) this.removeAttribute(attribute);
        else this.setAttribute(attribute, String(value));
      },
    });
  }

  customElements.define(name, OpfEditorElement);
  return OpfEditorElement;
}
