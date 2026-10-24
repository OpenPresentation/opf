// JSON cases of artifacts/source-editor/TEST-PLAN.md that phase 0 of the keyboard overhaul closes (AUDIT findings F01, F02, F03, F13, F14,
// F15, F17, F19, F20, F21, F23). Row format: [id, requirement, title, format, doc, steps, expect, options?]; see support/source-keyboard.mjs.
import { FAST, K, M, MS, P, T, WAIT } from '../source-keyboard.mjs';

const KEY = '{\n  "slides": [],\n  |\n}';
const DESIGN_TEXT = '"design": ';

// ---- accepting, dismissing, navigating the list ---------------------------------------------------------------------------------------
export const jsonAccept = [
  ['J-ACC-001', 'R-CMP-05', 'Tab accepts the selected key (F01; phase 3: description, since accepting design starts the design snippet and opens its theme list)', 'json', KEY, [T('"desc'), K('Tab')], { acceptedIsSelected: 1, not: '    "des', popup: { open: 0 } }],
  ['J-ACC-001b', 'R-CMP-05', 'Tab accepts description when it is typed out (phase 3: was design, now a snippet key)', 'json', KEY, [T('"descri'), K('Tab')], { has: '"description": ', popup: { open: 0 } }],
  ['J-ACC-002', 'R-CMP-06', 'Enter accepts the selected key (phase 3: description, since design opens its theme list)', 'json', KEY, [T('"desc'), K('Enter')], { acceptedIsSelected: 1, popup: { open: 0 } }],
  ['J-ACC-003', 'R-CMP-06', 'Enter 0 ms after the last key still accepts (F02)', 'json', KEY, [FAST('"desi', 'Enter', 0)], { has: DESIGN_TEXT }],
  ['J-ACC-004', 'R-CMP-06', 'Enter at 40 ms', 'json', KEY, [FAST('"desi', 'Enter', 40)], { has: DESIGN_TEXT }],
  ['J-ACC-005', 'R-CMP-06', 'Enter at 80 ms', 'json', KEY, [FAST('"desi', 'Enter', 80)], { has: DESIGN_TEXT }],
  ['J-ACC-006', 'R-CMP-06', 'Enter at 120 ms', 'json', KEY, [FAST('"desi', 'Enter', 120)], { has: DESIGN_TEXT }],
  ['J-ACC-007', 'R-CMP-06', 'Enter at 160 ms', 'json', KEY, [FAST('"desi', 'Enter', 160)], { has: DESIGN_TEXT }],
  ['J-ACC-008', 'R-CMP-05', 'Tab 0 ms after the last key accepts', 'json', KEY, [FAST('"desi', 'Tab', 0)], { has: DESIGN_TEXT }],
  ['J-ACC-008b', 'R-CMP-05', 'Tab at 120 ms', 'json', KEY, [FAST('"desi', 'Tab', 120)], { has: DESIGN_TEXT }],
  ['J-ACC-009', 'R-CMP-05', 'Tab never indents the line while the list is open (phase 3: description)', 'json', KEY, [T('"desc'), K('Tab')], { not: '    "' }],
  ['J-ACC-010', 'R-CMP-07', 'Escape closes the list and keeps the text', 'json', KEY, [T('"des'), K('Escape')], { popup: { open: 0 }, text: '{\n  "slides": [],\n  "des|"\n}' }],
  ['J-ACC-011', 'R-CMP-07', 'a second Escape does not change the text', 'json', KEY, [T('"des'), K('Escape'), WAIT(2200, 'CodeMirror turns Escape then Tab into leaving the editor for 2 s'), K('Escape')], { text: '{\n  "slides": [],\n  "des|"\n}' }],
  ['J-ACC-012', 'R-CMP-08', 'Down then Tab accepts the second item', 'json', KEY, [T('"des'), K('ArrowDown'), K('Tab')], { popup: { open: 0 }, acceptedIsSelected: 1 }],
  ['J-ACC-013', 'R-CMP-08', 'Up wraps to the last item', 'json', KEY, [T('"des'), K('ArrowUp')], { popup: { selectedIsLast: 1 } }],
  ['J-ACC-015', 'R-CMP-08', 'Ctrl+N moves the selection (macOS only)', 'json', KEY, [T('"des'), K('Control+n')], { popup: { selectedIndex: 1 } }, { plat: 'darwin' }],
  ['J-ACC-022', 'R-CMP-05', 'a mouse click still accepts', 'json', KEY, [T('"desi'), ['clickItem', 'design']], { has: DESIGN_TEXT }],
  ['J-ACC-023', 'R-CMP-06', 'Enter right after single keystrokes accepts', 'json', KEY, [T('"d'), T('e'), T('s'), K('Enter')], { acceptedIsSelected: 1 }],
  ['J-ACC-024', 'R-CMP-05', 'with no list, Tab inserts whitespace and Enter a line (Enter drops the trailing whitespace of a blank line)', 'json', '{\n  "slides": [],\n  |\n}', [K('Tab'), K('Enter')], { text: '{\n  "slides": [],\n\n  |\n}' }],
];

// ---- Ctrl+Space (and Cmd+I) open the list ----------------------------------------------------------------------------------------------
// 16 of the audit's 19 positions (SPEC section 4, AUDIT section 4). The other three offer a template, not a value: after a key whose value is
// an object (`{}`), inside `slides: []` (a slide) and in a blank document (a deck); they come with the insert templates and snippets of phase 1.
const CTRL = [
  ['empty line in object', '{\n  "slides": [],\n  |\n}', ['name', 'design', 'description']],
  ['inside empty key quotes', '{\n  "slides": [],\n  "|"\n}', ['name', 'design']],
  ['partial key in quotes', '{\n  "slides": [],\n  "des|"\n}', ['description', 'design', 'datasets']],
  ['bare partial key', '{\n  "slides": [],\n  des|\n}', ['description', 'design', 'datasets']],
  ['boolean right after the colon', '{\n  "slides": [],\n  "template":|\n}', ['true', 'false']],
  ['boolean after the colon and a space', '{\n  "slides": [],\n  "template": |\n}', ['true', 'false']],
  ['enum after the colon', '{\n  "slides": [],\n  "design": {"titleAlignment": |}\n}', ['left', 'center', 'right']],
  ['enum in empty quotes', '{\n  "slides": [],\n  "design": {"titleAlignment": "|"}\n}', ['left', 'center', 'right']],
  ['enum partial', '{\n  "slides": [],\n  "design": {"titleAlignment": "ce|"}\n}', ['center']],
  ['catalog ref in empty quotes', '{\n  "slides": [{"layout": "|"}]\n}', ['agenda', 'chart', 'closing', 'cover']],
  ['catalog ref after the colon', '{\n  "slides": [{"layout": |}]\n}', ['agenda', 'chart', 'closing', 'cover']],
  ['just after a closing quote', '{\n  "slides": [{"layout": "cover"|}]\n}', ['cover']],
  ['inside an existing {}', '{\n  "slides": [],\n  "design": {|}\n}', ['theme', 'colorScheme', 'fontScheme', 'background']],
  ['slide type enum', '{\n  "slides": [{"type": "|"}]\n}', ['chart', 'code', 'image', 'list', 'metric', 'quote', 'table', 'text', 'timeline', 'video']],
  ['chart type enum', '{\n  "slides": [{"chart": {"type": "|"}}]\n}', ['area', 'bar', 'column', 'line', 'pie']],
  ['audience item', '{\n  "slides": [],\n  "audience": ["|"]\n}', ['board', 'customer']],
  ['tone', '{\n  "slides": [],\n  "tone": "|"\n}', ['formal', 'casual', 'technical']],
  ['top level {}', '{|}', ['name', 'slides', 'design']],
];
export const jsonCtrlSpace = [
  ...CTRL.map(([name, doc, has], index) => [`J-CTRL-${String(index + 1).padStart(3, '0')}`, 'R-CMP-03', `Ctrl+Space opens the list: ${name} (F03)`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has }, dialog: { open: false } }]),
  ['J-CTRL-040', 'R-CMP-03', 'Cmd+I opens the list on macOS', 'json', CTRL[2][1], [K('Meta+i')], { popup: { open: 1, has: CTRL[2][2] } }, { plat: 'darwin' }],
  ['J-CTRL-041', 'R-CMP-03', 'Ctrl+Space then Tab accepts the first item', 'json', CTRL[7][1], [K('Control+Space'), K('Tab')], { acceptedIsSelected: 1, popup: { open: 0 } }],
  ['J-CTRL-042', 'R-CMP-03', 'Ctrl+Space then Enter accepts, replacing the whole string', 'json', CTRL[8][1], [K('Control+Space'), K('Enter')], { has: '"titleAlignment": "center"' }],
  ['J-CTRL-043', 'R-CMP-04', 'Ctrl+Space in a free-text field opens nothing', 'json', '{\n  "slides": [{"title": "Rev|"}]\n}', [K('Control+Space')], { popup: { open: 0 }, dialog: { open: false } }],
  ['J-CTRL-044', 'R-CMP-03', 'Escape after Ctrl+Space closes the list and keeps the text', 'json', CTRL[2][1], [K('Control+Space'), K('Escape')], { popup: { open: 0 }, text: '{\n  "slides": [],\n  "des|"\n}' }],
  ['J-CTRL-045', 'R-CMP-03', 'the field menu is not on Ctrl+Space, Alt+Down or a click', 'json', '{\n  "slides": [{"layout": "cover"}]\n}', [['caret', '"cover"', 3], K('Alt+ArrowDown'), ['clickText', 'cover']], { dialog: { open: false }, focus: 'editor' }],
  ['J-CTRL-046', 'R-CMP-03', 'Alt+Shift+O opens the field menu instead', 'json', '{\n  "slides": [{"layout": "cover"}]\n}', [['caret', '"cover"', 3], K('Alt+Shift+O')], { dialog: { open: true, focusInside: true }, popup: { open: 0 } }],
];

// ---- move, copy and delete lines ---------------------------------------------------------------------------------------------------------
export const jsonLines = [
  ['J-LIN-001', 'R-KEY-07', 'Alt+Up moves the line up', 'json', '{\n  "a": 1,\n  "b": 2|\n}', [K('Alt+ArrowUp')], { text: '{\n  "b": 2|\n  "a": 1,\n}' }],
  ['J-LIN-002', 'R-KEY-07', 'Alt+Down moves the line down (F13)', 'json', '{\n  "a": 1|,\n  "b": 2\n}', [K('Alt+ArrowDown')], { text: '{\n  "b": 2\n  "a": 1|,\n}' }],
  ['J-LIN-002b', 'R-KEY-07', 'Alt+Down twice goes down two lines', 'json', '{\n  "a": 1|,\n  "b": 2,\n  "c": 3\n}', [K('Alt+ArrowDown'), K('Alt+ArrowDown')], { text: '{\n  "b": 2,\n  "c": 3\n  "a": 1|,\n}' }],
  ['J-LIN-003', 'R-KEY-07', 'Shift+Alt+Down copies the line down', 'json', '{\n  "a": 1|\n}', [K('Alt+Shift+ArrowDown')], { text: '{\n  "a": 1\n  "a": 1|\n}' }],
  ['J-LIN-004', 'R-KEY-07', 'Mod+Shift+K deletes the line', 'json', '{\n  "a": 1|,\n  "b": 2\n}', [MS('k')], { text: '{\n  "b": 2|\n}' }],
  ['J-LIN-005', 'R-KEY-07', 'Mod+Enter inserts a line below', 'json', '{\n  "a": 1|\n}', [M('Enter')], { text: '{\n  "a": 1\n  |\n}' }],
  ['J-LIN-007', 'R-KEY-07', 'Mod+Backspace deletes to the line start', 'json', '{\n  "a": 1|\n}', [M('Backspace')], { text: '{\n|\n}' }, { plat: 'darwin' }],
  ['J-LIN-008', 'R-KEY-07', 'Alt+Backspace deletes a word (macOS)', 'json', '{\n  "title": "hello world|"\n}', [K('Alt+Backspace')], { text: '{\n  "title": "hello |"\n}' }, { plat: 'darwin' }],
  ['J-LIN-008b', 'R-KEY-07', 'Ctrl+Backspace deletes a word (Windows and Linux)', 'json', '{\n  "title": "hello world|"\n}', [K('Control+Backspace')], { text: '{\n  "title": "hello |"\n}' }, { plat: '!darwin' }],
  ['J-LIN-009', 'R-KEY-07', 'Mod+X with an empty selection cuts the line', 'json', '{\n  "a": 1|\n}', [M('x')], { text: '{\n|}' }, { native: true }],
];

// ---- Tab, Shift+Tab, indentation ---------------------------------------------------------------------------------------------------------
export const jsonTabs = [
  ['J-TAB-001', 'R-KEY-01', 'Tab with no list inserts whitespace at the caret (F14)', 'json', '{\n  "name": "x"|\n}', [K('Tab')], { text: '{\n  "name": "x" |\n}' }],
  ['J-TAB-001b', 'R-KEY-01', 'Tab goes to the next tab stop, not a whole unit on', 'json', '{\n  "name": "x" |\n}', [K('Tab')], { text: '{\n  "name": "x"   |\n}' }],
  ['J-TAB-002', 'R-KEY-01', 'Tab on an empty line inserts one unit', 'json', '{\n  "slides": [],\n|\n}', [K('Tab')], { text: '{\n  "slides": [],\n  |\n}' }],
  ['J-TAB-003', 'R-KEY-01', 'Shift+Tab outdents the line by one unit', 'json', '{\n  "slides": [],\n    |\n}', [K('Shift+Tab')], { text: '{\n  "slides": [],\n  |\n}' }],
  ['J-TAB-004', 'R-KEY-02', 'Tab on a multi-line selection indents every line', 'json', '{\n⟦  "name": "x",\n  "slides": []⟧\n}', [K('Tab')], { text: '{\n⟦    "name": "x",\n    "slides": []⟧\n}' }],
  ['J-TAB-005', 'R-KEY-02', 'Shift+Tab outdents every line', 'json', '{\n  "a": 1,\n⟦    "name": "x",\n    "slides": []⟧\n}', [K('Shift+Tab')], { text: '{\n  "a": 1,\n⟦  "name": "x",\n  "slides": []⟧\n}' }],
  ['J-TAB-006', 'R-KEY-02', 'Mod+] and Mod+[ indent and outdent the line', 'json', '{\n  "name": "x"|\n}', [M(']'), M('[')], { text: '{\n  "name": "x"|\n}' }],
  ['J-TAB-007', 'R-KEY-02', 'Tab over a selection inside one line replaces it', 'json', '{\n  "name": "⟦x⟧"\n}', [K('Tab')], { text: '{\n  "name": " |"\n}' }],
  ['J-TAB-008', 'R-KEY-02', 'Tab on a whole selected line indents the line', 'json', '{\n⟦  "name": "x"⟧\n}', [K('Tab')], { text: '{\n⟦    "name": "x"⟧\n}' }],
  ['J-TAB-009', 'R-KEY-01', 'Tab at two cursors inserts at both', 'json', '{\n  "a": 1,\n  "b": 2\n}', [['addCursors', ['"a": 1', '"b": 2']], K('Tab')], { text: '{\n  "a": 1  |,\n  "b": 2  |\n}', cursors: 2 }],
  ['J-IND-001', 'R-IND-01', 'a 4-space document keeps 4 after edits', 'json', '{\n    "a": 1,\n    "b": 2|\n}', [T(','), K('Enter'), K('Tab')], { text: '{\n    "a": 1,\n    "b": 2,\n        |\n}' }],
  ['J-IND-002', 'R-IND-01', 'Tab, Tab, Shift+Tab walk 4-space units', 'json', '{\n    "a": 1\n}\n|', [K('Tab'), K('Tab'), K('Shift+Tab')], { text: '{\n    "a": 1\n}\n    |' }],
  ['J-IND-003', 'R-IND-02', 'a 2-space document keeps 2 after Tab Tab Shift+Tab', 'json', '{\n  "a": 1\n}\n|', [K('Tab'), K('Tab'), K('Shift+Tab')], { text: '{\n  "a": 1\n}\n  |' }],
  ['J-IND-004', 'R-IND-03', 'tab-indented documents insert a tab character', 'json', '{\n\t"a": 1\n}\n|', [K('Tab')], { text: '{\n\t"a": 1\n}\n\t|' }],
  ['J-IND-005', 'R-IND-04', 'Backspace in leading whitespace removes one unit', 'json', '{\n  "a": 1,\n    |\n}', [K('Backspace')], { text: '{\n  "a": 1,\n  |\n}' }],
  ['J-IND-006', 'R-IND-01', 'one deeply indented line does not change the unit (F15)', 'json', '{\n  "a": [\n      1\n  ],\n|\n}', [K('Tab'), K('Tab'), K('Shift+Tab')], { text: '{\n  "a": [\n      1\n  ],\n  |\n}' }],
];

// ---- paste -------------------------------------------------------------------------------------------------------------------------------
const PASTE_AT = '{\n  "slides": [\n    {\n      "title": "a"\n    },\n    |\n  ]\n}';
export const jsonPaste = [
  ['J-PST-001', 'R-PASTE', 'single-line paste at a caret', 'json', PASTE_AT, [P('{"title": "b"}')], { deck: { '/slides/1/title': 'b' } }],
  ['J-PST-002', 'R-PASTE', 'a multi-line object ending in a lone } is inserted (F19)', 'json', PASTE_AT, [P('{\n"title": "b"\n}')], { deck: { '/slides/1/title': 'b' }, has: '{\n"title": "b"\n}' }],
  ['J-PST-002b', 'R-PASTE', 'the same object already at its indent', 'json', PASTE_AT, [P('{\n      "title": "b"\n    }')], { deck: { '/slides/1/title': 'b' } }],
  ['J-PST-003', 'R-PASTE', 'a multi-line array ending in a lone ]', 'json', '{\n  "tags": |\n}', [P('[\n"a",\n"b"\n]')], { has: '"tags": [\n"a",\n"b"\n]' }],
  ['J-PST-004', 'R-PASTE', 'text is inserted as written (VS Code: editor.autoIndentOnPaste is off)', 'json', PASTE_AT, [P('{\n  "title": "b"\n}')], { text: '{\n  "slides": [\n    {\n      "title": "a"\n    },\n    {\n  "title": "b"\n}|\n  ]\n}' }],
  ['J-PST-005', 'R-PASTE', 'paste over a selection replaces it', 'json', '{\n  "name": "⟦x⟧"\n}', [P('Q3')], { text: '{\n  "name": "Q3|"\n}' }],
  ['J-PST-006', 'R-PASTE', 'a CRLF clipboard keeps the text and one editor line per line', 'json', '{\n  "a": 1,\n  |\n}', [P('"b": 2\r\n')], { has: '"b": 2' }],
  ['J-PST-007', 'R-PASTE', 'pasting invalid JSON is accepted as text and reported', 'json', '{\n  |\n}', [P('"a" 1')], { has: '"a" 1', findings: { errors: 1 } }],
  ['J-PST-008', 'R-PASTE', 'paste is one undo step', 'json', PASTE_AT, [P('{\n"title": "b"\n}')], { undo: [1, PASTE_AT.replace('|', '|')] }],
  ['J-PST-009', 'R-PASTE', 'a multi-line paste ending in } at the document end', 'json', '|', [P('{\n  "name": "x",\n  "slides": [{"title": "a"}]\n}')], { text: '{\n  "name": "x",\n  "slides": [{"title": "a"}]\n}|', findings: { errors: 0 } }],
  ['J-PST-011', 'R-PASTE', 'Cmd/Ctrl+V with the real clipboard inserts a multi-line object ending in } (F19)', 'json', PASTE_AT, [['realPaste', '{\n"title": "b"\n}']], { deck: { '/slides/1/title': 'b' } }, { native: true, engines: ['chromium'] }],
  ['J-PST-010', 'R-PASTE', 'two cursors: each gets the paste (CodeMirror default route)', 'json', '{\n  "a": 1,\n  "b": 2\n}', [['addCursors', ['"a": 1', '"b": 2']], P('x')], { text: '{\n  "a": 1x|,\n  "b": 2x|\n}' }],
];

// ---- multiple cursors --------------------------------------------------------------------------------------------------------------------
const TWO_TITLES = '{\n  "slides": [{"title|": "a"}, {"title": "b"}]\n}';
export const jsonMulti = [
  ['J-MUL-001', 'R-KEY-08', 'Mod+D selects the word, Mod+D again adds the next occurrence (F17)', 'json', TWO_TITLES, [M('d'), M('d')], { cursors: 2 }],
  ['J-MUL-002', 'R-KEY-08', 'typing at two cursors edits both', 'json', TWO_TITLES, [M('d'), M('d'), T('x')], { has: ['"x": "a"', '"x": "b"'] }],
  ['J-MUL-003', 'R-KEY-08', 'Mod+Shift+L selects all occurrences', 'json', '{\n  "slides": [{"title|": "a"}, {"title": "b"}, {"title": "c"}]\n}', [M('d'), MS('l')], { cursors: 3 }],
  ['J-MUL-004', 'R-KEY-08', 'Mod+Alt+Down adds a cursor below', 'json', '{|\n  "a": 1,\n  "b": 2\n}', [K('Mod+Alt+ArrowDown')], { cursors: 2 }],
  ['J-MUL-005', 'R-KEY-08', 'Alt+click adds a cursor', 'json', '{\n  "a": 1,\n  "b": 2\n}', [['caret', '"a"', 0], ['altClickText', '"b"']], { cursors: 2 }],
  ['J-MUL-006', 'R-KEY-08', 'Escape collapses the extra cursors', 'json', TWO_TITLES, [M('d'), M('d'), K('Escape')], { cursors: 1 }],
  ['J-MUL-007', 'R-KEY-08', 'a multi-cursor edit is one undo step', 'json', TWO_TITLES, [M('d'), M('d'), T('x')], { undo: [1, '{\n  "slides": [{"⟦title⟧": "a"}, {"⟦title⟧": "b"}]\n}'] }],
  ['J-MUL-008', 'R-KEY-08', 'Backspace at two cursors deletes at both', 'json', '{\n  "a": 1,\n  "b": 2\n}', [['addCursors', ['"a": 1', '"b": 2']], K('Backspace')], { text: '{\n  "a": |,\n  "b": |\n}' }],
  ['J-MUL-009', 'R-KEY-08', 'the first Escape closes a list, the second collapses the cursors', 'json', '{\n  "a": 1,\n  "b": 2\n}', [['addCursors', ['"a"', '"b"']], K('Escape')], { cursors: 1 }],
];

// ---- the field menu (the options dialog) ---------------------------------------------------------------------------------------------------
const LAYOUT = '{"slides":[{"layout":"pillars"}]}';
export const jsonDialog = [
  ['X-DLG-001', 'R-A11Y-07', 'the dialog traps Tab and returns focus on Escape (F21)', 'json', LAYOUT, [['caret', '"pillars"', 3], K('Alt+Shift+O'), K('Tab'), K('Tab'), K('Tab'), K('Escape')], { focus: 'editor', dialog: { open: false } }],
  ['X-DLG-002', 'R-A11Y-07', 'Tab never leaves the dialog open behind the page', 'json', LAYOUT, [['caret', '"pillars"', 3], K('Alt+Shift+O'), K('Tab'), K('Tab'), K('Tab')], { dialog: { open: true, focusInside: true } }],
  ['X-DLG-003', 'R-CMP-03', 'a click on a catalog value only places the caret (F20)', 'json', LAYOUT, [['clickText', 'pillars']], { dialog: { open: false }, focus: 'editor' }],
  ['X-DLG-004', 'R-A11Y-07', 'Shift+Tab wraps backwards inside the dialog', 'json', LAYOUT, [['caret', '"pillars"', 3], K('Alt+Shift+O'), K('Shift+Tab'), K('Shift+Tab')], { dialog: { open: true, focusInside: true } }],
  ['X-DLG-005', 'R-CMP-03', 'a click on an enum value does not take the focus', 'json', '{"slides":[{"type":"text"}]}', [['clickText', 'text']], { dialog: { open: false }, focus: 'editor' }],
];

// ---- format ------------------------------------------------------------------------------------------------------------------------------
const DECKDOC = '{"name":"Q3","slides":[{"title":"a","items":["c","d"]},{"title":"b"}]}';
export const jsonFormat = [
  ['J-FMT-001', 'R-FMT-01', 'Shift+Alt+F formats a compact deck', 'json', '{"name":"x","slides":[{"title":"a","items":["c","d"]}]}|', [K('Alt+Shift+f')], { has: '  "name": "x",\n  "slides": [' }],
  ['J-FMT-002', 'R-FMT-01', 'Mod+Shift+F also formats (kept alias)', 'json', '{"name":"x","slides":[]}|', [MS('f')], { has: '\n  "name"' }],
  ['J-FMT-003', 'R-FMT-01', 'Format works on invalid JSON (F23)', 'json', '{"name":"x" "slides":[]}|', [K('Alt+Shift+f')], { has: '\n  "name"' }],
  ['J-FMT-004', 'R-FMT-01', 'the Format button gives the same result as the key', 'json', '{"name":"x","slides":[]}|', [['clickFormat']], { has: '\n  "name"' }],
  ['J-FMT-005', 'R-FMT-01', 'Format keeps CRLF and the detected tab indent', 'json', '{\r\n\t"a":1}\r\n|', [K('Alt+Shift+f')], { has: '\t"a": 1' }],
  ['J-FMT-006', 'R-FMT-01', 'Format is one undo step', 'json', '{"a":1,"b":2}|', [K('Alt+Shift+f')], { undo: [1, '{"a":1,"b":2}|'] }],
  ['J-FMT-007', 'R-FMT-01', 'Format keeps the caret on the same token', 'json', '{"a":1,"b":|2}', [K('Alt+Shift+f')], { text: '{\n  "a": 1,\n  "b": |2\n}' }],
  ['J-FMT-008', 'R-FMT-01', 'Format is idempotent', 'json', DECKDOC, [K('Alt+Shift+f'), ['snapshot', '1'], K('Alt+Shift+f'), ['expectSame', '1']], {}],
  ['J-FMT-009', 'R-FMT-01', 'Format keeps the deck', 'json', DECKDOC, [K('Alt+Shift+f')], { deck: { '/slides/0/items/1': 'd', '/name': 'Q3' } }],
  ['J-FMT-010', 'R-FMT-01', 'Format keeps a final newline', 'json', '{"a":1}\n|', [K('Alt+Shift+f')], { text: '{\n  "a": 1\n}\n|' }],
  ['J-FMT-011', 'R-FMT-01', 'Format keeps 4-space indentation', 'json', '{\n    "a": [1,2]|\n}', [K('Alt+Shift+f')], { has: '    "a": [\n        1,\n        2\n    ]' }],
  ['J-FMT-012', 'R-FMT-01', 'Shift+Alt+F is not typed into the text', 'json', '{"a":1}|', [K('Alt+Shift+f')], { not: 'F' }],
];

// ---- whole sessions, by keyboard only ------------------------------------------------------------------------------------------------------
export const jsonFlows = [
  ['J-FLOW-001', 'R-CMP-05', 'a slide written with keys only: braces, a key, a string, a catalog value', 'json', '{\n  "name": "x",\n  "slides": [\n    |\n  ]\n}',
    [T('{'), K('Enter'), T('"titl'), K('Tab'), T('Hello'), K('End'), T(','), K('Enter'), T('"lay'), K('Tab'), T('cov'), K('Enter')],
    { deck: { '/slides/0/title': 'Hello', '/slides/0/layout': 'cover' }, findings: { errors: 0 } }],
  ['J-FLOW-002', 'R-CMP-14', 'a key chains into the list of its values and Tab takes the first', 'json', '{\n  "slides": [{"title": "a"}],\n  "design": {\n    |\n  }\n}',
    [T('"titleA'), K('Tab'), ['waitPopup'], K('Tab')],
    { text: '{\n  "slides": [{"title": "a"}],\n  "design": {\n    "titleAlignment": "center"|\n  }\n}', popup: { open: 0 } }],
  ['J-FLOW-003', 'R-CMP-06', 'Enter after typing a whole value takes the match, then a line is a line', 'json', '{\n  "slides": [{"title": "a"}],\n  "tone": |\n}',
    [T('"cas'), K('Enter'), K('Enter')],
    { text: '{\n  "slides": [{"title": "a"}],\n  "tone": "casual"\n  |\n}', popup: { open: 0 } }],
  ['J-FLOW-004', 'R-CMP-07', 'Escape closes the list; Enter is then a line, not an accept', 'json', '{\n  "slides": [{"title": "a"}],\n  |\n}',
    [T('"des'), K('Escape'), K('End'), K('Enter')],
    { popup: { open: 0 }, text: '{\n  "slides": [{"title": "a"}],\n  "des"\n  |\n}' }],
  ['J-FLOW-005', 'R-CMP-05', 'with two cursors Tab and Enter keep their plain meaning at both', 'json', '{\n  "a": 1,\n  "b": 2\n}',
    [['addCursors', ['"a"', '"b"']], K('Tab')],
    { text: '{\n  "a" |: 1,\n  "b" |: 2\n}', popup: { open: 0 }, cursors: 2 }],
];

export const jsonCases = [...jsonAccept, ...jsonCtrlSpace, ...jsonLines, ...jsonTabs, ...jsonPaste, ...jsonMulti, ...jsonDialog, ...jsonFormat, ...jsonFlows];
