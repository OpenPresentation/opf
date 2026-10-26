import type { EditorSession, CatalogOption } from "./index.js";

export interface OPFTextInputProps {
  editor: EditorSession;
  path: string;
  label?: string;
  multiline?: boolean;
  inputProps?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OPFCatalogSelectProps {
  editor: EditorSession;
  path: string;
  catalogKind: string;
  label?: string;
  onError?: (error: Error) => void;
  catalogOptions?: CatalogOption[];
  selectProps?: Record<string, unknown>;
  [key: string]: unknown;
}

export declare function createOPFReactComponents(React: {
  createElement: (...args: unknown[]) => unknown;
  useSyncExternalStore?: (...args: unknown[]) => unknown;
  useState?: (...args: unknown[]) => unknown;
  useEffect?: (...args: unknown[]) => unknown;
}): {
  useEditorSnapshot(editor: EditorSession): unknown;
  OPFTextInput(props: OPFTextInputProps): unknown;
  OPFCatalogSelect(props: OPFCatalogSelectProps): unknown;
};

// ---- CE-06: the embeddable editor ---------------------------------------------------------------------------------------------------------
import type { CSSProperties, ForwardRefExoticComponent, MutableRefObject, RefAttributes } from "react";
import type { OpfEditor as OpfEditorHandle, OpfEditorOptions, OpfEditorSlots } from "./workspace.js";

/** A slot is an element, or a React ref to one (resolved when the editor mounts). */
export type OpfEditorReactSlots = { [Name in keyof OpfEditorSlots]?: OpfEditorSlots[Name] | { current: OpfEditorSlots[Name] | null } };

export interface OpfEditorProps extends Omit<OpfEditorOptions, "slots"> {
  slots?: OpfEditorReactSlots;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Called with the editor right after it is created, and with `null` when it is destroyed. For the hooks below. */
  onEditor?: (editor: OpfEditorHandle | null) => void;
}

/**
 * The editor in a `<div>`. Every other prop is an option of `createOpfEditor`, read once when it mounts (give the component another `key` to mount a
 * new one); `theme`, `readOnly`, `view`, `density` and `exportMode` follow later renders, and the callbacks are always the latest. `ref` is the
 * editor handle once mounted. Correct under StrictMode; renders an empty container on the server.
 */
export declare const OpfEditor: ForwardRefExoticComponent<OpfEditorProps & RefAttributes<OpfEditorHandle | null>>;

/** The editor as a hook: `const { ref, editor } = useOpfEditor(options)`, then `<div ref={ref} />`. `editor` is `null` on the server and until mounted. */
export declare function useOpfEditor(options?: OpfEditorProps): { ref: MutableRefObject<HTMLDivElement | null>; editor: OpfEditorHandle | null };

/** The document of an editor, replaced on every change; `undefined` while `editor` is `null`. Frozen: do not modify it. */
export declare function useOpfDocument(editor: OpfEditorHandle | null | undefined): unknown;

/** The content last selected on the canvas, or `null`. */
export declare function useOpfSelection(editor: OpfEditorHandle | null | undefined): { path: string; value: unknown } | null;

export type { OpfEditorHandle };
