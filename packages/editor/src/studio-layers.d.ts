/** CE-20 (internal): the Studio's layers tree over the current slide's scene. */
import type { KitDom } from "./studio-kit/dom.js";
import type { SlideAdapter } from "./slide-adapter.js";

export interface StudioLayers {
  element: HTMLElement;
  render(): void;
  paintSelection(options?: { focus?: boolean }): void;
  focus(): void;
  destroy(): void;
}
export declare function createStudioLayers(container: HTMLElement, options: { dom: KitDom; adapter: SlideAdapter; studio: any }): StudioLayers;
