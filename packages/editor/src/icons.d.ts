/**
 * An icon a host can give a part: an SVG element (cloned into the part's document, never moved), a function returning one (called with the
 * part's document; it may also return path data), or SVG path data for a 24x24 icon drawn as a 2px round stroke in `currentColor`
 * (`"M12 5v14M5 12h14"`). The result is `<svg class="opf-icon" aria-hidden="true" focusable="false">`: it is decorative, the control carries
 * the accessible name. An element keeps its own attributes (`viewBox`, `fill`, `stroke`); the part's CSS sizes it.
 */
export type OpfIcon = SVGElement | ((doc: Document) => SVGElement | string | null | undefined) | string;

/** The `icons` option of a part: icon names (listed in each part's `.d.ts`) to icons. A name the part does not have throws a RangeError. */
export type OpfIcons<Name extends string = string> = Partial<Record<Name, OpfIcon | null>>;

export interface ResolveIconOptions {
  /** Written as `data-opf-icon="<name>"` so CSS can target one icon. */
  name?: string;
  /** Extra classes after `opf-icon`, for example the part's own (`"opf-expand-icon"`). */
  className?: string;
  /** `width` and `height` in px, unless the icon sets its own. The part's CSS overrides either. */
  size?: number;
}

/** A built-in icon that is more than one stroked path: `[tag, attributes]` shapes in a 24x24 box. */
export type OpfIconShapes = ReadonlyArray<readonly [string, Record<string, string | number>]>;

/**
 * The icon for one place in a part. `given` is the host's choice; `null` or `undefined` means `fallback` (path data or shapes). With neither the
 * result is null. Throws a TypeError for a given value that is not an SVG element, a function or path data.
 */
export declare function resolveIcon(doc: Document, given: OpfIcon | null | undefined, fallback?: string | OpfIconShapes | null, options?: ResolveIconOptions): SVGSVGElement | null;

/**
 * Check a part's `icons` option against the names it has. Returns a plain copy (`{}` for undefined). Throws a TypeError for a bad shape or
 * value and a RangeError for an unknown name.
 */
export declare function normalizeIcons<Name extends string>(icons: OpfIcons<Name> | null | undefined, names: readonly Name[], label?: string): OpfIcons<Name>;
