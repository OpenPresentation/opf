// Phase 2 YAML cases of artifacts/source-editor/TEST-PLAN.md, section 5: when the list opens (also in flow style and after a list dash), what accepting
// writes, Enter and indentation, pairs, comments, problems with their positions, Canonicalize with OPF, hover and undo. Real keyboard events in a real
// browser. Row format: [id, requirement, title, format, doc, steps, expect, options?]; see support/source-keyboard.mjs. `⟦⟧` is the caret where the
// text has a `|` of its own (a block scalar).
import { FAST, K, M, T, platform } from '../source-keyboard.mjs';
import { phase4Yaml } from './phase4-extras.mjs';

// VS Code's fold keys: Cmd+Alt+[ and ] on macOS, Ctrl+Shift+[ and ] elsewhere (where Ctrl+Alt+[ folds everything). The key is named by its code: a synthetic
// Shift+[ carries the key "[", which is Indent less, where a real keyboard sends "{".
const FOLD = platform === 'darwin' ? 'Meta+Alt+[' : 'Control+Shift+BracketLeft';
const UNFOLD = platform === 'darwin' ? 'Meta+Alt+]' : 'Control+Shift+BracketRight';

const DECK_YAML = 'name: Q3 Review\nslides:\n  - title: Q3 Review\n  - title: Highlights\n    items:\n      - Revenue up 12%\n      - Churn down\n';
const wait = ['waitPopup'];

export const yamlTriggers = [
  ['Y-TRG-001', 'R-CMP-20', 'Ctrl+Space at a new key line', 'yaml', 'name: x\n|', [K('Control+Space')], { popup: { open: 1, has: ['slides', 'design', 'description'], not: ['name'] } }],
  ['Y-TRG-002', 'R-CMP-20', 'typing a key prefix opens the list', 'yaml', 'name: x\n|', [T('des')], { popup: { open: 1, has: ['description', 'design', 'datasets'] } }],
  ['Y-TRG-003', 'R-CMP-20', 'the space after "key:" opens the value list (enum)', 'yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment:|', [T(' ')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['Y-TRG-004', 'R-CMP-20', 'the space after "-" under slides offers the slide keys and snippets', 'yaml', 'slides:\n  -|', [T(' ')], { popup: { open: 1, has: ['title', 'items', 'slide'] } }],
  ['Y-TRG-005', 'R-CMP-20', 'catalog ids', 'yaml', 'slides:\n  - layout: |', [K('Control+Space')], { popup: { open: 1, has: ['agenda', 'pillars'] } }],
  ['Y-TRG-006', 'R-CMP-20', 'booleans', 'yaml', 'slides:\n  - hidden: |', [K('Control+Space')], { popup: { open: 1, has: ['true', 'false'], count: [2, 2] } }],
  ['Y-TRG-007', 'R-CMP-04', 'comments never open the list', 'yaml', 'name: x # |', [T('des')], { popup: { open: 0 } }],
  ['Y-TRG-008', 'R-CMP-04', 'block scalar text never opens the list', 'yaml', 'slides:\n  - notes: |\n      ⟦⟧', [T('des')], { popup: { open: 0 } }],
  ['Y-TRG-009', 'R-CMP-04', 'a free text value never opens the list', 'yaml', 'slides:\n  - title: |', [T('Rev')], { popup: { open: 0 } }],
  ['Y-TRG-010', 'R-CMP-20', 'a blank document offers the deck snippet', 'yaml', '|', [K('Control+Space')], { popup: { open: 1, has: ['deck', 'slides'] } }],
  ['Y-TRG-011', 'R-CMP-20', 'flow sequence item values', 'yaml', 'audience: [|]', [K('Control+Space')], { popup: { open: 1, has: ['board'] } }],
  ['Y-TRG-012', 'R-CMP-20', 'nested under design: keys of Design only', 'yaml', 'slides:\n  - title: a\ndesign:\n  |', [K('Control+Space')], { popup: { open: 1, has: ['theme', 'colorScheme', 'fontScheme'], not: ['slides'] } }],
  ['Y-TRG-013', 'R-CMP-20', 'a flow mapping offers keys', 'yaml', 'design: {theme: minimal, |}', [K('Control+Space')], { popup: { open: 1, has: ['colorScheme', 'fontScheme'], not: ['theme'] } }],
  ['Y-TRG-014', 'R-CMP-20', 'a flow mapping value offers the enum', 'yaml', 'design: {titleAlignment: |}', [K('Control+Space')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['Y-TRG-015', 'R-CMP-20', 'items of a list of ids', 'yaml', 'audience:\n  - |', [K('Control+Space')], { popup: { open: 1, has: ['board', 'customer'] } }],
  ['Y-TRG-016', 'R-CMP-04', 'a list of lines of text never opens', 'yaml', 'slides:\n  - title: a\n    items:\n      - |', [T('Rev')], { popup: { open: 0 } }],
  ['Y-TRG-017', 'R-CMP-20', 'a quoted key opens the list inside the quotes', 'yaml', '"|"', [T('des')], { popup: { open: 1, has: ['design'] } }],
  ['Y-TRG-018', 'R-CMP-20', 'keys already in the mapping, above and below, are not offered', 'yaml', 'name: x\n|\nslides: []\n', [K('Control+Space')], { popup: { open: 1, has: ['design'], not: ['name', 'slides'] } }],
  ['Y-TRG-019', 'R-CMP-20', 'a second slide item offers the slide keys again', 'yaml', 'slides:\n  - title: a\n  - |', [K('Control+Space')], { popup: { open: 1, has: ['title', 'items', 'slide'] } }],
  ['Y-TRG-020', 'R-CMP-20', 'the keys of a slide item continue on its next line', 'yaml', 'slides:\n  - title: a\n    |', [K('Control+Space')], { popup: { open: 1, has: ['items', 'layout'], not: ['title'] } }],
  ['Y-TRG-021', 'R-CMP-03', 'Ctrl+Space right after the colon, with no space, still offers the values', 'yaml', 'design:\n  titleAlignment:|', [K('Control+Space')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['Y-TRG-022', 'R-CMP-20', 'the required keys come first', 'yaml', 'organization:\n  |', [K('Control+Space')], { popup: { open: 1, first: 'id' } }],
  ['Y-TRG-023', 'R-CMP-04', 'a number field opens nothing', 'yaml', 'duration: |', [T('4')], { popup: { open: 0 } }],
  ['Y-TRG-024', 'R-CMP-20', 'a value inside quotes lists the ids', 'yaml', 'slides:\n  - layout: "|"', [K('Control+Space')], { popup: { open: 1, has: ['pillars'] } }],
];

export const yamlInsert = [
  ['Y-ACC-001', 'R-CMP-05', 'Tab accepts a key (an object key goes on the next line; phase 3: variables, since accepting design starts the design snippet)', 'yaml', 'name: x\n|', [T('variab'), K('Tab')], { text: 'name: x\nvariables:\n  |' }],
  ['Y-ACC-002', 'R-CMP-06', 'Enter accepts, with no race', 'yaml', 'name: x\n|', [FAST('desi', 'Enter', 0)], { has: 'design:' }],
  ['Y-ACC-005', 'R-CMP-06', 'Enter accepts 40 ms after the last key', 'yaml', 'name: x\n|', [FAST('desi', 'Enter', 40)], { has: 'design:' }],
  ['Y-ACC-006', 'R-CMP-06', 'Tab accepts 80 ms after the last key', 'yaml', 'name: x\n|', [FAST('desi', 'Tab', 80)], { has: 'design:' }],
  ['Y-ACC-007', 'R-CMP-06', 'Enter accepts 120 ms after the last key', 'yaml', 'name: x\n|', [FAST('desi', 'Enter', 120)], { has: 'design:' }],
  ['Y-ACC-008', 'R-CMP-06', 'Tab accepts 160 ms after the last key', 'yaml', 'name: x\n|', [FAST('desi', 'Tab', 160)], { has: 'design:' }],
  ['Y-ACC-003', 'R-CMP-07', 'Escape closes the list and keeps the text', 'yaml', 'name: x\n|', [T('des'), K('Escape')], { popup: { open: 0 }, text: 'name: x\ndes|' }],
  ['Y-ACC-004', 'R-CMP-05', 'Tab with no list indents', 'yaml', 'name: x|', [K('Tab')], { text: 'name: x |', popup: { open: 0 } }],
  ['Y-INS-001', 'R-CMP-21', 'a scalar key: "key: " and the caret', 'yaml', 'name: x\n|', [T('descr'), K('Tab')], { text: 'name: x\ndescription: |' }],
  ['Y-INS-002', 'R-CMP-21', 'an enum key chains into the value list', 'yaml', 'design:\n  |', [T('titleA'), K('Tab'), wait], { popup: { open: 1, has: ['left', 'center', 'right'] }, text: 'design:\n  titleAlignment: |' }],
  ['Y-INS-003', 'R-CMP-21', 'a list key: "- " on the next line', 'yaml', '|', [T('slid'), K('Tab')], { text: 'slides:\n  - |' }],
  ['Y-INS-004', 'R-CMP-21', 'an object key with required members (phase 3: organization is a snippet key, its placeholders hold acme and Acme Inc.)', 'yaml', '|', [T('organ'), K('Tab')], { text: 'organization:\n  id: ⟦acme⟧\n  name: Acme Inc.' }],
  ['Y-INS-004b', 'R-CMP-16', 'Tab walks the required members', 'yaml', '|', [T('organ'), K('Tab'), T('acme'), K('Tab'), T('Acme')], { deck: { '/organization/id': 'acme', '/organization/name': 'Acme' } }],
  ['Y-INS-005', 'R-CMP-21', 'an enum value is a plain scalar', 'yaml', 'design:\n  titleAlignment: |', [T('cen'), K('Tab')], { text: 'design:\n  titleAlignment: center|' }],
  ['Y-INS-006', 'R-CMP-21', 'a boolean is true or false', 'yaml', 'slides:\n  - hidden: |', [T('tr'), K('Tab')], { text: 'slides:\n  - hidden: true|' }],
  ['Y-INS-007', 'R-CMP-21', 'a catalog id inserts the bare id', 'yaml', 'slides:\n  - layout: |', [T('pil'), K('Enter')], { text: 'slides:\n  - layout: pillars|' }],
  ['Y-INS-008', 'R-CMP-21', 'a key before an existing colon keeps it', 'yaml', 'na|: x', [K('Control+Space'), K('Enter')], { text: 'name|: x', not: '::' }],
  ['Y-INS-009', 'R-CMP-16', 'the slide snippet after "- "', 'yaml', 'slides:\n  - |', [T('slide'), K('Tab')], { has: 'title: Slide title\n    items:\n      - First point', deck: { '/slides/0/title': 'Slide title', '/slides/0/items/0': 'First point' } }],
  ['Y-INS-010', 'R-CMP-16', 'the chart snippet writes YAML', 'yaml', 'slides:\n  - |', [T('slide-chart'), K('Tab')], { deck: { '/slides/0/chart/type': 'column', '/slides/0/chart/data/columns': ['Category', 'Value'] } }],
  ['Y-INS-011', 'R-CMP-16', 'Tab walks the stops of a snippet and typing replaces a placeholder', 'yaml', 'slides:\n  - |', [T('slide'), K('Tab'), T('Hi'), K('Tab'), T('x')], { deck: { '/slides/0/title': 'Hi', '/slides/0/items/0': 'x' } }],
  ['Y-INS-012', 'R-CMP-16', 'the quote snippet', 'yaml', 'slides:\n  - |', [T('slide-quote'), K('Tab')], { deck: { '/slides/0/quote/text': 'Quote', '/slides/0/quote/attribution': 'Name, Title' } }],
  ['Y-INS-013', 'R-CMP-16', 'a number placeholder stays a number', 'yaml', 'slides:\n  - |', [T('slide-metric'), K('Tab')], { deck: { '/slides/0/metric/value': '42', '/slides/0/metric/label': 'Label' } }],
  ['Y-INS-014', 'R-CMP-21', 'a key in a flow mapping is written as "key: "', 'yaml', 'design: {|}', [T('them'), K('Tab')], { text: 'design: {theme: |}' }],
  ['Y-INS-015', 'R-CMP-21', 'a value inside quotes keeps the quotes', 'yaml', 'slides:\n  - layout: "pi|"', [K('Control+Space'), K('Enter')], { text: 'slides:\n  - layout: "pillars"|' }],
  ['Y-INS-016', 'R-CMP-21', 'a list key after a dash nests under the key, past the dash', 'yaml', 'slides:\n  - title: a\n    |', [T('items'), K('Tab')], { text: 'slides:\n  - title: a\n    items:\n      - |' }],
  ['Y-INS-017', 'R-CMP-21', 'Shift+Enter replaces the whole word', 'yaml', 'na|me: x', [K('Control+Space'), K('Shift+Enter')], { has: 'name: x' }],
  ['Y-INS-018', 'R-CMP-21', 'a value in a flow list', 'yaml', 'audience: [|]', [T('boa'), K('Tab')], { text: 'audience: [board|]' }],
  ['Y-INS-019', 'R-CMP-21', 'the list-key template: second slide item', 'yaml', 'slides:\n  - title: a\n  - |', [T('slide'), K('Tab')], { deck: { '/slides/1/title': 'Slide title' } }],
  ['Y-UND-001', 'R-UND-01', 'accepting a key is one undo step', 'yaml', 'name: x\n|', [T('descr'), K('Tab'), T('Hello')], { undo: [1, 'name: x\ndescription: |'] }],
  ['Y-UND-002', 'R-UND-01', 'a snippet is one undo step', 'yaml', 'slides:\n  - |', [T('slide'), K('Tab')], { undo: [1, 'slides:\n  - slide|'] }],
];

export const yamlEnter = [
  ['Y-ENT-001', 'R-KEY-04', 'Enter after "key:" indents one unit', 'yaml', 'slides:|', [K('Enter')], { text: 'slides:\n  |' }],
  ['Y-ENT-002', 'R-KEY-04', 'Enter after "- key: v" aligns under the key', 'yaml', 'slides:\n  - title: a|', [K('Enter')], { text: 'slides:\n  - title: a\n    |' }],
  ['Y-ENT-003', 'R-KEY-04', 'Enter after "key: |" indents the block', 'yaml', 'slides:\n  - notes: |⟦⟧', [K('Enter')], { text: 'slides:\n  - notes: |\n      |' }],
  ['Y-ENT-004', 'R-KEY-04', 'Enter in a block scalar keeps its indent', 'yaml', 'a: |\n  one⟦⟧', [K('Enter')], { text: 'a: |\n  one\n  |' }],
  ['Y-ENT-005', 'R-KEY-04', 'Enter on an empty "- " leaves the list', 'yaml', 'slides:\n  - title: a\n  - |', [K('Enter')], { text: 'slides:\n  - title: a\n|' }],
  ['Y-ENT-006', 'R-KEY-04', 'Enter after a top-level scalar keeps column 0', 'yaml', 'name: x|', [K('Enter')], { text: 'name: x\n|' }],
  ['Y-ENT-007', 'R-KEY-04', 'Enter after "- key:" indents past the key', 'yaml', 'slides:\n  - items:|', [K('Enter')], { text: 'slides:\n  - items:\n      |' }],
  ['Y-ENT-008', 'R-KEY-04', 'Enter after a list item that is a value goes on with the next dash', 'yaml', 'audience:\n  - board|', [K('Enter')], { text: 'audience:\n  - board\n  - |' }],
  ['Y-ENT-009', 'R-KEY-04', 'Enter splits a line and keeps the text after the caret', 'yaml', 'a: 1|b: 2', [K('Enter')], { text: 'a: 1\nb: 2' .replace('b', '|b') }],
  ['Y-ENT-010', 'R-KEY-04', 'Enter with a selection replaces it', 'yaml', 'a: ⟦x⟧', [K('Enter')], { text: 'a: \n  |' }],
  ['Y-ENT-011', 'R-KEY-04', 'Enter after an empty nested "- " moves out one level', 'yaml', 'slides:\n  - items:\n      - one\n      - |', [K('Enter')], { text: 'slides:\n  - items:\n      - one\n    |' }],
  ['Y-ENT-012', 'R-KEY-04', 'Enter on an empty indented line keeps the indent', 'yaml', 'design:\n  |', [K('Enter')], { text: 'design:\n  \n  |' }],
  ['Y-ENT-013', 'R-KEY-04', 'Enter accepts a list item when the list is open', 'yaml', 'name: x\n|', [T('descr'), K('Enter')], { text: 'name: x\ndescription: |' }],
];

export const yamlPairs = [
  ['Y-PAIR-001', 'R-PAIR-01', 'quote pairs', 'yaml', 'a: |', [T('"hi')], { text: 'a: "hi|"' }],
  ['Y-PAIR-002', 'R-PAIR-01', 'an apostrophe inside a word is not paired', 'yaml', 'a: it|', [T("'s")], { text: "a: it's|" }],
  ['Y-PAIR-003', 'R-PAIR-01', '[ pairs', 'yaml', 'a: |', [T('[1')], { text: 'a: [1|]' }],
  ['Y-PAIR-004', 'R-PAIR-01', '{ pairs', 'yaml', 'a: |', [T('{b: 1')], { text: 'a: {b: 1|}' }],
  ['Y-PAIR-005', 'R-PAIR-02', 'typing the closer overtypes it', 'yaml', 'a: |', [T('[1]')], { text: 'a: [1]|' }],
  ['Y-PAIR-006', 'R-PAIR-05', 'a quote around a selection', 'yaml', 'a: ⟦x⟧', [T('"')], { text: 'a: "⟦x⟧"' }],
  ['Y-PAIR-007', 'R-PAIR-01', '( is not paired in YAML', 'yaml', 'a: |', [T('(x')], { text: 'a: (x|' }],
  ['Y-PAIR-008', 'R-PAIR-03', 'Backspace between an empty pair deletes both', 'yaml', 'a: [|]', [K('Backspace')], { text: 'a: |' }],
  ['Y-PAIR-009', 'R-PAIR-05', '[ around a selection', 'yaml', 'a: ⟦x⟧', [T('[')], { text: 'a: [⟦x⟧]' }],
  ['Y-CMT-001', 'R-KEY-09', 'Mod+/ comments a line', 'yaml', 'name: x|', [M('/')], { text: '# name: x|' }],
  ['Y-CMT-002', 'R-KEY-09', 'Mod+/ again uncomments', 'yaml', '# name: x|', [M('/')], { text: 'name: x|' }],
  ['Y-CMT-003', 'R-KEY-09', 'a multi-line selection', 'yaml', '⟦a: 1\nb: 2⟧', [M('/')], { has: '# a: 1\n# b: 2' }],
];

export const yamlDiagnostics = [
  ['Y-DIA-007', 'R-DIAG-03', 'an enum error is at the value, with line and column', 'yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: middle\n', [['waitProblems', 1]], { findings: { rows: [{ line: 4, col: 19, text: 'titleAlignment' }] }, squiggles: [{ text: 'middle' }] }, { notify: true }],
  ['Y-DIA-012', 'R-DIAG-04', 'every finding has a squiggle at its value', 'yaml', 'slides:\n  - title: 42\n', [['waitProblems', 1]], { squiggles: [{ sev: 'error', text: '42' }], findings: { rows: [{ line: 2, col: 12 }] } }, { notify: true }],
  ['Y-DIA-013', 'R-DIAG-05', 'F8 selects the problem range', 'yaml', 'slides:\n  - title: 42\n', [['waitProblems', 1], K('F8')], { text: 'slides:\n  - title: ⟦42⟧\n' }, { notify: true }],
  ['Y-DIA-014', 'R-DIAG-04', 'a finding about a nested list item is at the item', 'yaml', 'slides:\n  - title: a\n    items:\n      - ok\n      - 7\n', [['waitProblems', 1]], { squiggles: [{ text: '7' }] }, { notify: true }],
  ['Y-DIA-015', 'R-DIAG-04', 'an unknown key is underlined at the key', 'yaml', 'slides:\n  - title: a\n    bogus: 1\n', [['waitProblems', 1]], { squiggles: [{ text: 'bogus' }] }, { notify: true }],
];

export const yamlFormat = [
  ['Y-FMT-010', 'R-FMT-02', 'Canonicalize asks before it drops comments, says how many, and Cancel keeps the text', 'yaml', '# keep\nname: x # inline\nslides:\n  - title: a\n|', [['canonicalize']], { confirm: { open: true, has: ['2 comments'], focusInside: true }, has: '# keep' }],
  ['Y-FMT-011', 'R-FMT-02', 'Cancel leaves the text and returns the focus', 'yaml', '# keep\nname: x\nslides:\n  - title: a\n|', [['canonicalize'], ['cancelConfirm']], { confirm: { open: false }, focus: 'editor', has: '# keep' }],
  ['Y-FMT-012', 'R-FMT-02', 'Canonicalize anyway rewrites through OPF and undo brings the comments back', 'yaml', '# keep\nname: x\nslides:\n  - title: a\n|', [['canonicalize'], ['confirm']], { not: '# keep', confirm: { open: false }, undo: [1, '# keep\nname: x\nslides:\n  - title: a\n|'] }],
  ['Y-FMT-013', 'R-FMT-02', 'Escape closes the question', 'yaml', '# keep\nname: x\nslides:\n  - title: a\n|', [['canonicalize'], K('Escape')], { confirm: { open: false }, focus: 'editor', has: '# keep' }],
  ['Y-FMT-014', 'R-FMT-02', 'with no comments it rewrites at once', 'yaml', 'name:    x\nslides:\n  - title: a\n|', [['canonicalize']], { confirm: { open: false }, has: 'name: x\nslides:' }],
  ['Y-FMT-015', 'R-FMT-02', 'the button is not there for JSON', 'json', '{"slides": []}', [], { attrs: { '.opf-source-action-canonicalize': { hidden: '' } } }],
  ['Y-FMT-016', 'R-FMT-02', 'Format still keeps the comments', 'yaml', '# keep\nname:    x\nslides: []\n|', [K('Alt+Shift+f')], { has: '# keep\nname: x', confirm: { open: false } }],
];

export const yamlHover = [
  ['Y-HOV-001', 'R-HOV-01', 'a key shows its description and type', 'yaml', 'name: Deck\nslides:\n  - title: a\n    layout: pillars\n', [['hoverText', 'layout']], { hover: { open: true, has: ['layout'] } }],
  ['Y-HOV-002', 'R-HOV-02', 'a catalog id shows the record', 'yaml', 'slides:\n  - title: a\n    layout: pillars\n', [['hoverText', 'pillars']], { hover: { open: true, has: ['Pillars'] } }],
  ['Y-HOV-003', 'R-HOV-01', 'free text shows nothing', 'yaml', 'slides:\n  - title: Hello there\n', [['hoverText', 'Hello']], { hover: { open: false } }],
  ['Y-HOV-004', 'R-HOV-01', 'Mod+K Mod+I shows the hover at the caret', 'yaml', 'design:\n  titleAlign⟦⟧ment: left\n', [['chord', 'Mod+k', 'Mod+i']], { hover: { open: true, has: ['titleAlignment'] } }],
];

export const yamlCases = [...yamlTriggers, ...yamlInsert, ...yamlEnter, ...yamlPairs, ...yamlDiagnostics, ...yamlFormat, ...yamlHover];
export { DECK_YAML };

// Quick fixes in YAML (Cmd/Ctrl+. at the problem): the same fixes as in JSON, written as text edits that keep comments and layout.
export const yamlFixes = [
  ['Y-FIX-003', 'R-FIX-02', 'change an enum value to a suggestion', 'yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: middle\n', [['waitProblems', 1], ['quickFix', 'Change to center']], { deck: { '/design/titleAlignment': 'center' }, text: 'slides:\n  - title: a\ndesign:\n  titleAlignment: ⟦center⟧\n' }, { notify: true }],
  ['Y-FIX-005', 'R-FIX-02', 'a fix keeps the comments around it', 'yaml', '# deck\nslides:\n  - title: a\ndesign:\n  # how titles line up\n  titleAlignment: middle # was a guess\n', [['waitProblems', 1], ['quickFix', 'Change to center']], { has: '# how titles line up\n  titleAlignment: center # was a guess' }, { notify: true }],
  ['Y-FIX-006', 'R-FIX-02', 'a quoted value stays quoted', 'yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: "middle"\n', [['waitProblems', 1], ['quickFix', 'Change to center']], { has: 'titleAlignment: "center"' }, { notify: true }],
  ['Y-FIX-007', 'R-FIX-01', 'rename an unknown key', 'yaml', 'slides:\n  - title: a\n    layot: cover\n', [['waitProblems', 1], ['quickFix', 'Rename to layout']], { deck: { '/slides/0/layout': 'cover' } }, { notify: true }],
  ['Y-FIX-008', 'R-FIX-01', 'remove an unknown key with its line', 'yaml', 'slides:\n  - title: a\n    bogus: 1\n    items:\n      - x\n', [['waitProblems', 1], ['quickFix', 'Remove property']], { text: 'slides:\n  - title: a\n|    items:\n      - x\n' }, { notify: true }],
  ['Y-FIX-009', 'R-FIX-01', 'add a missing required key', 'yaml', 'slides:\n  - title: a\norganization:\n  id: acme\n', [['waitProblems', 1], ['quickFix', 'Add `name`']], { deck: { '/organization/name': 'Acme Corp' } }, { notify: true }],
  ['Y-FIX-010', 'R-FIX-01', 'a fix is one undo step', 'yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: middle\n', [['waitProblems', 1], ['quickFix', 'Change to center']], { undo: [1, 'slides:\n  - title: a\ndesign:\n  titleAlignment: ⟦middle⟧\n'] }, { notify: true }],
];
yamlCases.push(...yamlFixes);

// Docs, accessible names and announcements in YAML: the same machinery as JSON.
export const yamlAccess = [
  ['Y-DOC-001', 'R-CMP-17', 'the selected key shows its schema description', 'yaml', 'name: x\n|', [T('desc')], { docs: { shown: true, has: ['description'] } }],
  ['Y-DOC-002', 'R-CMP-17', 'layout ids show name, description and regions', 'yaml', 'slides:\n  - layout: |', [T('pill')], { docs: { has: ['Pillars', 'Regions: title, pillars'] } }],
  ['Y-DOC-003', 'R-A11Y-01', 'each option has an accessible name with its position', 'yaml', 'slides: []\n|', [T('des'), ['waitLabels']], { popup: { ariaNames: [/^design, property, Design\. 1 of 3$/, /^description, property, string\. 2 of 3$/] } }],
  ['Y-DOC-004', 'R-CMP-17', 'Ctrl+Space with the list open hides and shows the documentation', 'yaml', 'name: x\n|', [T('des'), K('Control+Space'), ['expectDocs', false], K('Control+Space'), ['expectDocs', true]], {}],
  ['Y-A11Y-001', 'R-A11Y-02', 'opening the list says how many suggestions', 'yaml', 'slides: []\ndes|', [K('Control+Space')], { live: '3 suggestions' }],
  ['Y-A11Y-002', 'R-A11Y-02', 'accepting says what was inserted', 'yaml', 'name: x\n|', [T('descr'), K('Tab')], { live: 'Inserted description' }],
  ['Y-A11Y-003', 'R-A11Y-02', 'a snippet announces its first tab stop', 'yaml', 'slides:\n  - |', [T('slide'), K('Tab')], { live: 'Tab stop 1 of 2' }],
  ['Y-A11Y-004', 'R-A11Y-01', 'the list is announced to assistive technology while open', 'yaml', 'name: x\n|', [T('des')], { attrs: { '.opf-source-code .cm-content': { 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox' } } }],
];
yamlCases.push(...yamlAccess);

yamlCases.push(
  ['Y-ENT-020', 'R-KEY-04', 'with smartListEnter off Enter after a list value only keeps the item column', 'yaml', 'audience:\n  - board|', [K('Enter')], { text: 'audience:\n  - board\n  |' }, { query: '?smartListEnter=off' }],
);

yamlCases.push(
  ['Y-FOLD-001', 'R-KEY-11', 'Mod+Alt+[ folds a mapping', 'yaml', 'slides:|\n  - title: a\n  - title: b\n', [['press', FOLD], ['expectFolded', 1]], {}],
  ['Y-FOLD-002', 'R-KEY-11', 'Mod+Alt+] unfolds it', 'yaml', 'slides:|\n  - title: a\n  - title: b\n', [['press', FOLD], ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', 0]], {}],
);

yamlCases.push(
  ['Y-FMT-017', 'R-FMT-02', 'switching the format closes the question', 'yaml', '# keep\nname: x\nslides:\n  - title: a\n|', [['canonicalize'], ['format', 'json']], { confirm: { open: false }, format: 'json' }],
);

// Cross references inside the document (SPEC 3.4) in YAML: block and flow style, and a list entry.
const YSALES = 'datasets:\n  sales:\n    columns: [Quarter, Revenue, {name: Costs}]\n    rows: []\n  pipeline:\n    columns:\n      - Stage\n    rows: []\n';
const YXREF = [
  ['asset:', 'assets:\n  logo: logo.png\n  photo:\n    src: p.jpg\nslides:\n  - image: |', ['asset:logo', 'asset:photo']],
  ['asset: in a quoted value', 'assets:\n  logo: logo.png\nslides:\n  - image: "|"', ['asset:logo']],
  ['asset: in an image object', 'assets:\n  logo: logo.png\nslides:\n  - image:\n      src: |', ['asset:logo']],
  ['dataset', `${YSALES}slides:\n  - chart:\n      type: bar\n      data:\n        dataset: |`, ['sales', 'pipeline']],
  ['dataset of a table', `${YSALES}slides:\n  - table:\n      dataset: |`, ['sales', 'pipeline']],
  ['dataset columns, block list', `${YSALES}slides:\n  - table:\n      dataset: sales\n      fields:\n        - |`, ['Quarter', 'Revenue', 'Costs']],
  ['dataset columns, flow list', `${YSALES}slides:\n  - table:\n      dataset: sales\n      fields: [Quarter, |]`, ['Quarter', 'Revenue', 'Costs']],
  ['dataset column of a mapping', `${YSALES}slides:\n  - chart:\n      type: bar\n      data:\n        dataset: sales\n      mapping:\n        category: |`, ['Quarter', 'Revenue', 'Costs']],
  ['cite', 'references:\n  - id: smith2020\n    text: Smith\nslides:\n  - title:\n      - text: x\n        cite: |', ['smith2020']],
  ['cite in a flow list', 'references:\n  - id: smith2020\n    text: Smith\nslides:\n  - title:\n      - text: x\n        cite: [|]', ['smith2020']],
  ['beat', 'narrative: classic-story\nslides:\n  - beat: |', ['opening', 'closing']],
  ['region', 'slides:\n  - layout: two-column\n    blocks:\n      - region: |', ['first', 'second', 'left', 'right']],
  ['var:', 'variables:\n  brand:\n    type: color\n    value: "#123456"\nslides:\n  - title:\n      - text: x\n        color: |', ['var:brand']],
];
export const yamlXrefs = [
  ...YXREF.map(([field, doc, has], index) => [`Y-VAL-X${index + 1}`, 'R-CMP-19', `cross reference ${field}`, 'yaml', doc, [K('Control+Space')], { popup: { open: 1, has } }]),
  ['Y-VAL-X14', 'R-CMP-19', 'columns come from the dataset the field names', 'yaml', `${YSALES}slides:\n  - table:\n      dataset: pipeline\n      fields:\n        - |`, [K('Control+Space')], { popup: { open: 1, has: ['Stage'], not: ['Revenue'] } }],
  ['Y-VAL-X15', 'R-CMP-19', 'Tab inserts the plain id', 'yaml', 'assets:\n  logo: a.png\n  photo: b.png\nslides:\n  - image: |', [T('pho'), K('Tab')], { text: 'assets:\n  logo: a.png\n  photo: b.png\nslides:\n  - image: asset:photo|', deck: { '/slides/0/image': 'asset:photo' } }],
  ['Y-VAL-X16', 'R-CMP-19', 'the value inside quotes keeps them', 'yaml', 'assets:\n  logo: a.png\nslides:\n  - image: "|"', [K('Control+Space'), K('Enter')], { text: 'assets:\n  logo: a.png\nslides:\n  - image: "asset:logo"|' }],
  ['Y-VAL-X17', 'R-CMP-19', 'a beat is inserted bare', 'yaml', 'narrative: classic-story\nslides:\n  - beat: |', [T('open'), K('Tab')], { has: 'beat: opening', deck: { '/slides/0/beat': 'opening' } }],
  ['Y-VAL-X18', 'R-CMP-19', 'a document with no assets offers nothing for an image', 'yaml', 'slides:\n  - image: |', [K('Control+Space')], { popup: { open: 0 } }],
  ['Y-VAL-X19', 'R-CMP-19', '{{ in a text lists the variables and Tab closes the braces', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: "Hello |"', [T('{{'), K('Tab')], { has: 'title: "Hello {{brand}}"' }],
  ['Y-VAL-X20', 'R-CMP-19', '{{ in a plain scalar', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: Hello |', [T('{{br'), K('Enter')], { has: 'title: Hello {{brand}}' }],
  ['Y-VAL-X21', 'R-CMP-19', 'a list entry of cite is offered the ids too', 'yaml', 'references:\n  - id: smith2020\n    text: Smith\nslides:\n  - title:\n      - text: x\n        cite:\n          - |', [K('Control+Space')], { popup: { open: 1, has: ['smith2020'] } }],
];
yamlCases.push(...yamlXrefs);

// Snippets for the keys of a deck (SPEC 5): design, organization, speaker; and a key with its value as one undo step.
export const yamlSnippets = [
  ['Y-SNP-001', 'R-CMP-16', 'design: accepting the key writes the three members and opens the theme list', 'yaml', 'name: x\n|', [T('design'), K('Tab')], { popup: { open: 1, has: ['bold', 'classic', 'minimal'] }, text: 'name: x\ndesign:\n  theme: |\n  colorScheme: \n  fontScheme: ' }],
  ['Y-SNP-002', 'R-CMP-16', 'design: three picks fill the design', 'yaml', 'slides:\n  - title: a\n|', [T('design'), K('Tab'), T('mini'), K('Tab'), K('Tab'), T('boos'), K('Tab'), K('Tab'), T('aptos'), K('Tab')], { deck: { '/design/theme': 'minimal', '/design/colorScheme': 'boost', '/design/fontScheme': 'aptos' }, findings: { errors: 0 } }],
  ['Y-SNP-003', 'R-CMP-16', 'speaker: the id is a selected placeholder and the name follows (deviation from SPEC 5: the Speaker schema requires both)', 'yaml', 'name: x\n|', [T('speak'), K('Tab')], { text: 'name: x\nspeaker:\n  id: ⟦alice⟧\n  name: Name' }],
  ['Y-SNP-004', 'R-CMP-16', 'speaker: Tab walks from the id to the name', 'yaml', 'name: x\n|', [T('speak'), K('Tab'), T('ada'), K('Tab'), T('Ada')], { deck: { '/speaker/id': 'ada', '/speaker/name': 'Ada' } }],
  ['Y-SNP-005', 'R-CMP-16', 'design in a flow mapping of a slide is the plain key', 'yaml', 'slides:\n  - {title: a, |}', [T('design'), K('Tab')], { has: '{title: a, design: ' }],
  ['Y-SNP-006', 'R-CMP-16', 'design in a slide is the plain key', 'yaml', 'slides:\n  - title: a\n    |', [T('design'), K('Tab')], { text: 'slides:\n  - title: a\n    design:\n      |' }],
  ['Y-SNP-007', 'R-CMP-16', 'design: the snippet is one undo step', 'yaml', 'name: x\n|', [T('design'), K('Tab')], { undo: [1, 'name: x\ndesign|'] }],
  ['Y-SNP-008', 'R-CMP-16', 'design: the key is listed once', 'yaml', 'slides: []\n|', [T('des')], { popup: { open: 1, has: ['design', 'description', 'datasets'], count: [3, 3] } }],
  ['Y-INS-020', 'R-CMP-14', 'chain: accepting the key and its value is one undo step', 'yaml', 'design:\n  |', [T('titleA'), K('Tab'), K('Tab')], { undo: [1, 'design:\n  titleA|'] }],
  ['Y-INS-021', 'R-CMP-14', 'redo puts the key and its value back together', 'yaml', 'design:\n  |', [T('titleA'), K('Tab'), K('Tab')], { undo: [1, 'design:\n  titleA|'], redo: [1, 'design:\n  titleAlignment: left|'] }],
];
yamlCases.push(...yamlSnippets);

// Flow collections that run over several lines and quoted scalars that do: the place of the caret is found from the lines above it, on a draft too.
export const yamlMultiline = [
  ['Y-FLW-001', 'R-CMP-20', 'a flow list continued on the next line offers the ids', 'yaml', 'audience: [board,\n  |]', [K('Control+Space')], { popup: { open: 1, has: ['customer'] } }],
  ['Y-FLW-002', 'R-CMP-20', 'a flow mapping continued on the next line offers the keys left', 'yaml', 'design: {theme: minimal,\n  |}', [K('Control+Space')], { popup: { open: 1, has: ['colorScheme', 'fontScheme'], not: ['theme'] } }],
  ['Y-FLW-003', 'R-CMP-20', 'the value of a key in a continued flow mapping', 'yaml', 'design: {theme: minimal,\n  titleAlignment: |}', [K('Control+Space')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['Y-FLW-004', 'R-CMP-20', 'typing in the continuation opens the list', 'yaml', 'audience: [board,\n  |]', [T('cus')], { popup: { open: 1, has: ['customer'] } }],
  ['Y-FLW-005', 'R-CMP-21', 'Tab accepts in the continuation and keeps the closing bracket', 'yaml', 'audience: [board,\n  |]', [T('cus'), K('Tab')], { text: 'audience: [board,\n  customer|]' }],
  ['Y-FLW-006', 'R-CMP-20', 'a comment in the first line of the flow collection does not hide the lines below', 'yaml', 'audience: [board, # first\n  |]', [K('Control+Space')], { popup: { open: 1, has: ['customer'] } }],
  ['Y-FLW-007', 'R-CMP-20', 'a flow mapping after a dash continued on the next line', 'yaml', 'slides:\n  - {title: a,\n    |}', [K('Control+Space')], { popup: { open: 1, has: ['layout', 'items'], not: ['title'] } }],
  ['Y-FLW-008', 'R-CMP-20', 'three lines of a flow list', 'yaml', 'audience: [board,\n  customer,\n  |]', [K('Control+Space')], { popup: { open: 1, has: ['investor'] } }],
  ['Y-FLW-009', 'R-CMP-20', 'the keys after a flow collection that ran over lines are found as usual', 'yaml', 'slides:\n  - title: a\n    items: [x,\n      y]\n    |', [K('Control+Space')], { popup: { open: 1, has: ['layout'], not: ['title', 'items'] } }],
  ['Y-FLW-010', 'R-CMP-20', 'the value of a key in a continued flow mapping after a dash', 'yaml', 'slides:\n  - {title: a,\n    layout: |}', [K('Control+Space')], { popup: { open: 1, has: ['pillars'] } }],
  ['Y-FLW-011', 'R-CMP-20', 'a flow list left open still offers the ids in its continuation', 'yaml', 'audience: [board,\n  |\nslides: []', [K('Control+Space')], { popup: { open: 1, has: ['customer'] } }],
  ['Y-FLW-012', 'R-CMP-04', 'text in a flow list of free text opens nothing', 'yaml', 'tags: [a,\n  |]', [T('Rev')], { popup: { open: 0 } }],
  ['Y-QSC-001', 'R-CMP-19', '{{ inside a quoted scalar that runs over lines lists the variables', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: "Hello\n      there |"', [T('{{br'), K('Enter')], { has: 'there {{brand}}"' }],
  ['Y-QSC-002', 'R-CMP-19', '{{ in a plain scalar that runs over lines', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: Hello\n      there |', [T('{{'), K('Tab')], { has: 'there {{brand}}' }],
  ['Y-QSC-003', 'R-CMP-20', 'the keys after a quoted scalar that ran over lines are found as usual', 'yaml', 'slides:\n  - title: "first\n      second"\n    |', [K('Control+Space')], { popup: { open: 1, has: ['layout', 'items'], not: ['title'] } }],
  ['Y-QSC-004', 'R-CMP-20', 'text in the continuation that looks like a key is not one', 'yaml', 'slides:\n  - title: "a\n      layout: b"\n    |', [K('Control+Space')], { popup: { open: 1, has: ['layout'], not: ['title'] } }],
  ['Y-QSC-005', 'R-CMP-04', 'a continuation line opens nothing else', 'yaml', 'slides:\n  - title: "first\n      sec|ond"', [K('Control+Space')], { popup: { open: 0 } }],
  ['Y-QSC-006', 'R-CMP-20', 'a single-quoted scalar over lines, with a doubled quote inside', 'yaml', "slides:\n  - title: 'it''s\n      here'\n    |", [K('Control+Space')], { popup: { open: 1, has: ['layout'], not: ['title'] } }],
  ['Y-QSC-007', 'R-CMP-19', 'a quoted scalar left open still lists variables on its last line', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: "Hello\n      {{|', [K('Control+Space')], { popup: { open: 1, has: ['brand'] } }],
  ['Y-QSC-008', 'R-CMP-04', 'a continuation line with no {{ opens nothing even when variables are declared', 'yaml', 'variables:\n  brand:\n    type: text\n    value: Acme\nslides:\n  - title: "Hello\n      there |"', [K('Control+Space')], { popup: { open: 0 } }],
];
yamlCases.push(...yamlMultiline);

// Layout regions rank the slide keys, and the footer under a list of records whose catalog is not loaded.
const YCAT = 'catalogs:\n  acme:\n    source: https://acme.test\n    layouts:\n      bespoke:\n        name: Bespoke\n        regions:\n          - name: title\n';
export const yamlRank = [
  ['Y-RNK-001', 'R-CMP-18', 'agenda: title and items come before the subtitle', 'yaml', 'slides:\n  - layout: agenda\n    |', [K('Control+Space')], { popup: { first: 'title', order: ['title', 'items', 'subtitle', 'text'] } }],
  ['Y-RNK-002', 'R-CMP-18', 'cover: the media region calls for image and video', 'yaml', 'slides:\n  - layout: cover\n    |', [K('Control+Space')], { popup: { order: ['title', 'image', 'video', 'subtitle'] } }],
  ['Y-RNK-003', 'R-CMP-18', 'keys already set are not offered again', 'yaml', 'slides:\n  - layout: agenda\n    title: a\n    |', [K('Control+Space')], { popup: { first: 'items', not: ['title', 'layout'] } }],
  ['Y-RNK-004', 'R-CMP-18', 'no layout: the common order holds', 'yaml', 'slides:\n  - |', [K('Control+Space')], { popup: { order: ['title', 'subtitle', 'layout', 'items'] } }],
  ['Y-VAL-R1', 'R-CMP-19', 'records of a catalog that is not registered: the list says the rest is not loaded', 'yaml', `${YCAT}slides:\n  - layout: |`, [K('Control+Space')], { popup: { open: 1, has: ['acme:bespoke', 'cover'], footer: 'Records from catalog acme are not loaded' } }],
  ['Y-VAL-R2', 'R-CMP-19', 'a catalog that is registered adds no footer', 'yaml', 'catalogs:\n  gallery:\n    source: https://www.pptx.gallery\n    layouts:\n      bespoke:\n        name: Bespoke\n        regions:\n          - name: title\nslides:\n  - layout: |', [K('Control+Space')], { popup: { open: 1, footer: null } }],
];
yamlCases.push(...yamlRank);

yamlCases.push(
  ['Y-VAL-X22', 'R-A11Y-01', 'each reference has an accessible name with its kind and its place', 'yaml', 'assets:\n  logo: logo.png\nslides:\n  - image: |', [K('Control+Space'), ['waitLabels']], { popup: { ariaNames: [/^asset:logo, reference, logo\.png\. 1 of 1$/] } }],
  ['Y-VAL-X23', 'R-A11Y-02', 'accepting a reference says what was inserted', 'yaml', 'assets:\n  logo: logo.png\nslides:\n  - image: |', [K('Control+Space'), K('Enter')], { live: 'Inserted asset:logo' }],
  ['Y-VAL-X24', 'R-CMP-17', 'the documentation panel describes the selected dataset', 'yaml', 'datasets:\n  sales:\n    title: Sales\n    columns: [Quarter, Revenue]\n    rows: []\nslides:\n  - table:\n      dataset: |', [K('Control+Space')], { docs: { shown: true, has: ['sales', 'Quarter, Revenue'] } }],
);

// Phase 4: the shape hint, built-in variables with several cursors, Markdown image targets (phase4-extras.mjs).
yamlCases.push(...phase4Yaml);
