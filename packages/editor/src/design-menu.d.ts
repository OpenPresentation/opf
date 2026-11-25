import type { OpfIcons } from "./icons.js";
import type { Catalog } from "@openpresentation/opf";
import type { EditorSession } from "./index.js";

export interface DesignMenuLabels {
  /** The visible text of the toolbar button. Default: "Design". */
  trigger?: string;
  /** The panel's title and accessible name. Default: "Design". */
  title?: string;
  /** Default: "Theme". */
  theme?: string;
  /** The color scheme section. Default: "Colors". */
  colors?: string;
  /** The font scheme section. Default: "Fonts". */
  fonts?: string;
  /** The name of the current slide's layout choices. Default: "This slide: Layout". */
  layout?: string;
  /** The layout section's tab. Default: "Layout". */
  layoutTab?: string;
  /** The row that opens the full Design panel (only shown when `onOpenPanel` is given). Default: "More design options…". */
  more?: string;
  /** What the toolbar's overflow menu lists (`menuItems()`). Default: "Design…". */
  menuItem?: string;
  /** The accessible name of the panel's close button. Default: "Close". */
  close?: string;
  /** Shown when no catalog offers any choice. */
  empty?: string;
  /** The small label over a section: `kind` is "theme", "colors" or "layout", `slide` 0-based. Default: "Theme · 3", "Color scheme · 14", "Slide 02 · 39 layouts". */
  count?: (kind: "theme" | "colors" | "layout", count: number, slide: number) => string;
  /** The font filter's accessible name. Default: "Filter fonts". */
  filterFonts?: string;
  /** The font filter's placeholder. Default: "Filter 29 fonts". */
  filterPlaceholder?: (count: number) => string;
  /** Shown when the filter matches no font. */
  noFonts?: (query: string) => string;
  /** The group of the font scheme in use. Default: "In use". */
  inUse?: string;
  /** The font groups, by the font scheme record's `type`. */
  fontTypes?: { "sans-serif"?: string; serif?: string; monospace?: string; other?: string };
  /** The foot's line on the Fonts section; `language` is the deck language's name. */
  fontsFor?: (language: string) => string;
  /** The foot's line on the Theme section. */
  themeHint?: string;
  /** The foot's button that undoes the last choice. Default: "Undo". */
  undo?: string;
  /** The foot's line after Undo. Default: "Undone.". */
  undone?: string;
  /** The status line after a choice. `kind` is "theme", "colors", "fonts" or "layout". Default: "Theme set to Classic.". */
  applied?: (kind: "theme" | "colors" | "fonts" | "layout", name: string) => string;
  /** The status line when the choice was already set. */
  already?: (name: string) => string;
  /** Appended to the status line when slides keep their own value of a deck-level choice. */
  shadowed?: (count: number) => string;
}

export interface DesignMenuOptions {
  /** The editor session. Every choice is one validated, undoable edit with `source: "design-menu"`. */
  editor: EditorSession;
  /** The catalogs that supply the choices (the workspace's merged `catalogs()`). Default: the session's registered catalogs. */
  catalogs?: readonly Catalog[] | (() => readonly Catalog[]);
  /** The slide whose layout the layout section shows and changes (0-based). Default: slide 0. */
  getSlideIndex?: () => number;
  /** `"comfortable"` (default) or `"touch"` (40px rows; a coarse pointer always gets 44px). */
  density?: "comfortable" | "touch";
  labels?: DesignMenuLabels;
  /**
   * Replace an icon: `trigger` (the palette on the button), `close` (the X in the phone sheet) and `check` (the mark on the chosen row). See `OpfIcon`.
   * The icons carry `class="opf-icon"` and `data-opf-icon`.
   */
  icons?: OpfIcons<"trigger" | "close" | "check">;
  /**
   * Where the panel opens: under this element (a bar), its end edge on the element's content edge, at most as tall as the room below. A function
   * is read at each opening. Default: the button. Design, Find and Export share one panel: opening one closes the other.
   */
  anchor?: HTMLElement | (() => HTMLElement | null | undefined);
  /** True to disable the button (the document cannot be edited). Default false. */
  readOnly?: boolean;
  /** Adds a "More design options…" row that closes the menu and calls this, to open the host's full Design panel. Hidden when not given. */
  onOpenPanel?: () => void;
  /** Receives a short message after every choice (also announced in a polite live region inside the menu). */
  onStatus?: (message: string) => void;
}

export interface DesignMenuItem {
  id: "design";
  label: string;
  disabled: boolean;
  run(): void;
}

export interface DesignMenu {
  /** The part's root: the button and its popover. */
  readonly element: HTMLElement;
  /** The toolbar button. */
  readonly trigger: HTMLButtonElement;
  setDensity(density: "comfortable" | "touch"): void;
  /** Grays the button (and closes the menu). The editor does this while the source is invalid. */
  setDisabled(disabled: boolean): void;
  setReadOnly(readOnly: boolean): void;
  /** Read the document and catalogs again. The open menu also follows the editor session on its own. */
  refresh(): void;
  /** Open the panel on the section shown last (Theme at first) and focus its current choice. From a button that is not on screen (the overflow menu) it opens as a sheet. */
  open(): void;
  /** Close the popover and return focus to the button (or to what had it when the menu opened). */
  close(options?: { restoreFocus?: boolean }): void;
  isOpen(): boolean;
  /** What this part offers the toolbar's overflow menu: `[{ id: "design", label: "Design…", run: open }]`. */
  menuItems(): DesignMenuItem[];
  /** Removes the element and every listener. Safe to call twice. */
  destroy(): void;
}

/**
 * The Design quick menu: a toolbar button and the editor's one panel with four tabs, Theme, Colors, Fonts (for the deck's language) and the current
 * slide's Layout, for embeds that have no room for the full Design panel. Choosing applies at once (one undoable edit, with Undo in the panel's foot)
 * and keeps the panel open. On a phone (`max-width: 600px`) the panel is a bottom sheet.
 */
export declare function createDesignMenu(container: HTMLElement, options: DesignMenuOptions): DesignMenu;
