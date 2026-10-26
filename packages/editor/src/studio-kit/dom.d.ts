/** CE-18 studio kit (internal): DOM helpers, icons, the menu and the typing-target guard. */
export declare const ICONS: Readonly<Record<string, string>>;
/** The default class prefix of kit parts ("opf-kit"); Layout Studio passes "opf-lx". */
export declare const KIT_PREFIX: string;
export declare function nextId(prefix: string): string;
export interface KitButtonOptions {
  label?: string;
  text?: string;
  iconName?: string;
  size?: number;
  pressed?: boolean;
  title?: string;
  attributes?: Record<string, string | number | boolean | undefined | null>;
}
export interface KitDom {
  doc: Document;
  prefix: string;
  el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, attributes?: Record<string, string | number | boolean | undefined | null>): HTMLElementTagNameMap[K];
  icon(name: string, size?: number): SVGSVGElement;
  button(className: string, options?: KitButtonOptions): HTMLButtonElement;
}
export declare function createDom(doc: Document, options?: { prefix?: string }): KitDom;
export declare function isTypingTarget(target: EventTarget | null): boolean;
export declare function isMac(win?: Window | null): boolean;
/** A unit fraction as a CSS percentage. */
export declare function pct(fraction: number): string;
export interface KitMenuItem {
  label: string;
  onSelect?(): void;
  disabled?: boolean;
  role?: "menuitem" | "menuitemcheckbox";
  checked?: boolean;
  hint?: string;
}
export interface KitMenu { element: HTMLElement; close(options?: { restore?: boolean }): void }
export declare function openMenu(dom: KitDom, host: HTMLElement, options: { x: number; y: number; items: KitMenuItem[]; label: string; returnFocus?: HTMLElement | null; onClose?(): void; className?: string }): KitMenu;
