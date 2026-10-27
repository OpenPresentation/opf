/** CE-20 (internal): the Studio's canvas: the kit viewport and overlay over the workspace's canvas, driven by the slide adapter. */
import type { KitDom } from "./studio-kit/dom.js";
import type { CanvasEditor } from "./canvas.js";
import type { SlideAdapter } from "./slide-adapter.js";
import type { SceneNode } from "./slide-scene.js";

export declare function dottedPath(pointer: string): string;
export declare function isTextNode(node: SceneNode | null | undefined): boolean;
export interface StudioCanvas {
  paint(): void;
  paintHover(): void;
  readonly zoom: number;
  readonly panMode: boolean;
  setZoom(zoom: number, options?: { anchor?: { clientX: number; clientY: number } }): number;
  step(direction: number): number;
  fit(mode?: "slide" | "width"): number;
  readonly tool: "select" | "hand" | "text";
  setTool(tool: "select" | "hand" | "text"): void;
  focusPrimary(): void;
  boxOf(key: string): Element | undefined;
  describe(node: SceneNode): string;
  beginInsertDrag(kind: string, event: PointerEvent, options?: { onEnd?(): void }): boolean;
  readonly dragging: boolean;
  cancelDrag(): void;
  setEnabled(on: boolean): void;
  destroy(): void;
}
export declare function createStudioCanvas(options: {
  dom: KitDom;
  elements: { root: HTMLElement; viewport: HTMLElement; stage: HTMLElement; frame: HTMLElement; overlay: HTMLElement };
  canvas: CanvasEditor;
  adapter: SlideAdapter;
  studio: any;
}): StudioCanvas;
