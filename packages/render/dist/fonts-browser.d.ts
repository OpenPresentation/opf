import type {
  FontFaceInput,
  FontRegistry,
  FontRegistryOptions,
} from "./fonts.js";
export interface BrowserFontInput extends Omit<FontFaceInput, "data"> {
  data?: Uint8Array;
  url?: string;
}
export declare function loadBrowserFontRegistry(
  entries: BrowserFontInput[],
  options?: FontRegistryOptions & {
    document?: Document;
    fetch?: typeof fetch;
    signal?: AbortSignal;
  },
): Promise<FontRegistry & { dispose(): void }>;
