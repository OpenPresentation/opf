/** CE-18 studio kit (internal): boxes, badges, dividers, the drop line, the ratio badge and the marker layer over a frame. */
import type { KitDom } from "./dom.js";
export interface KitBox { x: number; y: number; w: number; h: number }
export declare function setBox(node: HTMLElement, box: KitBox, pad?: number): void;
export declare function inside(box: KitBox, point: { x: number; y: number }, slack?: number): boolean;
export declare function boxesAt<B extends KitBox & { depth: number }>(boxes: B[], point: { x: number; y: number }, options?: { slack?: number; skip?(box: B): boolean }): B[];
export interface KitKeyedPass { ensure<E extends Element>(key: string, create: () => E): E; done(): void }
export interface KitKeyedLayer { get(key: string): Element | undefined; entries(): IterableIterator<[string, Element]>; begin(): KitKeyedPass }
export declare function createKeyedLayer(layer: HTMLElement): KitKeyedLayer;
export declare function paintSelectable(node: HTMLElement, options: { box?: KitBox; selected: boolean; pressable?: boolean; label?: string; tabStop?: boolean }): void;
export declare function paintBadge(dom: KitDom, node: HTMLElement, messages: string[]): HTMLElement | null;
export declare function paintDivider(node: HTMLElement, options: { box?: KitBox; orientation: "vertical" | "horizontal"; draggable: boolean; tabbable?: boolean; label?: string; valueNow?: number; valueText?: string; title?: string }): void;
export declare function dividerKeyAction(event: Pick<KeyboardEvent, "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">, orientation: "vertical" | "horizontal"): { type: "nudge"; step: -1 | 1; big: boolean } | { type: "equalize" } | null;
export declare function ratioLabel(a: number, b: number): string;
export interface KitOverlay {
  guide: HTMLElement | null;
  drop: HTMLElement;
  ratio: HTMLElement;
  markers: HTMLElement | null;
  showGuide(box: KitBox, axis: "row" | "column"): void;
  hideGuide(): void;
  showDrop(line: KitBox, options: { orientation: "vertical" | "horizontal"; state?: "ok" | "same" | "refused"; reason?: string }): void;
  hideDrop(): void;
  showRatio(label: string, at: { x: number; y: number }): void;
  hideRatio(): void;
  hover(layer: HTMLElement, node: Element | null | undefined): void;
  into(layer: HTMLElement, node: Element | null | undefined): void;
}
export declare function createOverlay(dom: KitDom, host: HTMLElement, options?: { guide?: string | false; markers?: boolean }): KitOverlay;
