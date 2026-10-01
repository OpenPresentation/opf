import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export declare const IMAGE_MEDIA_TYPES: Readonly<Record<string, readonly string[]>>;
/** The `accept` value for a file input: image/png,image/jpeg,image/gif,image/webp,image/svg+xml. */
export declare const IMAGE_ACCEPT: string;
/** Default size cap for an uploaded image: 2 MiB. */
export declare const DEFAULT_MAX_IMAGE_BYTES: number;

export interface ValidatedImage {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
  size: number;
}
export interface PreparedImageAsset {
  id: string;
  /** `asset:<id>` */
  reference: string;
  entry: { src: string; mediaType: string; title: string; alt?: string };
  patches: JsonPatchOperation[];
}
export interface ImageUploadOptions {
  /** Saved on the asset (or passed to `onAddAsset`). */
  alt?: string;
  /** Size cap in bytes (default 2 MiB). */
  maxBytes?: number;
  /** For hosts that store images elsewhere: receives the validated bytes and returns the reference to use; nothing is added to `assets`. */
  onAddAsset?: (image: { name: string; mediaType: string; bytes: Uint8Array; size: number; alt?: string; file: unknown }) => string | { src: string } | Promise<string | { src: string }>;
  meta?: Record<string, unknown>;
}
export interface ImageUploadChange extends Omit<EditorChange, "document" | "patches"> {
  document: unknown;
  patches: JsonPatchOperation[];
  /** The new asset's id (absent with `onAddAsset`). */
  assetId?: string;
  reference: string;
  changed: boolean;
  prepared: { patches: JsonPatchOperation[]; [key: string]: unknown };
}

/** The image type the first bytes say it is (SVG by its root element), or undefined. */
export declare function sniffImageType(bytes: Uint8Array): string | undefined;
/** Validate bytes and name: type, contents matching the claimed type, size cap, and no script in SVG. Throws `invalid-image` or `image-too-large` with a message that says what to do. */
export declare function checkImageBytes(bytes: Uint8Array, options?: { name?: string; declaredType?: string; maxBytes?: number }): { mediaType: string };
/** Read a File or Blob into validated bytes. */
export declare function readImageFile(file: { name?: string; type?: string; size?: number; arrayBuffer(): Promise<ArrayBuffer> }, options?: { maxBytes?: number }): Promise<ValidatedImage>;
export declare function imageDataUri(bytes: Uint8Array, mediaType: string): string;
/** A free asset id for a file name (`logo`, then `logo-2`). */
export declare function uniqueAssetId(document: unknown, name: string): string;
/** The patch that adds one validated image to `assets`. */
export declare function prepareImageAsset(document: unknown, image: ValidatedImage, options?: { alt?: string; id?: string }): PreparedImageAsset;
/**
 * Add an uploaded image and use it in one undoable transaction. `build(reference, document)` returns the prepared change
 * that uses the image (any `prepare...` function of this package); its patches run after the asset patch.
 */
export declare function applyImageUpload(
  editor: EditorSession,
  file: { name?: string; type?: string; size?: number; arrayBuffer(): Promise<ArrayBuffer> },
  build: (reference: string, document: any) => { patches: JsonPatchOperation[] },
  options?: ImageUploadOptions,
): Promise<ImageUploadChange>;
/** The patch that sets (or, for an empty string, removes) an asset's alt text. */
export declare function prepareAssetAlt(document: unknown, assetId: string, alt: string): { assetId: string; patches: JsonPatchOperation[]; changed: boolean };
/** Set an asset's alt text as one undoable transaction. */
export declare function setAssetAlt(editor: EditorSession, assetId: string, alt: string, meta?: Record<string, unknown>): unknown;
/** The `assets` id a reference names (`asset:logo` gives `logo`), or undefined for a URL or data address. */
export declare function assetIdOf(reference: unknown): string | undefined;
