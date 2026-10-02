import type { BrowserFontRegistry } from "./fonts-browser.js";

/** One face of the self-hosted font root: where it sits under the root, and its pinned hash. */
export interface PreviewBaseFace { family: string; weight: number; italic: boolean; file: string; sha256: string; license: string }

/** Where a manifest package sits under a font root: `kind` is `base`, `lazy` or `scripts`, `target` its root-relative directory. */
export interface PreviewFontPlacement {
  pkg: { name: string; version: string; pack: string; vendored?: string; license: string; faces: { file: string; family: string; weight: number; italic: boolean; sha256: string }[] };
  kind: "base" | "lazy" | "scripts";
  directory: string;
  target: string;
}

export declare function previewFontDirectory(pkg: { name: string; vendored?: string }): string;
export declare function previewFontLayout(manifest?: unknown, lazyFiles?: readonly string[]): PreviewFontPlacement[];
export declare function previewBaseFaces(manifest?: unknown): PreviewBaseFace[];

/**
 * A browser font registry over a self-hosted font root: `<root>/base/<package>/<file>`, `<root>/lazy/fonts/<family>/<file>` and
 * `<root>/scripts/<package>/<file>`. It starts with Roboto Regular and loads other faces on demand, hash-verified, only when a
 * deck draws them. Registries are shared per root on a page.
 */
export declare function loadPreviewFonts(root: string, options?: { document?: Document; fetch?: typeof fetch; signal?: AbortSignal; registryOptions?: Record<string, unknown> }): Promise<BrowserFontRegistry>;
