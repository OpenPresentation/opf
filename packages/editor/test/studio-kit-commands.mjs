import assert from "node:assert/strict";
import { createCommandRegistry, formatKey, isHandled, keyGuard, markHandled, matchKey, parseKey } from "../dist/studio-kit/commands.js";

// CE-18, the studio kit's command registry and keymap, against the kit API only (no layout record): key specs, matching, formatting, the
// typing guard, scopes, `when` with reasons, repeat, rebinding, menus and the list a shortcut sheet or a host palette reads.
const key = (spec, extra = {}) => ({ key: spec, code: "", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, repeat: false, isComposing: false, defaultPrevented: false, target: null, prevented: 0, preventDefault() { this.prevented++; this.defaultPrevented = true; }, ...extra });

// Key specs.
assert.deepEqual(parseKey("Shift-Mod-z"), { key: "z", shift: true, alt: false, mod: true, ctrl: false, meta: false });
assert.deepEqual(parseKey("Mod--"), { key: "-", shift: false, alt: false, mod: true, ctrl: false, meta: false });
assert.deepEqual(parseKey("-"), { key: "-", shift: false, alt: false, mod: false, ctrl: false, meta: false });
assert.deepEqual(parseKey("Cmd-Alt-Enter"), { key: "Enter", shift: false, alt: true, mod: false, ctrl: false, meta: true });
assert.throws(() => parseKey("Hyper-x"), /Unknown modifier/);

// Matching: Shift and Alt exactly, Mod is Cmd or Ctrl, no modifier means neither, letters without case, brackets by physical key.
assert.equal(matchKey(key("z", { metaKey: true }), "Mod-z"), true);
assert.equal(matchKey(key("z", { ctrlKey: true }), "Mod-z"), true, "Ctrl satisfies Mod on every platform");
assert.equal(matchKey(key("Z", { ctrlKey: true, shiftKey: true }), "Mod-z"), false, "Shift must be listed");
assert.equal(matchKey(key("Z", { ctrlKey: true, shiftKey: true }), "Shift-Mod-z"), true);
assert.equal(matchKey(key("z", { ctrlKey: true, altKey: true }), "Mod-z"), false, "Alt must be listed");
assert.equal(matchKey(key("v"), "v"), true);
assert.equal(matchKey(key("V"), "v"), true, "Caps Lock does not matter");
assert.equal(matchKey(key("v", { metaKey: true }), "v"), false, "a plain key refuses Cmd");
assert.equal(matchKey(key("y", { ctrlKey: true }), "Ctrl-y"), true);
assert.equal(matchKey(key("y", { metaKey: true }), "Ctrl-y"), false, "Ctrl means Ctrl");
assert.equal(matchKey(key("{", { code: "BracketLeft", shiftKey: true }), "Shift-["), true, "Shift+[ is { on a US keyboard");
assert.equal(matchKey(key("ü", { code: "BracketLeft" }), "["), true, "the physical key when the layout has no [");
assert.equal(matchKey(key("[", { code: "Digit5", altKey: true, ctrlKey: true }), "["), false, "AltGr is Ctrl+Alt: refused");
assert.equal(matchKey(key("Delete"), "Delete"), true);
assert.equal(matchKey(key("delete"), "Delete"), false, "named keys compare exactly");

// Formatting for a menu or a shortcut sheet.
const mac = { navigator: { platform: "MacIntel" } }, pc = { navigator: { platform: "Win32" } };
assert.equal(formatKey("Mod-d", mac), "⌘D");
assert.equal(formatKey("Mod-d", pc), "Ctrl+D");
assert.equal(formatKey("Shift-Mod-z", mac), "⇧⌘Z");
assert.equal(formatKey("Shift-Mod-z", pc), "Ctrl+Shift+Z");
assert.equal(formatKey("F2", pc), "F2");
assert.equal(formatKey("Escape", pc), "Esc");

// The guard: not twice, not prevented, not in a field, not while composing.
assert.equal(keyGuard(key("v")), true);
const handled = key("v");
markHandled(handled);
assert.equal(isHandled(handled), true);
assert.equal(keyGuard(handled), false);
assert.equal(keyGuard(key("v", { defaultPrevented: true })), false);
assert.equal(keyGuard(key("v", { isComposing: true })), false);
assert.equal(keyGuard(key("v", { target: { nodeType: 1, tagName: "INPUT", type: "text" } })), false, "typing in a text field");
assert.equal(keyGuard(key("v", { target: { nodeType: 1, tagName: "INPUT", type: "checkbox" } })), true, "a checkbox is not typing");
assert.equal(keyGuard(key("v", { target: { nodeType: 1, tagName: "DIV", isContentEditable: true } })), false);

// A registry over a toy document: a counter and a selection.
const runs = [];
const registry = createCommandRegistry({
  commands: [
    { id: "doc.undo", label: "Undo", group: "Edit", keys: ["Mod-z"], run: () => runs.push("undo") },
    { id: "doc.tool.hand", label: "Hand", keys: ["h"], repeat: false, run: () => runs.push("hand") },
    { id: "doc.delete", label: "Delete", scope: "selection", keys: ["Delete", "Backspace"], hint: "⌫", when: (ctx) => (ctx.selected.length ? true : "Select something to delete."), run: (ctx) => { runs.push(`delete ${ctx.selected.join(",")}`); } },
    { id: "doc.group", label: "Group", scope: "selection", keys: ["Mod-g"], when: (ctx) => ctx.selected.length > 1, run: () => { runs.push("group"); return false; } },
  ],
});
assert.throws(() => registry.register({ id: "doc.undo", label: "Again", run() {} }), /already registered/);
assert.throws(() => registry.register({ label: "No id", run() {} }), /needs an id/);

// handle: scope, guard, when, repeat; a handled event is prevented and marked.
const ctx = { selected: ["a", "b"] };
const undo = key("z", { metaKey: true });
assert.equal(registry.handle(undo, ctx), true);
assert.equal(undo.prevented, 1);
assert.equal(isHandled(undo), true);
assert.equal(registry.handle(undo, ctx), false, "a handled event is left alone");
assert.equal(registry.handle(key("Delete"), ctx), false, "a selection command does not run in the global scope");
assert.equal(registry.handle(key("Delete"), ctx, { scope: "selection" }), true);
assert.equal(registry.handle(key("Delete"), { selected: [] }, { scope: "selection" }), false, "a disabled command leaves the key to others");
assert.equal(registry.handle(key("h", { repeat: true }), ctx), false, "a held key does not repeat a tool");
assert.equal(registry.handle(key("h"), ctx), true);
assert.equal(registry.handle(key("h", { target: { nodeType: 1, tagName: "TEXTAREA" } }), ctx), false, "not while typing");
assert.deepEqual(runs, ["undo", "delete a,b", "hand"]);

// run: by id, with `when`; the result of `run` (true when it returns nothing).
runs.length = 0;
assert.equal(registry.run("doc.delete", ctx), true);
assert.equal(registry.run("doc.delete", { selected: [] }), false);
assert.equal(registry.run("doc.group", ctx), false, "run reports what the command returned");
assert.equal(registry.run("nope", ctx), false);
assert.equal(registry.enabled("doc.group", { selected: ["a"] }), false);
assert.deepEqual(runs, ["delete a,b", "group"]);

// list: what a shortcut sheet or a host palette shows, with the reason a command is disabled.
const listed = registry.list({ selected: [] }, { win: pc });
assert.deepEqual(listed.map((entry) => [entry.id, entry.shortcut, entry.enabled, entry.reason]), [
  ["doc.undo", "Ctrl+Z", true, ""],
  ["doc.tool.hand", "H", true, ""],
  ["doc.delete", "⌫", false, "Select something to delete."],
  ["doc.group", "Ctrl+G", false, ""],
]);

// menu: items for openMenu in the order asked, disabled from `when`, choosing runs the command for the ctx it was built with.
runs.length = 0;
const items = registry.menu(["doc.group", "missing", "doc.delete"], { selected: ["x"] }, { win: mac });
assert.deepEqual(items.map((item) => [item.label, item.hint, item.disabled]), [["Group", "⌘G", true], ["Delete", "⌫", false]]);
items[1].onSelect();
assert.deepEqual(runs, ["delete x"]);

// setKeymap: a host rebinds a command or unbinds it.
registry.setKeymap({ "doc.tool.hand": ["Shift-h"], "doc.undo": null });
assert.equal(registry.handle(key("h"), ctx), false);
assert.equal(registry.handle(key("H", { shiftKey: true }), ctx), true);
assert.equal(registry.handle(key("z", { ctrlKey: true }), ctx), false, "an unbound command has no key");
assert.equal(registry.list(ctx, { win: pc }).find((entry) => entry.id === "doc.undo").shortcut, "");

// register returns the function that removes the command.
const remove = registry.register({ id: "doc.extra", label: "Extra", keys: ["x"], run: () => runs.push("extra") });
assert.equal(registry.has("doc.extra"), true);
remove();
assert.equal(registry.has("doc.extra"), false);

console.log("studio kit commands: key specs, matching, formatting, guard, scopes, when, repeat, keymap, menus and list passed");
