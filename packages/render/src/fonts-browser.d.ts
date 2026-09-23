import type {
  FontFaceInput,
  FontRegistry,
  FontRegistryOptions,
} from "./fonts.js";
import type { BundledFontPackage, ScriptSelection } from "./fonts-node.js";
export interface BrowserFontInput extends Omit<FontFaceInput, "data"> {
  data?: Uint8Array;
  url?: string;
  /** Reviewed SHA-256 (hex); verified with Web Crypto before the face is used. */
  sha256?: string;
}
export declare function loadBrowserFontRegistry(
  entries: BrowserFontInput[],
  options?: FontRegistryOptions & {
    document?: Document;
    fetch?: typeof fetch;
    signal?: AbortSignal;
    crypto?: { subtle: SubtleCrypto };
  },
): Promise<FontRegistry & { dispose(): void }>;
export declare function scriptFontPackages(scripts: ScriptSelection): BundledFontPackage[];
/** Hash-pinned browser entries for the script pack, served by the host from `baseUrl`. */
export declare function scriptFontEntries(
  scripts: ScriptSelection,
  options: { baseUrl: string },
): (BrowserFontInput & { url: string; family: string; weight: number; italic: boolean; sha256: string; scripts: string[]; package: string; license: string })[];
