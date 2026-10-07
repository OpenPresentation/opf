export declare const MAX_OPF_BYTES: number;
export interface OpfTransfer {
  kind: "presentation" | "slides" | "selection";
  value: unknown;
  presentation?: any;
}
export declare function assertOpf(presentation: any): any;
export declare function unwrapOpf(value: any): any;
export declare function parseOpfTransfer(text: string): OpfTransfer;
export declare function serializeOpfTransfer(
  presentation: any,
  options?: {
    scope?: "presentation" | "slide" | "selection";
    slideIndex?: number;
    path?: string;
    format?: "pretty" | "compact" | "markdown";
  },
): string;
export declare function prepareOpfImport(
  current: any,
  transfer: OpfTransfer,
  options?: {
    mode?: "insert" | "replace" | "selection";
    slideIndex?: number;
    path?: string;
  },
): { presentation: any; slideIndex: number };
