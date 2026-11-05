// @openpresentation/gallery/icon-sets/<id>: one icon set of the gallery (LH-14), loaded on demand. `galleryIconSets.iconSets.<id>()` imports
// it; core's ensureIcons calls that for the sets a deck uses. The record is https://openpresentation.org/schema/opf-icon-set/v1
// without `$schema` and `id`.

/** One icon: its path data (drawn as the set's style), or the parts the set strokes and fills. */
export type GalleryIcon = string | { readonly stroke?: string; readonly fill?: string };

/** An icon set record. */
export interface GalleryIconSet {
  readonly name: string;
  readonly summary?: string;
  readonly version?: string;
  readonly package?: string;
  readonly homepage?: string;
  readonly license: string;
  readonly copyright: string;
  readonly licenseText?: string;
  readonly viewBox: readonly [number, number, number, number];
  readonly style: "stroke" | "fill";
  readonly strokeWidth?: number;
  readonly strokeLinecap?: "butt" | "round" | "square";
  readonly strokeLinejoin?: "miter" | "round" | "bevel";
  readonly icons: Readonly<Record<string, GalleryIcon>>;
  readonly tags?: Readonly<Record<string, readonly string[]>>;
}

declare const iconSet: GalleryIconSet;
export default iconSet;
