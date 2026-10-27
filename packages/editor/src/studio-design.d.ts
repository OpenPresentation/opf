/** CE-20 (internal): the Studio's Design panel, its sections chosen by the selection. */
import type { Catalog } from "@openpresentation/opf";
import type { KitDom } from "./studio-kit/dom.js";
import type { EditorSession } from "./index.js";
import type { SceneNode } from "./slide-scene.js";

export type StudioDesignMode = "deck" | "slide" | "group" | "region" | "promoted" | "heading" | "part" | "multi" | "block" | "image" | "chart" | "table" | "list";
export declare function designMode(nodes: SceneNode[]): StudioDesignMode;
export interface StudioDesign {
  element: HTMLElement;
  refresh(): void;
  readonly mode: StudioDesignMode | null;
  showSection(name: string): void;
  destroy(): void;
}
export declare function createStudioDesign(container: HTMLElement, options: { dom: KitDom; ui: EditorSession; studio: any; catalogs?: readonly Catalog[]; designOptions?: Record<string, unknown>; onAddAsset?: unknown }): StudioDesign;
