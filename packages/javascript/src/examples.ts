// Bundled OPF example decks.
//
// Source-of-truth: ../../../examples/**/*.opf.json. The build step
// (`pnpm build`) inlines each deck into this module so consumers can import
// the gallery without doing any filesystem work at runtime.
//
// Each example's `deck` field is the parsed JSON for an `.opf.json` file —
// the same content you would `JSON.parse(fs.readFileSync(file))`.

import { examplesRaw, galleriesRaw } from "./generated/examples.js";
import type {
  ExampleRecord,
  GalleryRecord,
} from "./generated/examples.js";

export type { ExampleRecord, GalleryRecord };

/** Every example deck shipped with this release, sorted by file path. */
export const examples: readonly ExampleRecord[] = examplesRaw;

/** Examples grouped by `examples/gallery/<slug>/` folder. */
export const galleries: readonly GalleryRecord[] = galleriesRaw;

/** Top-level `examples/<category>` buckets present in this release. */
export const exampleCategories: readonly string[] = Object.freeze(
  Array.from(new Set(examplesRaw.map((example) => example.category))).sort(),
);

/** Look up an example deck by slug (the filename without `.opf.json`). */
export function getExample(slug: string): ExampleRecord | undefined {
  return examplesRaw.find((example) => example.slug === slug);
}

/** Look up a gallery by slug. */
export function getGallery(slug: string): GalleryRecord | undefined {
  return galleriesRaw.find((gallery) => gallery.slug === slug);
}

/** All examples that belong to a given gallery slug. */
export function getExamplesByGallery(slug: string): readonly ExampleRecord[] {
  return examplesRaw.filter((example) => example.gallery === slug);
}

/** All examples that belong to a given top-level category (`gallery`, `technical`, …). */
export function getExamplesByCategory(category: string): readonly ExampleRecord[] {
  return examplesRaw.filter((example) => example.category === category);
}
