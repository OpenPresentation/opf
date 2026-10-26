// Phase 1 JSON cases of artifacts/source-editor/TEST-PLAN.md, sections 4.1 to 4.5: when the list opens, the Ctrl+Space matrix, what accepting writes
// (exact strings of SPEC 4.6), the values of every kind of field, ranking, the documentation panel and snippets. Row format:
// [id, requirement, title, format, doc, steps, expect, options?]; see support/source-keyboard.mjs.
import { K, M, T, WAIT } from '../source-keyboard.mjs';
import { phase4Json } from './phase4-extras.mjs';

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
  ['J-INS-006', 'R-CMP-12', 'an object key without required members (phase 3: variables, since accepting design starts the design snippet)', 'json', KEY, [T('"variab'), K('Tab')], { text: '{\n  "slides": [],\n  "variables": {|}\n}' }],
  ['J-INS-007', 'R-CMP-15', 'an object key with required members writes them as tab stops (phase 3: organization is a snippet key, its placeholders hold acme and Acme Inc.)', 'json', KEY, [T('"organ'), K('Tab')], { text: '{\n  "slides": [],\n  "organization": {\n    "id": "⟦acme⟧",\n    "name": "Acme Inc."\n  }\n}' }],
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
  ['J-INS-017', 'R-CMP-14', 'chain: accepting the key and its value is one undo step (VS Code: the accept is one step, the typed prefix stays)', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"titleA'), K('Tab'), K('Tab')], { undo: [1, '{\n  "slides": [],\n  "design": {\n    "titleA|"\n  }\n}'] }],
  ['J-INS-017b', 'R-CMP-14', 'redo puts the key and its value back together', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"titleA'), K('Tab'), K('Tab')], { undo: [1, '{\n  "slides": [],\n  "design": {\n    "titleA|"\n  }\n}'], redo: [1, '{\n  "slides": [],\n  "design": {\n    "titleAlignment": "left"|\n  }\n}'] }],
  ['J-INS-017c', 'R-CMP-14', 'text typed between the key and the value keeps the two steps apart', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"titleA'), K('Tab'), T('ce'), K('Tab')], { undo: [1, '{\n  "slides": [],\n  "design": {\n    "titleAlignment": "ce|"\n  }\n}'] }],
  ['J-INS-017d', 'R-CMP-14', 'a boolean key and its value are one undo step too', 'json', KEY, [T('"templ'), K('Tab'), K('Tab')], { undo: [1, '{\n  "slides": [],\n  "templ|"\n}'] }],
  ['J-INS-017e', 'R-CMP-14', 'Escape on the value list leaves the key accept as its own step', 'json', '{\n  "slides": [],\n  "design": {\n    |\n  }\n}', [T('"titleA'), K('Tab'), K('Escape'), T('x')], { undo: [2, '{\n  "slides": [],\n  "design": {\n    "titleA|"\n  }\n}'] }],
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
  ['design.listBullet', '{"slides":[],"design":{"listBullet":"|"}}', ['character', 'image', 'none']],
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
// Cross references inside the document (SPEC 3.4; TEST-PLAN 4.4 XREF): the lists are read from the text being edited, so they follow it while the document is a draft.
const SALES = '"datasets":{"sales":{"columns":["Quarter","Revenue",{"name":"Costs"}],"rows":[["Q1",1,2]]},"pipeline":{"title":"Pipeline","columns":["Stage"],"rows":[]}}';
const XREF = [
  ['asset:', '{"assets":{"logo":{"src":"logo.png"},"photo":"./p.jpg"},"slides":[{"image":"|"}]}', ['asset:logo', 'asset:photo']],
  ['asset: in an image object', '{"assets":{"logo":{"src":"logo.png"}},"slides":[{"image":{"src":"|","alt":"x"}}]}', ['asset:logo']],
  ['asset: in a design background', '{"assets":{"logo":"a.png"},"slides":[],"design":{"background":{"type":"image","src":"|"}}}', ['asset:logo']],
  ['dataset', `{${SALES},"slides":[{"chart":{"type":"bar","data":{"dataset":"|"}}}]}`, ['sales', 'pipeline']],
  ['dataset of a table', `{${SALES},"slides":[{"table":{"dataset":"|"}}]}`, ['sales', 'pipeline']],
  ['dataset columns of a table', `{${SALES},"slides":[{"table":{"dataset":"sales","fields":["|"]}}]}`, ['Quarter', 'Revenue', 'Costs']],
  ['dataset columns of a chart', `{${SALES},"slides":[{"chart":{"type":"bar","data":{"dataset":"sales","fields":["Quarter","|"]}}}]}`, ['Quarter', 'Revenue', 'Costs']],
  ['dataset column of a chart mapping', `{${SALES},"slides":[{"chart":{"type":"bar","data":{"dataset":"sales"},"mapping":{"category":"|"}}}]}`, ['Quarter', 'Revenue', 'Costs']],
  ['cite', '{"references":[{"id":"smith2020","text":"Smith"},{"id":"lee2021","text":"Lee"}],"slides":[{"title":[{"text":"x","cite":"|"}]}]}', ['smith2020', 'lee2021']],
  ['cite in a list', '{"references":[{"id":"smith2020","text":"Smith"}],"slides":[{"title":[{"text":"x","cite":["|"]}]}]}', ['smith2020']],
  ['beat', '{"narrative":"classic-story","slides":[{"beat":"|"}]}', ['opening', 'closing']],
  ['region', '{"slides":[{"layout":"two-column","blocks":[{"region":"|"}]}]}', ['first', 'second', 'left', 'right']],
  ['var:', '{"variables":{"brand":{"type":"color","value":"#123456"},"hero":{"type":"image","value":"a.png"}},"slides":[{"title":[{"text":"x","color":"|"}]}]}', ['var:brand']],
  ['var: in a design color', '{"variables":{"brand":"#123456"},"slides":[],"design":{"background":{"type":"solid","color":"|"}}}', ['var:brand', 'accent1']],
];
export const jsonXrefs = [
  ...XREF.map(([field, doc, has], index) => [`J-VAL-X${index + 1}`, 'R-CMP-19', `cross reference ${field}`, 'json', doc, [K('Control+Space')], { popup: { open: 1, has } }]),
  ['J-VAL-X27', 'R-CMP-19', 'the columns of a chart with its own data, for a highlighted series', 'json', '{"slides":[{"chart":{"type":"bar","data":{"columns":["Quarter",{"name":"Revenue"}],"rows":[["Q1",1]]},"highlight":{"series":["|"]}}}]}', [K('Control+Space')], { popup: { open: 1, has: ['Quarter', 'Revenue'] } }],
  ['J-VAL-X28', 'R-CMP-19', 'combo series: line names a column of the dataset', 'json', `{${SALES},"slides":[{"chart":{"type":"combo","data":{"dataset":"sales"},"line":["|"]}}]}`, [K('Control+Space')], { popup: { open: 1, has: ['Quarter', 'Revenue'] } }],
  ['J-VAL-X29', 'R-CMP-19', 'each option has an accessible name with its kind and its place', 'json', '{"assets":{"logo":"logo.png"},"slides":[{"image":"|"}]}', [K('Control+Space'), ['waitLabels']], { popup: { ariaNames: [/^asset:logo, reference, logo\.png\. 1 of 1$/] } }],
  ['J-VAL-X30', 'R-CMP-19', 'the documentation panel describes the selected reference', 'json', '{"assets":{"logo":{"src":"logo.png","title":"Logo"}},"slides":[{"image":"|"}]}', [K('Control+Space')], { docs: { shown: true, has: ['asset:logo', 'asset'] } }],
  ['J-VAL-X31', 'R-A11Y-02', 'accepting a reference says what was inserted', 'json', '{"assets":{"logo":"logo.png"},"slides":[{"image":"|"}]}', [K('Control+Space'), K('Enter')], { live: 'Inserted asset:logo' }],
  ['J-VAL-X15', 'R-CMP-19', 'only the asset ids of the document, not the other kinds', 'json', '{"assets":{"logo":"a.png"},"references":[{"id":"r1","text":"R"}],"slides":[{"image":"|"}]}', [K('Control+Space')], { popup: { open: 1, has: ['asset:logo'], not: ['r1'] } }],
  ['J-VAL-X16', 'R-CMP-19', 'columns come from the dataset the field names, not another', 'json', `{${SALES},"slides":[{"table":{"dataset":"pipeline","fields":["|"]}}]}`, [K('Control+Space')], { popup: { open: 1, has: ['Stage'], not: ['Revenue'] } }],
  ['J-VAL-X17', 'R-CMP-19', 'image variables are offered where an image goes, color variables where a color does', 'json', '{"variables":{"brand":{"type":"color","value":"#123456"},"hero":{"type":"image","value":"a.png"}},"slides":[{"image":"|"}]}', [K('Control+Space')], { popup: { open: 1, has: ['var:hero'], not: ['var:brand'] } }],
  ['J-VAL-X18', 'R-CMP-19', 'a typed prefix filters the ids and Tab inserts the quoted id', 'json', '{"assets":{"logo":"a.png","photo":"b.png"},"slides":[{"image":"|"}]}', [T('pho'), K('Tab')], { text: '{"assets":{"logo":"a.png","photo":"b.png"},"slides":[{"image":"asset:photo"|}]}', deck: { '/slides/0/image': 'asset:photo' } }],
  ['J-VAL-X19', 'R-CMP-19', 'a cite id inside a list is inserted in its own quotes', 'json', '{"references":[{"id":"smith2020","text":"Smith"}],"slides":[{"title":[{"text":"x","cite":["|"]}]}]}', [K('Control+Space'), K('Enter')], { has: '"cite":["smith2020"]' }],
  ['J-VAL-X20', 'R-CMP-19', 'a beat of an unknown narrative offers nothing', 'json', '{"narrative":"no-such-story","slides":[{"beat":"|"}]}', [K('Control+Space')], { popup: { open: 0 } }],
  ['J-VAL-X21', 'R-CMP-19', 'a document with no assets offers nothing for an image', 'json', '{"slides":[{"image":"|"}]}', [K('Control+Space')], { popup: { open: 0 } }],
  ['J-VAL-X22', 'R-CMP-19', 'a free text field with no reference opens nothing even with variables declared', 'json', '{"variables":{"brand":{"type":"color","value":"#123456"}},"slides":[{"notes":"|"}]}', [K('Control+Space')], { popup: { open: 0 } }],
  ['J-VAL-X23', 'R-CMP-19', 'the references follow the draft: an asset added a moment ago is offered', 'json', '{"assets":{"logo":"a.png"},"slides":[{"image":"|"}]}', [['caret', '"logo"', 5], T('x'), ['caret', '"image":"', 9], K('Control+Space')], { popup: { open: 1, has: ['asset:logox'] } }],
  ['J-VAL-X24', 'R-CMP-19', '{{ in a text lists the variables and Tab closes the braces', 'json', '{"variables":{"brand":{"type":"text","value":"Acme"}},"slides":[{"title":"Hello |"}]}', [T('{{'), K('Tab')], { text: '{"variables":{"brand":{"type":"text","value":"Acme"}},"slides":[{"title":"Hello {{brand}}|"}]}' }],
  ['J-VAL-X25', 'R-CMP-19', '{{ and a typed prefix pick one variable', 'json', '{"variables":{"brand":{"type":"text","value":"Acme"},"year":{"type":"number","value":2026}},"slides":[{"title":"Hello |"}]}', [T('{{ye'), K('Enter')], { has: '"Hello {{year}}"', popup: { open: 0 } }],
  ['J-VAL-X26', 'R-CMP-19', 'a { alone in a text opens nothing', 'json', '{"variables":{"brand":{"type":"text","value":"Acme"}},"slides":[{"title":"Hello |"}]}', [T('{')], { popup: { open: 0 } }],
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
// Layout regions rank the slide keys (SPEC 4.4 item 2): the keys the layout's regions call for that are not set yet come first, after the required ones.
export const jsonRegionRank = [
  ['J-RNK-010', 'R-CMP-18', 'agenda: title and items come before the subtitle', 'json', '{\n  "slides": [{\n    "layout": "agenda",\n    |\n  }]\n}', [T('"')], { popup: { first: 'title', order: ['title', 'items', 'subtitle', 'text'] } }],
  ['J-RNK-011', 'R-CMP-18', 'cover: the media region calls for image and video', 'json', '{\n  "slides": [{\n    "layout": "cover",\n    |\n  }]\n}', [T('"')], { popup: { order: ['title', 'image', 'video', 'subtitle'] } }],
  ['J-RNK-012', 'R-CMP-18', 'keys the layout calls for that are already set are not offered again', 'json', '{\n  "slides": [{\n    "layout": "agenda",\n    "title": "a",\n    |\n  }]\n}', [T('"')], { popup: { first: 'items', not: ['title', 'layout'] } }],
  ['J-RNK-013', 'R-CMP-18', 'an unknown layout leaves the common order', 'json', '{\n  "slides": [{\n    "layout": "no-such-layout",\n    |\n  }]\n}', [T('"')], { popup: { order: ['title', 'subtitle', 'items'] } }],
  ['J-RNK-014', 'R-CMP-18', 'a layout embedded in the document ranks its regions too', 'json', '{\n  "catalogs": {"custom": {"layouts": {"mine": {"name": "Mine", "regions": [{"name": "title"}, {"name": "quote", "accepts": ["quote"]}]}}}},\n  "slides": [{\n    "layout": "mine",\n    |\n  }]\n}', [T('"')], { popup: { order: ['title', 'quote', 'subtitle'] } }],
  ['J-RNK-015', 'R-CMP-18', 'the ranking is the same twice with a layout', 'json', '{\n  "slides": [{\n    "layout": "agenda",\n    |\n  }]\n}', [T('"'), ['snapshotPopup', 'a'], K('Escape'), K('Control+Space'), ['expectSamePopup', 'a']], {}],
  ['J-RNK-016', 'R-CMP-18', 'no layout: the common order holds', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"')], { popup: { order: ['title', 'subtitle', 'layout', 'items'] } }],
  ['J-RNK-017', 'R-CMP-18', 'a prefix that matches ranks by the match, not by the layout', 'json', '{\n  "slides": [{\n    "layout": "agenda",\n    |\n  }]\n}', [T('"sub')], { popup: { first: 'subtitle' } }],
];

// The line under a list of catalog records whose catalog is not loaded (SPEC 4.5).
const BESPOKE = '{"name": "Bespoke", "regions": [{"name": "title"}]}';
export const jsonFooter = [
  ['J-VAL-R13', 'R-CMP-19', 'records of a catalog that is not registered: the embedded ones are listed and the list says the rest is not loaded', 'json', `{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space')], { popup: { open: 1, has: ['acme:bespoke', 'cover'], footer: 'Records from catalog acme are not loaded' } }],
  ['J-VAL-R14', 'R-CMP-19', 'a catalog that is registered adds no footer', 'json', `{"catalogs":{"gallery":{"source":"https://www.pptx.gallery","layouts":{"bespoke":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space')], { popup: { open: 1, footer: null } }],
  ['J-VAL-R15', 'R-CMP-19', 'the footer stays while the list is filtered', 'json', `{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space'), T('bes')], { popup: { open: 1, has: ['acme:bespoke'], footer: 'Records from catalog acme are not loaded' } }],
  ['J-VAL-R16', 'R-CMP-19', 'the footer is read out with the count', 'json', `{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space')], { live: 'suggestions. Records from catalog acme are not loaded' }],
  ['J-VAL-R17', 'R-CMP-19', 'the custom group is never "not loaded"', 'json', `{"catalogs":{"custom":{"layouts":{"bespoke":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space')], { popup: { open: 1, first: 'bespoke', footer: null } }],
  ['J-VAL-R18', 'R-CMP-19', 'two unregistered groups are named together', 'json', `{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":${BESPOKE}}},"zeta":{"source":"https://zeta.test","layouts":{"other":${BESPOKE}}}},"slides":[{"layout":"|"}]}`, [K('Control+Space')], { popup: { open: 1, footer: 'Records from catalog acme, zeta are not loaded' } }],
  ['J-VAL-R19', 'R-CMP-19', 'a field that is not a catalog reference has no footer', 'json', `{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":${BESPOKE}}}},"slides":[],"design":{"titleAlignment":"|"}}`, [K('Control+Space')], { popup: { open: 1, footer: null } }],
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
  ['J-SNP-020', 'R-CMP-16', 'design: accepting the key writes the design snippet and opens the theme list (the plan row J-SNP-007 expected a closed list; SPEC 5 says each stop opens its catalog list)', 'json', KEY, [T('"design'), K('Tab')], { popup: { open: 1, has: ['bold', 'classic', 'minimal'] }, text: '{\n  "slides": [],\n  "design": {\n    "theme": "|",\n    "colorScheme": "",\n    "fontScheme": ""\n  }\n}' }],
  ['J-SNP-021', 'R-CMP-16', 'design: accepting a theme and Tab opens the color scheme list', 'json', KEY, [T('"design'), K('Tab'), T('mini'), K('Tab'), K('Tab')], { popup: { open: 1, has: ['boost', 'black-and-white'] }, has: '"theme": "minimal"' }],
  ['J-SNP-022', 'R-CMP-16', 'design: three picks fill the design and leave a valid deck', 'json', '{\n  "slides": [{"title": "a"}],\n  |\n}', [T('"design'), K('Tab'), T('mini'), K('Tab'), K('Tab'), T('boos'), K('Tab'), K('Tab'), T('aptos'), K('Tab')], { deck: { '/design/theme': 'minimal', '/design/colorScheme': 'boost', '/design/fontScheme': 'aptos' }, findings: { errors: 0 } }],
  ['J-SNP-023', 'R-CMP-16', 'design: Escape keeps the empty stop and Tab goes on', 'json', KEY, [T('"design'), K('Tab'), K('Escape'), K('Tab')], { popup: { open: 1, has: ['boost'] } }],
  ['J-SNP-024', 'R-CMP-16', 'speaker: the id is a selected placeholder and the name follows (deviation from SPEC 5, which lists only the name: the Speaker schema requires both)', 'json', KEY, [T('"speak'), K('Tab')], { text: '{\n  "slides": [],\n  "speaker": {\n    "id": "⟦alice⟧",\n    "name": "Name"\n  }\n}' }],
  ['J-SNP-025', 'R-CMP-16', 'speaker: Tab walks from the id to the name', 'json', KEY, [T('"speak'), K('Tab'), T('ada'), K('Tab'), T('Ada')], { deck: { '/speaker/id': 'ada', '/speaker/name': 'Ada' } }],
  ['J-SNP-026', 'R-CMP-16', 'organization: a comma follows when a property comes after', 'json', '{\n  "slides": [],\n  |\n  "name": "x"\n}', [T('"organ'), K('Tab')], { has: '    "name": "Acme Inc."\n  },\n  "name": "x"' }],
  ['J-SNP-027', 'R-CMP-16', 'design: the snippet is one undo step', 'json', KEY, [T('"design'), K('Tab')], { undo: [1, '{\n  "slides": [],\n  "design|"\n}'] }],
  ['J-SNP-028', 'R-CMP-16', 'design: the key is listed once (the snippet is what the key writes, not an item of its own)', 'json', KEY, [T('"des')], { popup: { open: 1, has: ['design', 'description', 'datasets'], count: [3, 3] } }],
  ['J-SNP-029', 'R-CMP-16', 'design: accepting the snippet announces it and its first stop', 'json', KEY, [T('"design'), K('Tab')], { live: 'Inserted design. Tab stop 1 of 3' }],
  ['J-SNP-030', 'R-CMP-16', 'design: a key with a colon after it keeps the plain key', 'json', '{\n  "slides": [],\n  "des|": {}\n}', [K('Control+Space'), K('ArrowDown'), K('ArrowDown'), K('Enter')], { not: '"theme"' }],
  ['J-SNP-031', 'R-CMP-16', 'deck keys in a slide are not snippets: design in a slide is the plain key', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [T('"design'), K('Tab')], { text: '{\n  "slides": [{\n    "design": {|}\n  }]\n}' }],
  ['J-SNP-012', 'R-CMP-16', 'the snippet is one undo step', 'json', SLIDES, [T('slide'), K('Tab')], { undo: [1, '{\n  "slides": [slide|]\n}'] }],
];

export const jsonComplete = [...jsonTriggers, ...jsonCtrlSpace, ...jsonInsert, ...jsonValues, ...jsonXrefs, ...jsonRank, ...jsonRegionRank, ...jsonFooter, ...jsonDocs, ...jsonSnippets];
void M; void WAIT;

// Phase 4: the shape hint, built-in variables with several cursors, Markdown image targets (phase4-extras.mjs).
jsonComplete.push(...phase4Json);
