/** One host button in the toolbar. */
export interface ToolbarAction {
  /** Unique within the list. Becomes `data-action` on the button and `actions:<id>` in the overflow menu. */
  id: string;
  /** The visible text of the button (and its accessible name). */
  label: string;
  /** An SVG element (copied into the toolbar's document) or SVG path data for a 24x24 stroked icon (`"M5 12h14"`). Optional. */
  icon?: SVGElement | string;
  /** The tooltip. */
  title?: string;
  /** What the button does. Called on a click, and from the overflow menu, only while the action is enabled. The button refreshes afterwards. */
  run(): void | Promise<void>;
  /** Whether the button can be used. Default: always. Read again by `refresh()`. A throw counts as false. */
  enabled?(): boolean;
  /** Makes it a toggle: `aria-pressed` follows this. Read again by `refresh()`. Without it the button is not a toggle. */
  pressed?(): boolean;
  /** Style the button with the accent color. */
  primary?: boolean;
}
export interface ToolbarActionsLabels {
  /** The accessible name of the group of buttons. Default: "Actions". */
  group?: string;
}
export interface ToolbarActionsOptions {
  actions?: ToolbarAction[];
  /** `"comfortable"` (32px, default) or `"touch"` (40px; 44px under a coarse pointer either way). */
  density?: "comfortable" | "touch";
  labels?: ToolbarActionsLabels;
}
export interface ToolbarActionsMenuItem {
  /** `actions:<action id>`. */
  id: string;
  label: string;
  disabled: boolean;
  /** Present for toggles. */
  pressed?: boolean;
  run(): void | Promise<void> | undefined;
}
export interface ToolbarActions {
  /** The group element (`role="group"`); hidden while there are no actions. */
  readonly element: HTMLElement;
  /** Replace the buttons. Throws a TypeError for an action without an id, a label or `run`, or for a repeated id. A focused button keeps the focus. */
  setActions(actions: ToolbarAction[]): void;
  /** Read every `enabled()` and `pressed()` again. The state is not watched; call this when the host's state changes. */
  refresh(): void;
  setDensity(density: "comfortable" | "touch"): void;
  /** Disables every button (the editor does this while the source is invalid or read-only). */
  setDisabled(disabled: boolean): void;
  /** One entry per action, for the toolbar's overflow menu. */
  menuItems(): ToolbarActionsMenuItem[];
  /** Removes the element. Safe twice. */
  destroy(): void;
}
/** The host's own buttons in the toolbar: labelled, optionally iconed, with enabled and pressed state read on `refresh()`. */
export declare function createToolbarActions(container: HTMLElement, options?: ToolbarActionsOptions): ToolbarActions;
