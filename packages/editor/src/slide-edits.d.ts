/** CE-19 (internal): the structural edits of the slide scene, as prepared changes (nothing is applied). */
import type { Catalog } from "@openpresentation/opf";
import type { JsonPatchOperation, OPFEditorError } from "./index.js";
import type { SlideScene } from "./slide-scene.js";

export interface PreparedSceneChange {
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Index pointers to select afterwards. */
  paths: string[];
  label?: string;
  /** A move that changes nothing. */
  noop?: boolean;
  lossless?: boolean;
  loss?: unknown[];
  weights?: number[];
  [key: string]: unknown;
}
export interface SceneEditOptions { catalogs?: readonly Catalog[] }
export type StudioClipboard =
  | { kind: "opf-studio-blocks"; blocks: unknown[]; count: number }
  | { kind: "opf-studio-slides"; presentation: unknown; count: number };

export declare function refuse(message: string, details?: Record<string, unknown>): OPFEditorError;
export declare function prepareSceneMove(presentation: unknown, scene: SlideScene, keys: string[], targetKey: string, index: number, options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneMoveBy(presentation: unknown, scene: SlideScene, keys: string[], delta: -1 | 1, options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneMoveInto(presentation: unknown, scene: SlideScene, keys: string[], delta: -1 | 1, options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneGroup(presentation: unknown, scene: SlideScene, keys: string[], options?: SceneEditOptions & { composition?: Record<string, unknown> }): PreparedSceneChange;
export declare function prepareSceneUngroup(presentation: unknown, scene: SlideScene, key: string, options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneDuplicate(presentation: unknown, scene: SlideScene, keys: string[], options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneDelete(presentation: unknown, scene: SlideScene, keys: string[], options?: SceneEditOptions): PreparedSceneChange;
export declare function ratioLabel(a: number, b: number): string;
export declare function snapTrackPair(weights: number[], boundary: number, fraction: number, options?: { free?: boolean }): { a: number; b: number };
export declare function prepareSceneTrackResize(presentation: unknown, scene: SlideScene, key: string, boundary: number, fraction: number, options?: SceneEditOptions & { free?: boolean }): PreparedSceneChange;
export declare function prepareSceneEqualize(presentation: unknown, scene: SlideScene, key: string, boundary: number, options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneWeights(presentation: unknown, scene: SlideScene, key: string, weights: number[], options?: SceneEditOptions): PreparedSceneChange;
export declare function prepareSceneMoveSlides(presentation: unknown, scene: SlideScene, keys: string[], to: number, options?: SceneEditOptions & { section?: string | null }): PreparedSceneChange;
export declare function copyScene(presentation: unknown, scene: SlideScene, keys: string[], options?: SceneEditOptions): StudioClipboard;
export declare function prepareScenePaste(presentation: unknown, scene: SlideScene, clip: StudioClipboard, options?: SceneEditOptions & { target?: string; index?: number; slideIndex?: number }): PreparedSceneChange;
