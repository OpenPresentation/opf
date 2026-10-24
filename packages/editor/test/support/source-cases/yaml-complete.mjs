// Phase 2 YAML cases of artifacts/source-editor/TEST-PLAN.md, section 5: when the list opens (also in flow style and after a list dash), what accepting
// writes, Enter and indentation, pairs, comments, problems with their positions, Canonicalize with OPF, hover and undo. Real keyboard events in a real
// browser. Row format: [id, requirement, title, format, doc, steps, expect, options?]; see support/source-keyboard.mjs. `⟦⟧` is the caret where the
// text has a `|` of its own (a block scalar).
import { FAST, K, M, T } from '../source-keyboard.mjs';

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
  ['Y-ACC-001', 'R-CMP-05', 'Tab accepts a key (an object key goes on the next line)', 'yaml', 'name: x\n|', [T('des'), K('Tab')], { text: 'name: x\ndesign:\n  |' }],
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
  ['Y-INS-004', 'R-CMP-21', 'an object key with required members', 'yaml', '|', [T('organ'), K('Tab')], { text: 'organization:\n  id: |\n  name: ' }],
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
