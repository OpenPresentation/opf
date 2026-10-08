import type { Catalog, CopiedRecordRename } from "@openpresentation/opf";
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
    /** Host catalogs: a presentation or slide is embedded (core `embed`) so it renders the same where none is registered. */
    catalogs?: readonly Catalog[];
  },
): string;
export declare function prepareOpfImport(
  current: any,
  transfer: OpfTransfer,
  options?: {
    mode?: "insert" | "replace" | "selection";
    slideIndex?: number;
    path?: string;
    /** Host catalogs, for resolving and copying the inserted slides' records (core `copySlides`). */
    catalogs?: readonly Catalog[];
  },
): {
  presentation: any;
  slideIndex: number;
  /** Records that did not keep their reference while inserting: tell the user. */
  renamed: CopiedRecordRename[];
  addedGroups: { name: string; source?: string }[];
};
