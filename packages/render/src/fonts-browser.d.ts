import type {
  FontFaceInput,
  FontRegistry,
  FontRegistryOptions,
} from "./fonts.js";
import type { AutoScriptSelection, BundledFontPackage, LazyFont, ScriptSelection } from "./fonts-node.js";
import type { RenderSvgOptions } from "./svg.js";
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
   * Load the vendored faces (for example Intos Display 700 and Intos 400 for a plain deck in the default Aptos scheme) the
   * presentation draws, resolved as the registry resolves them under its `substitutionPolicy` (nothing is downloaded for a
   * family the policy would not resolve, nor for a weight or style nothing draws), once each, from `lazyFontsBaseUrl`.
   * Fetches and verifies every file, then adds the faces to the document and the registry together; on failure nothing
   * changes and the call can be retried. Call it before measuring a document, and again after edits: an edit that adds a
   * bold or italic run loads just that face. Besides `signal`, the call takes the `renderSvg` options the document resolves
   * with (`catalogs`, ...) over the loader's `renderOptions`. A document that does not resolve rejects with the error
   * `renderSvg` throws for it. After `dispose()` it rejects with `font-registry-disposed`.
   */
  ensureLazyFonts(presentation: unknown, options?: { signal?: AbortSignal } & Partial<RenderSvgOptions>): Promise<LazyFont[]>;
  /**
   * Synchronous: the vendored faces the presentation draws under the registry's policy that are not loaded yet. Empty means
   * `ensureLazyFonts` fetches nothing. `renderOptions` are the `renderSvg` options the document resolves with (`catalogs`, ...)
   * over the loader's `renderOptions`. Throws what `renderSvg` throws for a document that does not resolve.
   */
  pendingLazyFonts(presentation: unknown, renderOptions?: Partial<RenderSvgOptions>): LazyFont[];

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
  ensureScripts(presentation: unknown, options?: { signal?: AbortSignal } & Partial<RenderSvgOptions>): Promise<AutoScriptSelection & { loaded: string[]; uncovered: string[] }>;
  /** Synchronous: package names the presentation needs that are not loaded yet. Empty means `ensureScripts` fetches nothing, so a host can render immediately. Text decides, so a document is analyzed without resolving its layouts; `renderOptions.catalogs` matter for font schemes only the host's catalogs have (FF-41). */
  pendingScripts(presentation: unknown, renderOptions?: Partial<RenderSvgOptions>): string[];
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
    /**
     * FF-41: the `renderSvg` options the documents resolve with (`catalogs` above all), the default for `pendingLazyFonts`,
     * `ensureLazyFonts`, `pendingScripts` and `ensureScripts`. A layout or font scheme id that only the host's catalogs have
     * resolves the same way here as it does when the host renders. A call's own options win.
     */
    renderOptions?: Partial<RenderSvgOptions>;
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
/**
 * The font families a presentation's slides resolve (heading, body and code roles of every slide). `options` are the
 * `renderSvg` options the document resolves with (`catalogs`, ...). A document that does not resolve throws what `renderSvg`
 * throws for it (FF-41: it no longer returns an empty set). This is the role families, not what is drawn: see `presentationFaces`.
 */
export declare function presentationFamilies(presentation: unknown, options?: Partial<RenderSvgOptions>): Set<string>;
/** A face request or a drawn face: a family, a weight and a style. */
export interface FaceRequest { family: string; weight: number; italic: boolean }
/**
 * The faces a preview of the presentation draws (FF-41), sorted by family, style and weight: the renderer's own layout and
 * painting with a recording measurement, so heading and body roles, bold and italic runs, tables, furniture, chart labels and
 * the code role (only where code is drawn), per-slide overrides and script slots are all followed. Without `registry` the
 * faces are the styles as the document names them. With `registry` (`{faces, policy, aliases, fallbackFamily}`: the faces a
 * registry holds or could hold and its substitution options) every style resolves as that registry resolves it, in the two
 * steps drawing takes (role family, then weight within it), and the result is the faces the registry paints.
 * `options` are the `renderSvg` options the document resolves with; a document that does not resolve throws what `renderSvg`
 * throws for it.
 */
export declare function presentationFaces(presentation: unknown, options?: Partial<RenderSvgOptions>, registry?: { faces: Iterable<FaceRequest>; policy?: "none" | "metric" | "visual"; aliases?: ReadonlyMap<string, string>; fallbackFamily?: string }): FaceRequest[];
/**
 * The vendored faces (of `lazy`) a presentation draws that the registry does not hold. `held` is `registry.describeFaces()`,
 * `loaded` the lazy files already loaded; `policy`, `aliases` and `fallbackFamily` are the registry's. Face level: only the
 * drawn faces, so an edit adding a bold run adds one face.
 */
export declare function lazyFacesNeeded(presentation: unknown, renderOptions: Partial<RenderSvgOptions> | undefined, context: { lazy: readonly LazyFont[]; held: Iterable<FaceRequest>; loaded?: ReadonlySet<string>; policy?: "none" | "metric" | "visual"; aliases?: ReadonlyMap<string, string>; fallbackFamily?: string }): LazyFont[];
/**
 * The vendored faces a list of requests needs that the registry does not hold, following the registry's own order and
 * `policy` (default "visual"): the family itself, an alias target, the declared replacement, then its alternates.
 * Entries are face requests (`presentationFaces`), resolved as the registry resolves them with every vendored face loaded
 * over `held` (`registry.describeFaces()`), so only the faces asked for are returned and a partially loaded family still
 * loads its missing faces; or family names, which mean every face of the family. Without `held` a face request falls back to
 * family level with `hasFamily`.
 */
export declare function lazyFontsFor(entries: Iterable<string | { family: string; weight?: number; italic?: boolean }>, context: { lazy: readonly LazyFont[]; held?: Iterable<FaceRequest>; hasFamily?: (family: string) => boolean; loaded?: ReadonlySet<string>; policy?: "none" | "metric" | "visual"; aliases?: ReadonlyMap<string, string>; fallbackFamily?: string }): LazyFont[];
