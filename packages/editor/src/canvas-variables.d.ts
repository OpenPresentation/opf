import type { EditorSession } from "./index.js";
import type { CanvasEditor } from "./canvas.js";

/**
 * For a host that mounts the canvas itself (`createCanvasEditor`) and draws `{{variables}}` resolved (`renderOptions.variables: {}`): a press on text
 * that holds a variable token opens the field's properties form (which edits the authored value) instead of an inline edit of the resolved glyphs,
 * and a press on text with no field of its own calls `focusSource`. `resolved()` says whether the canvas draws variables resolved now (a template deck
 * draws them as authored). Returns a function that removes the listeners. `createOpfEditor({ variables: "resolved" })` (`@openpresentation/opf-editor/workspace`) does this for you.
 */
export declare function installCanvasVariableEditing(
  host: HTMLElement,
  editor: EditorSession,
  canvas: CanvasEditor,
  options?: { resolved?: () => boolean; focusSource?: () => void },
): () => void;
