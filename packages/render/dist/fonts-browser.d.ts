import type {
  FontFaceInput,
  FontRegistry,
  FontRegistryOptions,
} from "./fonts.js";
import type { AutoScriptSelection, BundledFontPackage, ScriptSelection } from "./fonts-node.js";
export type { AutoScriptSelection } from "./fonts-node.js";
export { detectPresentationScripts, autoScriptSelection } from "./fonts-node.js";
export interface BrowserFontInput extends Omit<FontFaceInput, "data"> {
  data?: Uint8Array;
  url?: string;
  /** Reviewed SHA-256 (hex); verified with Web Crypto before the face is used. */
  sha256?: string;
}
export interface BrowserFontRegistry extends FontRegistry {
  dispose(): void;
  /** Load script faces for ISO 15924 codes (or "all") from `scriptBaseUrl`. Resolves with the newly loaded package names. */
  loadScripts(scripts: ScriptSelection, options?: { signal?: AbortSignal }): Promise<string[]>;
  /**
   * Load the script faces the presentation's text needs, once each (FF-19). Cheap when nothing new is
   * needed. Also loads the CJK face a glyph fallback needs for drawn characters the loaded faces lack. Call it after
   * edits and render again afterwards: measurements planned earlier do not know the new faces. `signal` belongs to
   * this call only. `uncovered` lists drawn CJK characters no loaded face covers. At most one CJK face beyond the text's own
   * scripts is loaded for glyph fallback. If a package fails the others still load and the call rejects with an
   * OPFFontError whose `details` are `{ loaded: string[]; failed: {package, code, message}[] }`. A failed call (fetch, hash, FontFace load) leaves nothing loaded and can be retried; after
   * `dispose()` it rejects with `font-registry-disposed`.
   */
  ensureScripts(presentation: unknown, options?: { signal?: AbortSignal }): Promise<AutoScriptSelection & { loaded: string[]; uncovered: string[] }>;
  /** Synchronous: package names the presentation needs that are not loaded yet. Empty means `ensureScripts` fetches nothing, so a host can render immediately. */
  pendingScripts(presentation: unknown): string[];
  /** Names of the script-pack packages loaded so far. */
  readonly loadedScriptPackages: string[];
}
export declare function loadBrowserFontRegistry(
  entries: BrowserFontInput[],
  options?: FontRegistryOptions & {
    document?: Document;
    fetch?: typeof fetch;
    signal?: AbortSignal;
    crypto?: { subtle: SubtleCrypto };
    /** Script faces to load once the registry exists: "auto" (with `presentation`), "all" or ISO 15924 codes. Needs `scriptBaseUrl`. */
    scripts?: ScriptSelection | "auto";
    /** The presentation whose text decides `scripts: "auto"`. */
    presentation?: unknown;
    /** Where the host serves the installed `@expo-google-fonts/*` packages; script faces are fetched from here, hash-verified. */
    scriptBaseUrl?: string;
  },
): Promise<BrowserFontRegistry>;
export declare function scriptFontPackages(scripts: ScriptSelection): BundledFontPackage[];
/** Hash-pinned browser entries for the script pack, served by the host from `baseUrl`. */
export declare function scriptFontEntries(
  scripts: ScriptSelection,
  options: { baseUrl: string },
): (BrowserFontInput & { url: string; family: string; weight: number; italic: boolean; sha256: string; scripts: string[]; package: string; license: string })[];
