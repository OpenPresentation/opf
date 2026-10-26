/** CE-18: the studio kit (internal; no package subpath exports it yet). The document adapter a studio supplies is `StudioDocumentAdapter`. */
export * from "./dom.js";
export * from "./commands.js";
export * from "./selection.js";
export * from "./gesture.js";
export * from "./viewport.js";
export * from "./overlay.js";
export * from "./drag.js";
export * from "./tree.js";
export * from "./inspector.js";
import type { KitBox } from "./overlay.js";

/** One node of a studio document, as the layers, the overlay and the screen reader see it. */
export interface StudioNode<Key = string> { key: string; path: Key; kind: string; parent: string | null; depth: number; label: string; findings: { message: string }[] }
/** What a studio needs from a document (Layout Studio: src/layout-adapter.js; the slide adapter is CE-19). */
export interface StudioDocumentAdapter<Key, Draft = unknown> {
  nodes(): StudioNode<Key>[];
  boxOf(key: Key): (KitBox & { depth: number }) | undefined;
  containerOf(key: Key): { direction: "row" | "column"; tracks: { start: number; length: number }[] } | undefined;
  hitChain(point: { x: number; y: number }, skip?: (box: KitBox) => boolean): (KitBox & { depth: number })[];
  trialMove(keys: Key[], target: Key, index: number): { ok: boolean; reason: string; noop: boolean };
  run(command: string, ...args: unknown[]): boolean;
  begin(label: string): boolean;
  preview(draft: Draft, message?: string): void;
  commit(message?: string): boolean;
  cancel(): void;
  undo(): boolean;
  redo(): boolean;
}
