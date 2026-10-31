import type { Catalog } from "@openpresentation/opf";
import type { OpfEditor, OpfEditorEvents, OpfEditorFontsOption, OpfEditorOptions } from "./workspace.js";

/** Every workspace event the element re-dispatches (the keys of `OpfEditorEvents`, plus the chrome's `deck-name` and `expand`). */
export declare const OPF_EDITOR_EVENTS: readonly string[];
/** The DOM event type of a workspace event name: `opfEventType("layoutStudio")` is `"opf-layout-studio"`. */
export declare function opfEventType(name: string): string;

type KebabCase<S extends string> = S extends `${infer Head}${infer Tail}` ? `${Head extends Lowercase<Head> ? Head : `-${Lowercase<Head>}`}${KebabCase<Tail>}` : S;

/**
 * The DOM events of `<opf-editor>`: one `opf-<name>` for each workspace event (`opf-ready`, `opf-change`, `opf-slide`, `opf-layout-studio`, ...), a
 * `CustomEvent` that bubbles and is composed, whose `detail` is the workspace event's detail.
 */
export type OpfEditorElementEventMap = {
  [Name in keyof OpfEditorEvents as `opf-${KebabCase<Name & string>}`]: CustomEvent<OpfEditorEvents[Name]>;
} & {
  /**
   * `opf-error` is also the element's own error channel: a `src` that could not be fetched or read (`source: "src"`), inline or property text that is
   * not a deck (`"inline"`, `"document"`), a document the editor refused (`"document"`), an attribute the editor rejected (`"layout"`, `"theme"`,
   * `"slide"`, ...) and an editor that could not be created, for example an unknown `layout` (`"mount"`). The workspace's own errors carry no `source`.
   */
  "opf-error": CustomEvent<OpfEditorEvents["error"] & { source?: string }>;
};

/** What `defineOpfEditorElement` takes as the defaults of every element of that name. A property on an element wins. */
export interface OpfEditorElementDefaults {
  /**
   * The fonts the editor draws with: the renderer's handle, a lease, a promise or a function of either, or the URL of a font root (a string, as in
   * `<opf-deck fonts="/opf-fonts">`, loaded with the renderer's `loadPreviewFonts`). Without it (and without a `fonts` property or attribute) the editor
   * draws with estimated layout and system fonts.
   */
  fonts?: OpfEditorFontsOption | string;
  /** The host's catalogs, for the session and every draw (for example `[gallery]`). */
  catalogs?: readonly Catalog[];
}

/**
 * `<opf-editor>`: the editor in one tag. The editor mounts in a `div` inside the element (light DOM), once the element is connected and the
 * page has parsed its content, and is destroyed one microtask after the element leaves the document (unless it came back: a move in the DOM
 * keeps the editor). Attributes `layout`, `toolbar`, `readonly`, `theme`, `density`, `slide` and `src` are observed; see docs/web-component.md.
 */
export interface OpfEditorElement extends HTMLElement {
  /** The editor handle once it is created, else `null` (before mount, after removal, or when it could not be created). */
  readonly editor: OpfEditor | null;
  /** Settles with the handle once the editor has mounted and drawn; rejects when it could not be created (`opf-error` says why). Read it again after a remount. */
  readonly ready: Promise<OpfEditor>;
  /**
   * The document. Reading it gives the live document of a mounted editor (frozen, replaced on every change) or the one the editor will open.
   * Setting an object opens it (one undoable change when the editor is mounted); a string is JSON, YAML or Markdown text.
   * Wins over `src` and over an inline `<script>`.
   */
  document: unknown;
  /** More `createOpfEditor` options. Read when the editor mounts; setting a different object on a mounted element remounts it, keeping the document. */
  options: Partial<OpfEditorOptions>;
  /** A fonts handle (or what `OpfEditorFontsOption` allows), or the URL of a font root; the `fonts` attribute is a font root. Default: `defineOpfEditorElement`'s. */
  fonts: OpfEditorFontsOption | string | undefined;
  catalogs: readonly Catalog[] | undefined;
  /** The attributes as properties. `readOnly` is the `readonly` attribute. */
  layout: string | null;
  toolbar: string | null;
  theme: "light" | "dark" | "auto" | string | null;
  density: "comfortable" | "touch" | "auto" | string | null;
  src: string | null;
  readOnly: boolean;
  /** The slide on show (0-based); setting it navigates. */
  slide: number;

  addEventListener<K extends keyof OpfEditorElementEventMap>(type: K, listener: (this: OpfEditorElement, event: OpfEditorElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof OpfEditorElementEventMap>(type: K, listener: (this: OpfEditorElement, event: OpfEditorElementEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

export interface OpfEditorElementConstructor {
  new (): OpfEditorElement;
  readonly prototype: OpfEditorElement;
  readonly observedAttributes: readonly string[];
}

/**
 * Define the custom element (default tag `opf-editor`) and return its class. Safe to call twice: it returns the class already defined under
 * that name, and throws when the name belongs to another element. Needs a browser (`customElements`); importing this module does not.
 */
export declare function defineOpfEditorElement(name?: string, defaults?: OpfEditorElementDefaults): OpfEditorElementConstructor;

declare global {
  interface HTMLElementTagNameMap {
    "opf-editor": OpfEditorElement;
  }
}
