import type { OpfIcons } from "./icons.js";
export interface ExpandLabels {
  /** The accessible name of the button while the editor is not expanded. Default: "Expand editor". */
  expand?: string;
  /** The accessible name of the button while the editor is expanded. Default: "Exit expanded editor". */
  collapse?: string;
  /** The key named in the tooltip of the expanded button, "Exit expanded editor (Esc)". Default: "Esc". */
  escape?: string;
  /** The status line (`onStatus`) when the editor expands. Default: "Editor expanded. Press Escape to exit.". */
  expanded?: string;
  /** The status line (`onStatus`) when it returns. Default: "Editor restored.". */
  collapsed?: string;
}

export interface ExpandControllerOptions {
  /** Called after the editor expands or returns, however that happened (the button, `expand()`, Escape, the browser leaving full screen, another editor expanding). Not called by `destroy()`. */
  onChange?: (change: { expanded: boolean }) => void;
  /**
   * Also ask the browser for full screen on the target (best effort). It is refused without a user gesture, in an iframe without
   * `allow="fullscreen"` and on iPhone Safari; the fixed overlay is then the expanded editor, silently. When the browser leaves full screen by
   * itself (Esc, the host), the editor collapses. Default false.
   */
  fullscreen?: boolean;
  labels?: ExpandLabels;
  /**
   * While expanded, make everything on the page outside the target `inert` (default true), so Tab and screen readers stay inside the editor. It is
   * applied to the siblings of the target and of each ancestor up to `body`; elements that are already `inert`, `script`, `style`, `template` and a
   * mounted presenter (`.opf-presenter`) are skipped, and exactly the elements marked are restored on collapse, destroy and hand-over to another editor.
   * It is a snapshot: an element added to the page while expanded (a menu appended to `body`) is not inert.
   */
  inertOutside?: boolean;
  /**
   * Elements that must stay interactive while the rest of the page is inert: for example a toolbar the host mounted outside the target
   * (`slots`). An array, or a function returning one (read each time the editor expands). A container of a kept element is not made inert; its
   * other children are.
   */
  keep?: Element[] | (() => Iterable<Element> | null | undefined);
  /** Screen-reader status lines for the two transitions (`labels.expanded`, `labels.collapsed`). */
  onStatus?: (message: string) => void;
}

export interface ExpandController {
  /** True while the editor is expanded. */
  readonly expanded: boolean;
  /** Expand (default) or, with `false`, collapse. Returns the resulting state: true when the editor is now expanded. */
  expand(on?: boolean): boolean;
  /** Return the editor to its place. Returns the resulting state (false). */
  collapse(): boolean;
  /** Returns the resulting state. */
  toggle(): boolean;
  /** Collapses if expanded (restoring the attribute, scroll, focus and full screen) without calling `onChange`, and removes every listener. Safe twice. */
  destroy(): void;
}

/**
 * Make `target` (the editor's host element) fill the viewport for editing. Not the presenter: this edits, it does not present.
 *
 * Expanding sets `data-opf-expanded` on `target` (`src/styles/expand.css` turns it into a fixed overlay; `--opf-ui-z-overlay` sets its z-index, default
 * 1000; the older `--opf-expand-z` still wins when set), locks page scroll on the document element (the previous inline `overflow` is restored exactly), makes the rest of the page `inert` (`inertOutside`, `keep`),
 * moves the focus into `target` and listens for Escape. The element is never moved in the DOM, so the editor keeps its state. Collapsing returns the focus to the control that expanded.
 *
 * Escape collapses unless the event was already handled (`defaultPrevented`), the focus is in a text input, textarea, select, contenteditable,
 * CodeMirror (`.cm-editor`), an open menu, listbox, combobox or dialog, or the presenter is running (`.opf-presenter:not([hidden])`).
 *
 * Works in iframes (`target.ownerDocument`). Only one controller per document is expanded at a time: expanding another collapses the first.
 */
export declare function createExpandController(target: HTMLElement, options?: ExpandControllerOptions): ExpandController;

export interface ExpandButtonOptions {
  /** The controller the button drives and follows. Required. */
  controller: ExpandController;
  /** `"comfortable"` (32px, default) or `"touch"` (40px). A coarse pointer makes the button 44px either way. */
  density?: "comfortable" | "touch";
  /** Overrides the controller's labels (`expand`, `collapse`, `escape`). */
  labels?: ExpandLabels;
  /** Replace the button's icons: `expand` (shown while the editor is not expanded) and `collapse` (while it is). See `OpfIcon`. */
  icons?: OpfIcons<"expand" | "collapse">;
}

export interface ExpandMenuItem {
  id: "expand";
  label: string;
  pressed: boolean;
  disabled?: boolean;
  run(): void;
}

export interface ExpandButton {
  readonly element: HTMLButtonElement;
  setDensity(density: "comfortable" | "touch"): void;
  /** A disabled button stays focusable (`aria-disabled`) and cannot expand the editor; it can always exit an expanded one. */
  setDisabled(disabled: boolean): void;
  /** The toolbar overflow menu's entry: one toggle item. */
  menuItems(): ExpandMenuItem[];
  destroy(): void;
}

/**
 * The expand button: an icon-only toggle (Lucide Maximize2 / Minimize2) with `aria-pressed`, the name "Expand editor" or "Exit expanded editor",
 * and a tooltip that names Escape while expanded. It follows the controller. CSS: `src/styles/expand.css`, classes `opf-expand-*`.
 */
export declare function createExpandButton(container: HTMLElement, options: ExpandButtonOptions): ExpandButton;
