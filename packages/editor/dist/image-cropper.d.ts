import type { EditorSession } from "./index.js";

export interface ImageCropperOptions {
  editor: EditorSession;
  /** The traced `<image>` of the picture at a path (its width and height give the frame's shape; its position places the button). */
  getImageElement?: (path: string) => Element | null;
  /** Finish an inline edit first; return false to stop. */
  beforeOpen?: () => boolean;
  onCommit?: (event: { path: string; assetId?: string; restored?: boolean }) => void;
  onCancel?: () => void;
  report?: (error: Error) => void;
  /** Force the full-screen layer (true) or the in-canvas one (false). Default: full screen on a screen at most 900px wide or a canvas shorter than 460px. */
  fullscreen?: boolean;
}
export interface ImageCropper {
  /** Open the crop layer for the picture at `path` (`{ tool: "focus" }` starts with the focal point). Resolves to whether it opened. */
  open(path: string, options?: { tool?: "crop" | "focus" }): Promise<boolean>;
  readonly isOpen: boolean;
  readonly path: string | null;
  cancel(): void;
  /** The canvas selected `path`: show the Crop picture button when it is a picture. */
  sync(path: string | null): void;
  /** The canvas redrew: put the button back on its picture. */
  update(): void;
  readonly pill: HTMLButtonElement;
  destroy(): void;
}
/** The in-canvas crop tool: aspect lock, handles, focal point, exact numbers, keyboard and touch. Apply is one undoable change (see `image-crop`). */
export declare function createImageCropper(root: HTMLElement, overlay: HTMLElement, options: ImageCropperOptions): ImageCropper;
