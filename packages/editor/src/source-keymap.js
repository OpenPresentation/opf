// The one table of key bindings of the source editor (artifacts/source-editor/SPEC.md, sections 8.6 and 11). Every binding the editor installs is
// declared here with its keys per platform, a title and a group; the editor installs the keys it reads from this table (`bind`, `bindDom`), and
// `getShortcuts()` and the shortcuts dialog list what was installed, so the list cannot drift from the keymap. The key names are CodeMirror's
// (`Mod-Shift-o`, `Alt-F12`; `Mod` is Cmd on macOS and Ctrl elsewhere; a space separates the strokes of a chord: `Mod-k Mod-0`).
//
// A binding object is CodeMirror's own shape: `key` for every platform, and `mac`, `win` or `linux` where it differs.
import {
  addCursorAbove, addCursorBelow, copyLineDown, copyLineUp, cursorCharLeft, cursorCharRight, cursorDocEnd, cursorDocStart, cursorGroupLeft, cursorGroupRight,
  cursorLineBoundaryBackward, cursorLineBoundaryForward, cursorLineBoundaryLeft, cursorLineBoundaryRight, cursorLineDown, cursorLineEnd, cursorLineStart,
  cursorLineUp, cursorMatchingBracket, cursorPageDown, cursorPageUp, cursorSyntaxLeft, cursorSyntaxRight, deleteCharBackward, deleteCharForward, deleteGroupBackward,
  deleteGroupForward, deleteLine, deleteLineBoundaryBackward, deleteLineBoundaryForward, deleteToLineEnd, indentLess, indentMore, indentSelection, insertBlankLine,
  moveLineDown, moveLineUp, redo, redoSelection, selectAll, selectLine, selectParentSyntax, simplifySelection, splitLine, toggleBlockComment, toggleTabFocusMode,
  insertNewlineAndIndent, transposeChars, undo, undoSelection, toggleComment,
} from "@codemirror/commands";
import { closeBracketsKeymap, closeCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { closeSearchPanel } from "@codemirror/search";
import { findNext, findPrevious, gotoLine, openSearchPanel, selectNextOccurrence, selectSelectionMatches } from "@codemirror/search";

// ---- groups ---------------------------------------------------------------------------------------------------------------------------
export const GROUPS = Object.freeze([
  "Suggestions", "Problems and fixes", "Hover and hints", "Go to", "Folding", "Lines", "Selection and cursors", "Find", "Format", "Undo and redo", "Editing", "Focus", "Help", "Cursor movement",
]);

// ---- the table ------------------------------------------------------------------------------------------------------------------------
// id: the name the command is bound under; title and group: what the shortcuts list shows; keys: bindings; `when`: what has to be true (shown as a
// note); `dom`: read from the keydown event (chords and keys whose character depends on the modifiers) instead of CodeMirror's keymap.
const entry = (id, title, group, keys, extra = {}) => Object.freeze({ id, title, group, keys: Object.freeze(keys), ...extra });
const FOLD_LEVELS = [1, 2, 3, 4, 5, 6, 7];

export const TABLE = Object.freeze([
  // Suggestions (the list is CodeMirror's autocomplete)
  entry("suggest.trigger", "Trigger suggestions", "Suggestions", [{ key: "Ctrl-Space" }, { mac: "Mod-i" }]),
  entry("suggest.details", "Show or hide the details of the selected suggestion", "Suggestions", [{ key: "Ctrl-Space" }], { when: "the list is open", installedWith: "suggest.trigger" }),
  entry("suggest.accept", "Accept the selected suggestion", "Suggestions", [{ key: "Tab" }, { key: "Enter" }], { when: "the list is open" }),
  entry("suggest.acceptReplace", "Accept and replace the whole word", "Suggestions", [{ key: "Shift-Tab" }, { key: "Shift-Enter" }], { when: "the list is open" }),
  entry("suggest.dismiss", "Close the list", "Suggestions", [{ key: "Escape" }], { when: "the list is open" }),
  entry("suggest.next", "Select the next suggestion", "Suggestions", [{ key: "ArrowDown" }, { mac: "Ctrl-n" }], { when: "the list is open" }),
  entry("suggest.previous", "Select the previous suggestion", "Suggestions", [{ key: "ArrowUp" }, { mac: "Ctrl-p" }], { when: "the list is open" }),
  entry("suggest.nextPage", "Select the suggestion a page down", "Suggestions", [{ key: "PageDown" }], { when: "the list is open" }),
  entry("suggest.previousPage", "Select the suggestion a page up", "Suggestions", [{ key: "PageUp" }], { when: "the list is open" }),
  entry("snippet.next", "Next tab stop of a snippet", "Suggestions", [{ key: "Tab" }], { when: "a snippet is being filled", installedWith: "suggest.accept" }),
  entry("snippet.previous", "Previous tab stop of a snippet", "Suggestions", [{ key: "Shift-Tab" }], { when: "a snippet is being filled", installedWith: "suggest.acceptReplace" }),
  // Problems
  entry("problem.next", "Go to the next problem", "Problems and fixes", [{ key: "F8" }]),
  entry("problem.previous", "Go to the previous problem", "Problems and fixes", [{ key: "Shift-F8" }]),
  entry("problem.quickFix", "Quick fix", "Problems and fixes", [{ key: "Mod-." }]),
  entry("problem.panel", "Move focus to the problems panel", "Problems and fixes", [{ key: "Mod-Shift-m" }], { dom: true }),
  // Hover and hints
  entry("hover.show", "Show the hover at the caret", "Hover and hints", [{ key: "Mod-k Mod-i" }], { dom: true }),
  entry("hint.shape", "Show the shape of the slide (parameter hints)", "Hover and hints", [{ key: "Mod-Shift-Space" }]),
  // Go to
  entry("nav.definition", "Go to definition", "Go to", [{ key: "F12" }, { key: "Mod-Click" }], { clickOnly: ["Mod-Click"] }),
  entry("nav.peek", "Peek definition", "Go to", [{ key: "Alt-F12" }]),
  entry("nav.references", "Find references", "Go to", [{ key: "Shift-F12" }]),
  entry("nav.rename", "Rename symbol", "Go to", [{ key: "F2" }]),
  entry("nav.symbol", "Go to symbol in the document (outline)", "Go to", [{ key: "Mod-Shift-o" }], { dom: true }),
  entry("nav.line", "Go to line", "Go to", [{ key: "Ctrl-g" }, { key: "Mod-Alt-g" }]),
  entry("nav.bracket", "Jump to the matching bracket", "Go to", [{ key: "Mod-Shift-\\" }]),
  // Folding
  entry("fold.fold", "Fold", "Folding", [{ key: "Ctrl-Shift-[", mac: "Cmd-Alt-[" }]),
  entry("fold.unfold", "Unfold", "Folding", [{ key: "Ctrl-Shift-]", mac: "Cmd-Alt-]" }]),
  entry("fold.toggle", "Toggle fold", "Folding", [{ key: "Mod-k Mod-l" }], { dom: true }),
  entry("fold.foldRecursively", "Fold recursively", "Folding", [{ key: "Mod-k Mod-[" }], { dom: true }),
  entry("fold.unfoldRecursively", "Unfold recursively", "Folding", [{ key: "Mod-k Mod-]" }], { dom: true }),
  entry("fold.all", "Fold all", "Folding", [{ key: "Mod-k Mod-0" }], { dom: true }),
  entry("fold.unfoldAll", "Unfold all", "Folding", [{ key: "Mod-k Mod-j" }], { dom: true }),
  ...FOLD_LEVELS.map((level) => entry(`fold.level${level}`, `Fold level ${level}`, "Folding", [{ key: `Mod-k Mod-${level}` }], { dom: true })),
  // Lines
  entry("lines.moveUp", "Move line up", "Lines", [{ key: "Alt-ArrowUp" }]),
  entry("lines.moveDown", "Move line down", "Lines", [{ key: "Alt-ArrowDown" }]),
  entry("lines.copyUp", "Copy line up", "Lines", [{ key: "Shift-Alt-ArrowUp" }]),
  entry("lines.copyDown", "Copy line down", "Lines", [{ key: "Shift-Alt-ArrowDown" }]),
  entry("lines.delete", "Delete line", "Lines", [{ key: "Mod-Shift-k" }]),
  entry("lines.insertBelow", "Insert line below", "Lines", [{ key: "Mod-Enter" }]),
  entry("lines.insertAbove", "Insert line above", "Lines", [{ key: "Mod-Shift-Enter" }]),
  entry("lines.indent", "Indent line", "Lines", [{ key: "Mod-]" }]),
  entry("lines.outdent", "Outdent line", "Lines", [{ key: "Mod-[" }]),
  entry("lines.comment", "Toggle line comment", "Lines", [{ key: "Mod-/" }]),
  entry("lines.blockComment", "Toggle block comment", "Lines", [{ key: "Shift-Alt-a" }]),
  entry("lines.join", "Join lines", "Lines", [{ mac: "Ctrl-j" }]),
  entry("lines.deleteToEnd", "Delete to the end of the line", "Lines", [{ mac: "Ctrl-k" }]),
  entry("lines.split", "Split the line at the caret", "Lines", [{ mac: "Ctrl-o" }]),
  entry("lines.transpose", "Transpose the characters around the caret", "Lines", [{ mac: "Ctrl-t" }]),
  // Selection and cursors
  entry("select.all", "Select all", "Selection and cursors", [{ key: "Mod-a" }]),
  entry("select.line", "Expand the line selection", "Selection and cursors", [{ key: "Mod-l" }, { mac: "Ctrl-l" }], { dom: true }),
  entry("select.expand", "Expand selection", "Selection and cursors", [{ key: "Shift-Alt-ArrowRight", mac: "Ctrl-Shift-Cmd-ArrowRight" }]),
  entry("select.shrink", "Shrink selection", "Selection and cursors", [{ key: "Shift-Alt-ArrowLeft", mac: "Ctrl-Shift-Cmd-ArrowLeft" }]),
  entry("select.nextOccurrence", "Add the next occurrence to the selection", "Selection and cursors", [{ key: "Mod-d" }]),
  entry("select.allOccurrences", "Select all occurrences of the selection", "Selection and cursors", [{ key: "Mod-Shift-l" }]),
  entry("cursor.above", "Add a cursor above", "Selection and cursors", [{ key: "Mod-Alt-ArrowUp" }]),
  entry("cursor.below", "Add a cursor below", "Selection and cursors", [{ key: "Mod-Alt-ArrowDown" }]),
  entry("cursor.click", "Add a cursor", "Selection and cursors", [{ key: "Alt-Click" }], { clickOnly: ["Alt-Click"] }),
  entry("cursor.column", "Select a column", "Selection and cursors", [{ key: "Shift-Alt-Drag" }], { clickOnly: ["Shift-Alt-Drag"] }),
  entry("cursor.collapse", "Collapse to one cursor", "Selection and cursors", [{ key: "Escape" }], { when: "there are several cursors" }),
  entry("select.undo", "Undo the last cursor movement", "Selection and cursors", [{ key: "Mod-u" }]),
  entry("select.redo", "Redo the last cursor movement", "Selection and cursors", [{ key: "Alt-u", mac: "Mod-Shift-u" }]),
  // Find
  entry("find.open", "Find", "Find", [{ key: "Mod-f" }]),
  entry("find.replace", "Replace", "Find", [{ mac: "Mod-Alt-f" }, { win: "Mod-h", linux: "Mod-h" }]),
  entry("find.next", "Find next", "Find", [{ key: "F3", mac: "Mod-g" }], { when: "the find panel is open or the editor has focus" }),
  entry("find.previous", "Find previous", "Find", [{ key: "Shift-F3", mac: "Mod-Shift-g" }]),
  entry("find.close", "Close the find panel", "Find", [{ key: "Escape" }], { when: "the find panel is open" }),
  // Format
  entry("format.document", "Format the document", "Format", [{ key: "Alt-Shift-f" }, { key: "Mod-Shift-f" }], { dom: true }),
  // Undo and redo
  entry("edit.undo", "Undo", "Undo and redo", [{ key: "Mod-z" }]),
  entry("edit.redo", "Redo", "Undo and redo", [{ key: "Mod-Shift-z" }, { win: "Mod-y", linux: "Mod-y" }], { dom: true }),
  // Editing
  entry("edit.enter", "New line (continues a list, keeps the indentation)", "Editing", [{ key: "Enter" }]),
  entry("edit.tab", "Indent (Tab inserts whitespace)", "Editing", [{ key: "Tab" }], { when: "no list is open" }),
  entry("edit.shiftTab", "Outdent", "Editing", [{ key: "Shift-Tab" }], { when: "no list is open" }),
  entry("edit.fieldMenu", "Open the options of the field under the caret (dialog)", "Editing", [{ key: "Alt-Shift-o" }], { dom: true }),
  // Focus
  entry("focus.toggleTab", "Toggle Tab moves focus", "Focus", [{ key: "Ctrl-m", mac: "Ctrl-Shift-m" }]),
  entry("focus.escapeTab", "Leave the editor", "Focus", [{ key: "Escape Tab" }], { documentedOnly: true }),
  // Help
  entry("help.shortcuts", "Show the keyboard shortcuts", "Help", [{ key: "Mod-k Mod-s" }, { key: "F1" }], { dom: true }),
]);

const BY_ID = new Map(TABLE.map((item) => [item.id, item]));
export const shortcutEntry = (id) => BY_ID.get(id);

// ---- the commands CodeMirror binds, with the titles the list shows ----------------------------------------------------------------------
// Keyed by the command function, so the title does not depend on how a bundler renames functions. A binding whose command is not here is a bug
// the test finds (`unlisted`): nothing is installed without a place in the list.
const BASIC = new Map();
const basic = (command, id, title, group) => { if (command) BASIC.set(command, { id, title, group }); };
basic(moveLineUp, "lines.moveUp"); basic(moveLineDown, "lines.moveDown"); basic(copyLineUp, "lines.copyUp"); basic(copyLineDown, "lines.copyDown");
basic(deleteLine, "lines.delete"); basic(insertBlankLine, "lines.insertBelow"); basic(indentMore, "lines.indent"); basic(indentLess, "lines.outdent");
basic(toggleBlockComment, "lines.blockComment"); basic(deleteToLineEnd, "lines.deleteToEnd"); basic(splitLine, "lines.split"); basic(transposeChars, "lines.transpose");
basic(selectAll, "select.all"); basic(selectLine, "select.line"); basic(selectNextOccurrence, "select.nextOccurrence"); basic(selectSelectionMatches, "select.allOccurrences");
basic(addCursorAbove, "cursor.above"); basic(addCursorBelow, "cursor.below"); basic(simplifySelection, "cursor.collapse");
basic(undoSelection, "select.undo"); basic(redoSelection, "select.redo"); basic(undo, "edit.undo"); basic(redo, "edit.redo");
basic(cursorMatchingBracket, "nav.bracket"); basic(gotoLine, "nav.line"); basic(openSearchPanel, "find.open"); basic(findNext, "find.next"); basic(findPrevious, "find.previous");
basic(toggleTabFocusMode, "focus.toggleTab"); basic(closeSearchPanel, "find.close"); basic(closeCompletion, "suggest.dismiss"); basic(toggleComment, "lines.comment");
basic(indentSelection, "edit.indentSelection", "Auto-indent the selection", "Editing");
basic(selectParentSyntax, "select.expand"); basic(insertNewlineAndIndent, "edit.enter");
const MOVES = [
  [cursorCharLeft, "left", "Move left"], [cursorCharRight, "right", "Move right"], [cursorLineUp, "up", "Move up"], [cursorLineDown, "down", "Move down"],
  [cursorGroupLeft, "wordLeft", "Move a word left"], [cursorGroupRight, "wordRight", "Move a word right"],
  [cursorSyntaxLeft, "syntaxLeft", "Move to the previous syntax boundary"], [cursorSyntaxRight, "syntaxRight", "Move to the next syntax boundary"],
  [cursorLineBoundaryBackward, "lineStart", "Go to the start of the line"], [cursorLineBoundaryForward, "lineEnd", "Go to the end of the line"],
  [cursorLineBoundaryLeft, "lineLeft", "Go to the left edge of the line"], [cursorLineBoundaryRight, "lineRight", "Go to the right edge of the line"],
  [cursorLineStart, "lineStartLogical", "Go to the start of the line"], [cursorLineEnd, "lineEndLogical", "Go to the end of the line"],
  [cursorDocStart, "docStart", "Go to the start of the document"], [cursorDocEnd, "docEnd", "Go to the end of the document"], [cursorPageUp, "pageUp", "Page up"], [cursorPageDown, "pageDown", "Page down"],
  [deleteCharBackward, "deleteBack", "Delete the character before the caret"], [deleteCharForward, "deleteForward", "Delete the character after the caret"],
  [deleteGroupBackward, "deleteWordBack", "Delete the word before the caret"], [deleteGroupForward, "deleteWordForward", "Delete the word after the caret"],
  [deleteLineBoundaryBackward, "deleteToStart", "Delete to the start of the line"], [deleteLineBoundaryForward, "deleteToEnd", "Delete to the end of the line"],
];
for (const [command, id, title] of MOVES) basic(command, `move.${id}`, title, "Cursor movement");

// ---- strokes ---------------------------------------------------------------------------------------------------------------------------
/** The platform CodeMirror uses for `navigator.platform`: "mac", "win" or "linux" (anything else is "linux"). */
export function platformOf(navigatorPlatform = typeof navigator === "undefined" ? "" : navigator.platform) {
  return /Mac|iPhone|iPad/.test(navigatorPlatform) ? "mac" : /Win/.test(navigatorPlatform) ? "win" : "linux";
}

/** The stroke(s) of a binding on `platform`, as CodeMirror reads them (`binding[platform] || binding.key`), or undefined. */
export const strokeOf = (binding, platform) => binding[platform] || binding.key;

const SYMBOLS = { Mod: "⌘", Cmd: "⌘", Meta: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" };
const KEY_WORDS = { ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Escape: "Esc", " ": "Space" };
const KEY_SYMBOLS = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "⎋", Enter: "↩", Tab: "⇥", Backspace: "⌫", Delete: "⌦", Space: "␣" };

/** Split one stroke (`Mod-Shift-o`, `Mod-Alt--`) into its modifiers and key. */
export function parseStroke(stroke, platform) {
  const parts = stroke.split(/-(?!$)/);
  let key = parts.pop();
  if (key === "Space") key = " ";
  const mods = { ctrl: false, meta: false, alt: false, shift: false };
  for (const part of parts) {
    if (part === "Mod") mods[platform === "mac" ? "meta" : "ctrl"] = true;
    else if (part === "Ctrl" || part === "Control") mods.ctrl = true;
    else if (part === "Cmd" || part === "Meta") mods.meta = true;
    else if (part === "Alt") mods.alt = true;
    else if (part === "Shift") mods.shift = true;
    else throw new Error(`Unknown modifier ${part} in key ${stroke}`);
  }
  // An upper-case letter in a CodeMirror key name means Shift is held (`Alt-A` is Shift+Alt+A).
  if (key.length === 1 && key !== key.toLowerCase()) mods.shift = true;
  return { ...mods, key: key.length === 1 ? key.toLowerCase() : key };
}

/** A stroke as words for a person: `Cmd+Shift+O` on macOS, `Ctrl+Shift+O` elsewhere (`symbols`: `⌘⇧O`). */
export function strokeText(stroke, platform, { symbols = false } = {}) {
  return stroke.split(" ").map((one) => {
    const parsed = parseStroke(one, platform);
    const key = parsed.key === " " ? "Space" : parsed.key.length === 1 ? parsed.key.toUpperCase() : KEY_WORDS[parsed.key] ?? parsed.key;
    if (symbols) {
      const letters = [parsed.ctrl && "Ctrl", parsed.alt && "Alt", parsed.shift && "Shift", parsed.meta && "Cmd"].filter(Boolean).map((name) => SYMBOLS[name]).join("");
      return `${letters}${KEY_SYMBOLS[parsed.key === " " ? "Space" : parsed.key] ?? key}`;
    }
    const words = [parsed.ctrl && "Ctrl", parsed.alt && "Alt", parsed.shift && "Shift", parsed.meta && (platform === "mac" ? "Cmd" : "Win")].filter(Boolean);
    return [...words, key].join("+");
  }).join(" ");
}

// ---- reading key events (the DOM handler) ---------------------------------------------------------------------------------------------
const CODES = { "[": "BracketLeft", "]": "BracketRight", "\\": "Backslash", "/": "Slash", ".": "Period", ",": "Comma", "-": "Minus", "=": "Equal", " ": "Space" };
const codeOf = (key) => (/^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : CODES[key]);

/**
 * Whether a keydown `event` is the stroke `want` (from `parseStroke`). The modifiers must be exactly those; the key is read as the character it types
 * (a lowercase one even with Shift held, as some platforms report it) and, where Alt changes the character (macOS), by its physical key.
 */
export function eventMatches(event, want) {
  if (event.ctrlKey !== want.ctrl || event.metaKey !== want.meta || event.altKey !== want.alt || event.shiftKey !== want.shift) return false;
  if (want.key.length > 1 && want.key !== " ") return event.key === want.key;
  if (event.key.toLowerCase() === want.key) return true;
  return (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) && event.code === codeOf(want.key);
}

// ---- the builder ------------------------------------------------------------------------------------------------------------------------
/**
 * The bindings of one editor. `bind(id, run)` returns CodeMirror bindings for the keys the table gives `id` (and records that they are installed);
 * `bindDom(id, run)` records a command read from the keydown event; `spread(list)` records a list of CodeMirror's own bindings, with the titles above.
 * `shortcuts(platform)` is what the editor installed, for the list. `platform` is the one CodeMirror reads from `navigator.platform` unless given.
 */
export function createKeymap({ platform = platformOf() } = {}) {
  const installed = new Map();       // id -> { entry, bindings: [binding], extra: [binding] }
  const dom = [];                    // { id, run, strokes: [[parsed per chord stroke]] }
  const unlisted = [];
  const rowFor = (id, titleInfo) => {
    let row = installed.get(id);
    if (!row) {
      const item = BY_ID.get(id);
      row = { id, title: item?.title ?? titleInfo?.title ?? id, group: item?.group ?? titleInfo?.group ?? "Editing", when: item?.when, bindings: [], clicks: item?.clickOnly ? item.keys.filter((k) => item.clickOnly.includes(k.key)) : [] };
      installed.set(id, row);
    }
    return row;
  };
  const bindingsOf = (item) => item.keys.filter((binding) => !(item.clickOnly ?? []).includes(binding.key));
  return {
    platform,
    /** CodeMirror bindings for the keys of `id`, running `run`. `shift` gives the command of the same keys with Shift held. */
    bind(id, run, extra = {}) {
      const item = BY_ID.get(id);
      if (!item) throw new Error(`No key binding named ${id}`);
      if (item.dom) throw new Error(`${id} is read from the keydown event: use bindDom`);
      const row = rowFor(id);
      const own = bindingsOf(item);
      row.bindings.push(...own);
      // `run` may be one command or one per binding of the table entry, in its order.
      return own.map((binding, index) => ({ ...binding, run: Array.isArray(run) ? run[index] : run, ...extra }));
    },
    /** Record that `id`'s keys are handled elsewhere in the editor (an alias of a command registered under another id, a menu's own keys). */
    note(id) {
      const item = BY_ID.get(id);
      if (!item) throw new Error(`No key binding named ${id}`);
      const row = rowFor(id);
      row.bindings.push(...bindingsOf(item));
    },
    /** A command read from the keydown event: `run(view, event)` returns true when it handled the key. */
    bindDom(id, run) {
      const item = BY_ID.get(id);
      if (!item?.dom) throw new Error(`${id} is not a keydown binding`);
      const row = rowFor(id);
      row.bindings.push(...item.keys);
      const strokes = [];
      for (const binding of item.keys) {
        const stroke = strokeOf(binding, platform);
        if (stroke) strokes.push(stroke.split(" ").map((one) => parseStroke(one, platform)));
      }
      dom.push({ id, run, strokes });
    },
    /** Record CodeMirror's own bindings and return them unchanged (those whose command has a title in the list). */
    spread(list) {
      for (const binding of list) {
        for (const command of [binding.run, binding.shift]) {
          if (!command) continue;
          const info = BASIC.get(command);
          // A Shift variant that has no title is the same command extending the selection: not a row of its own.
          if (!info) { if (command === binding.run) unlisted.push(strokeOf(binding, platform) ?? binding.key ?? binding.mac ?? binding.linux ?? binding.win); continue; }
          const row = rowFor(info.id, info);
          if (command === binding.shift && command === binding.run) continue;
          if (command === binding.shift) row.bindings.push({ ...binding, key: binding.key && `Shift-${binding.key}`, mac: binding.mac && `Shift-${binding.mac}`, win: binding.win && `Shift-${binding.win}`, linux: binding.linux && `Shift-${binding.linux}` });
          else row.bindings.push(binding);
        }
      }
      return list;
    },
    /** Bindings the editor handles itself and does not list (single characters it skips over, Backspace in a Markdown list, the menu's own keys). */
    hidden: (list) => list,
    dom,
    /** Bindings recorded without a title (a bug: every installed binding has a place in the list). */
    unlisted: () => [...unlisted],
    /** `{ id, title, group, keys, symbols, when }` for every installed binding that has keys on `platform` (default: this editor's). */
    shortcuts(on = platform) {
      const rows = [];
      for (const row of installed.values()) {
        const keys = [];
        for (const binding of row.bindings) {
          const stroke = strokeOf(binding, on);
          if (stroke && !keys.includes(stroke)) keys.push(stroke);
        }
        for (const click of row.clicks) if (!keys.includes(click.key)) keys.push(click.key);
        if (!keys.length) continue;
        const shown = (stroke) => (/Click|Drag$/.test(stroke) ? stroke.replace(/^Mod/, on === "mac" ? "Cmd" : "Ctrl").replaceAll("-", "+") : strokeText(stroke, on));
        const symbol = (stroke) => (/Click|Drag$/.test(stroke) ? stroke.replace(/^Mod/, on === "mac" ? "Cmd" : "Ctrl").replaceAll("-", "+") : strokeText(stroke, on, { symbols: on === "mac" }));
        rows.push({ id: row.id, title: row.title, group: row.group, keys: keys.map(shown), symbols: keys.map(symbol), strokes: keys, ...(row.when ? { when: row.when } : {}) });
      }
      const order = (row) => GROUPS.indexOf(row.group);
      return rows.sort((a, b) => order(a) - order(b) || tableIndex(a.id) - tableIndex(b.id));
    },
  };
}

const TABLE_INDEX = new Map(TABLE.map((item, index) => [item.id, index]));
const tableIndex = (id) => TABLE_INDEX.get(id) ?? 10000 + [...BASIC.values()].findIndex((info) => info.id === id);

/** `list` without the bindings of `drop` (a function of the binding) and with `add` after them. */
export const without = (list, drop) => list.filter((binding) => !drop(binding));

/** CodeMirror's close-brackets bindings (Backspace removes a pair), kept as they are. */
export const CLOSE_BRACKETS = closeBracketsKeymap;

// ---- the keydown handler --------------------------------------------------------------------------------------------------------------
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);
const CHORD_TIMEOUT = 4000;
const signature = (stroke) => `${stroke.ctrl ? "c" : ""}${stroke.meta ? "m" : ""}${stroke.alt ? "a" : ""}${stroke.shift ? "s" : ""}:${stroke.key}`;

/**
 * The handler for the bindings `km.bindDom` recorded. A binding of one stroke runs when the event is that stroke exactly; a chord (`Mod-k Mod-i`) waits for
 * its second stroke for four seconds, and a key that is not the second stroke of any chord is handled as if the first had not been pressed. `run(view, event)`
 * returns false to leave the key alone. The first stroke of a chord is taken, so Cmd/Ctrl+K alone does nothing else; Cmd/Ctrl+Shift+K (Delete line) is another stroke.
 */
export function domKeymap(km, say) {
  let pending = null;
  const chords = km.dom.flatMap((command) => command.strokes.filter((strokes) => strokes.length === 2).map((strokes) => ({ command, first: strokes[0], second: strokes[1], sig: signature(strokes[0]) })));
  return EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.isComposing || MODIFIER_KEYS.has(event.key)) return false;
      if (pending) {
        const waiting = pending;
        pending = null;
        if (Date.now() - waiting.at < CHORD_TIMEOUT) {
          const hit = chords.find((chord) => chord.sig === waiting.sig && eventMatches(event, chord.second));
          if (hit) {
            event.preventDefault();
            if (hit.command.run(view, event) === false) return false;
            return true;
          }
        }
      }
      for (const command of km.dom) {
        for (const strokes of command.strokes) {
          if (strokes.length === 1 && eventMatches(event, strokes[0])) {
            if (command.run(view, event) === false) continue;
            event.preventDefault();
            return true;
          }
        }
      }
      const first = chords.find((chord) => eventMatches(event, chord.first));
      if (first) {
        pending = { sig: first.sig, at: Date.now() };
        event.preventDefault();
        say?.("Chord started, waiting for the second key");
        return true;
      }
      return false;
    },
  });
}
