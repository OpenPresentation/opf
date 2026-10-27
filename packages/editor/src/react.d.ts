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
import type { CSSProperties, ForwardRefExoticComponent, MutableRefObject, ReactNode, RefAttributes } from "react";
import type { SourceCursor } from "./source-pane.js";
import type { OpfEditor as OpfEditorHandle, OpfEditorOptions, OpfEditorSlots, OpfCommandInfo, OpfStudioHostPanel, OpfStudioSelectionItem } from "./workspace.js";

/** A slot is an element, or a React ref to one (resolved when the editor mounts). */
export type OpfEditorReactSlots = { [Name in keyof OpfEditorSlots]?: OpfEditorSlots[Name] | { current: OpfEditorSlots[Name] | null } };

export interface OpfEditorProps extends Omit<OpfEditorOptions, "slots"> {
  slots?: OpfEditorReactSlots;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Called with the editor right after it is created, and with `null` when it is destroyed. For the hooks below. */
  onEditor?: (editor: OpfEditorHandle | null) => void;
  /**
   * CE-20, the Studio: the host's panels (`layout: "studio"`). Each `render()` is mounted by React through a portal into the panel the Studio
   * makes for it (a tab of the right panel, or a section of the left panel with `side: "left"`), so it shares the host's context and state.
   */
  hostPanels?: (Omit<OpfStudioHostPanel, "mount"> & { render(): ReactNode })[];
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

/** The content last selected on the canvas, or `null`; in the Studio, the selection list `[{ key, path, idPath, kind }]`. */
export declare function useOpfSelection(editor: OpfEditorHandle | null | undefined): { path: string; value: unknown } | OpfStudioSelectionItem[] | null;

/** CE-20: the Studio's commands for a host palette (pptx.dev's Cmd+K): the list with each command's state, and `run(id)`. */
export declare function useOpfCommands(editor: OpfEditorHandle | null | undefined): { commands: OpfCommandInfo[]; run(id: string): boolean };

/** The path under the caret of the source pane, the latest `cursor` event (`pointer`, `idPath`, `from`, `to`, ...), or `null` before the first. */
export declare function useOpfCursor(editor: OpfEditorHandle | null | undefined): SourceCursor | null;

export type { OpfEditorHandle };
