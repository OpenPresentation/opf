import type { BrowserFontsHandle } from "./fonts-browser.js";
import type { RenderSvgOptions } from "./svg.js";

/**
 * Why a deck could not be loaded, drawn or presented. `code` is stable: `invalid-document`, `fetch-failed`, `fonts-unavailable`,
 * `render-failed`, `no-slides`, `no-document`, `not-ready`, `no-dom`, `present-failed`, `load-failed`.
 */
export declare class DeckError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: { cause?: unknown });
}

/** The slide that is showing, in the sequence that plays (hidden slides are not counted). `notes` is plain text. */
export interface PlayerSlideChange { slide: number; total: number; index: number; id?: string; title: string; notes: string; section?: string }

export type BlankMode = "none" | "black" | "white";

export interface PresentOptions {
  /** The self-hosted font root URL (see `copyPreviewFonts`), or a browser fonts handle the page already has (`loadFonts` from `/fonts-browser`). Without it layout uses estimated widths and system fonts. */
  fonts?: string | BrowserFontsHandle;
  /** Extra `renderSlideSvg` options (catalogs, imageResolver, date, ...). */
  renderOptions?: Partial<RenderSvgOptions>;
  /** 1-based slide to start on, in the sequence that plays. Default 1. */
  startSlide?: number;
  /** Play hidden slides too. Default false. */
  includeHidden?: boolean;
  /** Ask for full screen (needs a user gesture). Default true. */
  fullscreen?: boolean;
  /** Open the speaker view window too (needs a user gesture). */
  presenterView?: boolean;
  /** `"presenter"` makes this window the speaker view (for a second tab or window of your page). Default `"audience"`. */
  role?: "audience" | "presenter";
  /** BroadcastChannel name, or `false` for none. Default: derived from the deck, so windows of one deck (same origin) follow each other. */
  channel?: string | false;
  /** Where the player is mounted. Default `document.body`. */
  container?: HTMLElement;
  /** Where focus returns when the show ends. Default: the element focused when it started. */
  returnFocus?: HTMLElement | null;
  signal?: AbortSignal;
  /** An injectable clock (milliseconds since the epoch) for the speaker view's timer and clock. */
  now?: () => number;
  /** A deck store shared with an `<opf-deck>` (advanced). */
  store?: unknown;
}

/** A running slideshow. Events: `slidechange` (PlayerSlideChange), `blank` ({ mode }), `presenterview` ({ open }), `close` ({ slide, index }). */
export declare class PlayerSession extends EventTarget {
  /** The 1-based number of the showing slide. */
  readonly slide: number;
  readonly total: number;
  readonly blankMode: BlankMode;
  readonly closed: boolean;
  readonly presenterViewOpen: boolean;
  next(): boolean;
  previous(): boolean;
  first(): boolean;
  last(): boolean;
  goto(number: number): boolean;
  blank(mode?: BlankMode): boolean;
  toggleFullscreen(): void;
  /** Open the speaker view window (from a user gesture). Returns the window, or null when the browser blocked it. */
  openPresenterView(): Window | null;
  closePresenterView(): void;
  /** End the show: leave full screen, close the speaker view, restore focus. Safe to call twice. */
  close(): void;
  addEventListener(type: "slidechange", listener: (event: CustomEvent<PlayerSlideChange>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: "blank", listener: (event: CustomEvent<{ mode: BlankMode }>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: "presenterview", listener: (event: CustomEvent<{ open: boolean }>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: "close", listener: (event: CustomEvent<{ slide: number; index?: number }>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/**
 * Start a slideshow over the page. `source` is an OPF document (object or JSON text), the URL of one, or an `<opf-deck>`
 * element. Keys: arrows, Page Up/Down, Space, Enter, N and P (next, previous), Home/End, a slide number then Enter, B and W
 * (black and white screen), S (speaker view), F (full screen), Escape to leave. Hidden slides are skipped. Call it from a
 * click or key handler: full screen and the speaker view need a user gesture.
 */
export declare function present(source: unknown, options?: PresentOptions): Promise<PlayerSession>;
