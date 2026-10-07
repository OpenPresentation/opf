import type { BrowserFontsHandle } from "./fonts-browser.js";
import type { RenderFonts } from "./fonts.js";
import type { RenderSvgOptions } from "./svg.js";
import type { PlayerSession, PresentOptions, PlayerSlideChange } from "./player.js";
export { DeckError } from "./player.js";
export { loadPreviewFonts, previewBaseFaces, previewFontLayout } from "./preview-fonts.js";

export declare const OPF_DECK_TAG: "opf-deck";

export type OpfDeckSlideChange = PlayerSlideChange;
export interface OpfDeckErrorDetail {
  code: string;
  message: string;
  /** False when the deck still shows (for example the fonts did not load and the layout is estimated). */
  fatal: boolean;
}
export interface OpfDeckEventMap {
  ready: CustomEvent<{ total: number; slide: number }>;
  slidechange: CustomEvent<OpfDeckSlideChange>;
  error: CustomEvent<OpfDeckErrorDetail>;
  presentstart: CustomEvent<{ slide: number }>;
  presentend: CustomEvent<{ slide: number }>;
}

/**
 * `<opf-deck src="deck.opf.json" fonts="/opf-fonts/">`: an embedded OPF deck. Attributes: `src`, `slide` (1-based), `fonts`,
 * `thumbnails`, `controls="none"`, `present`, `include-hidden`, `label`, `keyboard="off"`. It draws the renderer's own SVG.
 */
export interface OpfDeckElement extends HTMLElement {
  src: string;
  /** The OPF document. Setting it (an object or JSON text) replaces `src`. */
  document: unknown;
  /** The 1-based number of the showing slide in the sequence that plays; set it to navigate. */
  slide: number;
  readonly total: number;
  /**
   * The fonts the deck draws with: the URL of the self-hosted font root (the `fonts` attribute), or a browser fonts handle the page
   * already has (`loadFonts` from `/fonts-browser`), which wins over the attribute. The getter returns the handle when one is set, else the
   * attribute's URL (an empty string without either).
   */
  fonts: string | BrowserFontsHandle;
  /** Extra `renderSlideSvg` options (catalogs, imageResolver, date, ...). Set before the deck loads, or call `reload()`. */
  renderOptions: Partial<RenderSvgOptions>;
  includeHidden: boolean;
  thumbnails: boolean;
  readonly ready: Promise<void>;
  readonly currentSlide: PlayerSlideChange | undefined;
  next(): boolean;
  previous(): boolean;
  first(): boolean;
  last(): boolean;
  goto(number: number): boolean;
  reload(): Promise<void>;
  /** Open the full-screen slideshow (from a user gesture). Loads the player on first use. */
  present(options?: PresentOptions): Promise<PlayerSession>;
  addEventListener<K extends keyof OpfDeckEventMap>(type: K, listener: (this: OpfDeckElement, event: OpfDeckEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/** The element class (created on first call, so importing this module is safe on a server). Browser only. */
export declare function getOpfDeckElement(): { new (): OpfDeckElement; readonly observedAttributes: string[] };
/** Register `<opf-deck>` (or another tag name). Safe to call twice and on a server, where it does nothing. */
export declare function defineOpfDeck(tagName?: string): CustomElementConstructor | undefined;

export interface RenderDeckHtmlOptions {
  tagName?: string;
  /** `"first"` (default: the first slide and a list of titles), `"all"`, or 1-based slide numbers. */
  slides?: "first" | "all" | readonly number[];
  includeHidden?: boolean;
  src?: string;
  slide?: number;
  /** A string is the font root URL written to the tag's `fonts` attribute; an object (a `loadFonts()` handle, or any `RenderFonts`) draws the markup with those fonts and writes no attribute. */
  fonts?: string | RenderFonts;
  label?: string;
  thumbnails?: boolean;
  present?: boolean;
  /** Extra attributes on the tag. */
  attributes?: Record<string, string | boolean | undefined>;
  /** Put the document in an `application/opf+json` script child so the element upgrades without a request. */
  embed?: boolean;
  /** Today's date (ISO) for `date: true` furniture. */
  date?: string;
  renderOptions?: Partial<RenderSvgOptions>;
}

/** Server-side markup: the deck's slides as inline SVG inside the tag, shown as is without JavaScript and replaced when the element upgrades. */
export declare function renderDeckHtml(document: unknown, options?: RenderDeckHtmlOptions): string;

declare global {
  interface HTMLElementTagNameMap { "opf-deck": OpfDeckElement }
}
