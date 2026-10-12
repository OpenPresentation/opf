import type { EditorSession } from "./index.js";

export declare function openCustomLayoutEditor(editor: EditorSession, options?: {
  document?: Document;
  onSave?: (layout: { id: string; record: Record<string, unknown> }) => void;
  onClose?: () => void;
}): { dialog: HTMLDialogElement; close(): void };
