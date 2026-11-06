import type { ShapeCatalogEntry } from "@openpresentation/opf/shape-catalog";

export interface ShapePickerOptions {
  /** Called with a preset's DrawingML name and its catalog entry when a tile is chosen (or Enter takes the first match). */
  onPick?: (name: string, entry: ShapeCatalogEntry | undefined) => void;
  /** The preset to mark as in use. */
  selected?: string;
  /** Keeps ids unique when there are several pickers. */
  idPrefix?: string;
  /** Focus the search once the tiles are drawn. */
  autofocus?: boolean;
  labels?: { search?: string };
}
export interface ShapePicker {
  element: HTMLElement;
  /** Resolves once the preset geometry has loaded and the tiles are drawn. */
  ready: Promise<void>;
  focus(): void;
  /** Mark the preset in use (undefined clears the mark). */
  setSelected(name: string | undefined): void;
  /** Clear the search and show the gallery. */
  reset(): void;
  destroy(): void;
}
/** Mount the shape picker: PowerPoint's gallery groups, a search by DrawingML name, Aspose name and common words, and a tile drawn from each preset's geometry. */
export declare function createShapePicker(container: Element, options?: ShapePickerOptions): ShapePicker;

export interface ShapeMenuOptions {
  onPick?: (name: string, entry: ShapeCatalogEntry | undefined) => void;
  selected?: string;
  /** The popover's accessible name (default "Shapes"). */
  label?: string;
}
export interface ShapeMenu {
  readonly isOpen: boolean;
  element: HTMLElement;
  open(): void;
  close(restoreFocus?: boolean): void;
  toggle(): void;
  setSelected(name: string | undefined): void;
  destroy(): void;
}
/** A popover with the picker under `button`: opens on a click, closes on Escape, an outside press and a pick. */
export declare function createShapeMenu(button: HTMLElement, options?: ShapeMenuOptions): ShapeMenu;
/** An `<svg class="opf-sp-thumb" aria-hidden>` of a preset drawn from its geometry; `engine` is `await loadShapeEngine()`. */
export declare function shapeThumbnailNode(doc: Document, engine: typeof import("@openpresentation/opf/shape-geometry"), name: string, size?: number): SVGSVGElement;
