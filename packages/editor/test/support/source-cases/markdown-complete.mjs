// Phase 2 Markdown cases of artifacts/source-editor/TEST-PLAN.md, section 6: completion in the front matter, in slide and block options, in fence
// info lines and fences, `Note:` and snippets; lists, quotes, Enter and Tab; pairs and comments; problems with their positions; Canonicalize with OPF;
// hover. Real keyboard events in a real browser. Row format: [id, requirement, title, format, doc, steps, expect, options?]; see
// support/source-keyboard.mjs.
import { FAST, K, M, T, platform } from '../source-keyboard.mjs';
import { phase4Markdown } from './phase4-extras.mjs';

// VS Code's fold keys: Cmd+Alt+[ and ] on macOS, Ctrl+Shift+[ and ] elsewhere (where Ctrl+Alt+[ folds everything). The key is named by its code: a synthetic
// Shift+[ carries the key "[", which is Indent less, where a real keyboard sends "{".
const FOLD = platform === 'darwin' ? 'Meta+Alt+[' : 'Control+Shift+BracketLeft';
const UNFOLD = platform === 'darwin' ? 'Meta+Alt+]' : 'Control+Shift+BracketRight';

const wait = ['waitPopup'];

export const markdownFrontMatter = [
  ['M-FM-001', 'R-CMP-22', 'Ctrl+Space inside the front matter offers the deck keys', 'md', '---\n|\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 1, has: ['name', 'design', 'language'], not: ['slides'] } }],
  ['M-FM-002', 'R-CMP-22', 'typing a key prefix', 'md', '---\n|\n---\n\n# A\n', [T('des')], { popup: { open: 1, has: ['design', 'description'] } }],
  ['M-FM-003', 'R-CMP-22', 'Tab accepts', 'md', '---\n|\n---\n\n# A\n', [T('descr'), K('Tab')], { text: '---\ndescription: |\n---\n\n# A\n' }],
  ['M-FM-004', 'R-CMP-22', 'a value list in the front matter', 'md', '---\ndesign:\n  titleAlignment: |\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['M-FM-005', 'R-KEY-04', 'Enter after "key:" indents inside the front matter', 'md', '---\ndesign:|\n---\n\n# A\n', [K('Enter')], { text: '---\ndesign:\n  |\n---\n\n# A\n' }],
  ['M-FM-006', 'R-CMP-22', 'the closing line is offered nothing', 'md', '---\nname: x\n---|\n\n# A\n', [K('Control+Space')], { popup: { open: 0 } }],
  ['M-FM-007', 'R-CMP-22', 'the opening line is offered nothing', 'md', '---|\nname: x\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 0 } }],
  ['M-FM-008', 'R-CMP-22', 'keys already in the front matter are not offered', 'md', '---\nname: x\n|\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 1, has: ['design'], not: ['name', 'slides'] } }],
  ['M-FM-009', 'R-CMP-22', 'the front matter of a deck with no slides yet', 'md', '---\n|\n---\n', [K('Control+Space')], { popup: { open: 1, has: ['name'] } }],
  ['M-FM-010', 'R-CMP-22', 'an object key goes on the next line, indented (phase 3: variables, since accepting design starts the design snippet)', 'md', '---\n|\n---\n\n# A\n', [T('variab'), K('Tab')], { text: '---\nvariables:\n  |\n---\n\n# A\n' }],
  ['M-FM-011', 'R-CMP-04', 'a free text value opens nothing', 'md', '---\nname: |\n---\n', [T('Q3')], { popup: { open: 0 } }],
  ['M-FM-012', 'R-CMP-22', 'a comment in the front matter opens nothing', 'md', '---\n# |\n---\n', [T('des')], { popup: { open: 0 } }],
];

export const markdownOptions = [
  ['M-OPT-001', 'R-CMP-23', '"<!-- slide: " offers the option keys', 'md', '# A\n\n---\n\n<!-- slide: |-->\n# B\n', [K('Control+Space')], { popup: { open: 1, has: ['id', 'type', 'layout', 'section', 'tag', 'hidden', 'beat'] } }],
  ['M-OPT-002', 'R-CMP-23', 'typing "<!-- " offers slide: and block:', 'md', '# A\n\n---\n\n|\n# B\n', [T('<!-- ')], { popup: { open: 1, has: ['slide:', 'block:'] } }],
  ['M-OPT-002b', 'R-CMP-23', 'accepting slide: closes the comment and opens the keys', 'md', '# A\n\n---\n\n|\n# B\n', [T('<!-- '), K('Tab'), wait], { has: '<!-- slide:  -->', popup: { open: 1, has: ['layout'] } }],
  ['M-OPT-003', 'R-CMP-23', 'layout= lists the layout ids', 'md', '# A\n\n---\n\n<!-- slide: layout=| -->\n# B\n', [K('Control+Space')], { popup: { open: 1, has: ['pillars', 'agenda'] } }],
  ['M-OPT-004', 'R-CMP-23', 'accepting inserts the bare id', 'md', '# A\n\n---\n\n<!-- slide: layout=| -->\n# B\n', [T('pil'), K('Tab')], { has: '<!-- slide: layout=pillars -->', deck: { '/slides/1/layout': 'pillars' } }],
  ['M-OPT-005', 'R-CMP-23', 'hidden= offers true and false', 'md', '# A\n\n<!-- slide: hidden=| -->\n', [K('Control+Space')], { popup: { open: 1, has: ['true', 'false'] } }],
  ['M-OPT-006', 'R-CMP-23', 'type= offers the slide types', 'md', '# A\n\n<!-- slide: type=| -->\n', [K('Control+Space')], { popup: { open: 1, has: ['chart'] } }],
  ['M-OPT-007', 'R-CMP-23', 'keys already set are not offered', 'md', '# A\n\n<!-- slide: id=a |-->\n', [K('Control+Space')], { popup: { open: 1, not: ['id'], has: ['layout'] } }],
  ['M-OPT-008', 'R-CMP-23', 'block: keys', 'md', '# A\n\n<!-- block: | -->\n- x\n', [K('Control+Space')], { popup: { open: 1, has: ['id', 'type', 'as', 'region'] } }],
  ['M-OPT-009', 'R-CMP-23', 'region= lists the regions of the slide layout', 'md', '<!-- slide: layout=two-column -->\n# A\n\n<!-- block: region=| -->\n- x\n', [K('Control+Space')], { popup: { open: 1, has: ['first', 'second', 'left'] } }],
  ['M-OPT-010', 'R-CMP-23', 'a free text option opens nothing', 'md', '# A\n\n<!-- slide: section=| -->\n', [T('Part 1')], { popup: { open: 0 } }],
  ['M-OPT-011', 'R-CMP-23', 'accepting a key writes "key=" and opens its values', 'md', '# A\n\n<!-- slide: | -->\n', [T('lay'), K('Tab'), wait], { has: '<!-- slide: layout= -->', popup: { open: 1, has: ['pillars'] } }],
  ['M-OPT-012', 'R-CMP-23', 'as= offers bullets and video', 'md', '# A\n\n<!-- block: as=| -->\n- x\n', [K('Control+Space')], { popup: { open: 1, has: ['bullets', 'video'], count: [2, 2] } }],
  ['M-OPT-013', 'R-CMP-23', 'a value that is already there is replaced', 'md', '# A\n\n<!-- slide: layout=pi| -->\n', [K('Control+Space'), K('Enter')], { has: '<!-- slide: layout=pillars -->' }],
  ['M-OPT-014', 'R-CMP-23', 'a space after an option opens the keys', 'md', '# A\n\n<!-- slide: id=a| -->\n', [T(' ')], { popup: { open: 1, has: ['layout'], not: ['id'] } }],
  ['M-OPT-015', 'R-CMP-23', 'a plain comment offers nothing', 'md', '# A\n\n<!-- note: |-->\n', [K('Control+Space')], { popup: { open: 0 } }],
];

export const markdownFences = [
  ['M-FEN-001', 'R-CMP-24', 'three backticks at the start of a line list the fence kinds', 'md', '# A\n\n```|', [K('Control+Space')], { popup: { open: 1, has: ['chart', 'metric', 'timeline', 'opf-block', 'opf-slide', 'js'] } }],
  ['M-FEN-002', 'R-CMP-24', '"chart " lists the chart types', 'md', '# A\n\n```chart |', [K('Control+Space')], { popup: { open: 1, has: ['column', 'bar', 'line', 'pie'] } }],
  ['M-FEN-003', 'R-CMP-24', 'accepting a chart type', 'md', '# A\n\n```chart |', [T('col'), K('Tab')], { text: '# A\n\n```chart column|' }],
  ['M-FEN-004', 'R-CMP-24', 'metric keys inside a metric fence', 'md', '# A\n\n```metric\n|\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['value', 'label', 'unit', 'delta', 'trend', 'sentiment'] } }],
  ['M-FEN-005', 'R-CMP-24', 'an opf-slide fence uses the slide schema', 'md', '# A\n\n```opf-slide\n|\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['composition', 'design'] } }],
  ['M-FEN-006', 'R-CMP-24', 'an opf-block fence uses the ContentPayload schema', 'md', '# A\n\n```opf-block\n|\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['id', 'type', 'text', 'items'] } }],
  ['M-FEN-007', 'R-CMP-04', 'a code fence body never completes', 'md', '# A\n\n```js\ncon|\n```\n', [K('Control+Space')], { popup: { open: 0 } }],
  ['M-FEN-008', 'R-CMP-25', '"Note:" at the start of a line', 'md', '# A\n\n|', [T('Not')], { popup: { open: 1, has: ['Note:', 'Notes:'] } }],
  ['M-ACC-010', 'R-CMP-06', 'Tab accepts a fence kind 0 ms after the last key', 'md', '# A\n\n```|', [FAST('metr', 'Tab', 0)], { text: '# A\n\n```metric|' }],
  ['M-ACC-011', 'R-CMP-06', 'Enter accepts an option 40 ms after the last key', 'md', '# A\n\n<!-- slide: | -->\n', [FAST('lay', 'Enter', 40)], { has: 'layout=' }],
  ['M-ACC-012', 'R-CMP-06', 'Tab accepts a snippet 120 ms after the last key', 'md', '# A\n\n|', [FAST('slid', 'Tab', 120)], { has: '# Slide title' }],
  ['M-FEN-009', 'R-CMP-24', 'accepting a kind writes the word', 'md', '# A\n\n```|', [T('metr'), K('Tab')], { text: '# A\n\n```metric|' }],
  ['M-FEN-010', 'R-CMP-24', 'accepting chart opens the types', 'md', '# A\n\n```|', [T('cha'), K('Tab'), wait], { text: '# A\n\n```chart |', popup: { open: 1, has: ['column'] } }],
  ['M-FEN-011', 'R-CMP-24', 'trend values in a metric fence', 'md', '# A\n\n```metric\ntrend: |\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['up', 'down'] } }],
  ['M-FEN-012', 'R-CMP-24', 'accepting a metric key writes "key: "', 'md', '# A\n\n```metric\n|\n```\n', [T('val'), K('Tab')], { text: '# A\n\n```metric\nvalue: |\n```\n' }],
  ['M-FEN-013', 'R-CMP-24', 'keys of the metric fence already written are not offered', 'md', '# A\n\n```metric\nvalue: 4\n|\n```\n', [K('Control+Space')], { popup: { open: 1, not: ['value'], has: ['label'] } }],
  ['M-FEN-014', 'R-CMP-24', 'YAML in an opf-block fence completes the value of a key', 'md', '# A\n\n```opf-block\ntype: |\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['chart', 'text'] } }],
  ['M-FEN-015', 'R-CMP-24', 'the fence body of a chart opens nothing', 'md', '# A\n\n```chart column\n|\n```\n', [K('Control+Space')], { popup: { open: 0 } }],
  ['M-FEN-016', 'R-CMP-04', 'prose at the start of a line opens nothing', 'md', '# A\n\n|', [T('The quick brown fox')], { popup: { open: 0 } }],
  ['M-FEN-017', 'R-CMP-25', 'speaker notes are verbatim: nothing inside them', 'md', '# A\n\nNote: say this\n\n|', [T('Not')], { popup: { open: 0 } }],
];

export const markdownSnippets = [
  ['M-SNP-001', 'R-CMP-16', 'the slide snippet writes a separator, a title and a bullet', 'md', '# A\n\n|', [T('slide'), K('Tab')], { has: '# A\n\n---\n\n# Slide title\n\n- First point' }],
  ['M-SNP-002', 'R-CMP-16', 'Tab walks the stops; the first slide of a document has no separator', 'md', '|', [T('slide'), K('Tab'), T('Hi'), K('Tab'), T('x')], { deck: { '/slides/0/title': 'Hi', '/slides/0/items/0': 'x' }, not: '---' }],
  ['M-SNP-003', 'R-CMP-16', 'slide-chart writes a chart fence', 'md', '|', [T('slide-chart'), K('Tab')], { has: '```chart column' }],
  ['M-SNP-004', 'R-CMP-16', 'the notes snippet', 'md', '# A\n\n|', [T('notes'), K('Tab')], { has: 'Note: Speaker notes' }],
  ['M-SNP-005', 'R-CMP-16', 'a blank line is added above the separator when the text above has none', 'md', '# A\n|', [T('slide'), K('Tab')], { has: '# A\n\n---\n\n# Slide title' }],
  ['M-SNP-006', 'R-CMP-16', 'the snippet after a separator does not repeat it', 'md', '# A\n\n---\n\n|', [T('slide'), K('Tab')], { has: '---\n\n# Slide title', not: '---\n\n---' }],
  ['M-SNP-007', 'R-CMP-16', 'the two-column snippet pins its blocks to regions', 'md', '|', [T('slide-two-column'), K('Tab')], { has: '<!-- slide: layout=two-column -->\n# Title\n\n<!-- block: region=left -->\n- Left\n\n<!-- block: region=right -->\n- Right' }],
  ['M-SNP-008', 'R-CMP-16', 'the quote snippet reads back', 'md', '|', [T('slide-quote'), K('Tab')], { deck: { '/slides/0/quote/text': 'Quote', '/slides/0/quote/attribution': 'Name, Title' } }],
  ['M-SNP-009', 'R-CMP-16', 'the table snippet reads back', 'md', '|', [T('slide-table'), K('Tab')], { deck: { '/slides/0/table/columns': ['Name', 'Value'] } }],
  ['M-SNP-010', 'R-CMP-16', 'the code snippet reads back', 'md', '|', [T('slide-code'), K('Tab')], { deck: { '/slides/0/code/language': 'js' } }],
  ['M-SNP-011', 'R-CMP-16', 'the section snippet', 'md', '|', [T('section'), K('Tab')], { deck: { '/slides/0/layout': 'section' } }],
  ['M-SNP-012', 'R-CMP-16', 'a snippet is one undo step', 'md', '# A\n\n|', [T('slide'), K('Tab')], { undo: [1, '# A\n\nslide|'] }],
];

export const markdownLists = [
  ['M-LST-001', 'R-KEY-04', 'Enter after "- item" continues the marker', 'md', '- one|', [K('Enter')], { text: '- one\n- |' }],
  ['M-LST-002', 'R-KEY-04', 'Enter on an empty marker removes it', 'md', '- one\n- |', [K('Enter')], { text: '- one\n|' }],
  ['M-LST-003', 'R-KEY-04', 'numbered lists count up', 'md', '1. one|', [K('Enter')], { text: '1. one\n2. |' }],
  ['M-LST-004', 'R-KEY-04', '"*" markers continue with "*"', 'md', '* one|', [K('Enter')], { text: '* one\n* |' }],
  ['M-LST-005', 'R-KEY-04', 'a blockquote continues "> "', 'md', '> a|', [K('Enter')], { text: '> a\n> |' }],
  ['M-LST-006', 'R-KEY-02', 'Tab nests a list item by 2 spaces', 'md', '- one\n- two|', [K('Tab')], { text: '- one\n  - two|' }],
  ['M-LST-007', 'R-KEY-02', 'Shift+Tab moves it out', 'md', '- one\n  - two|', [K('Shift+Tab')], { text: '- one\n- two|' }],
  ['M-LST-008', 'R-IND-01', 'the unit is 2 and does not drift', 'md', '- a\n  - b\n    - c|', [K('Shift+Tab'), K('Shift+Tab')], { text: '- a\n  - b\n- c|' }],
  ['M-LST-009', 'R-KEY-04', 'Enter in a code fence keeps only the indent', 'md', '```js\n  a|\n```', [K('Enter')], { text: '```js\n  a\n  |\n```' }],
  ['M-LST-010', 'R-KEY-04', 'Backspace right after a marker removes the marker', 'md', '- |one', [K('Backspace')], { text: '|one' }],
  ['M-LST-011', 'R-KEY-04', 'Enter on an empty nested marker moves out one level', 'md', '- a\n  - |', [K('Enter')], { text: '- a\n- |' }],
  ['M-LST-012', 'R-KEY-04', 'Enter in the middle of an item splits it', 'md', '- one| two', [K('Enter')], { text: '- one\n- | two' }],
  ['M-LST-013', 'R-KEY-04', 'Enter inside the marker breaks the line only', 'md', '-| one', [K('Enter')], { text: '-\n| one' }],
  ['M-LST-014', 'R-KEY-04', 'Enter after a heading is a plain new line', 'md', '# Title|', [K('Enter')], { text: '# Title\n|' }],
  ['M-LST-015', 'R-KEY-04', 'Enter on an empty quote ends it', 'md', '> a\n> |', [K('Enter')], { text: '> a\n|' }],
  ['M-LST-016', 'R-KEY-04', 'a numbered list with ")" keeps its marker', 'md', '1) one|', [K('Enter')], { text: '1) one\n2) |' }],
  ['M-LST-017', 'R-KEY-04', 'Enter after indented text keeps the indent', 'md', '  text|', [K('Enter')], { text: '  text\n  |' }],
  ['M-LST-019', 'R-KEY-01', 'Tab outside a list inserts spaces', 'md', 'text|', [K('Tab')], { text: 'text  |' }],
  ['M-LST-020', 'R-KEY-04', 'Backspace after the text of a marker line deletes one character', 'md', '- one|', [K('Backspace')], { text: '- on|' }],
  ['M-LST-021', 'R-KEY-04', 'Enter in a speaker note keeps the indentation', 'md', 'Note: say|', [K('Enter')], { text: 'Note: say\n|' }],
];

export const markdownPairs = [
  ['M-PAIR-001', 'R-PAIR-01', '( pairs', 'md', '|', [T('(a')], { text: '(a|)' }],
  ['M-PAIR-002', 'R-PAIR-01', '[ pairs', 'md', '|', [T('[a')], { text: '[a|]' }],
  ['M-PAIR-003', 'R-PAIR-01', 'backticks pair', 'md', '|', [T('`a')], { text: '`a|`' }],
  ['M-PAIR-004', 'R-PAIR-01', '" is not paired', 'md', '|', [T('"a')], { text: '"a|' }],
  ['M-PAIR-005', 'R-PAIR-05', '* around a selection wraps it in emphasis', 'md', '⟦word⟧', [T('*')], { text: '*⟦word⟧*' }],
  ['M-PAIR-006', 'R-PAIR-05', '** around a selection wraps it in bold', 'md', '⟦word⟧', [T('**')], { has: '**word**' }],
  ['M-PAIR-007', 'R-PAIR-05', '_ around a selection', 'md', '⟦word⟧', [T('_')], { text: '_⟦word⟧_' }],
  ['M-PAIR-008', 'R-PAIR-05', '[ around a selection', 'md', '⟦word⟧', [T('[')], { text: '[⟦word⟧]' }],
  ['M-PAIR-009', 'R-PAIR-01', '* with no selection is just a star', 'md', '|', [T('*a')], { text: '*a|' }],
  ['M-PAIR-010', 'R-PAIR-02', 'typing the closer overtypes it', 'md', '|', [T('(a)')], { text: '(a)|' }],
  ['M-PAIR-011', 'R-PAIR-01', '< is not paired', 'md', '|', [T('<a')], { text: '<a|' }],
  ['M-CMT-001', 'R-KEY-09', 'Mod+/ wraps a line in an HTML comment', 'md', 'text|', [M('/')], { text: '<!-- text -->|' }],
  ['M-CMT-002', 'R-KEY-09', 'Mod+/ again unwraps', 'md', '<!-- text -->|', [M('/')], { text: 'text|' }],
  ['M-CMT-003', 'R-KEY-09', 'Mod+/ on a slide options line does nothing and says why', 'md', '<!-- slide: id=a -->|', [M('/')], { text: '<!-- slide: id=a -->|', live: 'Slide options are already a comment' }],
  ['M-CMT-004', 'R-KEY-09', 'Mod+/ in the front matter uses #', 'md', '---\nname: x|\n---\n# A\n', [M('/')], { has: '# name: x' }],
  ['M-CMT-005', 'R-KEY-09', 'a multi-line selection is commented line by line', 'md', '⟦one\ntwo⟧', [M('/')], { text: '<!-- ⟦one -->\n<!-- two -->⟧' }],
  ['M-CMT-006', 'R-KEY-09', 'Mod+/ keeps the indentation', 'md', '  - item|', [M('/')], { text: '  <!-- - item -->|' }],
  ['M-CMT-007', 'R-KEY-09', 'Mod+/ in a code fence says there is no comment syntax', 'md', '```js\ncode|\n```', [M('/')], { text: '```js\ncode|\n```', live: 'no comment syntax' }],
];

export const markdownDiagnostics = [
  ['M-DIA-020', 'R-DIAG-04', 'a finding in the front matter is at its YAML value, with line and column', 'md', '---\nname: x\ndesign:\n  titleAlignment: middle\n---\n# A\n', [['waitProblems', 1]], { findings: { rows: [{ line: 4, col: 19 }] }, squiggles: [{ text: 'middle' }] }, { notify: true }],
  ['M-DIA-021', 'R-DIAG-04', 'an unresolved layout is at the value in the options comment', 'md', '# A\n<!-- slide: layout=nope -->\n', [['waitProblems', 1]], { squiggles: [{ text: 'nope' }], findings: { rows: [{ line: 2, col: 20 }] } }, { notify: true }],
  ['M-DIA-022', 'R-DIAG-05', 'F8 selects the value in the options comment', 'md', '# A\n<!-- slide: layout=nope -->\n', [['waitProblems', 1], K('F8')], { text: '# A\n<!-- slide: layout=⟦nope⟧ -->\n' }, { notify: true }],
];

export const markdownFormat = [
  ['M-FMT-010', 'R-FMT-03', 'Canonicalize asks before it drops comments and counts them', 'md', '# A\n\n<!-- keep -->\n\n- x\n|', [['canonicalize']], { confirm: { open: true, has: ['1 comment'], focusInside: true }, has: '<!-- keep -->' }],
  ['M-FMT-011', 'R-FMT-03', 'Canonicalize anyway rewrites through OPF; undo restores the comment', 'md', '# A\n\n<!-- keep -->\n\n- x\n|', [['canonicalize'], ['confirm']], { not: 'keep', confirm: { open: false }, undo: [1, '# A\n\n<!-- keep -->\n\n- x\n|'] }],
  ['M-FMT-012', 'R-FMT-03', 'options comments are not comments the rewrite drops', 'md', '# A\n<!-- slide: id=a -->\n- x\n|', [['canonicalize']], { confirm: { open: false } }],
  ['M-FMT-013', 'R-FMT-03', 'Format keeps the comments', 'md', '# A\n\n\n<!-- keep -->\n- x\n|', [K('Alt+Shift+f')], { has: '<!-- keep -->', confirm: { open: false } }],
  ['M-FMT-014', 'R-FMT-03', 'comments in the front matter count too', 'md', '---\n# c\nname: x\n---\n# A\n|', [['canonicalize']], { confirm: { open: true, has: ['1 comment'] } }],
];

export const markdownHover = [
  ['M-HOV-001', 'R-HOV-01', 'a front matter key shows its description', 'md', '---\nname: Deck\ndesign:\n  titleAlignment: left\n---\n# A\n', [['hoverText', 'titleAlignment']], { hover: { open: true, has: ['titleAlignment'] } }],
  ['M-HOV-002', 'R-HOV-02', 'the layout in an options comment shows the record', 'md', '# A\n<!-- slide: layout=pillars -->\n', [['hoverText', 'pillars']], { hover: { open: true, has: ['Pillars'] } }],
  ['M-HOV-003', 'R-HOV-01', 'a title shows nothing', 'md', '# Hello there\n', [['hoverText', 'Hello']], { hover: { open: false } }],
];

export const markdownCases = [...markdownFrontMatter, ...markdownOptions, ...markdownFences, ...markdownSnippets, ...markdownLists, ...markdownPairs, ...markdownDiagnostics, ...markdownFormat, ...markdownHover];
export { FAST };

// Quick fixes in Markdown: a value of the front matter or of an options comment, as text edits.
export const markdownFixes = [
  ['M-FIX-001', 'R-FIX-02', 'change an enum value in the front matter', 'md', '---\ndesign:\n  titleAlignment: middle\n---\n# A\n', [['waitProblems', 1], ['quickFix', 'Change to center']], { deck: { '/design/titleAlignment': 'center' } }, { notify: true }],
  ['M-FIX-002', 'R-FIX-02', 'change an unresolved layout to a suggestion', 'md', '# A\n<!-- slide: layout=cde -->\n', [['waitProblems', 1], ['quickFix', 'Change to cover']], { has: '<!-- slide: layout=cover -->', findings: { warnings: 0 } }, { notify: true }],
  ['M-FIX-003', 'R-FIX-01', 'rename an unknown key of the front matter', 'md', '---\ndesgin:\n  theme: minimal\n---\n# A\n', [['waitProblems', 1], ['quickFix', 'Rename to design']], { deck: { '/design/theme': 'minimal' } }, { notify: true }],
];
markdownCases.push(...markdownFixes);

export const markdownSpans = [
  ['M-SPN-001', 'R-CMP-26', 'typing { after ] opens the span attributes', 'md', '# A\n\nSome [word]|', [T('{')], { popup: { open: 1, has: ['bold', 'color', 'size', 'font', 'lang'] }, text: '# A\n\nSome [word]{|}' }],
  ['M-SPN-002', 'R-CMP-26', 'attributes already written are not offered', 'md', '# A\n\nSome [word]{bold |}', [K('Control+Space')], { popup: { open: 1, has: ['color'], not: ['bold'] } }],
  ['M-SPN-003', 'R-CMP-26', 'accepting a value attribute writes "name="', 'md', '# A\n\nSome [word]{|}', [T('col'), K('Tab')], { text: '# A\n\nSome [word]{color=|}' }],
  ['M-SPN-004', 'R-CMP-26', 'accepting a flag writes the name', 'md', '# A\n\nSome [word]{|}', [T('bol'), K('Tab')], { text: '# A\n\nSome [word]{bold|}' }],
  ['M-SPN-005', 'R-CMP-04', 'a link target in parentheses opens nothing', 'md', '# A\n\nSome [word](|)', [T('htt')], { popup: { open: 0 } }],
  ['M-SPN-006', 'R-CMP-04', 'speaker notes are verbatim', 'md', '# A\n\nNote: see [word]{|}', [K('Control+Space')], { popup: { open: 0 } }],
];
markdownCases.push(...markdownSpans);

export const markdownAccess = [
  ['M-DOC-001', 'R-CMP-17', 'a front matter key shows its description', 'md', '---\n|\n---\n', [T('desc')], { docs: { shown: true, has: ['description'] } }],
  ['M-DOC-002', 'R-CMP-17', 'a layout id of an option shows its regions', 'md', '# A\n<!-- slide: layout=| -->\n', [T('pill')], { docs: { has: ['Pillars', 'Regions: title, pillars'] } }],
  ['M-DOC-003', 'R-CMP-17', 'a slide option key shows the schema description', 'md', '# A\n<!-- slide: | -->\n', [T('hid')], { docs: { shown: true, has: ['hidden'] } }],
  ['M-DOC-004', 'R-A11Y-01', 'each option has an accessible name with its position', 'md', '# A\n\n```|', [T('chart'), ['waitLabels']], { popup: { ariaNames: [/^chart, keyword, fence\. 1 of \d+$/] } }],
  ['M-A11Y-001', 'R-A11Y-02', 'opening the list says how many suggestions', 'md', '# A\n\nNot|', [K('Control+Space')], { live: '3 suggestions' }],
  ['M-A11Y-002', 'R-A11Y-02', 'accepting says what was inserted', 'md', '# A\n<!-- slide: | -->\n', [T('lay'), K('Tab')], { live: 'Inserted layout' }],
  ['M-A11Y-003', 'R-A11Y-02', 'Mod+/ on an options comment says why nothing happened', 'md', '<!-- block: id=a -->|', [M('/')], { live: 'Slide options are already a comment' }],
];
markdownCases.push(...markdownAccess);

markdownCases.push(
  ['M-LST-030', 'R-KEY-04', 'with smartListEnter off Enter after a list item only keeps the indentation', 'md', '  - one|', [K('Enter')], { text: '  - one\n  |' }, { query: '?smartListEnter=off' }],
  ['M-LST-031', 'R-KEY-04', 'with smartListEnter off a quote is not continued', 'md', '> a|', [K('Enter')], { text: '> a\n|' }, { query: '?smartListEnter=off' }],
);

export const markdownSyntaxHover = [
  ['M-HOV-004', 'R-HOV-01', 'the # of a title says what it writes', 'md', '# Hello there\n', [['hoverText', '#']], { hover: { open: true, has: ['title', 'Written as # Title'] } }],
  ['M-HOV-005', 'R-HOV-01', 'the ## of a subtitle', 'md', '# A\n\n## Sub line\n', [['hoverText', '##']], { hover: { open: true, has: ['subtitle'] } }],
  ['M-HOV-006', 'R-HOV-01', 'a list marker is items', 'md', '# A\n\n- one\n- two\n', [['hoverText', '-']], { hover: { open: true, has: ['items'] } }],
  ['M-HOV-007', 'R-HOV-01', '"Note:" is the speaker notes', 'md', '# A\n\nNote: say it slowly\n', [['hoverText', 'Note:']], { hover: { open: true, has: ['notes'] } }],
  ['M-HOV-008', 'R-HOV-01', 'a --- line starts the next slide', 'md', '# A\n\n---\n\n# B\n', [['hoverText', '---']], { hover: { open: true, has: ['slide separator', 'next slide'] } }],
  ['M-HOV-009', 'R-HOV-01', 'the word of a chart fence is the chart field', 'md', '# A\n\n```chart column\nA,B\nx,1\n```\n', [['hoverText', 'chart']], { hover: { open: true, has: ['chart'] } }],
  ['M-HOV-010', 'R-HOV-01', 'the word opf-block explains the fence', 'md', '# A\n\n```opf-block\ntype: text\n```\n', [['hoverText', 'opf-block']], { hover: { open: true, has: ['written as YAML'] } }],
  ['M-HOV-011', 'R-HOV-01', 'slide: in an options comment lists the keys', 'md', '# A\n<!-- slide: id=a -->\n', [['hoverText', 'slide:']], { hover: { open: true, has: ['layout', 'key=value'] } }],
  ['M-HOV-012', 'R-HOV-01', 'plain prose shows nothing', 'md', '# A\n\nJust some prose here.\n', [['hoverText', 'prose']], { hover: { open: false } }],
];
markdownCases.push(...markdownSyntaxHover);

markdownCases.push(
  ['M-FEN-020', 'R-CMP-24', 'a timeline line starts with a status mark on request', 'md', '# A\n\n```timeline\n|\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['[x]', '[>]', '[ ]'] } }],
  ['M-FEN-021', 'R-CMP-24', 'accepting a status mark writes it and a space', 'md', '# A\n\n```timeline\n|\n```\n', [K('Control+Space'), K('Enter')], { text: '# A\n\n```timeline\n[x] |\n```\n' }],
  ['M-FEN-022', 'R-CMP-04', 'typing the text of an event opens nothing', 'md', '# A\n\n```timeline\n|\n```\n', [T('2026 Q1')], { popup: { open: 0 } }],
);

markdownCases.push(
  ['M-FOLD-001', 'R-KEY-11', 'fold a slide (from its first line to the next ---)', 'md', '---\nname: Q3 Review\n---\n\n# Q3 Review\n\n---\n\n# High|lights\n\n- Revenue up\n- Churn down\n', [['press', FOLD], ['expectFolded', 1]], {}],
  ['M-FOLD-002', 'R-KEY-11', 'fold a fenced block', 'md', '# A\n\n```js|\nx\ny\n```\n', [['press', FOLD], ['expectFolded', 1]], {}],
  ['M-FOLD-003', 'R-KEY-11', 'fold the front matter', 'md', '---|\nname: x\ndesign:\n  theme: minimal\n---\n# A\n', [['press', FOLD], ['expectFolded', 1]], {}],
  ['M-FOLD-004', 'R-KEY-11', 'a --- inside a fence is not a slide end', 'md', '# A|\n\n```yaml\n---\nx: 1\n```\n\ntext\n', [['press', FOLD], ['expectFolded', 1], ['press', UNFOLD], ['expectFolded', 0]], {}],
);

// Cross references inside the document (SPEC 3.4) in Markdown: the deck is the front matter; the lists are offered in the YAML of the front matter and of
// the fences, in the options comments and after `{{` in a line of text.
const MFRONT = '---\nnarrative: classic-story\nassets:\n  logo: logo.png\nreferences:\n  - id: smith2020\n    text: Smith\nvariables:\n  brand:\n    type: text\n    value: Acme\n  tint: "#123456"\ndatasets:\n  sales:\n    columns: [Quarter, Revenue]\n    rows: []\n---\n\n';
export const markdownXrefs = [
  ['M-VAL-X1', 'R-CMP-19', 'beat= lists the beats of the narrative in the front matter', 'md', `${MFRONT}# A\n\n<!-- slide: beat=| -->\n`, [K('Control+Space')], { popup: { open: 1, has: ['opening', 'closing'] } }],
  ['M-VAL-X2', 'R-CMP-19', 'accepting a beat writes it bare', 'md', `${MFRONT}# A\n\n<!-- slide: beat=| -->\n`, [T('open'), K('Tab')], { has: '<!-- slide: beat=opening -->' }],
  ['M-VAL-X3', 'R-CMP-19', 'an asset in an opf-slide fence', 'md', `${MFRONT}# A\n\n\`\`\`opf-slide\nimage: |\n\`\`\`\n`, [K('Control+Space')], { popup: { open: 1, has: ['asset:logo'] } }],
  ['M-VAL-X4', 'R-CMP-19', 'a cite id in an opf-block fence', 'md', `${MFRONT}# A\n\n\`\`\`opf-block\ntext:\n  - text: x\n    cite: |\n\`\`\`\n`, [K('Control+Space')], { popup: { open: 1, has: ['smith2020'] } }],
  ['M-VAL-X5', 'R-CMP-19', 'columns of the dataset a fence names', 'md', `${MFRONT}# A\n\n\`\`\`opf-block\ntable:\n  dataset: sales\n  fields: [|]\n\`\`\`\n`, [K('Control+Space')], { popup: { open: 1, has: ['Quarter', 'Revenue'] } }],
  ['M-VAL-X6', 'R-CMP-19', '{{ in a line of text lists the variables', 'md', `${MFRONT}# Hello |`, [T('{{')], { popup: { open: 1, has: ['brand', 'tint'] } }],
  ['M-VAL-X7', 'R-CMP-19', 'Tab closes the braces', 'md', `${MFRONT}# Hello |`, [T('{{br'), K('Tab')], { has: '# Hello {{brand}}' }],
  ['M-VAL-X8', 'R-CMP-19', 'the front matter lists ids too', 'md', '---\nassets:\n  logo: logo.png\norganization:\n  id: a\n  name: A\n  logo: |\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 1, has: ['asset:logo'] } }],
  ['M-VAL-X9', 'R-CMP-04', 'Note: lines are verbatim: {{ opens nothing', 'md', `${MFRONT}# A\n\nNote: see |`, [T('{{')], { popup: { open: 0 } }],
  ['M-VAL-X10', 'R-CMP-19', 'a block region= lists the regions of the layout', 'md', '<!-- slide: layout=two-column -->\n# A\n\n<!-- block: region=| -->\n- x\n', [K('Control+Space')], { popup: { open: 1, has: ['first', 'second'] } }],
];
markdownCases.push(...markdownXrefs);

// Snippets for the keys of a deck in the front matter (SPEC 5) and the chain as one undo step.
markdownCases.push(
  ['M-SNP-020', 'R-CMP-16', 'design: accepting the key in the front matter writes the three members and opens the theme list', 'md', '---\n|\n---\n\n# A\n', [T('design'), K('Tab')], { popup: { open: 1, has: ['bold', 'classic', 'minimal'] }, text: '---\ndesign:\n  theme: |\n  colorScheme: \n  fontScheme: \n---\n\n# A\n' }],
  ['M-SNP-021', 'R-CMP-16', 'organization: id and name are placeholders in the front matter', 'md', '---\n|\n---\n\n# A\n', [T('organ'), K('Tab'), T('acme'), K('Tab'), T('Acme')], { deck: { '/organization/id': 'acme', '/organization/name': 'Acme' } }],
  ['M-SNP-022', 'R-CMP-14', 'chain: an option key and its value are one undo step', 'md', '# A\n\n<!-- slide: | -->\n', [T('lay'), K('Tab'), K('Tab')], { undo: [1, '# A\n\n<!-- slide: lay| -->\n'] }],
  ['M-SNP-023', 'R-CMP-14', 'chain: a front matter key and its value are one undo step', 'md', '---\ndesign:\n  |\n---\n\n# A\n', [T('titleA'), K('Tab'), K('Tab')], { undo: [1, '---\ndesign:\n  titleA|\n---\n\n# A\n'] }],
);

markdownCases.push(
  ['M-FLW-001', 'R-CMP-22', 'a flow list continued on the next line in the front matter', 'md', '---\naudience: [board,\n  |]\n---\n\n# A\n', [K('Control+Space')], { popup: { open: 1, has: ['customer'] } }],
  ['M-FLW-002', 'R-CMP-22', 'a flow mapping continued on the next line in an opf-slide fence', 'md', '# A\n\n```opf-slide\ndesign: {theme: minimal,\n  |}\n```\n', [K('Control+Space')], { popup: { open: 1, has: ['colorScheme'], not: ['theme'] } }],
  ['M-FLW-003', 'R-CMP-19', '{{ in a quoted scalar over lines in an opf-block fence', 'md', '---\nvariables:\n  brand:\n    type: text\n    value: Acme\n---\n\n# A\n\n```opf-block\ntext: "Hello\n  there |"\n```\n', [T('{{br'), K('Enter')], { has: 'there {{brand}}"' }],
);

markdownCases.push(
  ['M-RNK-001', 'R-CMP-18', 'agenda: title and items come before the subtitle in an opf-slide fence', 'md', '# A\n\n```opf-slide\nlayout: agenda\n|\n```\n', [K('Control+Space')], { popup: { first: 'title', order: ['title', 'items', 'subtitle'] } }],
  ['M-VAL-R1', 'R-CMP-19', 'layout= says the records of a catalog that is not registered are not loaded', 'md', '---\ncatalogs:\n  acme:\n    source: https://acme.test\n    layouts:\n      bespoke:\n        name: Bespoke\n        regions:\n          - name: title\n---\n\n# A\n<!-- slide: layout=| -->\n', [K('Control+Space')], { popup: { open: 1, has: ['acme:bespoke', 'cover'], footer: 'Records from catalog acme are not loaded' } }],
);

markdownCases.push(
  ['M-VAL-X11', 'R-A11Y-01', 'each variable has an accessible name with its kind and its place', 'md', `${MFRONT}# Hello |`, [T('{{'), ['waitLabels']], { popup: { ariaNames: [/^brand, reference, text variable\. 1 of \d+$/] } }],
  ['M-VAL-X12', 'R-A11Y-02', 'accepting a beat says what was inserted', 'md', `${MFRONT}# A\n\n<!-- slide: beat=| -->\n`, [T('open'), K('Tab')], { live: 'Inserted opening' }],
);

// Phase 4: the shape hint, built-in variables with several cursors, Markdown image targets (phase4-extras.mjs).
markdownCases.push(...phase4Markdown);
