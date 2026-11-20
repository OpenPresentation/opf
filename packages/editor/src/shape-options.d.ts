import type { ShapeCatalogEntry, ShapeCategoryId, ShapeSearchOptions } from "@openpresentation/opf/shape-catalog";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export { SHAPE_CATALOG, SHAPE_CATEGORIES, shapeCatalogEntry } from "@openpresentation/opf/shape-catalog";
export type { ShapeCatalogEntry, ShapeCategoryId } from "@openpresentation/opf/shape-catalog";
export { loadShapeEngine, shapeEngine } from "./shape-engine.js";

/** The keys of a shape block this module edits. */
export declare const SHAPE_PROPERTY_KEYS: readonly [
  "shape", "adjust", "aspectRatio", "fill", "opacity", "stroke", "style", "shadow", "innerShadow", "glow", "softEdge", "reflection", "blur",
  "rotate", "flip", "text", "anchor", "padding", "textDirection", "alt", "decorative", "hidden", "link", "layer",
];
/** The keys an overlay connector shares with a shape: its line and accessibility keys. */
export declare const CONNECTOR_PROPERTY_KEYS: readonly ["stroke", "alt", "decorative", "hidden", "adjust"];
export type ShapePropertyKey = (typeof SHAPE_PROPERTY_KEYS)[number];

/** The presets matching `query` (DrawingML name, common words), best first; an empty query lists the gallery in order. */
export declare function searchShapes(query?: string, options?: ShapeSearchOptions): ShapeCatalogEntry[];
export interface ShapeGroup { id: ShapeCategoryId; title: string; shapes: ShapeCatalogEntry[] }
/** PowerPoint's gallery groups with their presets in gallery order. */
export declare function shapeGroups(): ShapeGroup[];
/** A readable label for a preset: `rightArrowCallout` is "Right Arrow Callout". */
export declare function shapeLabel(name: string): string;

/** The shape block a selection is in, as its path (`slides.0.blocks.1.text` gives `slides.0.blocks.1`), or undefined. */
export declare function shapeBlockPathForSelection(presentation: unknown, selectedPath: string): string | undefined;
export interface ShapeBlockState {
  path: string;
  /** False for a slide or region that holds the shape inline. */
  explicit: boolean;
  /** True for an overlay shape of the slide's `shapes`. */
  overlay: boolean;
  /** The DrawingML preset (undefined for a custom `path`). */
  preset?: string;
  custom: boolean;
  /** A copy of the block. */
  block: Record<string, unknown>;
}
/** The shape block at `path` (a selection inside it works), or undefined. */
export declare function readShape(presentation: unknown, path: string): ShapeBlockState | undefined;

/** Keys to set (a value) or remove (`null`); see `setShapeProperties`. */
export type ShapeProperties = { [K in ShapePropertyKey]?: unknown };
export interface ShapeSize { width: number; height: number }
export interface PreparedShapeChange {
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  path: string;
}
/** The patches that set (a value) or remove (`null`) keys of the shape block at `path`. */
export declare function shapePropertyPatches(presentation: unknown, path: string, fields: ShapeProperties, options?: { size?: ShapeSize }): JsonPatchOperation[];
/** Compute the patch for `setShapeProperties` without touching a session. */
export declare function prepareShapeProperties(presentation: unknown, path: string, fields: ShapeProperties, options?: { size?: ShapeSize }): PreparedShapeChange;
export type ShapeChange = EditorChange & { changed: boolean; path: string };
/**
 * Set or remove (`null`) keys of one shape block as a single undoable step. Empty values remove their key (empty text, `false`, rotation 0).
 * Throws `not-a-shape-block`, `invalid-shape`, `shape-adjust-unknown` and `invalid-opf-edit` (the schema's message); nothing changes then.
 */
export declare function setShapeProperties(editor: EditorSession, path: string, fields: ShapeProperties, meta?: Record<string, unknown> & { size?: ShapeSize }): ShapeChange;
/** Change the preset; the adjust values the new preset also has are kept. One undoable step. */
export declare function setShapePreset(editor: EditorSession, path: string, preset: string, meta?: Record<string, unknown>): ShapeChange;
/**
 * Set the adjust values of a shape block (`{ adj1: 0.4 }` merges, `null` removes one), pinned to each handle's range at `meta.size` (the frame) once
 * the geometry is loaded (`await loadShapeEngine()`). Fractions and degrees. One undoable step.
 */
export declare function setShapeAdjust(editor: EditorSession, path: string, adjust: Record<string, number | null>, meta?: Record<string, unknown> & { size?: ShapeSize }): ShapeChange;
export interface ShapeAdjustState { default: number; min: number | null; max: number | null; unit: "fraction" | "degrees"; value: number; set: boolean }
/** Each adjust value of a shape block at a size: current value, default, range and unit. Needs the geometry (`loadShapeEngine`); undefined before. */
export declare function readShapeAdjust(presentation: unknown, path: string, size?: ShapeSize): Record<string, ShapeAdjustState> | undefined;

export interface ShapeInsertOptions {
  shape: string;
  slideIndex?: number;
  containerPath?: string;
  index?: number;
  /** More keys for the new block: `{ text: "Plan", fill: "accent2" }`. */
  block?: Record<string, unknown>;
}
export declare function prepareShapeInsert(presentation: unknown, options: ShapeInsertOptions): PreparedShapeChange & { shape: string };
/** Insert a shape block as one undoable step; the change's `path` is the new block. */
export declare function insertShape(editor: EditorSession, options: ShapeInsertOptions, meta?: Record<string, unknown>): ShapeChange & { shape: string };
