// Phase 3 cases of artifacts/source-editor/TEST-PLAN.md: problem text in plain words, the squiggles and the quick fixes for YAML and Markdown syntax
// problems, and the new text fixes (Move into extensions, Convert to string, Wrap in a list, Add a slide) in all three formats. Row format:
// [id, requirement, title, format, doc, steps, expect, options?] (see json.mjs); `notify` places the text as a paste so the pane checks it.
import { K, M, T } from '../source-keyboard.mjs';

const WAIT = ['waitProblems', 1];
const NONE = ['waitNoProblems'];
const N = { notify: true };

// ---- YAML ------------------------------------------------------------------------------------------------------------------------------------
export const yamlDiagnostics = [
  ['Y-DIA-001', 'R-DIAG-01', 'a tab for indentation is named, with its line', 'yaml', 'name: x\nslides:\n\t- title: a\n', [WAIT], { findings: { n: 1, rows: [{ line: 3, col: 1, text: 'Line 3 is indented with a tab', next: 'replace the tab with spaces', rule: 'yaml/syntax', fixes: ['Convert tabs to spaces'] }] }, squiggles: [{ text: '\t' }] }, N],
  ['Y-DIA-002', 'R-DIAG-01', 'a quote that is never closed is reported where it opens', 'yaml', 'name: "x\nslides: []\n', [WAIT], { findings: { n: 1, rows: [{ line: 1, col: 7, text: 'The double quote opened on line 1 is never closed', fixes: ['Insert closing quote'] }] }, squiggles: [{ text: '"x' }] }, N],
  ['Y-DIA-003', 'R-DIAG-01', 'a repeated key marks both keys', 'yaml', 'name: x\nname: y\nslides: []\n', [['waitProblems', 2]], { findings: { rows: [{ line: 2, text: '`name` appears twice', fixes: ['Remove the first', 'Remove the second'] }] }, squiggles: [{ text: 'name' }, { text: 'name' }] }, N],
  ['Y-DIA-004', 'R-DIAG-02', 'a half-typed key is quiet while the list is open', 'yaml', 'name: x\n|', [T('des'), ['pause', 700]], { findings: { n: 0 } }, N],
  ['Y-DIA-005', 'R-DIAG-02', '... and is reported once the list is closed', 'yaml', 'name: x\n|', [T('des'), K('Escape'), WAIT], { findings: { rows: [{ text: '`des` needs a colon and a value', fixes: ['Add a colon'] }] } }, N],
  ['Y-DIA-006', 'R-DIAG-01', 'a flow list that is never closed', 'yaml', 'tags: [a, b\nslides: []\n', [WAIT], { findings: { rows: [{ line: 1, text: 'The list that starts with `[` on line 1 is never closed', next: 'add `]`', fixes: ['Insert ]'] }] } }, N],
  ['Y-DIA-008', 'R-DIAG-03', 'an unknown key says what it could be', 'yaml', 'slids:\n  - title: a\n', [WAIT], { findings: { n: 1, rows: [{ text: '`slids` is not a property of the deck', next: 'did you mean `slides`', fixes: ['Rename to slides', 'Move into extensions'] }] } }, N],
  ['Y-DIA-009', 'R-DIAG-03', 'a missing required key, with the YAML to write', 'yaml', 'name: x\n', [WAIT], { findings: { rows: [{ text: 'The deck is missing `slides`', next: 'add `slides:` with at least one `- title:', fixes: ['Add `slides`'] }] } }, N],
  ['Y-DIA-010', 'R-DIAG-01', 'an empty document', 'yaml', ' ', [WAIT], { findings: { rows: [{ text: 'The document is empty', next: 'slides:', fixes: ['Insert minimal deck'] }] } }, N],
  ['Y-DIA-011', 'R-DIAG-01', 'a second document', 'yaml', 'name: a\nslides: []\n---\nname: b\n', [WAIT], { findings: { rows: [{ line: 3, text: 'more than one YAML document', fixes: ['Remove the extra `---`'] }] } }, N],
  ['Y-DIA-016', 'R-DIAG-01', 'a colon in a value', 'yaml', 'slides:\n  - title: Revenue: up\n', [WAIT], { findings: { rows: [{ line: 2, text: "A value can't contain `: ` unless it is quoted", next: 'wrap the value in quotes', fixes: ['Quote the value'] }] } }, N],
  ['Y-DIA-017', 'R-DIAG-01', 'a list item under a value', 'yaml', 'name: x\n- a\n', [WAIT], { findings: { n: 1, rows: [{ line: 2, text: "This list item sits under a value that isn't a list" }] } }, N],
  ['Y-DIA-018', 'R-DIAG-01', 'a list at the top level', 'yaml', '- title: a\n- title: b\n', [WAIT], { findings: { rows: [{ text: 'The top level must be `key: value` lines, but this is a list', fixes: ['Wrap as `slides:`'] }] } }, N],
  ['Y-DIA-019', 'R-DIAG-01', 'several syntax errors are listed in position order', 'yaml', 'a:\n\tb: 1\nc: "x\n', [['waitProblems', 2]], { findings: { n: 2, rows: [{ line: 2, text: 'indented with a tab' }, { line: 3, text: 'quote opened on line 3' }] } }, N],
  ['Y-DIA-020', 'R-DIAG-04', 'F8 selects the range of a syntax problem', 'yaml', 'name: "x\nslides: []\n', [WAIT, K('F8')], { text: 'name: ⟦"x⟧\nslides: []\n' }, N],
  ['Y-DIA-021', 'R-DIAG-01', 'Details explain the rule', 'yaml', 'name: x\nname: y\nslides: []\n', [WAIT, ['clickDetails', 0]], { explain: { has: ['Checks:', 'Why:', 'Fix:'] } }, N],
];

export const yamlFixes = [
  ['Y-FIX-001', 'R-FIX-01', 'convert tabs to spaces', 'yaml', 'a:\n\tb: 1\nslides:\n  - title: a\n', [WAIT, ['placeCaret', '\tb', false], ['quickFix', 'Convert tabs to spaces']], { text: 'a:\n|  b: 1\nslides:\n  - title: a\n' }, N],
  ['Y-FIX-002', 'R-FIX-01', 'insert the missing ]', 'yaml', 'tags: [a, b\nslides:\n  - title: a\n', [WAIT, ['placeCaret', '[a', false], ['quickFix', 'Insert ]']], { has: 'tags: [a, b]\n', findings: { errors: 0 } }, N],
  ['Y-FIX-004', 'R-FIX-01', 'remove the second of two equal keys', 'yaml', 'name: x\nname: y\nslides:\n  - title: a\n', [['waitProblems', 2], ['placeCaret', 'name: y', false], ['quickFix', 'Remove the second']], { text: 'name: x\n|slides:\n  - title: a\n', deck: { '/name': 'x' } }, N],
  ['Y-FIX-011', 'R-FIX-01', 'close the quote', 'yaml', 'name: "x\nslides:\n  - title: a\n', [WAIT, ['placeCaret', '"x', false], ['quickFix', 'Insert closing quote']], { has: 'name: "x"\nslides:', deck: { '/name': 'x' } }, N],
  ['Y-FIX-012', 'R-FIX-01', 'add a colon to a half-typed key', 'yaml', 'slides:\n  - title: a\ndesc\n', [WAIT, ['placeCaret', 'desc', false], ['quickFix', 'Add a colon']], { has: 'desc: \n' }, N],
  ['Y-FIX-013', 'R-FIX-01', 'quote a value with a colon', 'yaml', 'slides:\n  - title: Revenue: up # headline\n', [WAIT, ['placeCaret', 'Revenue', false], ['quickFix', 'Quote the value']], { has: 'title: "Revenue: up" # headline', deck: { '/slides/0/title': 'Revenue: up' } }, N],
  ['Y-FIX-014', 'R-FIX-01', 'the minimal deck for an empty document', 'yaml', ' ', [WAIT, ['quickFix', 'Insert minimal deck']], { findings: { errors: 0 }, deck: { '/slides/0/title': 'Title' } }, N],
  ['Y-FIX-015', 'R-FIX-01', 'wrap a list of slides as slides:', 'yaml', '- title: a\n- title: b\n', [WAIT, ['quickFix', 'Wrap as `slides:`']], { text: 'slides:\n  - title: a\n  - title: b\n|', deck: { '/slides/1/title': 'b' } }, N],
  ['Y-FIX-016', 'R-FIX-05', 'a syntax fix is one undo step', 'yaml', 'a:\n\tb: 1\n\tc: 2\n', [WAIT, ['placeCaret', '\tb', false], ['quickFix', 'Convert tabs to spaces in the file']], { undo: [1, 'a:\n|\tb: 1\n\tc: 2\n'] }, N],
  ['Y-FIX-017', 'R-FIX-05', 'the fix works with the keyboard alone from the panel row', 'yaml', 'name: "x\nslides:\n  - title: a\n', [WAIT, ['clickRowFix', 'Insert closing quote']], { has: 'name: "x"', findings: { errors: 0 } }, N],
  ['Y-FIX-020', 'R-FIX-02', 'wrap a string in a list, keeping the comment', 'yaml', 'slides:\n  - title: a\n    items: One # first\n', [WAIT, ['placeCaret', 'One', false], ['quickFix', 'Wrap in a list']], { has: 'items: [One] # first', deck: { '/slides/0/items/0': 'One' } }, N],
  ['Y-FIX-021', 'R-FIX-02', 'convert a number to a string', 'yaml', 'slides:\n  - title: 42\n', [WAIT, ['placeCaret', '42', false], ['quickFix', 'Convert to string']], { has: 'title: "42"', deck: { '/slides/0/title': '42' } }, N],
  ['Y-FIX-022', 'R-FIX-02', 'add a slide to an empty list', 'yaml', 'name: x\nslides: []\n', [WAIT, ['quickFix', 'Add a slide']], { has: 'slides:\n  - title: Slide title\n', deck: { '/slides/0/title': 'Slide title' } }, N],
  ['Y-FIX-023', 'R-FIX-02', 'move an unknown key into extensions, comments kept', 'yaml', '# deck\nname: x\nfoo: 1 # mine\nslides:\n  - title: a\n', [WAIT, ['placeCaret', 'foo', false], ['quickFix', 'Move into extensions']], { has: ['# deck\nname: x\nslides:\n  - title: a\nextensions:\n  foo: 1 # mine'], deck: { '/extensions/foo': 1 } }, N],
  ['Y-FIX-024', 'R-FIX-02', 'add the missing slides key', 'yaml', 'name: x\n', [WAIT, ['quickFix', 'Add `slides`']], { deck: { '/slides/0/title': 'Slide title' }, findings: { errors: 0 } }, N],
  ['Y-FIX-025', 'R-FIX-02', 'rename an unknown top-level key', 'yaml', 'slids:\n  - title: a\n', [WAIT, ['placeCaret', 'slids', false], ['quickFix', 'Rename to slides']], { text: '|slides:\n  - title: a\n', findings: { errors: 0 } }, N],
];

// ---- Markdown --------------------------------------------------------------------------------------------------------------------------------
export const markdownDiagnostics = [
  ['M-DIA-001', 'R-DIAG-01', 'front matter that is never closed', 'md', '---\nname: x\n\n# A\n', [WAIT], { findings: { rows: [{ line: 1, text: 'The front matter starting on line 1 is not closed', next: 'add a line with only `---`', fixes: ['Insert ---'] }] } }, N],
  ['M-DIA-002', 'R-DIAG-01', 'an unknown slide option says what it could be', 'md', '# A\n<!-- slide: layot=cover -->\n', [WAIT], { findings: { rows: [{ line: 2, text: '`layot` is not a slide option', next: 'did you mean `layout`', fixes: ['Rename to layout'] }] } }, N],
  ['M-DIA-003', 'R-DIAG-01', 'a comment that is never closed', 'md', '# A\n\n<!-- note\n', [WAIT], { findings: { rows: [{ line: 3, text: 'The `<!--` on line 3 has no `-->`', fixes: ['Insert -->'] }] } }, N],
  ['M-DIA-004', 'R-DIAG-01', 'a fence that is never closed', 'md', '# A\n\n```js\nx\n', [WAIT], { findings: { rows: [{ line: 3, text: 'The ``` fence opened on line 3 is never closed', fixes: ['Insert closing fence'] }] } }, N],
  ['M-DIA-005', 'R-DIAG-01', 'a chart without a type lists the types', 'md', '# A\n\n```chart\n```\n', [WAIT], { findings: { rows: [{ text: 'A chart fence needs its type', next: 'column', fixes: ['Insert column', 'Insert bar'] }] } }, N],
  ['M-DIA-006', 'R-DIAG-01', 'slides in the front matter', 'md', '---\nname: x\nslides: []\n---\n# A\n', [WAIT], { findings: { rows: [{ line: 3, text: "can't hold `slides`", fixes: ['Remove the slides key'] }] } }, N],
  ['M-DIA-007', 'R-DIAG-01', 'an empty document', 'md', ' ', [WAIT], { findings: { rows: [{ text: 'The Markdown has no slides', next: '# Title', fixes: ['Insert # Title'] }] } }, N],
  ['M-DIA-008', 'R-DIAG-03', 'an unresolved layout is a warning with a fix', 'md', '# A\n<!-- slide: layout=nope -->\n', [WAIT], { findings: { warnings: 1, rows: [{ line: 2, sev: 'warning', fixes: ['Change to cover'] }] } }, N],
  ['M-DIA-009', 'R-DIAG-01', 'a numbered list says what happened and keeps the deck', 'md', '# A\n\n1. one\n2. two\n', [WAIT], { findings: { warnings: 1, rows: [{ sev: 'warning', text: "Numbers in a list aren't kept", next: 'numbering', fixes: ['Add `numbering`'] }] }, deck: { '/slides/0/title': 'A' } }, N],
  ['M-DIA-012', 'R-DIAG-01', 'a YAML error in the front matter is at its line', 'md', '---\nname x\n---\n# A\n', [WAIT], { findings: { rows: [{ line: 2, text: '`name x` needs a colon and a value' }] } }, N],
  ['M-DIA-013', 'R-DIAG-04', 'every syntax problem of Markdown has a squiggle at its range', 'md', '# A\n\n<!-- note\n', [WAIT], { squiggles: [{ sev: 'error', text: '<!-- note' }] }, N],
  ['M-DIA-014', 'R-DIAG-05', 'F8 selects the options comment', 'md', '# A\n<!-- slide: layot=cover -->\n', [WAIT, K('F8')], { text: '# A\n⟦<!-- slide: layot=cover -->⟧\n' }, N],
  ['M-DIA-015', 'R-DIAG-01', 'a tab in the front matter YAML', 'md', '---\nname: x\n\tbad: 1\n---\n# A\n', [WAIT], { findings: { rows: [{ line: 3, text: 'indented with a tab', fixes: ['Convert tabs to spaces'] }] } }, N],
  ['M-DIA-016', 'R-DIAG-01', 'a repeated option', 'md', '# A\n<!-- slide: layout=a layout=b -->\n', [WAIT], { findings: { rows: [{ text: 'Option layout is given twice', fixes: ['Remove the second layout'] }] } }, N],
];

export const markdownFixes = [
  ['M-FIX-001', 'R-FIX-01', 'insert the closing front matter line', 'md', '---\nname: x\n\n# A\n', [WAIT, ['quickFix', 'Insert ---']], { has: '---\nname: x\n---\n\n# A\n', findings: { errors: 0 } }, N],
  ['M-FIX-004', 'R-FIX-01', 'rename a slide option', 'md', '# A\n<!-- slide: layot=cover -->\n', [WAIT, ['placeCaret', 'layot', false], ['quickFix', 'Rename to layout']], { deck: { '/slides/0/layout': 'cover' }, has: '<!-- slide: layout=cover -->' }, N],
  ['M-FIX-005', 'R-FIX-01', 'close the fence', 'md', '# A\n\n```js\nx\n', [WAIT, ['placeCaret', '```js', false], ['quickFix', 'Insert closing fence']], { has: '```js\nx\n```\n', findings: { errors: 0 } }, N],
  ['M-FIX-006', 'R-FIX-01', 'close the comment', 'md', '# A\n\n<!-- note\n', [WAIT, ['placeCaret', '<!--', false], ['quickFix', 'Insert -->']], { has: '<!-- note -->', findings: { errors: 0 } }, N],
  ['M-FIX-007', 'R-FIX-01', 'insert the chart type', 'md', '# A\n\n```chart\n```\n', [WAIT, ['placeCaret', '```chart', false], ['quickFix', 'Insert column']], { has: '```chart column' }, N],
  ['M-FIX-008', 'R-FIX-01', 'remove the slides key of the front matter', 'md', '---\nname: x\nslides: []\n---\n# A\n', [WAIT, ['placeCaret', 'slides: []', false], ['quickFix', 'Remove the slides key']], { has: '---\nname: x\n---\n# A', findings: { errors: 0 } }, N],
  ['M-FIX-009', 'R-FIX-01', 'insert a title into an empty document', 'md', ' ', [WAIT, ['quickFix', 'Insert # Title']], { deck: { '/slides/0/title': 'Title' } }, N],
  ['M-FIX-010', 'R-FIX-02', 'a numbered list gets its numbering', 'md', '# A\n\n1. one\n2. two\n', [WAIT, ['placeCaret', '1. one', false], ['quickFix', 'Add `numbering`']], { has: '```opf-slide\nnumbering: arabic\n```', deck: { '/slides/0/numbering': 'arabic' } }, N],
  ['M-FIX-011', 'R-FIX-01', 'convert tabs in the front matter', 'md', '---\nname: x\n\tbad: 1\n---\n# A\n', [WAIT, ['placeCaret', '\tbad', false], ['quickFix', 'Convert tabs to spaces']], { has: '  bad: 1' }, N],
  ['M-FIX-012', 'R-FIX-05', 'a Markdown syntax fix is one undo step', 'md', '# A\n\n<!-- note\n', [WAIT, ['placeCaret', '<!--', false], ['quickFix', 'Insert -->']], { undo: [1, '# A\n\n|<!-- note\n'] }, N],
  ['M-FIX-013', 'R-FIX-02', 'move an unknown front matter key into extensions', 'md', '---\nname: x\nfoo: 1\n---\n# A\n', [WAIT, ['placeCaret', 'foo', false], ['quickFix', 'Move into extensions']], { has: '---\nname: x\nextensions:\n  foo: 1\n---', deck: { '/extensions/foo': 1 } }, N],
  ['M-FIX-014', 'R-FIX-01', 'use hidden=true', 'md', '# A\n<!-- slide: hidden=maybe -->\n', [WAIT, ['quickFix', 'Use hidden=true']], { deck: { '/slides/0/hidden': true } }, N],
];

// ---- JSON: the fixes new in phase 3 ----------------------------------------------------------------------------------------------------------
export const jsonPhase3 = [
  ['J-FIX-030', 'R-FIX-02', 'move an unknown key into extensions', 'json', '{\n  "slides": [{"title": "a"}],\n  "foo": 1\n}', [WAIT, ['placeCaret', '"foo"', false], ['quickFix', 'Move into extensions']], { deck: { '/extensions/foo': 1 }, findings: { errors: 0 } }, N],
  ['J-FIX-031', 'R-FIX-02', 'convert a number to a string', 'json', '{"slides":[{"title":42}]}', [WAIT, ['placeCaret', '42', false], ['quickFix', 'Convert to string']], { deck: { '/slides/0/title': '42' } }, N],
  ['J-FIX-032', 'R-FIX-02', 'a fix core ships as a patch is offered once, as the text edit', 'json', '{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', [WAIT, ['placeCaret', '"middle"', false], M('.')], { live: '3 quick fixes' }, N],
  ['J-DIA-070', 'R-DIAG-03', 'Details explain the rule of a row', 'json', '{"slides":[{"title":"a"}],"name":"a","name":"b"}', [['waitProblems', 2], ['clickDetails', 0]], { explain: { has: ['Checks:', 'Why:', 'Fix:'] } }, N],
  ['J-DIA-071', 'R-DIAG-03', 'the Details stay open while the panel is redrawn', 'json', '{"slides":[{"title":"a"}],"name":"a","name":"b"}', [['waitProblems', 2], ['clickDetails', 0], K('End')], { explain: { has: ['Checks:'] } }, N],
];

// ---- the rules of core, in plain words with a Next line -----------------------------------------------------------------------------------------
export const jsonRules = [
  ['J-DIA-081', 'R-DIAG-03', 'a catalog group that is not declared', 'json', '{"slides":[{"title":"a","layout":"acme:hero"}],"language":"en-US"}', [['waitProblems', 1]], { findings: { rows: [{ text: '`acme:hero`', next: 'catalogs.acme', rule: 'opf/undeclared-catalog' }] } }, N],
  ['J-DIA-082', 'R-DIAG-03', 'an unknown dataset names the datasets there are', 'json', '{"slides":[{"title":"a","table":{"dataset":"sale"}}],"language":"en-US","datasets":{"sales":{"columns":["A"],"rows":[["1"]]}}}', [['waitProblems', 1]], { findings: { rows: [{ text: 'dataset', next: 'sales', rule: 'opf/dataset-unknown' }] } }, N],
  ['J-DIA-083', 'R-DIAG-03', 'a tooltip carries the message and the Next line', 'json', '{"slides":[{"title":"a","table":{"dataset":"sale"}}],"language":"en-US","datasets":{"sales":{"columns":["A"],"rows":[["1"]]}}}', [['waitProblems', 1], ['hoverProblem', 0]], { hover: { has: ['dataset', 'Next:', 'sales'] } }, N],
];

export const diagnosticsPhase3 = { yaml: [...yamlDiagnostics, ...yamlFixes], md: [...markdownDiagnostics, ...markdownFixes], json: [...jsonPhase3, ...jsonRules] };
