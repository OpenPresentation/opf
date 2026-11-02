import type { OpfIcons } from "./icons.js";
/**
 * CE-28: the editor's title bar. Named items in order, each in its own slot element; when the row does not fit the width of the bar (its
 * container decides, not the window), the collapsible items are hidden lowest priority first and what they offer is listed in the `more` (⋯)
 * menu, built from each mounted part's `menuItems()`. `createOpfEditor` builds one for its default layouts (`toolbar` option); a host can build
 * its own and mount the editor's parts in its slots. CSS: `src/styles/toolbar.css`, classes `opf-tb-*`.
 */

/** The item names. `zoom` is the Studio's own (the workspace leaves it out). */
export type ToolbarItemName =
  | "title"
  | "history"
  | "counter"
  | "views"
  | "find"
  | "zoom"
  | "design"
  | "review"
  | "autosave"
  | "export"
  | "present"
  | "expand"
  | "actions"
  | "help"
  | "more"
  | "spacer"
  | "|";

/** An item name, or the name of a host's own item. */
export type ToolbarItemId = ToolbarItemName | (string & {});

/**
 * An item by name, or with its own priority (higher stays visible longer) and whether it may move into the more menu. A host's own item is
 * `{ id, priority }` with a name that is not one of the above (lowercase letters, digits and dashes): its slot starts empty, the host fills it
 * (`slot(id)`) and registers what it offers in the more menu with `mount(id, part)`. A bare unknown name throws, so a misspelt item is caught.
 */
export type ToolbarItemSpec =
  | ToolbarItemName
  | { id: ToolbarItemName; priority?: number; collapsible?: boolean }
  | { id: string; priority: number; collapsible?: boolean };

export interface ToolbarItem {
  id: ToolbarItemId;
  priority: number;
  collapsible: boolean;
}

/** The defaults of every item: `more` and `title` stay (the title shrinks instead), `spacer` and `|` are layout. */
export declare const TOOLBAR_ITEMS: Readonly<Record<ToolbarItemName, Readonly<{ priority: number; collapsible: boolean }>>>;

/** The items with their priorities. Throws on a name that is not an item (or a host item), and on a named item given twice (`spacer` and `|` may repeat). */
export declare function normalizeToolbarItems(items: readonly ToolbarItemSpec[]): ToolbarItem[];

/** One entry of the more menu. `pressed` makes it a checkbox item (`aria-checked`); a `disabled` item is listed but does not run. */
export interface ToolbarMenuItem {
  id?: string;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  run(): void;
}

/** What a part registers with `mount`: the part contract's `menuItems()` is all the toolbar reads. */
export interface ToolbarPart {
  menuItems?(): ToolbarMenuItem[];
  [key: string]: unknown;
}

export interface ToolbarOptions {
  items?: readonly ToolbarItemSpec[];
  /** `"comfortable"` (default) or `"touch"`; under `(pointer: coarse)` the trigger and the menu items are 44px either way. */
  density?: "comfortable" | "touch";
  /** `more`: the name of the ⋯ button (default "More"); `menu`: the name of its menu (default "More actions"). */
  labels?: { more?: string; menu?: string };
  /** Replace the ⋯ glyph: `more` (`.opf-tb-more-icon`). See `OpfIcon`. */
  icons?: OpfIcons<"more">;
  /** The set of collapsed items changed. */
  onCollapse?(detail: { collapsed: ToolbarItemId[] }): void;
  /** A part's `menuItems()` or an item's `run()` threw. */
  onError?(error: unknown): void;
}

export interface Toolbar {
  /** The row (`.opf-tb`), appended to the container. */
  readonly element: HTMLElement;
  readonly items: ToolbarItem[];
  /** One element per named item (`data-opf-toolbar-item`), in bar order, host items included. Mount a part in it, then `mount(name, part)`. */
  readonly slots: Partial<Record<ToolbarItemId, HTMLElement>>;
  slot(name: ToolbarItemId): HTMLElement | undefined;
  /** The items in the more menu now, in bar order. */
  readonly collapsed: ToolbarItemId[];
  readonly menuOpen: boolean;
  /** Change an item's priority or whether it collapses; false for an item that is not in the bar (or `more`, `spacer`, `|`). */
  setItem(name: ToolbarItemId, change: { priority?: number; collapsible?: boolean }): boolean;
  /** Register the part mounted in a slot, for its menu items. Returns the function that unregisters it. */
  mount(name: ToolbarItemId, part: ToolbarPart): () => void;
  /** What the more menu would list now, one group per collapsed part. */
  menuItems(): { id: ToolbarItemId; items: ToolbarMenuItem[] }[];
  /** Fit the row now (it also fits itself on the next frame after a resize). Returns the collapsed items. */
  update(): ToolbarItemId[];
  /** Open the more menu and focus its first (or last) item. False when there is nothing to list. */
  openMenu(which?: "first" | "last"): boolean;
  closeMenu(options?: { restoreFocus?: boolean }): void;
  setDensity(density: "comfortable" | "touch"): void;
  /** Remove the row, its observers and listeners. Safe twice. */
  destroy(): void;
}

/**
 * Build a toolbar in `container`. The menu is a `role="menu"`: Arrow keys, Home and End move, Enter and Space run an item, Escape closes it and
 * returns the focus to the ⋯ button, Tab leaves it.
 */
export declare function createToolbar(container: HTMLElement, options?: ToolbarOptions): Toolbar;
