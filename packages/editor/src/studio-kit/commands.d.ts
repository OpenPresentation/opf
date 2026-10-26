/** CE-18 studio kit (internal): the command registry and keymap. */
export interface KitCommand<Ctx = unknown> {
  id: string;
  label: string;
  group?: string;
  /** The scope(s) `handle` runs it in (default "global"). */
  scope?: string | string[];
  /** CodeMirror-style key specs: "Mod-z", "Shift-Mod-z", "Ctrl-y", "[", "Delete", "F2". */
  keys?: string[];
  /** What a menu shows instead of the formatted first key. */
  hint?: string;
  /** false: a held key does not repeat the command. */
  repeat?: boolean;
  /** true runs it; false or a reason string disables it. */
  when?(ctx: Ctx): boolean | string;
  run(ctx: Ctx, event?: KeyboardEvent): unknown;
}
export interface KitCommandInfo { id: string; label: string; group?: string; keys: string[]; shortcut: string; enabled: boolean; reason: string }
export interface KitKey { key: string; shift: boolean; alt: boolean; mod: boolean; ctrl: boolean; meta: boolean }
export interface KitCommandRegistry<Ctx = unknown> {
  register(command: KitCommand<Ctx>): () => void;
  get(id: string): KitCommand<Ctx> | undefined;
  has(id: string): boolean;
  setKeymap(map: Record<string, string | string[] | null>): void;
  list(ctx: Ctx, options?: { win?: Window }): KitCommandInfo[];
  enabled(id: string, ctx: Ctx): boolean;
  run(id: string, ctx: Ctx, event?: KeyboardEvent): boolean;
  match(event: KeyboardEvent, ctx: Ctx, options?: { scope?: string }): KitCommand<Ctx> | null;
  handle(event: KeyboardEvent, ctx: Ctx, options?: { scope?: string }): boolean;
  menu(ids: string[], ctx: Ctx, options?: { win?: Window }): { id: string; label: string; hint?: string; disabled: boolean; title?: string; onSelect(): void }[];
}
export declare function createCommandRegistry<Ctx = unknown>(options?: { commands?: KitCommand<Ctx>[] }): KitCommandRegistry<Ctx>;
export declare function parseKey(spec: string): KitKey;
export declare function matchKey(event: Pick<KeyboardEvent, "key" | "code" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">, spec: string | KitKey): boolean;
export declare function formatKey(spec: string | KitKey, win?: Window): string;
export declare function isHandled(event: Event): boolean;
export declare function markHandled(event: Event): void;
export declare function keyGuard(event: KeyboardEvent): boolean;
