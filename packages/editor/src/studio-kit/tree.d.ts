/** CE-18 studio kit (internal): the layers tree (WAI-ARIA tree pattern) and its drop places. */
import type { KitDom } from "./dom.js";
export declare function treeItem(dom: KitDom, options: { level: number; selected: boolean; expanded?: boolean; setsize?: number; posinset?: number; attributes?: Record<string, string | number>; className?: string }): HTMLLIElement;
export declare function rovingTabStop(items: Iterable<HTMLElement>, stop: HTMLElement | null | undefined): void;
export type KitTreeAction<Item> = { type: "focus"; target: Item | null } | { type: "expand" } | { type: "collapse" } | { type: "activate" } | { type: "menu" };
export declare function treeKeyAction<Item>(event: Pick<KeyboardEvent, "key" | "shiftKey">, item: Item, items: Item[], state?: { expandable?: boolean; expanded?: boolean; collapsible?: boolean; parent?: Item | null; firstChild?: Item | null; menu?: boolean }): KitTreeAction<Item> | null;
export declare function hitRow<R extends { row: Element }>(rows: R[], clientY: number): R | undefined;
export declare function rowDropMode(fraction: number, options?: { root?: boolean; container?: boolean }): "into" | "before" | "after";
export declare function showTreeDrop(mark: HTMLElement, scroller: HTMLElement, drop: { mode: "into" | "before" | "after"; state: "ok" | "same" | "refused"; reason?: string; box: DOMRect } | null | undefined): void;
