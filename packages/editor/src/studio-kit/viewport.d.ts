/** CE-18 studio kit (internal): zoom (steps, smooth, fit), pan (hand, Space, two fingers) and screen-to-unit mapping. */
export declare const ZOOM_STEPS: readonly number[];
export declare function clampZoom(value: number, steps?: readonly number[]): number;
export declare function stepZoom(zoom: number, direction: number, steps?: readonly number[]): number;
export declare function toUnit(point: { clientX: number; clientY: number }, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number };
export declare function scrollForZoom(scroll: { left: number; top: number }, anchor: { x: number; y: number }, from: number, to: number): { left: number; top: number };
export interface KitViewportOptions {
  root?: HTMLElement;
  zoomVar?: string;
  steps?: readonly number[];
  zoom?: number;
  panEnabled?(): boolean;
  wheel?: "step" | "smooth" | false;
  pinch?: boolean;
  fitZoom?(mode: "slide" | "width"): number;
  onZoom?(zoom: number): void;
}
export interface KitViewport {
  readonly zoom: number;
  readonly panMode: boolean;
  readonly panning: boolean;
  setZoom(zoom: number, options?: { anchor?: { clientX: number; clientY: number } }): number;
  step(direction: number, options?: { anchor?: { clientX: number; clientY: number } }): number;
  fit(mode?: "slide" | "width"): number;
  holdSpace(on: boolean): void;
  toUnit(event: { clientX: number; clientY: number }, element: Element): { x: number; y: number };
  destroy(): void;
}
export declare function createViewport(viewport: HTMLElement, options?: KitViewportOptions): KitViewport;
