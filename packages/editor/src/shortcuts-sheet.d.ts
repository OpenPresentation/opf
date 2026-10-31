/** One row of the sheet. Keys are CodeMirror-style names ("Mod-z", "Shift-Mod-z", "Ctrl-y", "F1", "?"); `Mod` is Cmd on a Mac and Ctrl elsewhere. */
export interface HelpShortcut {
  label: string;
  /** The alternatives, for example `["Mod-z"]` or `["Mod-y", "Shift-Mod-z"]`. A chord of strokes is space separated: `"Mod-k Mod-s"`. */
  keys: string[];
  /** The heading the row is listed under. Default: "General". */
  group?: string;
  /** Optional stable id (a `data-id` on the row). */
  id?: string;
}
export interface HelpButtonLabels {
  /** The accessible name of the button. Default: "Keyboard shortcuts". */
  button?: string;
  /** The tooltip (" (?)" is added when the key is bound). Default: "Keyboard shortcuts". */
  title?: string;
  /** The dialog heading. Default: "Keyboard shortcuts". */
  heading?: string;
  /** Default: "Close". */
  close?: string;
  /** The accessible name of the filter field. Default: "Filter the keyboard shortcuts". */
  search?: string;
  /** Default: "Filter shortcuts". */
  searchPlaceholder?: string;
  /** The group of a shortcut that names none. Default: "General". */
  defaultGroup?: string;
  /** Default: "No shortcut matches." */
  none?: string;
  /** Default: "No keyboard shortcuts are available." */
  empty?: string;
  /** The sentence under the heading; `platform` is "macOS" or "Windows or Linux". */
  description?: (platform: string) => string;
  /** The live status line, for example "3 of 12 shortcuts match". */
  status?: (shown: number, total: number) => string;
}
export interface HelpButtonOptions {
  /** The element the dialog is added to. Default: the closest `.opf-ui` ancestor of the container, else `document.body`. */
  overlay?: HTMLElement;
  /** The shortcuts to list. Called on every open, so the list is current. */
  getShortcuts?: () => HelpShortcut[];
  /** `"comfortable"` (32px, default) or `"touch"` (40px; 44px under a coarse pointer either way). */
  density?: "comfortable" | "touch";
  labels?: HelpButtonLabels;
  /** Bind "?" and "Shift-?" on the document to open the sheet when focus is not in a field, an editor, a menu or a dialog. Default true. */
  bindKey?: boolean;
}
export interface HelpButtonMenuItem {
  id: "help";
  label: string;
  disabled: boolean;
  run(): boolean;
}
export interface HelpButton {
  /** The toolbar button (`aria-haspopup="dialog"`, `aria-expanded` follows the sheet). */
  readonly element: HTMLButtonElement;
  /** Open the shortcuts sheet. Returns false when the button is disabled or destroyed. Focus goes to the filter field. */
  open(): boolean;
  /** Close the sheet; focus returns to where it was. Escape does the same. */
  close(): void;
  setDensity(density: "comfortable" | "touch"): void;
  /** Disables the button and the "?" key, and closes an open sheet. */
  setDisabled(disabled: boolean): void;
  /** `[{ id: "help", label: "Keyboard shortcuts", disabled, run }]` for the toolbar's overflow menu. */
  menuItems(): HelpButtonMenuItem[];
  /** Closes the sheet, removes the button and the key listener. Safe twice. */
  destroy(): void;
}
/** Strokes as people read them, one string per alternative: `["Mod-z"]` is `["⌘Z"]` on a Mac and `["Ctrl+Z"]` elsewhere. `win` selects the platform. */
export declare function formatShortcutKeys(keys: string[] | string, win?: Window | null): string[];
/** The sheet's rows (`{ id, title, group, keys }`, keys formatted for `win`). */
export declare function shortcutRows(shortcuts: HelpShortcut[] | undefined, win?: Window | null, defaultGroup?: string): { id: string; title: string; group: string; keys: string[] }[];
/** The rows that match every word of `query` (in the label, group or keys). An empty query keeps all rows. */
export declare function filterShortcutRows<T extends { title: string; group: string; id: string; keys: string[] }>(rows: T[], query: string): T[];
/** Whether a "?" key press opens the sheet: a bare "?" (Shift allowed) that is not typed into a field, an editor, a menu or a dialog, and not already handled. */
export declare function opensOnKey(event: KeyboardEvent): boolean;
/** The help item: a button and the "?" key that open a modal sheet of the keyboard shortcuts, grouped and filterable by typing. */
export declare function createHelpButton(container: HTMLElement, options?: HelpButtonOptions): HelpButton;
