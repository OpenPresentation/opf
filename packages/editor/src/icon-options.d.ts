import type { Catalog, IconSetRecord } from "@openpresentation/opf";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** What an `icon` can mark: a first-level list entry, a metric or a group of blocks. */
export declare const ICON_TARGETS: readonly ["item", "metric", "group"];
export type IconTargetKind = (typeof ICON_TARGETS)[number];

/** The thing an icon goes on, found from a selection: `path` is the entry, the metric's own path (`slides.0.blocks.1.metric`) or the group block. */
export interface IconTarget { target: IconTargetKind; path: string }
/** The target of a selection (`slides.0.blocks.1.items.2.text` gives the entry, a metric block or a selection inside it its metric, a selected group block the group), or undefined. */
export declare function iconTargetForSelection(presentation: unknown, selectedPath: string): IconTarget | undefined;

export interface IconState extends IconTarget {
  /** The `icon` as written: "<set>:<name>", a name from the deck's `icons`, or an SVG source. Undefined when there is none. */
  icon?: string;
  /** True for a bare string or run-array entry and a bare metric value: setting an icon makes it an object (`{ text, icon }`, `{ value, icon }`). */
  scalar: boolean;
  /** True for a list entry below the first level, which icons never mark: it takes no new icon. */
  nested: boolean;
}
/** The icon state of the target a path (or selection) points at, or undefined when it has no icon of its own. */
export declare function readIcon(presentation: unknown, path: string): IconState | undefined;

export interface PreparedIcon {
  presentation: unknown;
  /** A `test` and `replace` of a bare entry or metric, or `add`, `replace` or `remove` of the `icon` key; with a pasted SVG, the `icons` entry first; with a last use removed, the `icons` entry last. Empty when nothing changed. */
  patches: JsonPatchOperation[];
  path: string;
  target: IconTargetKind;
  changed: boolean;
  lossless: true;
  loss: [];
  /** The icon the target has afterwards (null: none). */
  icon: string | null;
  /** The deck icon name a pasted SVG is stored under (`prepareSvgIcon` only). */
  name?: string;
}
export interface IconChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  lossless: true;
  loss: [];
  path: string;
  target: IconTargetKind;
  icon: string | null;
  name?: string;
}
export interface IconOptions {
  /** The registered catalogs (their `iconSets` let the validator check a set icon that is loaded). `setIcon` passes the session's. */
  catalogs?: readonly Catalog[];
  /** Remove a deck icon from `icons` when its last use goes (default true). */
  prune?: boolean;
  /** `false` is a dry run that skips the icon check. */
  validate?: boolean;
}
export interface SvgIconOptions extends IconOptions {
  /** The name to store the SVG under; made a valid deck icon name. Default: its `<title>`, else "icon" (and the next free "icon-2"). */
  name?: string;
  /** Replace the SVG of a deck icon that has this name (otherwise a taken name is refused as `icon-name-taken`). */
  replace?: boolean;
}

/**
 * Compute the patch that gives the list entry, metric or group at `path` the icon `icon` (a string: "<set>:<name>", a deck icon name or an SVG
 * source) or removes it (`null`). Throws `content-action-refused` for a path with no icon of its own and for a nested entry, `invalid-icon` for a
 * string that is no icon form, and `icon-unknown` or `icon-invalid` (with `details.ruleId`) with the validator's own message for an icon it reports.
 */
export declare function prepareIcon(presentation: unknown, path: string, icon: string | null, options?: IconOptions): PreparedIcon;
/** Set (or, with `null`, remove) an icon as one undoable step. */
export declare function setIcon(editor: EditorSession, path: string, icon: string | null, meta?: Record<string, unknown>): IconChange;
/** Remove the icon of the entry, metric or group at `path` as one undoable step. */
export declare function removeIcon(editor: EditorSession, path: string, meta?: Record<string, unknown>): IconChange;
/**
 * Compute the patch that stores a pasted SVG in the deck's `icons` under a name and gives the target that name, in one patch list. The same SVG
 * is reused by name. Throws `icon-invalid` with the `opf/icon-invalid` finding's message for an SVG that cannot be an icon, and `icon-name-taken`.
 */
export declare function prepareSvgIcon(presentation: unknown, path: string, svg: string, options?: SvgIconOptions): PreparedIcon & { name: string };
/** Paste an SVG as an icon: stored in `icons`, referenced by name, one undoable step. */
export declare function setSvgIcon(editor: EditorSession, path: string, svg: string, options?: Omit<SvgIconOptions, "catalogs">, meta?: Record<string, unknown>): IconChange & { name: string };
/** A deck icon name from free text: lowercase letters, digits and hyphens, starting with a letter. */
export declare function deckIconName(text: unknown, fallback?: string): string;

/** Where icon sets come from: an editor session, `{ catalogs, presentation }`, or a list of catalogs. */
export type IconSetSource = EditorSession | { catalogs?: readonly Catalog[]; presentation?: unknown } | readonly Catalog[];
export interface IconSetInfo {
  id: string;
  name: string;
  license?: string;
  copyright?: string;
  version?: string;
  /** The number of icons; known once the set is loaded. */
  icons?: number;
  loaded: boolean;
  /** True for a set the deck embeds (`catalogs.<group>.iconSets`) rather than one the host registered. */
  embedded: boolean;
}
/** The icon sets a host registered (a catalog's `iconSets`), then the deck's embedded ones. A registered loader's set has only its id until loaded. */
export declare function listIconSets(source: IconSetSource): IconSetInfo[];
/** Load the registered sets (once each) and prime core's registry so the deck draws them. Resolves with the records by id. */
export declare function loadIconSets(source: IconSetSource, ids?: readonly string[]): Promise<Map<string, IconSetRecord>>;

export interface IconSearchResult { icon: string; set: string; name: string; tags: string[] }
export interface IconSearch {
  query: string;
  total: number;
  returned: number;
  icons: IconSearchResult[];
  sets: { id: string; name: string; license: string; copyright: string; version?: string; icons: number }[];
}
/** Search the registered sets by name and keywords (the ranking of the MCP's `search_icons`); an empty query browses. Throws `unknown-icon-set` for `options.set` nothing registers. */
export declare function searchIcons(source: IconSetSource, query?: string, options?: { set?: string; limit?: number; offset?: number }): Promise<IconSearch>;

/** How to draw one icon, as plain data: path parts in a viewBox. */
export interface IconGlyph {
  viewBox: string;
  parts: { d: string; mode: "stroke" | "fill"; evenOdd?: true; strokeWidth?: number; linecap?: string; linejoin?: string }[];
  strokeWidth: number;
  linecap: string;
  linejoin: string;
}
export interface IconPicture { picture: { svg: string; width: number; height: number } }
/** How to draw an icon of a set record. Undefined for a name the record does not have. */
export declare function setIconGlyph(record: IconSetRecord, name: string): IconGlyph | undefined;
/** How to draw the icon a reference names (a set's, a deck's, a source core has read), in a 0 0 24 24 viewBox; a multicolor SVG is a `picture`. Undefined when it does not resolve. */
export declare function iconGlyph(presentation: unknown, reference: string, options?: { catalogs?: readonly Catalog[] }): IconGlyph | IconPicture | undefined;
/** The deck's own icons: `glyph` (one color), `picture` (its own colors), `source` (a file or asset not read here) or `invalid`. */
export declare function deckIcons(presentation: unknown, options?: { catalogs?: readonly Catalog[] }): { name: string; kind: "glyph" | "picture" | "source" | "invalid" }[];
