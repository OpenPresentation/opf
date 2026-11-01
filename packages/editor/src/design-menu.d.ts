import type { OpfIcons } from "./icons.js";
import type { Catalog } from "@openpresentation/opf";
import type { EditorSession } from "./index.js";

export interface DesignMenuLabels {
  /** The visible text of the toolbar button. Default: "Design". */
  trigger?: string;
  /** The accessible name of the popover, and the title of the bottom sheet on a phone. Default: "Design". */
  title?: string;
  /** Default: "Theme". */
  theme?: string;
  /** The color scheme section. Default: "Colors". */
  colors?: string;
  /** The font scheme section. Default: "Fonts". */
  fonts?: string;
  /** The section for the current slide's layout. Default: "This slide: Layout". */
  layout?: string;
  /** The row that opens the full Design panel (only shown when `onOpenPanel` is given). Default: "More design options…". */
  more?: string;
  /** What the toolbar's overflow menu lists (`menuItems()`). Default: "Design…". */
  menuItem?: string;
  /** The accessible name of the sheet's close button. Default: "Close". */
  close?: string;
  /** Shown when no catalog offers any choice. */
  empty?: string;
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
  /** Greys the button (and closes the menu). The editor does this while the source is invalid. */
  setDisabled(disabled: boolean): void;
  setReadOnly(readOnly: boolean): void;
  /** Read the document and catalogs again. The open menu also follows the editor session on its own. */
  refresh(): void;
  /** Open the popover and focus the current theme. From a button that is not on screen (the overflow menu) it opens as a sheet. */
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
 * The Design quick menu: a toolbar button and a compact popover for Theme, Colors, Fonts and the current slide's Layout, for embeds that have no room
 * for the full Design panel. Choosing applies at once (one undoable edit) and keeps the menu open. On a phone (`max-width: 600px`) the popover is a bottom sheet.
 */
export declare function createDesignMenu(container: HTMLElement, options: DesignMenuOptions): DesignMenu;
