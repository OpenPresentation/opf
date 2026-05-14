// Static HTML previews for slide layouts.
//
// Source-of-truth: ../../../spec/previews/layouts/<slug>.html. The build step
// (`pnpm build`) bundles those files into this module so consumers can import
// the previews without doing any filesystem work at runtime.

import { layoutPreviewsRaw, layoutPreviewIndexRaw } from "./generated/previews.js";

export interface LayoutPreviewRecord {
  /** Layout slug — matches `spec/catalogs/layouts/<id>.json` when available, and otherwise the pptx.gallery extended catalog. */
  id: string;
  /** Filename relative to `spec/previews/layouts/`. */
  file: string;
  /** UTF-8 byte length of the HTML. */
  bytes: number;
}

export interface LayoutPreviewIndex {
  $schema: string;
  version: string;
  description: string;
  records: readonly LayoutPreviewRecord[];
}

/**
 * Static HTML for a given layout preview. Each snippet is a self-contained
 * Tailwind-styled fragment intended to fill a 16:9 thumbnail container.
 *
 * The CSS variables used by the snippets are:
 *   --background, --foreground, --card, --muted, --muted-foreground,
 *   --accent, --border
 *
 * Consumers should apply these on a parent element (or import the
 * pptx.gallery design tokens).
 */
export const layoutPreviews: Readonly<Record<string, string>> =
  layoutPreviewsRaw;

/** Catalog index — the list of available preview slugs and metadata. */
export const layoutPreviewIndex: LayoutPreviewIndex = layoutPreviewIndexRaw;

/** Slugs of every layout that ships an HTML preview, sorted alphabetically. */
export const layoutPreviewSlugs: readonly string[] = Object.freeze(
  Object.keys(layoutPreviewsRaw).sort(),
);

/** Whether an HTML preview exists for the given slug. */
export function hasLayoutPreview(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(layoutPreviewsRaw, slug);
}

/**
 * Look up the HTML preview for a layout slug. Returns `undefined` for slugs
 * with no shipped preview — callers should fall back to a generic renderer in
 * that case (see `@openpresentation/opf/previews` README).
 */
export function getLayoutPreview(slug: string): string | undefined {
  return layoutPreviewsRaw[slug];
}
