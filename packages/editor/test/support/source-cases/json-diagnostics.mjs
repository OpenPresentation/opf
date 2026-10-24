// Phase 1 JSON cases of artifacts/source-editor/TEST-PLAN.md, sections 4.10 to 4.12: hover, problems in the text and in the panel (messages from
// VALIDATOR-HINTS.md), F8, the panel's keys, quick fixes and what a screen reader hears. Row format: [id, requirement, title, format, doc, steps, expect, options?].
import { K, M, MS, T } from '../source-keyboard.mjs';

const WAIT = ['waitProblems', 1];
const NONE = ['waitNoProblems'];

// ---- hover ---------------------------------------------------------------------------------------------------------------------------------
export const jsonHover = [
  ['J-HOV-001', 'R-HOV-01', 'hovering a key shows the schema description', 'json', '{\n  "slides": [{"title": "a"}],\n  "design": {}\n}', [['hoverText', '"design"']], { hover: { open: 1, has: ['design', 'Optional design system'] } }],
  ['J-HOV-002', 'R-HOV-01', 'Mod+K Mod+I shows the hover at the caret', 'json', '{\n  "slides": [{"title": "a"}],\n  "des|ign": {}\n}', [['chord', 'Mod+k', 'Mod+i']], { hover: { open: 1, has: ['Optional design system'] }, live: 'Optional design system' }],
  ['J-HOV-003', 'R-HOV-02', 'hovering a catalog value shows the record', 'json', '{\n  "slides": [{"layout": "pillars"}]\n}', [['hoverText', 'pillars']], { hover: { open: 1, has: ['Pillars', 'title, pillars'] } }],
  ['J-HOV-004', 'R-HOV-04', 'hovering a problem shows the message, what is next and the quick fix hint', 'json', '{\n  "slides": [{"title": "a"}],\n  "design": {"titleAlignment": "middle"}\n}', [WAIT, ['hoverText', '"middle"']], { hover: { open: 1, has: ['must be left, center or right', 'did you mean `center`', 'Quick Fix'] } }],
  ['J-HOV-005', 'R-HOV-01', 'Escape hides the hover', 'json', '{\n  "slides": [{"title": "a"}],\n  "des|ign": {}\n}', [['chord', 'Mod+k', 'Mod+i'], K('Escape')], { hover: { open: 0 } }],
  ['J-HOV-006', 'R-HOV-01', 'no hover over free text', 'json', '{\n  "slides": [{"title": "Hello"}]\n}', [['hoverText', 'Hello']], { hover: { open: 0 } }],
  ['J-HOV-007', 'R-HOV-01', 'hovering an enum value shows the field and its values', 'json', '{\n  "slides": [{"title": "a"}],\n  "design": {"titleAlignment": "center"}\n}', [['hoverText', '"center"']], { hover: { open: 1, has: ['titleAlignment', 'left'] } }],
  ['J-HOV-008', 'R-HOV-01', 'hovering a key in a slide shows the slide field', 'json', '{\n  "slides": [{"title": "a", "notes": "n"}]\n}', [['hoverText', '"notes"']], { hover: { open: 1, has: ['notes'] } }],
];

// ---- problems in the text and the panel ---------------------------------------------------------------------------------------------------
export const jsonSchemaDiagnostics = [
  ['J-DIA-020', 'R-DIAG-01', 'the top level is an array', 'json', '[{"title": "a"}]', [WAIT], { findings: { n: 1, rows: [{ text: 'top level must be an object', next: '"slides"', fixes: ['Wrap in { "slides" ... }'] }] }, squiggles: [{ text: '[' }] }],
  ['J-DIA-021', 'R-DIAG-01', 'a duplicate key marks both keys', 'json', '{"slides":[{"title":"a"}],"name":"a","name":"b"}', [WAIT], { findings: { rows: [{ text: 'appears twice', fixes: ['Remove the first', 'Remove the second'] }] }, squiggles: [{ text: '"name"' }, { text: '"name"' }] }],
  ['J-DIA-030', 'R-DIAG-03', 'a missing required property points at the parent brace', 'json', '{"name": "x"}', [WAIT], { findings: { rows: [{ text: 'The deck is missing `slides`', next: '"slides"', fixes: ['Add `slides`'] }] }, squiggles: [{ text: '{' }] }],
  ['J-DIA-031', 'R-DIAG-03', 'a type error says what it is and what to write', 'json', '{"slides":[{"items":"One"}]}', [WAIT], { findings: { rows: [{ text: '`items` should be a list', next: '["One"]', fixes: ['Wrap in a list'] }] }, squiggles: [{ text: '"One"' }] }],
  ['J-DIA-032', 'R-DIAG-03', 'an enum lists its values and guesses', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT], { findings: { rows: [{ text: '`titleAlignment` must be left, center or right, but is `middle`', next: 'did you mean `center`', fixes: ['Change to center', 'Change to left', 'Change to right'] }] }, squiggles: [{ text: '"middle"' }] }],
  ['J-DIA-033', 'R-DIAG-03', 'an unknown key: did you mean', 'json', '{"slids":[{"title":"a"}]}', [WAIT], { findings: { n: 1, rows: [{ text: '`slids` is not a property of the deck', next: 'did you mean `slides`', fixes: ['Rename to slides', 'Remove property'] }] }, squiggles: [{ text: '"slids"' }] }],
  ['J-DIA-034', 'R-DIAG-03', 'the required-property row is dropped when the rename resolves it', 'json', '{"slids":[]}', [WAIT], { findings: { n: 1 } }],
  ['J-DIA-034b', 'R-DIAG-03', 'it stays when the unknown key is not a near miss', 'json', '{"zzzz":[]}', [['waitProblems', 2]], { findings: { n: 2 } }],
  ['J-DIA-035', 'R-DIAG-03', 'an empty layout in plain words', 'json', '{"slides":[{"title":"a","layout":""}]}', [WAIT], { findings: { rows: [{ text: '`layout` must be a layout id such as `pillars`', next: 'Ctrl+Space' }] } }],
  ['J-DIA-036', 'R-DIAG-03', 'a hex color', 'json', '{"slides":[{"title":"a"}],"design":{"colorScheme":{"accent1":"#12"}}}', [WAIT], { findings: { rows: [{ text: 'hex color like `#1F4E79`' }] } }],
  ['J-DIA-037', 'R-DIAG-03', 'minItems', 'json', '{"slides":[]}', [WAIT], { findings: { rows: [{ text: '`slides` needs at least 1 item', fixes: ['Add a slide'] }] } }],
  ['J-DIA-038', 'R-DIAG-03', 'a union: the title is a number', 'json', '{"slides":[{"title":42}]}', [WAIT], { findings: { rows: [{ text: '`title` should be text or a list, but it is a number' }] } }],
  ['J-DIA-039', 'R-DIAG-03', 'an unresolved layout is a warning with suggestions', 'json', '{"slides":[{"title":"a","layout":"pilars"}]}', [WAIT], { findings: { warnings: 1, rows: [{ severity: 'warning', next: 'did you mean `pillars`', fixes: ['Change to pillars'] }] } }],
  ['J-DIA-040', 'R-DIAG-04', 'every finding that has a place gets a squiggle', 'json', '{"slides":[{"title":42}],"design":{"theme":"neon-dreams"}}', [['waitProblems', 2]], { squiggles: [{ sev: 'error', text: '42' }, { sev: 'warning', text: '"neon-dreams"' }] }],
  ['J-DIA-041', 'R-DIAG-04', 'the panel rows say line and column', 'json', '{\n  "slides": [{"title": 42}]\n}', [WAIT], { findings: { rows: [{ line: 2, col: 24, rule: 'opf/schema' }] } }],
];


// ---- syntax problems: one per cause, at the cause --------------------------------------------------------------------------------------------
export const jsonSyntax = [
  ['J-DIA-001', 'R-DIAG-01', 'the owner case: a key with no value is reported on its own line', 'json', '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}', [WAIT],
    { findings: { n: 1, rows: [{ sev: 'error', line: 3, col: 3, text: '`design` needs a value', next: 'Ctrl+Space', rule: 'opf/json-syntax', fixes: ['Add { }', 'Remove "design"'] }] }, squiggles: [{ text: '"design":' }] }],
  ['J-DIA-002', 'R-DIAG-01', 'a missing comma is reported at the end of the previous value', 'json', '{\n  "name": "x"\n  "slides": []\n}', [WAIT], { findings: { n: 1, rows: [{ line: 2, text: 'Missing comma after', fixes: ['Insert comma'] }] } }],
  ['J-DIA-003', 'R-DIAG-01', 'a trailing comma', 'json', '{"slides": [{"title": "a"},]}', [WAIT], { findings: { rows: [{ text: 'Trailing comma', fixes: ['Remove comma'] }] } }],
  ['J-DIA-004', 'R-DIAG-01', 'an unclosed brace points at the opener', 'json', '{"slides": [{"title": "a"}]', [WAIT], { findings: { rows: [{ line: 1, text: 'never closed', fixes: ['Insert }'] }] } }],
  ['J-DIA-005', 'R-DIAG-01', 'single quotes', 'json', "{'slides': []}", [WAIT], { findings: { rows: [{ text: 'double quotes', fixes: ['Use double quotes'] }] } }],
  ['J-DIA-006', 'R-DIAG-01', 'typographic quotes', 'json', '{\u201cslides\u201d: []}', [WAIT], { findings: { rows: [{ text: 'typographic quotes', fixes: ['Replace with straight quotes'] }] } }],
  ['J-DIA-007', 'R-DIAG-01', 'comments', 'json', '{"slides": [] // c\n}', [WAIT], { findings: { rows: [{ text: 'does not allow comments' }] } }],
  ['J-DIA-008', 'R-DIAG-01', 'several independent errors are all listed', 'json', '{\n  "name": "x"\n  "slides": [\n    {"title": "a"},\n  ]\n', [['waitProblems', 3]], { findings: { n: 3 } }],
  ['J-DIA-009', 'R-DIAG-01', 'a cascade is reported once', 'json', '{\n  "name": "x",\n  "design":\n  "organization": {}\n}', [WAIT], { findings: { n: 1 } }],
  ['J-DIA-010', 'R-DIAG-01', 'one message in the tooltip and in the panel (no browser text)', 'json', '{\n  "name": "x"\n  "slides": []\n}', [WAIT, ['hoverProblem', 0]], { hover: { has: ['Missing comma'], not: ['position '] } }],
  ['J-DIA-011', 'R-DIAG-02', 'typing a partial key does not flash an error while the list is open', 'json', '{\n  "slides": [],\n  |\n}', [T('"des'), ['pause', 700]], { findings: { n: 0 }, squiggles: [] }],
  ['J-DIA-012', 'R-DIAG-02', '... and it shows up when the list is gone and the key is still not finished', 'json', '{\n  "slides": [],\n  |\n}', [T('"zzz'), WAIT], { findings: { rows: [{ text: 'colon' }] } }],
  ['J-DIA-022', 'R-DIAG-01', 'YAML pasted into JSON', 'json', 'name: x\nslides: []', [WAIT], { findings: { rows: [{ text: 'looks like YAML', fixes: ['Switch format to YAML'] }] } }],
  ['J-DIA-023', 'R-DIAG-01', 'an empty document', 'json', ' ', [WAIT], { findings: { rows: [{ text: 'empty', fixes: ['Insert minimal deck'] }] } }],
];

export const jsonSyntaxFixes = [
  ['J-FIX-001', 'R-FIX-01', 'insert the missing comma', 'json', '{\n  "name": "x"\n  "slides": [{"title": "a"}]\n}', [WAIT, ['quickFix', 'Insert comma']], { text: '{\n  "name": "x",|\n  "slides": [{"title": "a"}]\n}' }],
  ['J-FIX-002', 'R-FIX-01', 'remove the trailing comma', 'json', '{"slides": [{"title": "a"},]}', [WAIT, ['quickFix', 'Remove comma']], { deck: { '/slides/0/title': 'a' }, findings: { errors: 0 } }],
  ['J-FIX-003', 'R-FIX-01', 'add a value for a key without one', 'json', '{\n  "slides": [{"title": "a"}],\n  "design":\n  ,"name": "x"\n}', [WAIT, ['quickFix', 'Add { }']], { has: '"design": {}' }],
  ['J-FIX-003b', 'R-FIX-01', 'the owner case: Add { } leaves a valid deck', 'json', '{\n  "name": "x",\n  "slides": [{"title": "a"}],\n  "design":\n  "organization": {"id": "a", "name": "Acme"}\n}', [WAIT, ['quickFix', 'Add { }']], { has: '"design": {}', findings: { errors: 0 } }],
  ['J-FIX-004', 'R-FIX-01', 'remove the property without a value', 'json', '{\n  "name": "x",\n  "slides": [{"title": "a"}],\n  "design":\n}', [WAIT, ['quickFix', 'Remove "design"']], { not: 'design', findings: { errors: 0 } }],
  ['J-FIX-005', 'R-FIX-01', 'insert the missing closing brace', 'json', '{"slides": [{"title": "a"}]', [WAIT, ['quickFix', 'Insert }']], { findings: { errors: 0 } }],
  ['J-FIX-006', 'R-FIX-01', 'use double quotes', 'json', "{'slides': []}", [WAIT, ['quickFix', 'Use double quotes']], { has: '"slides"' }],
  ['J-FIX-020', 'R-FIX-06', 'Switch format to YAML reads the text as YAML', 'json', 'name: x\nslides:\n  - title: a\n', [WAIT, ['quickFix', 'Switch format to YAML']], { deck: { '/slides/0/title': 'a' }, format: 'yaml' }],
  ['J-FIX-024', 'R-FIX-01', 'the minimal deck for an empty document', 'json', ' ', [WAIT, ['quickFix', 'Insert minimal deck']], { findings: { errors: 0 } }],
  ['J-FIX-025', 'R-FIX-01', 'applying the fix of one error reveals nothing else when it was the only cause', 'json', '{"slides": [{"title": "a"},\n   {"title": "b"},]}', [WAIT, ['quickFix', 'Remove comma']], { deck: { '/slides/1/title': 'b' }, findings: { n: 0 } }],
];

// ---- F8 and the panel's keys -------------------------------------------------------------------------------------------------------------------
const TWO = '{"slides":[{"title":42}],"design":{"theme":"neon-dreams"}}';
export const jsonProblemKeys = [
  ['J-DIA-050', 'R-DIAG-05', 'F8 goes to the first problem and selects its range', 'json', TWO, [['waitProblems', 2], K('F8')], { text: '{"slides":[{"title":⟦42⟧}],"design":{"theme":"neon-dreams"}}' }],
  ['J-DIA-051', 'R-DIAG-05', 'F8 again goes to the next, wraps; Shift+F8 goes back', 'json', TWO, [['waitProblems', 2], K('F8'), K('F8'), K('F8'), K('Shift+F8')], { text: '{"slides":[{"title":42}],"design":{"theme":⟦"neon-dreams"⟧}}' }],
  ['J-DIA-052', 'R-DIAG-06', 'Mod+Shift+M moves focus to the first row of the panel', 'json', '{"slides":[{"title":42}]}', [WAIT, MS('m')], { focus: 'button.opf-source-finding' }],
  ['J-DIA-053', 'R-DIAG-06', 'Enter on a row selects its range and returns focus to the editor', 'json', '{"slides":[{"title":42}]}', [WAIT, MS('m'), K('Enter')], { focus: 'editor', text: '{"slides":[{"title":⟦42⟧}]}' }],
  ['J-DIA-054', 'R-DIAG-06', 'Escape returns to the editor', 'json', '{"slides":[{"title":42}]}', [WAIT, MS('m'), K('Escape')], { focus: 'editor' }],
  ['J-DIA-055', 'R-DIAG-06', 'ArrowDown, ArrowUp, Home and End move between rows', 'json', TWO, [['waitProblems', 2], MS('m'), K('ArrowDown'), ['expectRow', 1], K('ArrowUp'), ['expectRow', 0], K('End'), ['expectRow', 1], K('Home'), ['expectRow', 0]], {}],
  ['J-DIA-056', 'R-DIAG-07', 'the count is said after a pause', 'json', '{\n  |\n}', [T('"a" 1'), WAIT, ['waitLive', '1 problem|2 problems']], { live: '1 problem|2 problems' }],
  ['J-DIA-057', 'R-DIAG-07', 'a problem is said when the caret enters it', 'json', '{"slides":[{"title":42}]}', [WAIT, ['placeCaret', '42', false], K('ArrowRight')], { live: 'Error: `title` should be' }],
  ['J-DIA-058', 'R-DIAG-05', 'F8 says what the problem is', 'json', '{"slides":[{"title":42}]}', [WAIT, K('F8')], { live: 'Error: `title` should be text or a list' }],
  ['J-DIA-059', 'R-DIAG-05', 'F8 with no problems says so', 'json', '{"slides":[{"title":"a"}],"language":"en-US"}', [NONE, K('F8')], { live: 'No problems' }],
];

// ---- quick fixes -------------------------------------------------------------------------------------------------------------------------------
export const jsonFixes = [
  ['J-FIX-007', 'R-FIX-02', 'change an enum to a suggestion', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['placeCaret', '"middle"', false], ['quickFix', 'Change to center']], { deck: { '/design/titleAlignment': 'center' } }],
  ['J-FIX-008', 'R-FIX-02', 'rename an unknown key', 'json', '{"slids":[{"title":"a"}]}', [WAIT, ['placeCaret', '"slids"', false], ['quickFix', 'Rename to slides']], { deck: { '/slides/0/title': 'a' } }],
  ['J-FIX-010', 'R-FIX-02', 'add the missing required property', 'json', '{"name":"x"}', [WAIT, ['placeCaret', '{', false], ['quickFix', 'Add `slides`']], { deck: { '/slides/0/title': 'Slide title' } }],
  ['J-FIX-011', 'R-FIX-02', 'change an unresolved layout to a suggestion', 'json', '{"slides":[{"title":"a","layout":"pilars"}]}', [WAIT, ['placeCaret', '"pilars"', false], ['quickFix', 'Change to pillars']], { deck: { '/slides/0/layout': 'pillars' } }],
  ['J-FIX-012', 'R-FIX-02', 'wrap a string in a list', 'json', '{"slides":[{"items":"One"}]}', [WAIT, ['placeCaret', '"One"', false], ['quickFix', 'Wrap in a list']], { deck: { '/slides/0/items/0': 'One' } }],
  ['J-FIX-013', 'R-FIX-02', 'remove the second of two equal keys', 'json', '{"slides":[{"title":"a"}],"name":"a","name":"b"}', [WAIT, ['placeCaret', '"name":"b"', false], ['quickFix', 'Remove the second']], { deck: { '/name': 'a' } }],
  ['J-FIX-016', 'R-FIX-04', 'Mod+. with no fix on the line says so', 'json', '{\n  |"name": "x",\n  "slides": [{"title": "a"}]\n}', [NONE, M('.')], { live: 'No quick fixes' }],
  ['J-FIX-018', 'R-FIX-05', 'a fix is one undo step', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['placeCaret', '"middle"', false], ['quickFix', 'Change to center']], { undo: [1, '{"slides":[{"title":"a"}],"design":{"titleAlignment":|"middle"}}'] }],
  ['J-FIX-019', 'R-FIX-05', 'Escape closes the fix list without editing', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['placeCaret', '"middle"', false], M('.'), K('Escape')], { text: '{"slides":[{"title":"a"}],"design":{"titleAlignment":|"middle"}}' }],
  ['J-FIX-021', 'R-FIX-04', 'the fix list lists the safest first and the problem says how many', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['placeCaret', '"middle"', false], M('.')], { live: '3 quick fixes' }],
  ['J-FIX-022', 'R-FIX-05', 'a fix from the panel row works', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['clickRowFix', 'Change to center']], { deck: { '/design/titleAlignment': 'center' } }],
  ['J-FIX-023', 'R-FIX-05', 'Mod+. in the panel applies the first fix of the row', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, MS('m'), M('.')], { deck: { '/design/titleAlignment': 'center' } }],
];

// ---- accessibility -------------------------------------------------------------------------------------------------------------------------------
export const jsonA11y = [
  ['J-A11Y-001', 'R-A11Y-01', 'the editor is a labelled multi-line textbox described by the panel', 'json', '|', [], { attrs: { '.opf-source-code .cm-content': { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'OPF source' } } }],
  ['J-A11Y-002', 'R-A11Y-01', 'the description names Ctrl+Space and Escape then Tab', 'json', '|', [], { attrs: { '.opf-source-code .cm-content': { 'aria-description': /Control\+Space.*Escape then Tab/ } } }],
  ['J-A11Y-003', 'R-A11Y-01', 'while the list is open aria-activedescendant follows the selection', 'json', '{\n  "slides": [],\n  |\n}', [T('"des'), K('ArrowDown')], { attrs: { '.opf-source-code .cm-content': { 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox' } }, popup: { selectedIndex: 1 } }],
  ['J-A11Y-004', 'R-A11Y-02', 'opening the list says how many suggestions', 'json', '{\n  "slides": [],\n  "des|"\n}', [K('Control+Space')], { live: '3 suggestions' }],
  ['J-A11Y-005', 'R-A11Y-02', 'moving the selection says what it is', 'json', '{\n  "slides": [],\n  |\n}', [T('"des'), K('ArrowDown'), ['waitLive', 'description, property']], { live: 'description, property.*prose' }],
  ['J-A11Y-006', 'R-A11Y-02', 'accepting says what was inserted', 'json', '{\n  "slides": [],\n  |\n}', [T('"des'), K('Tab')], { live: 'Inserted design' }],
  ['J-A11Y-007', 'R-A11Y-02', 'a snippet says its first tab stop', 'json', '{\n  "slides": [|]\n}', [T('slide'), K('Tab')], { live: 'Tab stop 1 of 2: Slide title' }],
  ['J-A11Y-007b', 'R-A11Y-02', 'Tab says the next stop', 'json', '{\n  "slides": [|]\n}', [T('slide'), K('Tab'), K('Tab')], { live: 'Tab stop 2 of 2: First point' }],
  ['J-A11Y-008', 'R-A11Y-03', 'Escape then Tab leaves the editor', 'json', '{"slides":[{"title":42}]}', [WAIT, K('Escape'), K('Tab')], { focus: 'button.opf-source-findings-toggle' }, { engines: ['chromium', 'firefox'] }],
  ['J-A11Y-009', 'R-A11Y-03', 'Ctrl+M (Ctrl+Shift+M on macOS) makes Tab leave the editor', 'json', '{"slides":[{"title":42}]}', [WAIT, K('Control+m'), K('Tab')], { focus: 'button.opf-source-findings-toggle' }, { plat: '!darwin' }],
  ['J-A11Y-009b', 'R-A11Y-03', 'Ctrl+Shift+M makes Tab leave the editor on macOS', 'json', '{"slides":[{"title":42}]}', [WAIT, K('Control+Shift+m'), K('Tab')], { focus: 'button.opf-source-findings-toggle' }, { plat: 'darwin', engines: ['chromium', 'firefox'] }],
  ['J-A11Y-011', 'R-A11Y-04', 'the findings toggle has aria-expanded and the region a label', 'json', '{"slides":[{"title":42}]}', [WAIT], { attrs: { '.opf-source-findings-toggle': { 'aria-expanded': 'true' }, '.opf-source-findings': { 'aria-label': 'Source findings' } } }],
  ['J-A11Y-013', 'R-A11Y-04', 'a finding row names its severity first', 'json', '{"slides":[{"title":42}]}', [WAIT], { findings: { rows: [{ text: '`title` should be' }] } }],
];

// ---- other formats share the squiggles, F8 and the panel -------------------------------------------------------------------------------------
export const otherFormats = [
  ['Y-DIA-001', 'R-DIAG-04', 'a YAML syntax error is underlined and F8 reaches it', 'yaml', 'name: x\nslides:\n  - title: "a\n', [WAIT, K('F8')], { findings: { n: 1 }, has: 'title' }],
  ['M-DIA-001', 'R-DIAG-04', 'a Markdown finding with a range is underlined', 'md', '---\nname: x\n', [['waitProblems', 1]], { findings: { n: 1 } }],
  ['X-RO-004', 'R-PANE-04', 'read only: the list does not open', 'json', '{\n  "slides": [{"title": "a"}],\n  |\n}', [['readOnly', true], K('Control+Space')], { popup: { open: 0 } }],
  ['J-MUL-010', 'R-CMP-12', 'with two cursors Ctrl+Space then Enter writes the item at both', 'json', '{\n  "slides": [{}, {}]\n}', [['addCursors', ['[{', '}, {']], K('Control+Space'), K('Enter')], { cursors: 2, popup: { open: 0 } }],
];

export const jsonDiagnostics = [...jsonHover, ...jsonSyntax, ...jsonSyntaxFixes, ...jsonSchemaDiagnostics, ...jsonProblemKeys, ...jsonFixes, ...jsonA11y, ...otherFormats];
