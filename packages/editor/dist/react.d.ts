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
