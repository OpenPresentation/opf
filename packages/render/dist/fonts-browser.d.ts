import type {
  FontFaceInput,
  FontRegistry,
  FontRegistryOptions,
} from "./fonts.js";
import type { AutoScriptSelection, BundledFontPackage, LazyFont, ScriptSelection } from "./fonts-node.js";
export type { LazyFont } from "./fonts-node.js";
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
  /** Every vendored face a host can load on demand: family, style, package-relative file and pinned sha256. */
  readonly lazyFonts: readonly LazyFont[];
  /**
   * Load the vendored faces (for example Intos for the default Aptos scheme) the presentation's font families resolve to
   * under the registry's `substitutionPolicy` (nothing is downloaded for a family the policy would not resolve), once
   * each, from `lazyFontsBaseUrl`. Fetches and verifies every file, then adds the faces to the document and the registry
   * together; on failure nothing changes and the call can be retried. Call it before measuring a document. After
   * `dispose()` it rejects with `font-registry-disposed`.
   */
  ensureLazyFonts(presentation: unknown, options?: { signal?: AbortSignal }): Promise<LazyFont[]>;
  /** Synchronous: the vendored faces the presentation needs under the registry's policy that are not loaded yet. Empty means `ensureLazyFonts` fetches nothing. */
  pendingLazyFonts(presentation: unknown): LazyFont[];

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
    /** Where the host serves this package's `fonts` directory, so vendored faces (Intos, the open families) load on demand from `<base>/<package-relative file>` (fonts/intos/..., fonts/<family>/...). */
    lazyFontsBaseUrl?: string;
  },
): Promise<BrowserFontRegistry>;
export declare function scriptFontPackages(scripts: ScriptSelection): BundledFontPackage[];
/** Hash-pinned browser entries for the script pack, served by the host from `baseUrl`. */
export declare function scriptFontEntries(
  scripts: ScriptSelection,
  options: { baseUrl: string },
): (BrowserFontInput & { url: string; family: string; weight: number; italic: boolean; sha256: string; scripts: string[]; package: string; license: string })[];
/** Every vendored face of this package: family, style, package-relative file, sha256. */
export declare function lazyFontList(): readonly LazyFont[];
/** Hash-pinned browser entries for the vendored faces, served by the host from `baseUrl` at their package-relative paths. */
export declare function lazyFontEntries(options: { baseUrl: string }, list?: readonly LazyFont[]): (BrowserFontInput & { url: string; family: string; weight: number; italic: boolean; sha256: string; package: string })[];
/** The font families a presentation's slides resolve (heading, body and code roles); empty for a document that does not resolve. */
export declare function presentationFamilies(presentation: unknown): Set<string>;
/**
 * The vendored faces a set of resolved families needs that the registry does not hold, following the registry's own order and
 * `policy` (default "visual"): the family itself, an alias target, the declared replacement, then its alternates.
 */
export declare function lazyFontsFor(families: Iterable<string>, context: { lazy: readonly LazyFont[]; hasFamily(family: string): boolean; loaded?: ReadonlySet<string>; policy?: "none" | "metric" | "visual"; aliases?: ReadonlyMap<string, string> }): LazyFont[];
