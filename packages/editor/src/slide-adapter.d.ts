/** CE-19 (internal; no package subpath exports it yet): the studio kit's document adapter for the slides of a deck, over an editor session. */
import type { Catalog } from "@openpresentation/opf";
import type { SlideComposition } from "@openpresentation/opf/composition";
import type { EditorSession } from "./index.js";
import type { StudioDocumentAdapter, StudioNode } from "./studio-kit/index.js";
import type { KitSelectionAdapter } from "./studio-kit/selection.js";
import type { PreparedSceneChange, StudioClipboard } from "./slide-edits.js";
import type { SceneBox, SceneContainer, SceneDrop, SceneHit, SlideScene } from "./slide-scene.js";

export type SlideCommand = "move" | "moveBy" | "moveInto" | "group" | "ungroup" | "duplicate" | "delete" | "resizeTracks" | "equalize" | "setWeights" | "paste" | "moveSlides";
export declare const SLIDE_COMMANDS: readonly SlideCommand[];
export interface SlideCommandResult { ok: boolean; changed: boolean; keys: string[]; label?: string; reason?: string }
export interface SlideAdapterOptions {
  slideIndex?: number;
  /** The `SlideComposition` of a slide as it is drawn; default core composition with the session's catalogs. */
  geometry?(presentation: unknown, slideIndex: number): SlideComposition;
  /** The keys selected now, recorded with each change so undo and redo restore them. */
  selection?(): string[];
  onPreview?(event: { presentation: unknown | null; message?: string }): void;
  onSelection?(keys: string[], info: { source: string }): void;
  onRefuse?(event: { reason: string; command?: string }): void;
}
export interface SlideAdapter extends Omit<StudioDocumentAdapter<string, PreparedSceneChange>, "nodes" | "boxOf" | "containerOf" | "hitChain"> {
  readonly session: EditorSession;
  readonly slideIndex: number;
  setSlide(indexOrKey: number | string): boolean;
  scene(): SlideScene;
  slides(): { key: string; path: string; index: number; label: string; hidden: boolean }[];
  nodes(): StudioNode<string>[];
  boxOf(key: string): (SceneBox & { depth: number }) | undefined;
  containerOf(key: string): SceneContainer | undefined;
  hitChain(point: { x: number; y: number }, skip?: (hit: SceneHit) => boolean, options?: { parts?: boolean }): SceneHit[];
  target(chain: SceneHit[], options?: { primary?: string | null; shift?: boolean; deep?: boolean }): SceneHit | null;
  dropAt(point: { x: number; y: number }, keys: string[]): (SceneDrop & { ok: boolean; reason: string; noop: boolean }) | null;
  selectionAdapter(): KitSelectionAdapter<string>;
  keyOf(path: string): string;
  pathOf(key: string): string | null;
  survivor(key: string): string | null;
  ensureIds(): boolean;
  prepare(command: SlideCommand, ...args: unknown[]): PreparedSceneChange & { base: unknown; command: SlideCommand };
  apply(command: SlideCommand, ...args: unknown[]): SlideCommandResult;
  run(command: SlideCommand, ...args: unknown[]): boolean;
  readonly lastResult: SlideCommandResult | null;
  copy(keys: string[]): StudioClipboard;
  readonly gestureActive: boolean;
  destroy(): void;
}
export declare function composeSlideGeometry(presentation: unknown, slideIndex: number, options?: { catalogs?: readonly Catalog[]; fonts?: unknown }): SlideComposition;
export declare function createSlideAdapter(session: EditorSession, options?: SlideAdapterOptions): SlideAdapter;
