// Phase 4 cases of the source editor keyboard plan (artifacts/source-editor/TEST-PLAN.md sections 4.8 and 7): the fold gutter and the chords, the line and
// selection keys of the shortcuts table, go to line and replace, and the shortcuts list. Row format: [id, requirement, title, format, doc, steps, expect,
// options?]; see support/source-keyboard.mjs.
import { K, M, MS, platform } from '../source-keyboard.mjs';

const FOLD = platform === 'darwin' ? 'Meta+Alt+[' : 'Control+Shift+BracketLeft';
const UNFOLD = platform === 'darwin' ? 'Meta+Alt+]' : 'Control+Shift+BracketRight';
const EXPAND = platform === 'darwin' ? 'Control+Meta+Shift+ArrowRight' : 'Alt+Shift+ArrowRight';
const SHRINK = platform === 'darwin' ? 'Control+Meta+Shift+ArrowLeft' : 'Alt+Shift+ArrowLeft';
const CH = (second) => ['chord', 'Mod+k', `Mod+${second}`];

const DECK = '{\n  "name": "Q3 Review",\n  "slides": [\n    {\n      "title": "Q3 Review"\n    },\n    {\n      "title": "Highlights",\n      "items": [\n        "Revenue up 12%",\n        "Churn down"\n      ]\n    }\n  ]\n}';
const DECK_YAML = 'name: Q3 Review\nslides:\n  - title: Q3 Review\n  - title: Highlights\n    items:\n      - Revenue up 12%\n      - Churn down\n';
const DECK_MD = '---\nname: Q3 Review\n---\n\n# Q3 Review\n\n---\n\n# Highlights\n\n- Revenue up 12%\n- Churn down\n\n```js\nx\ny\n```\n';
const at = (doc, needle, shift = 0) => doc.replace(needle, needle.slice(0, shift) + '|' + needle.slice(shift));

export const keymapCases = [
  // ---- fold gutter and commands (R-KEY-11) --------------------------------------------------------------------------------------------
  ['J-FOLD-001', 'R-KEY-11', 'the fold gutter is there', 'json', DECK, [], { gutter: '.cm-foldGutter' }],
  ['J-FOLD-002', 'R-KEY-11', 'Fold folds the innermost range around the caret, from any line inside it; Unfold opens it', 'json', at(DECK, '"title": "Q3 Review"\n', 12), [['press', FOLD], ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', 0]], {}],
  ['J-FOLD-003', 'R-KEY-11', 'Fold folds the next range out when the inner one is folded already', 'json', at(DECK, '"title": "Q3 Review"\n', 12), [['press', FOLD], ['press', FOLD], ['expectFolded', 1]], {}],
  ['J-FOLD-004', 'R-KEY-11', 'Fold All folds every range (Unfold on the outer one leaves the inner ones folded); Unfold All opens them', 'json', DECK, [CH('0'), ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', 1], CH('j'), ['expectFolded', 0]], {}],
  ['J-FOLD-005', 'R-KEY-11', 'Fold Level 2 folds the slides list only', 'json', '|' + DECK, [CH('2'), ['expectFolded', 1]], {}],
  ['J-FOLD-006', 'R-KEY-11', 'Fold Level 3 folds each slide', 'json', '|' + DECK, [CH('3'), ['expectFolded', 2]], {}],
  ['J-FOLD-007', 'R-KEY-11', 'Fold Level 1 leaves the range around the caret open', 'json', at(DECK, '"name"', 1), [CH('1'), ['expectFolded', 0]], {}],
  ['J-FOLD-008', 'R-KEY-11', 'Toggle Fold folds and unfolds', 'json', at(DECK, '"slides"', 1), [CH('l'), ['expectFolded', 1], CH('l'), ['expectFolded', 0]], {}],
  ['J-FOLD-009', 'R-KEY-11', 'Fold Recursively folds the range and everything inside it (Unfold leaves the inner ones folded); Unfold Recursively opens them all', 'json', at(DECK, '"slides"', 1), [CH('['), ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', 2], CH(']'), ['expectFolded', 0]], {}],
  ['J-FOLD-010', 'R-KEY-11', 'a click on the gutter marker folds', 'json', DECK, [['clickGutter', 0], ['expectFolded', 1]], {}],
  ['J-FOLD-011', 'R-KEY-11', 'the chord does not swallow Delete Line (Mod+Shift+K)', 'json', '{\n  "a": 1|,\n  "b": 2\n}', [['press', 'Mod+k'], MS('k')], { text: '{\n  "b": 2|\n}' }],
  ['J-FOLD-012', 'R-KEY-11', 'a key that is not the second stroke is handled as usual', 'json', '{|}', [['press', 'Mod+k'], ['type', 'x']], { text: '{x|}' }],
  ['J-FOLD-013', 'R-KEY-11', 'folding says what it did', 'json', at(DECK, '"slides"', 1), [['press', FOLD]], { live: 'Folded' }],
  ['J-FOLD-014', 'R-KEY-11', 'the text is the same when folded', 'json', DECK, [CH('0')], { has: ['"Churn down"', '"title": "Highlights"'] }],
  ['Y-FOLD-003', 'R-KEY-11', 'Fold All and Unfold All in YAML', 'yaml', DECK_YAML, [CH('0'), ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', '>0'], CH('j'), ['expectFolded', 0]], {}],
  ['Y-FOLD-004', 'R-KEY-11', 'Fold Level 1 in YAML folds the top-level collections', 'yaml', '|' + DECK_YAML, [CH('1'), ['expectFolded', 1]], {}],
  ['Y-FOLD-005', 'R-KEY-11', 'the gutter is there in YAML', 'yaml', DECK_YAML, [], { gutter: '.cm-foldGutter' }],
  ['M-FOLD-005', 'R-KEY-11', 'Fold All in Markdown folds the front matter, each slide and the fence', 'md', DECK_MD, [CH('0'), ['expectFolded', 2], CH('j'), ['expectFolded', 0]], {}],
  ['M-FOLD-006', 'R-KEY-11', 'the gutter is there in Markdown', 'md', DECK_MD, [], { gutter: '.cm-foldGutter' }],
  ['M-FOLD-007', 'R-KEY-11', 'Fold Level 1 in Markdown folds the slides, not the fence inside', 'md', '|' + DECK_MD, [CH('1'), ['expectFolded', 2]], {}],

  // ---- lines, selection, find (R-KEY-07, R-KEY-09, R-KEY-10) ----------------------------------------------------------------------------
  ['J-LIN-006', 'R-KEY-07', 'Mod+Shift+Enter inserts a line above, with the indentation of this one', 'json', '{\n  "a": 1|\n}', [MS('Enter')], { text: '{\n  |\n  "a": 1\n}' }],
  ['J-SEL-001', 'R-KEY-09', 'Mod+L selects the line; again, the next one', 'json', '{\n  "a": 1|\n}', [M('l')], { text: '{\n⟦  "a": 1\n⟧}' }],
  ['J-SEL-002', 'R-KEY-09', 'Mod+L does not take Mod+Shift+L (select all occurrences)', 'json', '{\n  "a": 1,\n  "a|": 2\n}', [M('d'), MS('l')], { cursors: 2 }],
  ['J-SEL-003', 'R-KEY-09', 'Expand Selection grows from the word through the string to the value', 'json', '{\n  "a": {"b": "he|llo"}\n}', [K(EXPAND)], { text: '{\n  "a": {"b": "⟦hello⟧"}\n}' }],
  ['J-SEL-004', 'R-KEY-09', 'Expand Selection twice reaches the string', 'json', '{\n  "a": {"b": "he|llo"}\n}', [K(EXPAND), K(EXPAND)], { text: '{\n  "a": {"b": ⟦"hello"⟧}\n}' }],
  ['J-SEL-005', 'R-KEY-09', 'Shrink Selection undoes the expansion step by step', 'json', '{\n  "a": {"b": "he|llo"}\n}', [K(EXPAND), K(EXPAND), K(EXPAND), K(SHRINK), K(SHRINK), K(SHRINK)], { text: '{\n  "a": {"b": "he|llo"}\n}' }],
  ['J-SEL-006', 'R-KEY-09', 'Shrink Selection with nothing to shrink says so', 'json', '{\n  "a": 1|\n}', [K(SHRINK)], { live: 'Nothing to shrink' }],
  ['J-FND-001', 'R-KEY-10', 'Mod+F opens find with focus in the field', 'json', '{|}', [M('f')], { focus: 'input.cm-textfield' }],
  ['J-FND-002', 'R-KEY-10', 'Enter finds, Escape closes and returns to the editor', 'json', DECK, [M('f'), ['type', 'Highlights'], K('Enter'), K('Escape')], { focus: 'editor', has: 'Highlights' }],
  ['J-FND-003', 'R-KEY-10', 'Ctrl+G opens go to line; the number and Enter go there', 'json', '{\n  "a": 1,\n  "b": 2\n}', [K('Control+g'), ['type', '3'], K('Enter')], { text: '{\n  "a": 1,\n|  "b": 2\n}' }],
  ['J-FND-004', 'R-KEY-10', 'Mod+Alt+G opens go to line on every platform', 'json', '{\n  "a": 1,\n  "b": 2\n}', [M('Alt+g'), ['type', '2'], K('Enter')], { text: '{\n|  "a": 1,\n  "b": 2\n}' }],
  ['J-FND-005', 'R-KEY-10', 'Replace opens the find panel with focus in the field', 'json', '{|}', [K(platform === 'darwin' ? 'Meta+Alt+f' : 'Control+h')], { focus: 'input.cm-textfield' }],
  ['J-FND-006', 'R-KEY-10', 'Escape from go to line returns to the editor', 'json', '{|}', [K('Control+g'), K('Escape')], { focus: 'editor' }],
  ['J-FND-007', 'R-KEY-10', 'F3 finds the next match', 'json', '{\n  "a": "x",\n  "b": "x"\n}', [M('f'), ['type', 'x'], K('Escape'), K('F3'), K('F3')], { text: '{\n  "a": "x",\n  "b": "⟦x⟧"\n}' }],
];

// ---- the shortcuts list and dialog (R-KEY-12, SPEC 8.6) ---------------------------------------------------------------------------------
const OUTLINE_KEYS = platform === 'darwin' ? 'Cmd+Shift+O' : 'Ctrl+Shift+O';
keymapCases.push(
  ['X-PLT-001', 'R-KEY-12', 'getShortcuts lists every installed binding, none without a title', 'json', DECK, [], { shortcutList: { keys: { 'nav.symbol': [OUTLINE_KEYS], 'fold.all': [platform === 'darwin' ? 'Cmd+K Cmd+0' : 'Ctrl+K Ctrl+0'], 'help.shortcuts': ['F1'] }, minimum: 70 } }],
  ['X-PLT-002', 'R-KEY-12', 'Windows and Linux: Ctrl+Y redo, Ctrl+G go to line, Ctrl+Shift+[ fold, no Cmd key', 'json', DECK, [], { shortcutList: { platform: 'win', keys: { 'edit.redo': ['Ctrl+Y', 'Ctrl+Shift+Z'], 'nav.line': ['Ctrl+G'], 'fold.fold': ['Ctrl+Shift+['], 'find.replace': ['Ctrl+H'], 'suggest.trigger': ['Ctrl+Space'] }, noKeyMatching: ['Cmd'] } }],
  ['X-PLT-003', 'R-KEY-12', 'macOS: Cmd+I suggest, Cmd+Alt+[ fold, Cmd+Alt+F replace, Cmd+G find next', 'json', DECK, [], { shortcutList: { platform: 'mac', keys: { 'suggest.trigger': ['Ctrl+Space', 'Cmd+I'], 'fold.fold': ['Cmd+Alt+['], 'find.replace': ['Cmd+Alt+F'], 'find.next': ['Cmd+G'], 'edit.redo': ['Cmd+Shift+Z'] } } }],
  ['X-PLT-004', 'R-KEY-12', 'Linux lists the same as Windows for the keys the editor owns', 'json', DECK, [], { shortcutList: { platform: 'linux', keys: { 'nav.symbol': ['Ctrl+Shift+O'], 'select.expand': ['Alt+Shift+Right'] }, noKeyMatching: ['Cmd'] } }],
  ['X-SHC-001', 'R-KEY-12', 'F1 opens the shortcuts dialog with focus in the search field', 'json', DECK, [K('F1')], { shortcuts: { open: 1, focus: 'opf-shortcuts-search', has: 'Fold all' } }],
  ['X-SHC-002', 'R-KEY-12', 'the Cmd/Ctrl+K Cmd/Ctrl+S chord opens it', 'json', DECK, [CH('s')], { shortcuts: { open: 1, has: ['Go to symbol', OUTLINE_KEYS] } }],
  ['X-SHC-003', 'R-KEY-12', 'Escape closes it and returns focus to the editor', 'json', DECK, [K('F1'), K('Escape')], { shortcuts: { open: 0 }, focus: 'editor' }],
  ['X-SHC-004', 'R-KEY-12', 'the ? button opens it and the same key sequence closes it with Escape', 'json', DECK, [['clickShortcutsButton'], K('Escape')], { shortcuts: { open: 0 } }],
  ['X-SHC-005', 'R-KEY-12', 'typing searches by name', 'json', DECK, [K('F1'), ['type', 'fold all']], { shortcuts: { has: 'Fold all', not: 'Move left' } }],
  ['X-SHC-006', 'R-KEY-12', 'typing searches by key', 'json', DECK, [K('F1'), ['type', 'F8']], { shortcuts: { has: ['Go to the next problem'], not: 'Fold all' } }],
  ['X-SHC-007', 'R-KEY-12', 'a search with no match says so', 'json', DECK, [K('F1'), ['type', 'zzzz']], { shortcuts: { status: /^0 shortcuts match/ } }],
  ['X-SHC-008', 'R-KEY-12', 'Tab stays inside the dialog and wraps', 'json', DECK, [K('F1'), K('Tab'), K('Tab'), K('Tab')], { shortcuts: { open: 1, insideFocus: true } }],
  ['X-SHC-009', 'R-KEY-12', 'Shift+Tab wraps to the last control', 'json', DECK, [K('F1'), K('Shift+Tab'), K('Shift+Tab'), K('Shift+Tab')], { shortcuts: { open: 1, insideFocus: true } }],
  ['X-SHC-010', 'R-KEY-12', 'a ? typed in the editor is text', 'json', '{"a": "|"}', [['type', '?']], { text: '{"a": "?|"}', shortcuts: { open: 0 } }],
  ['X-SHC-011', 'R-KEY-12', 'a ? on a button of the pane opens the dialog', 'json', DECK, [['focusFormatAction'], ['type', '?']], { shortcuts: { open: 1 } }],
  ['X-SHC-012', 'R-KEY-12', 'it opens in YAML and Markdown too', 'yaml', DECK_YAML, [K('F1')], { shortcuts: { open: 1, has: 'Fold all' } }],
  ['X-SHC-013', 'R-KEY-12', 'it is announced', 'json', DECK, [K('F1')], { live: 'Keyboard shortcuts, \\d+ shortcuts' }],
);
