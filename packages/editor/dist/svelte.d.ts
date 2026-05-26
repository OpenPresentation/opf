import type { CatalogOptionsInput, EditorSession, SvgTraceBindingOptions } from "./index.js";

export interface OPFTextInputActionParams {
  editor: EditorSession;
  path: string;
  label?: string;
}

export interface OPFCatalogSelectActionParams extends CatalogOptionsInput {
  editor: EditorSession;
  path: string;
  catalogKind: string;
  label?: string;
}

export interface OPFTraceActionParams extends SvgTraceBindingOptions {
  editor: EditorSession;
}

export interface SvelteAction {
  update(params: unknown): void;
  destroy(): void;
}

export declare function opfTextInput(node: any, params: OPFTextInputActionParams): SvelteAction;

export declare function opfCatalogSelect(node: any, params: OPFCatalogSelectActionParams): SvelteAction;

export declare function opfTrace(node: any, params: OPFTraceActionParams): SvelteAction;
