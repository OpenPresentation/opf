import type { EditorSession, JsonPatchOperation } from "./index.js";

/**
 * The JSON Patch that renames a deck. `current` is the deck's `name` now (`undefined` when it has none); `next` is the text typed, which is
 * trimmed. Returns `null` when nothing changes (the trimmed text equals `current`, or it is empty and there is no name to remove), a
 * `remove` of `/name` for an empty text, and an `add` of `/name` (which also replaces) otherwise.
 */
export declare function deckNamePatch(current: string | undefined, next: string): JsonPatchOperation[] | null;

export interface DeckTitleLabels {
  /** The accessible name of the field. Default: "Presentation name". */
  label?: string;
  /** The placeholder shown while the deck has no name. Default: "Untitled presentation". */
  placeholder?: string;
}
export interface DeckTitleRename {
  /** The new trimmed name; `""` when the name was removed. */
  name: string;
  /** The name before the rename; `undefined` when the deck had none. */
  previous: string | undefined;
}
export interface DeckTitleOptions {
  /** The editor session: the field shows `snapshot().presentation.name`, follows its changes and renames through `applyPatch`. */
  editor: EditorSession;
  /** Default: "Untitled presentation". Overrides `labels.placeholder`. */
  placeholder?: string;
  /** The accessible name (`aria-label`). Default: "Presentation name". Overrides `labels.label`. */
  label?: string;
  /** The name is shown as text and cannot be edited. Default false. */
  readOnly?: boolean;
  /** `"comfortable"` (default) or `"touch"` (40px field). */
  density?: "comfortable" | "touch";
  labels?: DeckTitleLabels;
  /**
   * Called before a rename is applied. Return `false` to stop it (the workspace uses this to commit an open canvas edit first and stops
   * when that fails). The typed text stays in the field.
   */
  beforeCommit?: () => boolean | void;
  /** Called after a successful rename (not for an unchanged name). */
  onRename?: (rename: DeckTitleRename) => void;
  /** Called when the session refuses the patch; the field shows the current name again. */
  onError?: (error: unknown) => void;
}
export interface DeckTitle {
  /** The part's root element (holds the input). */
  readonly element: HTMLElement;
  /** The text field. */
  readonly input: HTMLInputElement;
  setDensity(density: "comfortable" | "touch"): void;
  /** Disabled shows the name as text, like read-only; any typed text is dropped. */
  setDisabled(disabled: boolean): void;
  setReadOnly(readOnly: boolean): void;
  /** Read the name again (not while the person is typing). The field also follows the editor on its own. */
  refresh(): void;
  focus(): void;
  /** Remove the element and the editor subscription. Safe twice. */
  destroy(): void;
}
export declare function createDeckTitle(container: HTMLElement, options: DeckTitleOptions): DeckTitle;
