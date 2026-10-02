import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The smallest crop side, in source pixels. */
export declare const MIN_CROP_SIDE: number;
export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface CropAspect { id: string; label: string; ratio?: number }
/** Free, Original, Frame, 1:1, 4:3, 3:2, 16:9, 3:4, 2:3 and 9:16. */
export declare const CROP_ASPECTS: readonly CropAspect[];
/** The width / height ratio of an aspect id for an image and a frame, or undefined for "free". `frame` is the frame's width / height. */
export declare function aspectRatioFor(id: string | undefined, context?: { width?: number; height?: number; frame?: number }): number | undefined;
export declare function fullRect(width: number, height: number): Rect;
/** Keep a rectangle inside the image and at least `min` on each side. */
export declare function clampRect(rect: Rect, bounds: Size, min?: number): Rect;
export declare function moveRect(rect: Rect, dx: number, dy: number, bounds: Size): Rect;
/** Drag a handle (`n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`) to a source-pixel point; `aspect` (width / height) keeps the ratio. */
export declare function resizeRect(start: Rect, handle: string, point: { x: number; y: number }, bounds: Size, options?: { aspect?: number; min?: number }): Rect;
/** The largest rectangle with `aspect` inside `rect`, centred on it. */
export declare function fitAspect(rect: Rect, aspect: number | undefined): Rect;
/** The window a focal point asks for: the largest `aspect` window divided by `zoom`, centred on `focal` (fractions) and inside the image. */
export declare function focalWindow(bounds: Size, aspect: number, focal: { x: number; y: number }, zoom?: number): Rect;
export declare function focalPointOf(rect: Rect, bounds: Size): { x: number; y: number };
export declare function roundRect(rect: Rect, bounds: Size): Rect;
export declare function isFullRect(rect: Rect, bounds: Size): boolean;

export interface ImageDescription {
  path: string;
  pointer: string;
  form: "string" | "object";
  /** JSON pointer of the string that holds the source (the field itself, or its `src`). */
  srcPointer: string;
  src: string;
  /** The `assets` id when `src` is an `asset:` reference. */
  assetId?: string;
  /** What the source resolves to: the asset's `src`, or `src` itself. */
  assetSrc: string;
  alt?: string;
  mediaType?: string;
  /** The asset a crop of this picture was made from, when there is one. */
  origin?: string;
  entry?: unknown;
}
/** What a path holds when it is a picture, or `{ error }` with the reason it is not croppable (not a picture, a missing asset, SVG). */
export declare function describeImage(document: unknown, path: string): ImageDescription | { error: string };
export declare function countAssetReferences(document: unknown, id: string): number;
export interface CroppedPixels { dataUri: string; mediaType: string; width: number; height: number; bytes?: number }
export interface PreparedCrop { patches: JsonPatchOperation[]; assetId: string; reference: string; origin?: string; image: ImageDescription }
/** The patches that apply a cropped picture: a new asset and the image pointing at it (pure). Throws `not-croppable`. */
export declare function prepareCrop(document: unknown, path: string, pixels: CroppedPixels): PreparedCrop;
/** The patches that put a cropped picture back to its original asset, or null. */
export declare function prepareRestore(document: unknown, path: string): { patches: JsonPatchOperation[]; origin: string; image: ImageDescription } | null;
/** Restore the original as one undoable change; null when there is no original. */
export declare function restoreOriginal(editor: EditorSession, path: string, meta?: Record<string, unknown>): (EditorChange & { origin: string }) | null;
export interface LoadedImage { image: HTMLImageElement; width: number; height: number }
export declare function loadImagePixels(src: string, options?: { document?: Document; signal?: AbortSignal }): Promise<LoadedImage>;
/** Cut a rectangle out of a loaded picture at its own resolution (JPEG stays JPEG, everything else PNG). Needs a browser canvas. */
export declare function cropImagePixels(loaded: LoadedImage, rect: Rect, options?: { mediaType?: string; maxBytes?: number; document?: Document }): Promise<CroppedPixels>;
/** Crop a picture of the document and apply it as one undoable change. */
export declare function applyCrop(editor: EditorSession, path: string, rect: Rect, options?: { loaded?: LoadedImage; maxBytes?: number; meta?: Record<string, unknown> }): Promise<EditorChange & { assetId: string; reference: string; width: number; height: number }>;
