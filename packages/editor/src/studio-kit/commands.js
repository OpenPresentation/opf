// CE-18, the studio kit: the command registry and keymap. A command is `{ id, label, group, scope, keys, hint, repeat, when, run }`; the
// keyboard, the context menu, the bar's disabled states, the shortcut sheet and a host palette all read one registry, so they cannot drift.
// Keys are CodeMirror-style strings ("Mod-z", "Shift-Mod-z", "Ctrl-y", "[", "Shift-[", "Delete", "F2"). No DOM beyond the event it is given.
import { isMac, isTypingTarget } from "./dom.js";

const HANDLED = "opfStudioHandled";
/** Whether an earlier handler already acted on this key event. */
export const isHandled = (event) => Boolean(event?.[HANDLED]);
/** Mark a key event as acted on, so the handlers it bubbles to leave it alone. */
export const markHandled = (event) => { event[HANDLED] = true; };
/** Whether a shortcut may act on this event: not handled already, not prevented, not typed into a field, not an IME composition. */
export const keyGuard = (event) => !(isHandled(event) || event.defaultPrevented || isTypingTarget(event.target) || event.isComposing);

// A key can also be matched by its physical position, so a keyboard layout where "[" needs AltGr (or Shift turns it into "{") still has it.
const CODES = { "[": "BracketLeft", "]": "BracketRight" };
const MODIFIERS = new Set(["Shift", "Alt", "Mod", "Ctrl", "Meta", "Cmd"]);

/** Parse "Shift-Mod-z" into `{ key, shift, alt, mod, ctrl, meta }`. A trailing "-" is the minus key ("Mod--"). */
export function parseKey(spec) {
  const text = String(spec);
  if (text === "-") return { key: "-", shift: false, alt: false, mod: false, ctrl: false, meta: false };
  const parts =text.endsWith("-") && text.length > 1 ? [...text.slice(0, -2).split("-").filter(Boolean), "-"] : text.split("-");
  const key = parts.pop();
  const out = { key, shift: false, alt: false, mod: false, ctrl: false, meta: false };
  for (const part of parts) {
    if (!MODIFIERS.has(part)) throw new TypeError(`Unknown modifier ${part} in ${spec}`);
    if (part === "Cmd") out.meta = true; else out[part.toLowerCase()] = true;
  }
  return out;
}

/**
 * Whether a keyboard event matches one key spec. Shift and Alt must be exactly as listed. `Mod` is satisfied by Cmd or Ctrl on every platform
 * (so a Windows keyboard on a Mac works), `Ctrl` by Ctrl and `Meta`/`Cmd` by Cmd; with none of the three listed, neither Cmd nor Ctrl may be
 * down. A one-character key compares without case; "[" and "]" also match their physical key.
 */
export function matchKey(event, spec) {
  const want = typeof spec === "string" ? parseKey(spec) : spec;
  if (Boolean(event.shiftKey) !== want.shift || Boolean(event.altKey) !== want.alt) return false;
  if (want.mod || want.ctrl || want.meta) {
    if (want.mod && !(event.metaKey || event.ctrlKey)) return false;
    if (want.ctrl && !event.ctrlKey) return false;
    if (want.meta && !event.metaKey) return false;
  } else if (event.metaKey || event.ctrlKey) return false;
  const key = event.key ?? "";
  if (want.key.length === 1) return key.toLowerCase() === want.key.toLowerCase() || (CODES[want.key] !== undefined && event.code === CODES[want.key]);
  return key === want.key;
}

const MAC_NAMES = { shift: "⇧", alt: "⌥", ctrl: "⌃", mod: "⌘", meta: "⌘" };
const PC_NAMES = { shift: "Shift+", alt: "Alt+", ctrl: "Ctrl+", mod: "Ctrl+", meta: "Win+" };
const KEY_NAMES = { " ": "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc" };
/** A key spec as people read it: "⌘D" on a Mac, "Ctrl+D" elsewhere. */
export function formatKey(spec, win) {
  const want = typeof spec === "string" ? parseKey(spec) : spec;
  const mac = isMac(win);
  const names = mac ? MAC_NAMES : PC_NAMES;
  const order = mac ? ["ctrl", "alt", "shift", "mod", "meta"] : ["ctrl", "mod", "meta", "alt", "shift"];
  const mods = order.filter((name) => want[name] && !(name === "ctrl" && want.mod)).map((name) => names[name]).join("");
  const key = KEY_NAMES[want.key] ?? (want.key.length === 1 ? want.key.toUpperCase() : want.key);
  return mods + key;
}

/**
 * A command registry. `register(command)` returns the function that removes it. A command has an `id`, a `label`, optional `group`,
 * `scope` (a name or a list of names; `handle` runs only the commands of the scope it is given; default "global"), `keys` (key specs),
 * `hint` (what a menu shows instead of the formatted first key), `repeat` (false: a held key does not repeat it), `when(ctx)` (true, false,
 * or a reason string that disables it) and `run(ctx, event)`.
 */
export function createCommandRegistry({ commands = [] } = {}) {
  const byId = new Map();
  const overrides = new Map();
  const keysOf = (command) => (overrides.has(command.id) ? overrides.get(command.id) : command.keys) ?? [];
  const scopesOf = (command) => [].concat(command.scope ?? "global");
  const state = (command, ctx) => {
    const verdict = command.when ? command.when(ctx) : true;
    return verdict === true ? { enabled: true, reason: "" } : { enabled: false, reason: typeof verdict === "string" ? verdict : "" };
  };

  const registry = {
    register(command) {
      if (!command?.id || typeof command.run !== "function") throw new TypeError("A command needs an id and a run function.");
      if (byId.has(command.id)) throw new Error(`A command ${command.id} is already registered.`);
      const parsed = { ...command };
      byId.set(command.id, parsed);
      return () => { if (byId.get(command.id) === parsed) byId.delete(command.id); };
    },
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    /** Rebind commands: `{ id: keys }` replaces a command's keys, `{ id: null }` unbinds it. */
    setKeymap(map = {}) {
      for (const [id, keys] of Object.entries(map)) overrides.set(id, keys === null ? [] : [].concat(keys));
    },
    /** Every command with its state for `ctx`: `{ id, label, group, keys, shortcut, enabled, reason }`, in registration order. */
    list(ctx, { win } = {}) {
      return [...byId.values()].map((command) => {
        const keys = keysOf(command);
        return { id: command.id, label: command.label, group: command.group, keys: [...keys], shortcut: command.hint ?? (keys[0] ? formatKey(keys[0], win) : ""), ...state(command, ctx) };
      });
    },
    /** Whether `id` may run for `ctx` (`when` returned true). */
    enabled: (id, ctx) => (byId.has(id) ? state(byId.get(id), ctx).enabled : false),
    /** Run `id` for `ctx` when it is enabled. Returns false when it is unknown or disabled, else what `run` returned (true when it returned nothing). */
    run(id, ctx, event) {
      const command = byId.get(id);
      if (!command || !state(command, ctx).enabled) return false;
      const result = command.run(ctx, event);
      return result === undefined ? true : Boolean(result);
    },
    /** The command of `scope` a key event would run: the first whose keys match and whose `when` is true. */
    match(event, ctx, { scope = "global" } = {}) {
      for (const command of byId.values()) {
        if (!scopesOf(command).includes(scope)) continue;
        if (command.repeat === false && event.repeat) continue;
        if (!keysOf(command).some((spec) => matchKey(event, spec))) continue;
        if (state(command, ctx).enabled) return command;
      }
      return null;
    },
    /**
     * Act on a key event: the guard (`keyGuard`), then the matching command of `scope`. The event is prevented and marked handled, and true
     * is returned, whether or not the command changed anything.
     */
    handle(event, ctx, { scope = "global" } = {}) {
      if (!keyGuard(event)) return false;
      const command = registry.match(event, ctx, { scope });
      if (!command) return false;
      event.preventDefault();
      command.run(ctx, event);
      markHandled(event);
      return true;
    },
    /**
     * Menu items for `openMenu` from command ids, in order: `{ id, label, hint, disabled, title, onSelect }`. The state is read when the menu
     * is built; a disabled item cannot be chosen, and choosing an enabled one runs the command for the `ctx` the menu was built with.
     */
    menu(ids, ctx, { win } = {}) {
      return ids.filter((id) => byId.has(id)).map((id) => {
        const command = byId.get(id);
        const keys = keysOf(command);
        const { enabled, reason } = state(command, ctx);
        return { id, label: command.label, hint: command.hint ?? (keys[0] ? formatKey(keys[0], win) : undefined), disabled: !enabled, title: reason || undefined, onSelect: () => command.run(ctx) };
      });
    },
  };
  for (const command of commands) registry.register(command);
  return registry;
}
