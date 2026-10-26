/** CE-18 studio kit (internal): the inspector frame (sections chosen by the selection) and its field builders. */
import type { KitDom } from "./dom.js";
export interface KitInspectorSection<Ctx> { id: string; when?(ctx: Ctx): boolean; render(body: HTMLElement, ctx: Ctx): void }
export interface KitInspectorFrame<Ctx> {
  readonly editing: boolean;
  sectionsFor(ctx: Ctx): KitInspectorSection<Ctx>[];
  register(section: KitInspectorSection<Ctx>, options?: { before?: string }): () => void;
  render(): void;
  update(): void;
  check(fn: () => void): void;
  edit(callback: () => void): void;
}
export declare function createInspectorFrame<Ctx>(body: HTMLElement, options?: { sections?: KitInspectorSection<Ctx>[]; context?(): Ctx; before?(ctx: Ctx): void; after?(ctx: Ctx): void }): KitInspectorFrame<Ctx>;
export interface KitFields<Path> {
  field(label: string, control: HTMLElement, options?: { help?: string; path?: Path; field?: string; labelFor?: string; group?: boolean; target?: HTMLElement }): HTMLElement & { error: HTMLElement };
  textInput(value: string | undefined, options?: { onInput?(value: string): void; name?: string; pattern?: string; placeholder?: string; multiline?: boolean }): HTMLInputElement | HTMLTextAreaElement;
  select(entries: [string, string][], current: string, options: { onChange(value: string): void; name: string }): HTMLSelectElement;
  segmented(entries: [string, string, string?][], current: string, options: { onPick(value: string): void; label: string; name: string }): HTMLElement;
  actionButton(text: string, iconName: string | undefined, run: () => void, options?: { label?: string; disabled?: boolean; shortcut?: string }): HTMLButtonElement;
  section(label?: string): HTMLElement;
}
export declare function createFields<Path>(dom: KitDom, frame: KitInspectorFrame<unknown>, options?: { idPrefix?: string; issues?(path: Path, field: string): { message: string }[]; readOnly?(): boolean }): KitFields<Path>;
