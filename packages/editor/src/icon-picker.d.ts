import type { Catalog } from "@openpresentation/opf";
import type { EditorSession } from "./index.js";
import type { IconChange, IconGlyph, IconPicture } from "./icon-options.js";

export interface IconPickerOptions {
  /** The editor session whose document the picker edits. */
  editor: EditorSession;
  /** The host's current selection (an OPF path such as `slides.0.blocks.1.items.2.text`); call `refresh()` when it changes. */
  getSelectedPath?: () => string | undefined;
  /** Host catalogs, merged after the session's registered ones. Their `iconSets` are what the search reads; the editor bundles none. */
  catalogs?: readonly Catalog[];
  /** Icons shown per page (default 60); "Show more" adds a page. */
  pageSize?: number;
  /** Called with each applied change (a set, a pasted SVG or a removal). */
  onChange?: (change: IconChange) => void;
  /** Called with a status message, or a refusal (`error: true`) such as the `opf/icon-invalid` finding's message. */
  onStatus?: (message: string, info: { error: boolean }) => void;
}
export interface IconPicker {
  element: HTMLElement;
  /** Re-read the session and the selection (the picker also listens to the session itself). */
  refresh(): void;
  open(): void;
  close(): void;
  destroy(): void;
}
/** Mount the icon picker for the selected list entry, metric or group. Hidden when the selection has no icon of its own. */
export declare function createIconPicker(container: Element, options: IconPickerOptions): IconPicker;
/** An `<svg>` (or, for a multicolor picture, an `<img>`) for plain glyph data from `setIconGlyph` or `iconGlyph`. */
export declare function glyphNode(doc: Document, glyph: IconGlyph | IconPicture | undefined, size?: number): SVGSVGElement | HTMLImageElement;
