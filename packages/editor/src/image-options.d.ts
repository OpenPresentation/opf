import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export declare const IMAGE_FITS: readonly ["cover", "contain", "stretch", "auto"];
export declare const IMAGE_SHAPES: readonly string[];
export declare const IMAGE_EDGES: readonly ["left", "right", "top", "bottom"];
/** LH-132: how a person's picture is drawn in a team. */
export declare const IMAGE_PORTRAITS: readonly ["avatar", "side", "top"];
export declare const IMAGE_TREATMENT_FIELDS: readonly ["fit", "focus", "aspectRatio", "shape", "adjust", "stroke", "opacity", "recolor", "overlay", "placement", "portrait"];

export interface ImageFocus { x: number; y: number }
/** One overlay, shared by image backgrounds and image blocks: the whole picture, or a band along `edge` (`size` 0.05 to 1). */
export interface ImageOverlay { color: string; opacity: number; edge?: (typeof IMAGE_EDGES)[number]; size?: number }
/** The block bleeds to `edge` and takes `size` (0.1 to 0.9, default 0.5) of the slide; `inset` keeps it inside the padding. */
export interface ImagePlacement { edge: (typeof IMAGE_EDGES)[number]; size?: number; inset?: boolean }
export interface ImageTreatments {
  fit?: (typeof IMAGE_FITS)[number] | null;
  focus?: ImageFocus | null;
  aspectRatio?: number | null;
  shape?: (typeof IMAGE_SHAPES)[number] | null;
  adjust?: Record<string, number> | null;
  stroke?: "none" | { color?: string | { color: string; lighten?: number; darken?: number }; width?: number; [key: string]: unknown } | null;
  opacity?: number | null;
  recolor?: "grayscale" | { dark: string; light: string } | null;
  overlay?: ImageOverlay | null;
  placement?: ImagePlacement | null;
  /** LH-132: a person's picture in a team: the avatar, beside the text or across the top of the card (the first person's applies to the team). */
  portrait?: (typeof IMAGE_PORTRAITS)[number] | null;
}
export interface ImageTreatmentState extends Omit<ImageTreatments, "fit" | "focus"> {
  path: string;
  fit?: (typeof IMAGE_FITS)[number];
  focus?: ImageFocus;
  /** Whether the block may be placed (a top-level block, `slides.N.blocks.I`). */
  placeable: boolean;
  /** Edges other placed blocks of the slide already take. */
  usedEdges: (typeof IMAGE_EDGES)[number][];
}

export declare function normalizeFocus(value: unknown): ImageFocus;
export declare function normalizeOverlay(value: unknown): ImageOverlay;
export declare function normalizeRecolor(value: unknown): "grayscale" | { dark: string; light: string };
export declare function normalizePlacement(value: unknown): ImagePlacement;
/** What core composed for an image block (LH-126): the fit it is drawn with, and whether the fit asked for was `auto`, which `fit` then resolved. */
export interface EffectiveImageFit { fit: Exclude<(typeof IMAGE_FITS)[number], "auto">; auto: boolean }
/** The fit core composed for the image block at `blockPath`, read from a slide's composed geometry (`session.composeSlide(index)`); undefined when the geometry holds no such picture. */
export declare function readEffectiveImageFit(geometry: unknown, blockPath: string | string[]): EffectiveImageFit | undefined;
/** The image block's framing for a form. Throws `not-an-image-block`. */
export declare function readImageTreatments(presentation: unknown, blockPath: string | string[]): ImageTreatmentState;
/** The patches that set (a value) or remove (`null`) the fields. Throws `invalid-image-treatment`, `placement-not-top-level` or `placement-edge-taken`. */
export declare function imageTreatmentPatches(presentation: unknown, blockPath: string | string[], fields: ImageTreatments): JsonPatchOperation[];
export declare function prepareImageTreatment(presentation: unknown, blockPath: string | string[], fields: ImageTreatments): { presentation: unknown; patches: JsonPatchOperation[]; changed: boolean; path: string; slideIndex: number };
/** Set or remove treatment fields of one image block as one undoable transaction. */
export declare function setImageTreatment(editor: EditorSession, blockPath: string | string[], fields: ImageTreatments, meta?: Record<string, unknown>): EditorChange & { changed: boolean; path: string; slideIndex: number };
