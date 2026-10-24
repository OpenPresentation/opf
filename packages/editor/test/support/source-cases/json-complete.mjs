// Phase 1 JSON cases of artifacts/source-editor/TEST-PLAN.md, sections 4.1 to 4.5: when the list opens, the Ctrl+Space matrix, what accepting writes
// (exact strings of SPEC 4.6), the values of every kind of field, ranking, the documentation panel and snippets. Row format:
// [id, requirement, title, format, doc, steps, expect, options?]; see support/source-keyboard.mjs.
import { K, M, T, WAIT } from '../source-keyboard.mjs';

const KEY = '{\n  "slides": [],\n  |\n}';
const OBJ = KEY;

// ---- 4.1 triggers --------------------------------------------------------------------------------------------------------------------------
export const jsonTriggers = [
  ['J-TRG-001', 'R-CMP-01', 'a quote at a key position opens the key list', 'json', OBJ, [T('"')], { popup: { open: 1, has: ['design', 'description', 'name'], not: ['slides'] } }],
  ['J-TRG-002', 'R-CMP-01', 'typing inside the quotes refilters', 'json', OBJ, [T('"des')], { popup: { open: 1, has: ['design', 'description', 'datasets'], not: ['name'] } }],
  ['J-TRG-003', 'R-CMP-01', 'a bare word at a key position opens the list', 'json', OBJ, [T('des')], { popup: { open: 1, has: ['design'] } }],
  ['J-TRG-004', 'R-CMP-01', 'camelCase initials', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"tA')], { popup: { open: 1, first: 'titleAlignment' } }],
  ['J-TRG-005', 'R-CMP-02', 'typing : after a key opens the value list (enum)', 'json', '{\n  "slides": [],\n  "design": {\n    "titleAlignment"|\n  }\n}', [T(':')], { popup: { open: 1, has: ['left', 'center', 'right'] } }],
  ['J-TRG-006', 'R-CMP-02', 'typing : after an object key offers a template', 'json', '{\n  "slides": [],\n  "design"|\n}', [T(':')], { popup: { open: 1, has: ['{}'] } }],
  ['J-TRG-007', 'R-CMP-02', 'a space after the colon opens the value list', 'json', '{\n  "slides": [],\n  "template":|\n}', [T(' ')], { popup: { open: 1, has: ['true', 'false'] } }],
  ['J-TRG-008', 'R-CMP-02', 'a quote at a catalog value position opens the catalog ids', 'json', '{\n  "slides": [{"layout": |}]\n}', [T('"')], { popup: { open: 1, has: ['pillars', 'agenda', 'cover'], count: [20, 40] } }],
  ['J-TRG-009', 'R-CMP-04', 'free text never opens a list', 'json', '{\n  "slides": [{"title": |}]\n}', [T('"Rev')], { popup: { open: 0 } }],
  ['J-TRG-010', 'R-CMP-04', 'notes never open a list', 'json', '{\n  "slides": [{"notes": |}]\n}', [T('"He said ')], { popup: { open: 0 } }],
  ['J-TRG-011', 'R-CMP-04', 'a number field opens nothing', 'json', '{\n  "slides": [],\n  "duration": |\n}', [T('4')], { popup: { open: 0 } }],
  ['J-TRG-012', 'R-CMP-03', 'a list of catalog ids offers the ids at the first quote', 'json', '{\n  "slides": [],\n  "audience": [|]\n}', [T('"')], { popup: { open: 1, has: ['board', 'customer'] } }],
  ['J-TRG-013', 'R-CMP-02', 'the : after a key of a closed set opens the values at once, with the caret inside nothing yet', 'json', '{\n  "slides": [],\n  "tone"|\n}', [T(': ')], { popup: { open: 1, has: ['formal', 'casual'] } }],
  ['J-TRG-014', 'R-CMP-01', 'nothing opens after a comma or a brace by itself', 'json', '{\n  "slides": []|\n}', [T(',')], { popup: { open: 0 } }],
  ['J-TRG-015', 'R-CMP-04', 'inside a comment-looking string value of a free field nothing opens on Ctrl+Space', 'json', '{\n  "slides": [{"notes": "see: |"}]\n}', [K('Control+Space')], { popup: { open: 0 } }],
];

// ---- 4.1 the Ctrl+Space matrix (the audit's 19 positions) ---------------------------------------------------------------------------------------
const CTRL = [
  ['empty line in object', '{\n  "slides": [],\n  |\n}', ['name', 'design', 'description'], null],
  ['inside empty key quotes', '{\n  "slides": [],\n  "|"\n}', ['name', 'design'], null],
  ['partial key in quotes', '{\n  "slides": [],\n  "des|"\n}', ['description', 'design', 'datasets'], [3, 3]],
  ['bare partial key', '{\n  "slides": [],\n  des|\n}', ['description', 'design', 'datasets'], [3, 3]],
  ['boolean right after the colon', '{\n  "slides": [],\n  "template":|\n}', ['true', 'false'], [2, 2]],
  ['boolean after the colon and a space', '{\n  "slides": [],\n  "template": |\n}', ['true', 'false'], [2, 2]],
  ['enum after the colon', '{\n  "slides": [],\n  "design": {"titleAlignment": |}\n}', ['left', 'center', 'right'], [3, 3]],
  ['enum in empty quotes', '{\n  "slides": [],\n  "design": {"titleAlignment": "|"}\n}', ['left', 'center', 'right'], [3, 3]],
  ['enum partial', '{\n  "slides": [],\n  "design": {"titleAlignment": "ce|"}\n}', ['center'], [1, 1]],
  ['catalog ref in empty quotes', '{\n  "slides": [{"layout": "|"}]\n}', ['agenda', 'chart', 'closing', 'cover'], [20, 40]],
  ['catalog ref after the colon', '{\n  "slides": [{"layout": |}]\n}', ['agenda', 'chart', 'closing', 'cover'], [20, 40]],
  ['object-valued key after the colon', '{\n  "slides": [],\n  "design": |\n}', ['{}'], null],
  ['inside an existing {}', '{\n  "slides": [],\n  "design": {|}\n}', ['theme', 'colorScheme', 'fontScheme', 'background'], null],
  ['array item (audience)', '{\n  "slides": [],\n  "audience": ["|"]\n}', ['board', 'customer'], null],
  ['slide type enum', '{\n  "slides": [{"type": "|"}]\n}', ['chart', 'code', 'image', 'list', 'metric', 'quote', 'table', 'text', 'timeline', 'video'], [10, 10]],
  ['chart type enum', '{\n  "slides": [{"chart": {"type": "|"}}]\n}', ['area', 'bar', 'column', 'line', 'pie'], null],
  ['inside slides []', '{\n  "slides": [|]\n}', ['{}', 'slide'], null],
  ['blank document', '|', ['deck', '{}'], null],
  ['top level {}', '{|}', ['name', 'slides', 'design'], null],
];
export const jsonCtrlSpace = [
  ...CTRL.map(([name, doc, has, count], index) => [`J-CTRL-${String(index + 1).padStart(3, '0')}`, 'R-CMP-03', `Ctrl+Space opens the list: ${name}`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has, ...(count ? { count } : {}) } }]),
  ...CTRL.slice(0, 3).map(([name, doc, has], index) => [`J-CTRL-${String(index + 1).padStart(3, '0')}m`, 'R-CMP-03', `Cmd+I opens the list: ${name}`, 'json', doc, [K('Meta+i')], { popup: { open: 1, has } }, { plat: 'darwin' }]),
];

// ---- 4.3 insert semantics (the exact strings of SPEC 4.6) ------------------------------------------------------------------------------------
export const jsonInsert = [
  ['J-INS-001', 'R-CMP-12', 'a string key: quotes, colon, the caret inside the value quotes', 'json', KEY, [T('"descr'), K('Tab')], { text: '{\n  "slides": [],\n  "description": "|"\n}' }],
  ['J-INS-002', 'R-CMP-12', 'a boolean key opens true and false', 'json', KEY, [T('"templ'), K('Tab')], { popup: { open: 1, has: ['true', 'false'] }, text: '{\n  "slides": [],\n  "template": |\n}' }],
  ['J-INS-003', 'R-CMP-12', 'accepting the boolean value completes the pair', 'json', KEY, [T('"templ'), K('Tab'), K('Tab')], { text: '{\n  "slides": [],\n  "template": false|\n}' }],
  ['J-INS-004', 'R-CMP-12', 'an integer key leaves the caret after the colon', 'json', KEY, [T('"durat'), K('Tab')], { text: '{\n  "slides": [],\n  "duration": |\n}' }],
  ['J-INS-005', 'R-CMP-12', 'an array key', 'json', '{\n  "name": "x",\n  |\n}', [T('"slid'), K('Tab')], { text: '{\n  "name": "x",\n  "slides": [|]\n}' }],
  ['J-INS-006', 'R-CMP-12', 'an object key without required members', 'json', KEY, [T('"design'), K('Tab')], { text: '{\n  "slides": [],\n  "design": {|}\n}' }],
  ['J-INS-007', 'R-CMP-15', 'an object key with required members writes them as tab stops', 'json', KEY, [T('"organ'), K('Tab')], { text: '{\n  "slides": [],\n  "organization": {\n    "id": "⟦⟧",\n    "name": ""\n  }\n}'.replace('⟦⟧', '|') }],
  ['J-INS-008', 'R-CMP-16', 'Tab walks the required members', 'json', KEY, [T('"organ'), K('Tab'), T('acme'), K('Tab'), T('Acme Inc.')], { text: '{\n  "slides": [],\n  "organization": {\n    "id": "acme",\n    "name": "Acme Inc.|"\n  }\n}' }],
  ['J-INS-008b', 'R-CMP-16', 'the last Tab leaves the object', 'json', KEY, [T('"organ'), K('Tab'), T('acme'), K('Tab'), T('Acme Inc.'), K('Tab')], { deck: { '/organization/id': 'acme', '/organization/name': 'Acme Inc.' } }],
  ['J-INS-009', 'R-CMP-13', 'a comma is added when a property follows', 'json', '{\n  "name": "x",\n  |\n  "slides": []\n}', [T('"desc'), K('Tab')], { text: '{\n  "name": "x",\n  "description": "|",\n  "slides": []\n}' }],
  ['J-INS-010', 'R-CMP-13', 'no comma before the closing brace', 'json', KEY, [T('"desc'), K('Tab')], { not: '"",' }],
  ['J-INS-011', 'R-CMP-13', 'no second colon when one follows', 'json', '{\n  "slides": [],\n  "des|": {}\n}', [K('Control+Space'), K('Enter')], { not: '::', has: '"design": {}' }],
  ['J-INS-012', 'R-CMP-12', 'an enum value inserts the quoted value', 'json', '{\n  "slides": [],\n  "design": {"titleAlignment": |}\n}', [K('Control+Space'), K('ArrowDown'), K('Tab')], { text: '{\n  "slides": [],\n  "design": {"titleAlignment": "left"|}\n}' }],
  ['J-INS-013', 'R-CMP-12', 'a catalog id inserts the quoted id', 'json', '{\n  "slides": [{"layout": "|"}]\n}', [T('pil'), K('Enter')], { text: '{\n  "slides": [{"layout": "pillars"|}]\n}', deck: { '/slides/0/layout': 'pillars' } }],
  ['J-INS-014', 'R-CMP-12', 'a bare word value is quoted on accept', 'json', '{\n  "slides": [{"layout": |}]\n}', [T('pill'), K('Tab')], { text: '{\n  "slides": [{"layout": "pillars"|}]\n}' }],
  ['J-INS-015', 'R-CMP-12', 'a named catalog group inserts name:id', 'json', '{\n  "catalogs": {"acme": {"source": "https://acme.test", "layouts": {"bespoke": {"name": "Bespoke", "regions": [{"name": "title"}]}}}},\n  "slides": [{"layout": "|"}]\n}', [K('Control+Space'), T('bespo'), K('Enter')], { has: '"layout": "acme:bespoke"' }],
  ['J-INS-016', 'R-CMP-14', 'a key of a closed set chains into the list of its values', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"titleA'), K('Tab')], { popup: { open: 1, has: ['left', 'center', 'right'] }, text: '{\n  "slides": [],\n  "design": {\n    "titleAlignment": "|"\n  }\n}' }],
  ['J-INS-018', 'R-CMP-13', 'a key in the middle of the document replaces the token only', 'json', '{\n  "slides": [],\n  "te|": 1\n}', [K('Control+Space'), T('mpl'), K('Enter')], { has: '"template": 1' }],
  ['J-INS-019', 'R-CMP-12', 'accepting works with a following property on the line', 'json', '{\n  "slides": [], |"name": "x"\n}', [T('"desi'), K('Tab')], { has: '"design": ' }],
  ['J-INS-020', 'R-CMP-12', 'Enter after a string in a list adds an item (kept behavior)', 'json', '{\n  "slides": [{"items": [\n    "One|"\n  ]}]\n}', [K('Enter')], { text: '{\n  "slides": [{"items": [\n    "One",\n    "|"\n  ]}]\n}' }],
  ['J-INS-021', 'R-CMP-12', 'the new item is filled by typing', 'json', '{\n  "slides": [{"items": [\n    "One|"\n  ]}]\n}', [K('Enter'), T('Two')], { deck: { '/slides/0/items/1': 'Two' } }],
  ['J-INS-022', 'R-CMP-12', 'a key into an empty object has no comma', 'json', '{\n  "slides": [{|}]\n}', [T('"tit'), K('Tab')], { text: '{\n  "slides": [{"title": "|"}]\n}' }],
  ['J-INS-023', 'R-CMP-12', 'an object value after the colon writes {} with the caret inside', 'json', '{\n  "slides": [],\n  "design": |\n}', [K('Control+Space'), K('Enter')], { text: '{\n  "slides": [],\n  "design": {|}\n}' }],
  ['J-INS-024', 'R-CMP-12', 'a value template with required members after the colon', 'json', '{\n  "slides": [],\n  "organization": |\n}', [K('Control+Space'), K('Enter')], { text: '{\n  "slides": [],\n  "organization": {\n    "id": "|",\n    "name": ""\n  }\n}' }],
  ['J-INS-025', 'R-CMP-12', 'a catalog key chains its list and a typed prefix picks the id', 'json', '{\n  "slides": [{\n    "title": "a",\n    |\n  }]\n}', [T('"lay'), K('Tab'), T('pil'), K('Enter')], { deck: { '/slides/0/layout': 'pillars' } }],
  ['J-INS-026', 'R-CMP-12', 'a list value after the colon writes []', 'json', '{\n  "name": "x",\n  "slides": |\n}', [K('Control+Space'), K('Enter')], { text: '{\n  "name": "x",\n  "slides": [|]\n}' }],
  ['J-INS-027', 'R-CMP-13', 'a value followed by a property on the next line gets a comma', 'json', '{\n  "slides": [{\n    "layout": |\n    "title": "a"\n  }]\n}', [K('Control+Space'), T('cov'), K('Enter')], { has: '"layout": "cover",\n    "title"' }],
  ['J-INS-028', 'R-CMP-12', 'Shift+Tab and Shift+Enter on a key write the same as Tab', 'json', KEY, [T('"descr'), K('Shift+Enter')], { text: '{\n  "slides": [],\n  "description": "|"\n}' }],
  ['J-INS-029', 'R-CMP-12', 'with two cursors the key goes in at both', 'json', '{\n  "slides": [{}, {}]\n}', [['addCursors', ['[{', '}, {']], T('"tit'), K('Tab')], { has: ['"title": ""'], cursors: 2 }],
];

// ---- 4.4 values by field ------------------------------------------------------------------------------------------------------------------------
const ENUMS = [
  ['design.titleAlignment', '{"slides":[],"design":{"titleAlignment":"|"}}', ['left', 'center', 'right']],
  ['design.contentAlignment', '{"slides":[],"design":{"contentAlignment":"|"}}', ['left', 'center', 'right']],
  ['design.contentDirection', '{"slides":[],"design":{"contentDirection":"|"}}', ['horizontal', 'vertical']],
  ['design.chartPrimary', '{"slides":[],"design":{"chartPrimary":"|"}}', ['none', 'top', 'bottom', 'left', 'right']],
  ['design.imageFit', '{"slides":[],"design":{"imageFit":"|"}}', ['cover', 'contain', 'stretch']],
  ['design.listBullet', '{"slides":[],"design":{"listBullet":"|"}}', ['character', 'image']],
  ['slide.type', '{"slides":[{"type":"|"}]}', ['text', 'list', 'image', 'chart', 'table', 'video', 'code', 'metric', 'quote', 'timeline']],
  ['organization.role', '{"slides":[],"organization":{"id":"a","name":"A","role":"|"}}', ['primary', 'partner', 'client', 'sponsor', 'host']],
];
const BOOLS = [
  ['design.contentBox', '{"slides":[],"design":{"contentBox":|}}'],
  ['design.mirror', '{"slides":[],"design":{"mirror":|}}'],
  ['slide.hidden', '{"slides":[{"hidden":|}]}'],
  ['template', '{"slides":[],"template":|}'],
];
const REFS = [
  ['slide.layout', '{"slides":[{"layout":"|"}]}', ['agenda', 'closing', 'cover', 'pillars']],
  ['design.theme', '{"slides":[],"design":{"theme":"|"}}', ['bold', 'classic', 'minimal']],
  ['design.colorScheme', '{"slides":[],"design":{"colorScheme":"|"}}', ['black-and-white', 'bold-red', 'boost']],
  ['design.fontScheme', '{"slides":[],"design":{"fontScheme":"|"}}', ['aptos', 'arial']],
  ['slide.design.theme', '{"slides":[{"design":{"theme":"|"}}]}', ['minimal']],
  ['tone', '{"slides":[],"tone":"|"}', ['formal', 'casual', 'technical']],
  ['audience (array item)', '{"slides":[],"audience":["|"]}', ['board', 'customer']],
  ['audience (string)', '{"slides":[],"audience":"|"}', ['board', 'customer']],
  ['purpose', '{"slides":[],"purpose":"|"}', []],
  ['narrative', '{"slides":[],"narrative":"|"}', ['classic-story']],
  ['embedded theme colorScheme', '{"slides":[],"catalogs":{"custom":{"themes":{"mine":{"colorScheme":"|"}}}}}', ['boost']],
];
export const jsonValues = [
  ...ENUMS.map(([field, doc, has], index) => [`J-VAL-E${index + 1}`, 'R-CMP-03', `enum ${field}`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has, count: [has.length, has.length] } }]),
  ...BOOLS.map(([field, doc], index) => [`J-VAL-B${index + 1}`, 'R-CMP-03', `boolean ${field}`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has: ['true', 'false'], count: [2, 2] } }]),
  ...REFS.map(([field, doc, has], index) => [`J-VAL-R${index + 1}`, 'R-CMP-19', `catalog ref ${field}`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has, count: [Math.max(1, has.length), 200] } }]),
  ['J-VAL-R12', 'R-CMP-19', 'records of the document come first', 'json', '{"catalogs":{"custom":{"layouts":{"mine":{"name":"Mine","regions":[{"name":"title"}]}}}},"slides":[{"layout":"|"}]}', [K('Control+Space')], { popup: { open: 1, first: 'mine', has: ['cover'] } }],
];

// ---- 4.5 ranking, documentation -----------------------------------------------------------------------------------------------------------------
export const jsonRank = [
  ['J-RNK-001', 'R-CMP-18', 'required members come first', 'json', '{\n  "slides": [],\n  "organization": {\n    |\n  }\n}', [T('"')], { popup: { first: 'id', has: ['name', 'legalName'] } }],
  ['J-RNK-002', 'R-CMP-18', 'common slide keys precede the others', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"')], { popup: { first: 'title', has: ['subtitle', 'layout', 'items', 'text', 'notes'] } }],
  ['J-RNK-003', 'R-CMP-18', 'the region keys are hidden until typed', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"')], { popup: { not: ['top+middle:left+center', 'middle:center+right'], count: [10, 40] } }],
  ['J-RNK-004', 'R-CMP-18', '... and appear when the prefix matches', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"top+mi')], { popup: { has: ['top+middle:left'] } }],
  ['J-RNK-005', 'R-CMP-18', 'title is first for a slide with a layout', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    |\n  }]\n}', [T('"')], { popup: { first: 'title' } }],
  ['J-RNK-006', 'R-CMP-18', 'keys already present are not offered', 'json', '{\n  "slides": [{\n    "title": "a",\n    |\n  }]\n}', [T('"')], { popup: { not: ['title'] } }],
  ['J-RNK-007', 'R-CMP-18', 'the same input gives the same order twice', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"'), ['snapshotPopup', 'a'], K('Escape'), K('Control+Space'), ['expectSamePopup', 'a']], {}],
  ['J-RNK-008', 'R-CMP-18', 'the deck keys: slides is there, name first', 'json', '{\n  |\n}', [T('"')], { popup: { first: 'slides', has: ['name', 'design', 'language'] } }],
  ['J-RNK-009', 'R-CMP-18', 'a prefix match ranks above a fuzzy one', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"ti')], { popup: { first: 'title' } }],
];
export const jsonDocs = [
  ['J-DOC-001', 'R-CMP-17', 'the selected key shows its schema description', 'json', KEY, [T('"desc')], { docs: { shown: true, has: ['description', 'Free-form prose describing what this presentation is about'] } }],
  ['J-DOC-002', 'R-CMP-17', 'layout ids show name, description and regions', 'json', '{\n  "slides": [{"layout": "|"}]\n}', [T('pill')], { docs: { has: ['Pillars', 'Regions: title, pillars'] } }],
  ['J-DOC-003', 'R-CMP-17', 'the required badge is in the documentation', 'json', '{\n  "slides": [],\n  "organization": {\n    |\n  }\n}', [T('"i')], { popup: { has: ['id'] }, docs: { has: 'required' } }],
  ['J-DOC-004', 'R-A11Y-01', 'each option has an accessible name with its position', 'json', KEY, [T('"des'), ['waitLabels']], { popup: { ariaNames: [/^design, property, Design\. 1 of 3$/, /^description, property, string\. 2 of 3$/] } }],
  ['J-DOC-005', 'R-CMP-17', 'an enum value shows its description when the schema has one', 'json', '{\n  "slides": [{"type": "|"}]\n}', [T('ch')], { popup: { has: ['chart'] } }],
  ['J-DOC-006', 'R-CMP-17', 'the documentation follows the selection', 'json', KEY, [T('"des'), K('ArrowDown')], { docs: { has: 'description' } }],
];

// ---- snippets ----------------------------------------------------------------------------------------------------------------------------------------
const SLIDES = '{\n  "slides": [|]\n}';
export const jsonSnippets = [
  ['J-SNP-001', 'R-CMP-16', 'the slide snippet in slides', 'json', SLIDES, [T('slide'), K('Tab')], { text: '{\n  "slides": [{\n    "title": "⟦Slide title⟧",\n    "items": [\n      "First point"\n    ]\n  }]\n}' }],
  ['J-SNP-002', 'R-CMP-16', 'Tab walks title then item, Tab again exits', 'json', SLIDES, [T('slide'), K('Tab'), T('Hello'), K('Tab'), T('A'), K('Tab')], { deck: { '/slides/0/title': 'Hello', '/slides/0/items/0': 'A' }, text: '{\n  "slides": [{\n    "title": "Hello",\n    "items": [\n      "A"\n    ]\n  }|]\n}' }],
  ['J-SNP-003', 'R-CMP-16', 'Shift+Tab goes back a stop', 'json', SLIDES, [T('slide'), K('Tab'), K('Shift+Tab'), T('X')], { deck: { '/slides/0/title': 'X' } }],
  ['J-SNP-004', 'R-CMP-16', 'Escape leaves snippet mode', 'json', SLIDES, [T('slide'), K('Tab'), K('Escape'), K('Tab')], { popup: { open: 0 }, findings: { errors: 0 } }],
  ['J-SNP-005', 'R-CMP-16', 'the chart snippet opens the chart type list at its choice stop', 'json', SLIDES, [T('slide-chart'), K('Tab'), T('My chart'), K('Tab')], { popup: { open: 1, has: ['column', 'bar', 'line', 'pie'] } }],
  ['J-SNP-005b', 'R-CMP-16', 'choosing the chart type and walking on fills the data', 'json', SLIDES, [T('slide-chart'), K('Tab'), T('My chart'), K('Tab'), T('colum'), K('Enter'), K('Tab'), T('Q'), K('Tab'), T('Sales'), K('Tab'), T('Q1'), K('Tab'), T('7')], { deck: { '/slides/0/chart/type': 'column', '/slides/0/chart/data/columns/0': 'Q', '/slides/0/chart/data/rows/0/1': 7 }, findings: { errors: 0 } }],
  ['J-SNP-006', 'R-CMP-16', 'a blank document: the deck snippet', 'json', '|', [K('Control+Space'), T('deck'), K('Enter')], { deck: { '/slides/0/title': 'Title' } }],
  ['J-SNP-007', 'R-CMP-16', 'a comma follows the snippet when a slide comes after it', 'json', '{\n  "slides": [|{"title": "b"}]\n}', [T('slide-text'), K('Tab')], { has: '},{"title": "b"}' }],
  ['J-SNP-008', 'R-CMP-16', 'the quote snippet is a valid slide', 'json', SLIDES, [T('slide-quote'), K('Tab'), K('Tab'), K('Tab')], { deck: { '/slides/0/quote/text': 'Quote' }, findings: { errors: 0 } }],
  ['J-SNP-009', 'R-CMP-16', 'the reference snippet in references', 'json', '{\n  "slides": [],\n  "references": [|]\n}', [T('refer'), K('Tab')], { deck: { '/references/0/id': 'smith2020' } }],
  ['J-SNP-010', 'R-CMP-16', 'every slide snippet makes a valid deck', 'json', SLIDES, [T('slide-image'), K('Tab'), K('Tab'), K('Tab'), K('Tab')], { findings: { errors: 0 } }],
  ['J-SNP-011', 'R-CMP-16', 'the dataset snippet in datasets', 'json', '{\n  "slides": [],\n  "datasets": {|}\n}', [T('datas'), K('Tab')], { has: '"sales"' }],
  ['J-SNP-012', 'R-CMP-16', 'the snippet is one undo step', 'json', SLIDES, [T('slide'), K('Tab')], { undo: [1, '{\n  "slides": [slide|]\n}'] }],
];

export const jsonComplete = [...jsonTriggers, ...jsonCtrlSpace, ...jsonInsert, ...jsonValues, ...jsonRank, ...jsonDocs, ...jsonSnippets];
void M; void WAIT;
