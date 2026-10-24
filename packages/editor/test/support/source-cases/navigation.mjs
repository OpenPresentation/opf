// Phase 4 cases of the source editor keyboard plan (artifacts/source-editor/SPEC.md, section 8.3): go to definition (F12, Cmd/Ctrl+click), peek (Alt+F12),
// find references (Shift+F12) and rename (F2) for the ids of an OPF document, in JSON, YAML and Markdown. The same deck is written in each format and the
// same behavior is asserted on all three; every key is a real keyboard event and every click a real mouse event. Row format:
// [id, requirement, title, format, doc, steps, expect, options?] (see json.mjs); the steps and expectations this file adds are in source-keyboard.mjs
// (`nav`, `setCaret`, `modClick`, `clickRow`, `expect.nav`, `expect.selection`, `expect.selected`).
import { toMarkdown } from '@openpresentation/opf/markdown';
import { toYaml } from '@openpresentation/opf/yaml';
import assert from 'node:assert/strict';
import { K, M } from '../source-keyboard.mjs';

const deck = {
  name: 'Demo {{client}}',
  narrative: 'problem-solution',
  references: [{ id: 'gartner', text: 'Gartner 2026' }, { id: 'gartner-old', text: 'Older' }],
  assets: { logo: './l.svg', 'logo-dark': './d.svg' },
  variables: { client: { type: 'text', value: 'Acme' }, brand: '#336699' },
  datasets: { sales: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 1], ['Q2', 2]] } },
  catalogs: { custom: { layouts: { hero: { name: 'Hero', regions: [{ name: 'title', accepts: ['text'] }, { name: 'body', accepts: ['text', 'list'] }] } } } },
  slides: [
    { id: 'cover', layout: 'hero', title: 'Hello {{client|upper}}', blocks: [{ region: 'body', text: 'Welcome {{client}}' }] },
    { id: 'logos', title: 'Logos', image: 'asset:logo', notes: 'See asset:logo-dark' },
    { id: 'chart', beat: 'problem', layout: 'two-column', title: [{ text: 'Revenue', cite: 'gartner' }], blocks: [{ chart: { type: 'column', colors: ['var:brand'], data: { dataset: 'sales', fields: ['Quarter', 'Revenue'] } } }] },
  ],
};
export const docs = { json: JSON.stringify(deck, null, 2), yaml: toYaml(deck).yaml, md: toMarkdown(deck).markdown };

// Where each symbol is written, per format: `[needle, nth, shift, length]` finds the nth occurrence of the needle and goes `shift` characters into it;
// `length` is the size of the id there (for a declaration).
const SPEC = {
  json: {
    asset: { use: ['asset:logo', 0, 8], def: ['"logo": "./l.svg"', 0, 1, 4] },
    variable: { use: ['{{client|upper}}', 0, 4], def: ['"client": {', 0, 1, 6] },
    color: { use: ['var:brand', 0, 5], def: ['"brand": "#336699"', 0, 1, 5] },
    dataset: { use: ['"dataset": "sales"', 0, 14], def: ['"sales": {', 0, 1, 5] },
    cite: { use: ['"cite": "gartner"', 0, 12], def: ['"id": "gartner",', 0, 7, 7] },
    layout: { use: ['"layout": "hero"', 0, 13], def: ['"hero": {', 0, 1, 4] },
    app: { use: ['"layout": "two-column"', 0, 14] },
    column: { use: ['Revenue', 2, 2], def: ['Revenue', 0, 0, 7] },
    beat: { use: ['"beat": "problem"', 0, 11] },
    region: { use: ['"region": "body"', 0, 13], def: ['"name": "body"', 0, 9, 4] },
    slide: { def: ['"id": "cover"', 0, 7, 5] },
  },
  yaml: {
    asset: { use: ['asset:logo', 0, 8], def: ['logo: ./l.svg', 0, 0, 4] },
    variable: { use: ['{{client|upper}}', 0, 4], def: ['client:\n', 0, 0, 6] },
    color: { use: ['var:brand', 0, 5], def: ['brand: "#336699"', 0, 0, 5] },
    dataset: { use: ['dataset: sales', 0, 9], def: ['sales:\n', 0, 0, 5] },
    cite: { use: ['cite: gartner', 0, 6], def: ['id: gartner\n', 0, 4, 7] },
    layout: { use: ['layout: hero', 0, 8], def: ['hero:', 0, 0, 4] },
    app: { use: ['layout: two-column', 0, 9] },
    column: { use: ['Revenue', 1, 2], def: ['Revenue', 2, 0, 7] },
    beat: { use: ['beat: problem', 0, 6] },
    region: { use: ['region: body', 0, 8], def: ['name: body', 0, 6, 4] },
    slide: { def: ['id: cover', 0, 4, 5] },
  },
  md: {
    asset: { use: ['asset:logo', 0, 8], def: ['logo: ./l.svg', 0, 0, 4] },
    variable: { use: ['{{client|upper}}', 0, 4], def: ['client:\n', 0, 0, 6] },
    color: { use: ['var:brand', 0, 5], def: ['brand: "#336699"', 0, 0, 5] },
    dataset: { use: ['dataset: sales', 0, 9], def: ['sales:\n', 0, 0, 5] },
    cite: { use: ['cite: gartner', 0, 6], def: ['id: gartner\n', 0, 4, 7] },
    layout: { use: ['layout=hero', 0, 8], def: ['hero:', 0, 0, 4] },
    app: { use: ['layout=two-column', 0, 9] },
    column: { use: ['Revenue', 1, 2], def: ['Revenue', 0, 0, 7] },
    beat: { use: ['beat=problem', 0, 6] },
    region: { use: ['region=body', 0, 8], def: ['name: body', 0, 6, 4] },
    slide: { def: ['id=cover', 0, 3, 5] },
  },
};

const place = (doc, [needle, nth = 0, shift = 0]) => {
  let at = -1;
  for (let count = 0; count <= nth; count++) { at = doc.indexOf(needle, at + 1); assert.ok(at >= 0, `${JSON.stringify(needle)} #${nth} is in the document`); }
  return at + shift;
};
const defRange = (doc, spec) => { const from = place(doc, spec); return [from, from + spec[3]]; };
const mark = (doc, [from, to]) => `${doc.slice(0, from)}⟦${doc.slice(from, to)}⟧${doc.slice(to)}`;

// A read-only editor. The pane's own read-only content cannot be focused (it is not editable at all), so the test makes it focusable the way a host
// that wants keyboard access would, and the commands see CodeMirror's readOnly state.
const READ_ONLY = ['run', async (kb) => { await kb.page.evaluate(() => { demo.pane.setReadOnly(true); demo.pane.editor.view.contentDOM.tabIndex = 0; }); }];
const LIVE = (pattern) => new RegExp(pattern).source;

/** The cases of one format. `code` is the id prefix (N-JSON, N-YAML, N-MD). */
function casesFor(format, code) {
  const doc = docs[format], spec = SPEC[format];
  const use = (kind) => place(doc, spec[kind].use);
  const def = (kind) => defRange(doc, spec[kind].def);
  const at = (kind) => ['setCaret', use(kind)];
  const options = { literal: true };
  const row = (id, title, steps, expect, extra = {}) => [`${code}-${id}`, 'R-NAV', title, format, doc, steps, expect, { ...options, ...extra }];
  const same = (kind, noun, id) => row(`D-${kind}`, `F12 on ${noun} goes to where it is declared`, [at(kind), ['nav', 'F12']], { text: mark(doc, def(kind)), selected: id, focus: 'editor', nav: null, live: LIVE(`Definition of ${noun} ${id}, line \\d+`) });
  // The chart of the third slide is the slide's own `chart` in Markdown (one block with no options is a root field) and the first of its `blocks` elsewhere.
  const chart = format === 'md' ? '/slides/2/chart' : '/slides/2/blocks/0/chart';
  const rows = [];

  // ---- F12 ---------------------------------------------------------------------------------------------------------------------------------
  rows.push(same('asset', 'asset', 'logo'));
  rows.push(same('variable', 'variable', 'client'));
  rows.push(row('D-var', 'F12 on var:brand goes to the variable', [at('color'), ['nav', 'F12']], { selected: 'brand', selection: def('color'), focus: 'editor', live: 'Definition of variable brand' }));
  rows.push(same('dataset', 'dataset', 'sales'));
  rows.push(same('cite', 'reference', 'gartner'));
  rows.push(same('layout', 'layout', 'hero'));
  rows.push(row('D-column', 'F12 on a dataset column goes to the column of its dataset', [at('column'), ['nav', 'F12']], { selected: 'Revenue', selection: def('column'), live: 'Definition of dataset column Revenue' }));
  rows.push(row('D-region', 'F12 on a region goes to the region of the slide\'s layout record', [at('region'), ['nav', 'F12']], { selected: 'body', selection: def('region'), live: 'Definition of layout region body' }));
  rows.push(row('D-app', 'F12 on a layout only the app has opens its card, read only', [at('app'), ['nav', 'F12']], {
    nav: { kind: 'card', role: 'region', label: /two-column, provided by the app/, has: ['two-column', 'Provided by app'] }, focus: 'panel:card', selection: [use('app'), use('app')], live: 'layout two-column is provided by the app',
  }));
  rows.push(row('D-preview', 'the host can add a preview to the card', [at('app'), ['nav', 'F12']], { nav: { kind: 'card', has: ['Preview of layouts two-column'] } }, { query: '?preview=on' }));
  rows.push(row('D-card-close', 'Escape closes the card and the caret has not moved', [at('app'), ['nav', 'F12'], K('Escape')], { nav: null, focus: 'editor', selection: [use('app'), use('app')] }));
  rows.push(row('D-beat', 'F12 on a beat of a narrative the app provides opens its card', [at('beat'), ['nav', 'F12']], { nav: { kind: 'card', has: ['problem', 'Provided by app'] }, focus: 'panel:card' }));
  rows.push(row('D-none', 'F12 where nothing is defined says so and does not move', [['setCaret', doc.indexOf('Logos') + 2], ['nav', 'F12']], { selection: [doc.indexOf('Logos') + 2, doc.indexOf('Logos') + 2], nav: null, focus: 'editor', live: "No definition found for 'Logos'" }));
  const ghost = doc.replace('asset:logo-dark', 'asset:ghost');
  rows.push([`${code}-D-missing`, 'R-NAV', 'F12 on an id that is not declared says so', format, ghost, [['setCaret', ghost.indexOf('asset:ghost') + 9], ['nav', 'F12']], { selection: [ghost.indexOf('asset:ghost') + 9, ghost.indexOf('asset:ghost') + 9], live: "No definition found for 'ghost'", nav: null }, options]);
  rows.push(row('D-self', 'F12 on the declaration lists where it is used', [['setCaret', def('asset')[0] + 1], ['nav', 'F12']], { nav: { kind: 'refs', rows: 2 }, focus: 'panel:refs' }));

  // ---- Alt+F12 -----------------------------------------------------------------------------------------------------------------------------
  rows.push(row('P-open', 'Alt+F12 peeks the definition under the line, with the focus in the widget', [at('asset'), ['nav', 'Alt+F12']], {
    nav: { kind: 'peek', role: 'region', label: 'Peek definition of asset logo', title: 'asset logo', has: ['Enter goes to the definition. Escape closes.'], target: format === 'json' ? '"logo": "./l.svg",' : 'logo: ./l.svg' },
    focus: 'panel:peek', selection: [use('asset'), use('asset')], live: 'Peek definition of asset logo, line \\d+',
  }));
  rows.push(row('P-escape', 'Escape closes the peek and returns to the editor', [at('asset'), ['nav', 'Alt+F12'], K('Escape')], { nav: null, focus: 'editor', selection: [use('asset'), use('asset')] }));
  rows.push(row('P-enter', 'Enter in the peek goes to the definition', [at('asset'), ['nav', 'Alt+F12'], K('Enter')], { nav: null, focus: 'editor', selection: def('asset'), selected: 'logo' }));
  rows.push(row('P-block', 'the peek of a declaration with several lines shows them all', [at('dataset'), ['nav', 'Alt+F12']], { nav: { kind: 'peek', has: ['columns'] }, focus: 'panel:peek' }));
  rows.push(row('P-app', 'Alt+F12 on a layout only the app has shows its card', [at('app'), ['nav', 'Alt+F12']], { nav: { kind: 'card', has: ['Provided by app'] }, focus: 'panel:card' }));
  rows.push(row('P-follow', 'the widget moves with the edits above it', [at('asset'), ['nav', 'Alt+F12'], ['run', async (kb) => { await kb.page.evaluate(() => { const { view } = demo.pane.editor; view.focus(); view.dispatch({ selection: { anchor: 0 } }); }); }], K('Enter'), K('Enter')], {
    nav: { kind: 'peek', before: /asset:logo/ }, focus: 'editor',
  }));
  rows.push(row('P-close-button', 'the Close button closes the peek', [at('asset'), ['nav', 'Alt+F12'], ['clickClose']], { nav: null }));

  // ---- Shift+F12 ---------------------------------------------------------------------------------------------------------------------------
  rows.push(row('R-asset', 'Shift+F12 lists the declaration first, then the uses, with line numbers', [at('asset'), ['nav', 'Shift+F12']], {
    nav: { kind: 'refs', role: 'region', label: 'References to asset logo', title: '2 references to asset logo', rows: 2, active: 0, listRole: 'listbox', row: { 0: { declaration: true, badge: 'Declaration', selected: true }, 1: { declaration: false, badge: 'Slide 2', selected: false } } },
    focus: 'panel:refs', live: '2 references to asset logo',
  }));
  rows.push(row('R-prefix', 'an id that starts with another is its own symbol', [['setCaret', place(doc, ['asset:logo-dark', 0, 12])], ['nav', 'Shift+F12']], { nav: { kind: 'refs', title: '2 references to asset logo-dark', rows: 2 } }));
  rows.push(row('R-enter', 'Down then Enter jumps to the use and selects it', [at('asset'), ['nav', 'Shift+F12'], K('ArrowDown'), K('Enter')], { nav: null, focus: 'editor', selected: 'logo', selection: [use('asset') - 2, use('asset') + 2] }));
  rows.push(row('R-enter-decl', 'Enter on the first row goes to the declaration', [at('asset'), ['nav', 'Shift+F12'], K('Enter')], { nav: null, focus: 'editor', selected: 'logo', selection: def('asset') }));
  rows.push(row('R-keys', 'Up, Down, Home and End move through the list', [at('variable'), ['nav', 'Shift+F12'], K('End')], { nav: { kind: 'refs', rows: 4, active: 3, row: { 3: { selected: true }, 0: { selected: false } } } }));
  rows.push(row('R-keys-home', '... Home goes back to the declaration and Up stops there', [at('variable'), ['nav', 'Shift+F12'], K('End'), K('Home'), K('ArrowUp')], { nav: { kind: 'refs', active: 0 } }));
  rows.push(row('R-keys-down', '... Down moves one row at a time and stops at the last', [at('variable'), ['nav', 'Shift+F12'], K('ArrowDown'), K('ArrowDown'), K('ArrowDown'), K('ArrowDown'), K('ArrowDown')], { nav: { kind: 'refs', active: 3 } }));
  rows.push(row('R-pick', 'a row picked with Down twice and Enter selects that use', [at('variable'), ['nav', 'Shift+F12'], K('ArrowDown'), K('ArrowDown'), K('Enter')], { nav: null, selected: 'client', focus: 'editor' }));
  rows.push(row('R-escape', 'Escape closes the list and returns to the editor', [at('asset'), ['nav', 'Shift+F12'], K('Escape')], { nav: null, focus: 'editor', selection: [use('asset'), use('asset')] }));
  rows.push(row('R-editor-escape', 'Escape in the editor closes a list the author clicked away from', [at('asset'), ['nav', 'Shift+F12'], ['run', async (kb) => { await kb.page.evaluate(() => demo.pane.editor.view.focus()); }], K('Escape')], { nav: null, focus: 'editor' }));
  rows.push(row('R-layout', 'the references of an embedded layout are its record and the slides that use it', [at('layout'), ['nav', 'Shift+F12']], { nav: { kind: 'refs', rows: 2, title: '2 references to layout hero' } }));
  rows.push(row('R-app', 'the references of a layout only the app has are the slides that use it', [at('app'), ['nav', 'Shift+F12']], { nav: { kind: 'refs', rows: 1, title: '1 reference to layout two-column', row: { 0: { declaration: false, badge: 'Slide 3' } } } }));
  rows.push(row('R-dataset', 'the references of a dataset', [at('dataset'), ['nav', 'Shift+F12']], { nav: { kind: 'refs', rows: 2 } }));
  rows.push(row('R-click', 'clicking a row jumps to it', [at('asset'), ['nav', 'Shift+F12'], ['clickRow', 1]], { nav: null, selected: 'logo', selection: [use('asset') - 2, use('asset') + 2] }));

  // ---- F2 ----------------------------------------------------------------------------------------------------------------------------------
  const renameDeck = (extra) => ({ deck: extra });
  rows.push(row('N-open', 'F2 opens an input with the id, all selected', [at('asset'), ['nav', 'F2']], {
    nav: { kind: 'rename', role: 'group', label: 'Rename asset logo', input: { value: 'logo', selected: 'logo', invalid: 'false', label: 'New name' } }, focus: 'panel:rename', live: 'Rename asset logo',
  }));
  rows.push(row('N-asset', 'Enter renames the declaration and every use, and keeps the caret on the symbol', [at('asset'), ['nav', 'F2'], ['type', 'brand'], K('Enter')], {
    nav: null, focus: 'editor', selected: 'brand', before: 'asset:', live: 'Renamed asset logo to brand in 2 places',
    ...renameDeck({ '/assets/brand': './l.svg', '/assets/logo': undefined, '/assets/logo-dark': './d.svg', '/slides/1/image': 'asset:brand', '/slides/1/notes': 'See asset:logo-dark' }),
    has: ['asset:brand', 'asset:logo-dark'],
  }));
  rows.push(row('N-undo', 'one undo restores the declaration and every use', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], ['type', 'brand'], K('Enter'), M('z'), ['expectSame', 'before']], { focus: 'editor', deck: { '/assets/logo': './l.svg', '/assets/brand': undefined, '/slides/1/image': 'asset:logo' } }));
  rows.push(row('N-redo', 'redo brings the rename back in one step', [at('asset'), ['nav', 'F2'], ['type', 'brand'], K('Enter'), M('z'), ['press', 'Mod+Shift+z']], { deck: { '/assets/brand': './l.svg', '/slides/1/image': 'asset:brand' } }));
  rows.push(row('N-escape', 'Escape cancels and changes nothing', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], ['type', 'brand'], K('Escape'), ['expectSame', 'before']], { nav: null, focus: 'editor', selection: [use('asset'), use('asset')], deck: { '/assets/logo': './l.svg' } }));
  rows.push(row('N-collision', 'a name another asset has is refused, with the message in the widget and announced', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], ['type', 'logo-dark']], {
    nav: { kind: 'rename', message: 'Asset logo-dark already exists', input: { invalid: 'true' } }, live: 'Asset logo-dark already exists',
  }));
  rows.push(row('N-collision-enter', '... and Enter does not apply it', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], ['type', 'logo-dark'], K('Enter'), ['expectSame', 'before']], { nav: { kind: 'rename', message: 'Asset logo-dark already exists' }, focus: 'panel:rename' }));
  rows.push(row('N-empty', 'an empty name is refused', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], K('Backspace'), K('Enter'), ['expectSame', 'before']], { nav: { kind: 'rename', message: 'The name cannot be empty', input: { value: '', invalid: 'true' } }, live: 'The name cannot be empty', focus: 'panel:rename' }));
  rows.push(row('N-pattern', 'a name the schema does not allow is refused as you type', [at('variable'), ['nav', 'F2'], ['type', 'Client Name']], { nav: { kind: 'rename', message: /lowercase/, input: { value: 'Client Name', invalid: 'true' } }, live: 'must be lowercase' }));
  rows.push(row('N-fixed', '... and a good name clears the message', [at('variable'), ['nav', 'F2'], ['type', 'Client Name'], ...Array.from({ length: 11 }, () => K('Backspace')), ['type', 'customer']], { nav: { kind: 'rename', message: '', input: { value: 'customer', invalid: 'false' } } }));
  rows.push(row('N-same', 'Enter on the unchanged name closes and changes nothing', [at('asset'), ['snapshot', 'before'], ['nav', 'F2'], K('Enter'), ['expectSame', 'before']], { nav: null, focus: 'editor', live: 'asset logo keeps its name', deck: { '/assets/logo': './l.svg' } }));
  rows.push(row('N-variable', 'renaming a variable keeps the |format of its tokens', [at('variable'), ['nav', 'F2'], ['type', 'customer'], K('Enter')], {
    nav: null, selected: 'customer', has: ['{{customer|upper}}', '{{customer}}'], not: ['{{client'], live: 'Renamed variable client to customer in 4 places',
    deck: { '/variables/customer/type': 'text', '/variables/client': undefined, '/slides/0/title': 'Hello {{customer|upper}}', '/name': 'Demo {{customer}}' },
  }));
  rows.push(row('N-color', 'renaming a variable from var:brand changes the variable and the chart', [at('color'), ['nav', 'F2'], ['type', 'accent'], K('Enter')], { selected: 'accent', has: ['var:accent'], deck: { '/variables/accent': '#336699', '/variables/brand': undefined, [`${chart}/colors/0`]: 'var:accent' } }));
  rows.push(row('N-dataset', 'renaming a dataset changes its charts', [at('dataset'), ['nav', 'F2'], ['type', 'turnover'], K('Enter')], { selected: 'turnover', deck: { '/datasets/turnover/columns/0': 'Quarter', '/datasets/sales': undefined, [`${chart}/data/dataset`]: 'turnover' } }));
  rows.push(row('N-cite', 'renaming a reference changes the citations and not gartner-old', [at('cite'), ['nav', 'F2'], ['type', 'analyst'], K('Enter')], { selected: 'analyst', deck: { '/references/0/id': 'analyst', '/references/1/id': 'gartner-old', '/slides/2/title/0/cite': 'analyst' } }));
  rows.push(row('N-slide', 'renaming a slide id', [['setCaret', def('slide')[0] + 1], ['nav', 'F2'], ['type', 'intro'], K('Enter')], { selected: 'intro', deck: { '/slides/0/id': 'intro', '/slides/1/id': 'logos' }, live: 'Renamed slide cover to intro in 1 place' }));
  rows.push(row('N-slide-number', 'a name YAML would read as a number stays text', [['setCaret', def('slide')[0] + 1], ['nav', 'F2'], ['type', '123'], K('Enter')], { deck: { '/slides/0/id': '123' } }));
  rows.push(row('N-layout', 'renaming an embedded layout changes the record and the slides that use it', [at('layout'), ['nav', 'F2'], ['type', 'banner'], K('Enter')], { selected: 'banner', deck: { '/slides/0/layout': 'banner', '/catalogs/custom/layouts/banner/name': 'Hero', '/catalogs/custom/layouts/hero': undefined, '/slides/2/layout': 'two-column' } }));
  rows.push(row('N-from-def', 'F2 on the declaration renames from there and selects it', [['setCaret', def('asset')[0] + 1], ['nav', 'F2'], ['type', 'brand'], K('Enter')], { selected: 'brand', selection: [def('asset')[0] + (use('asset') < def('asset')[0] ? 1 : 0), def('asset')[0] + (use('asset') < def('asset')[0] ? 1 : 0) + 5], deck: { '/assets/brand': './l.svg', '/slides/1/image': 'asset:brand' } }));
  rows.push(row('N-app', 'a layout only the app has cannot be renamed', [at('app'), ['snapshot', 'before'], ['nav', 'F2'], ['expectSame', 'before']], { nav: null, focus: 'editor', live: 'Cannot rename: layout two-column is provided by the app' }));
  rows.push(row('N-column', 'a dataset column cannot be renamed from here', [at('column'), ['nav', 'F2']], { nav: null, live: 'Cannot rename: a dataset column is named where it is declared' }));
  rows.push(row('N-none', 'F2 where there is no id says so', [['setCaret', doc.indexOf('Logos') + 2], ['nav', 'F2']], { nav: null, live: 'Cannot rename: there is no id at the caret' }));
  rows.push(row('N-readonly', 'a read-only editor cannot rename', [READ_ONLY, ['click', 'asset:logo', 8], ['nav', 'F2']], { nav: null, live: 'Cannot rename: the editor is read-only', deck: { '/assets/logo': './l.svg' } }));
  rows.push(row('N-readonly-goto', '... but can still go to the definition', [READ_ONLY, ['click', 'asset:logo', 8], ['nav', 'F12']], { selected: 'logo', selection: def('asset') }));
  rows.push(row('N-typed-since', 'the text typed while the input is open is respected', [at('asset'), ['nav', 'F2'], ['type', 'brand']], { nav: { kind: 'rename', input: { value: 'brand' } } }));

  // ---- Windows line ends and one long line --------------------------------------------------------------------------------------------------
  const crlf = doc.replaceAll('\n', '\r\n');
  const crlfUse = place(crlf, spec.asset.use), crlfDef = defRange(crlf, spec.asset.def);
  rows.push([`${code}-D-crlf`, 'R-NAV', 'F12 on text with CRLF line ends selects the definition in the source offsets', format, crlf, [['setCaret', crlfUse], ['nav', 'F12']], { selection: crlfDef, selected: 'logo', focus: 'editor' }, options]);
  rows.push([`${code}-N-crlf`, 'R-NAV', 'a rename keeps every CRLF line end', format, crlf, [['setCaret', crlfUse], ['nav', 'F2'], ['type', 'brand'], K('Enter')], {
    selected: 'brand', deck: { '/assets/brand': './l.svg', '/slides/1/image': 'asset:brand' },
    custom: async (kb) => { const source = await kb.source(); assert.ok(!/(?<!\r)\n/.test(source), 'no bare LF in the source'); assert.equal(source.split('\r\n').length, crlf.split('\r\n').length, 'the same number of lines'); },
  }, options]);
  // A deck on one line: the lines the widget shows are a window around the id.
  const flat = format === 'json' ? JSON.stringify(deck) : null;
  if (flat) rows.push([`${code}-R-minified`, 'R-NAV', 'a deck on one line lists a window around each use, not the whole line', format, flat, [['setCaret', flat.indexOf('asset:logo') + 8], ['nav', 'Shift+F12']], { nav: { kind: 'refs', rows: 2, has: ['…'] }, custom: async (kb) => { const { rows: shown } = await kb.nav(); assert.ok(shown.every((row) => row.text.length <= 240), `the rows are short: ${shown.map((row) => row.text.length)}`); } }, options]);

  // ---- Cmd/Ctrl+click ----------------------------------------------------------------------------------------------------------------------
  rows.push(row('C-asset', 'Cmd/Ctrl+click on asset:logo goes to its definition', [['modClick', 'asset:logo', 8]], { selected: 'logo', selection: def('asset'), nav: null, focus: 'editor', live: 'Definition of asset logo' }));
  rows.push(row('C-variable', 'Cmd/Ctrl+click on {{client|upper}} goes to the variable', [['modClick', '{{client|upper}}', 4]], { selected: 'client', selection: def('variable'), live: 'Definition of variable client' }));
  rows.push(row('C-app', 'Cmd/Ctrl+click on a layout only the app has opens its card', [['modClick', format === 'json' ? '"two-column"' : 'two-column', format === 'json' ? 4 : 3]], { nav: { kind: 'card', has: ['Provided by app'] } }));
  rows.push(row('C-none', 'Cmd/Ctrl+click where nothing is defined is a plain click', [['modClick', 'Logos', 2, false]], { selection: [doc.indexOf('Logos') + 2, doc.indexOf('Logos') + 2], nav: null, focus: 'editor', liveCount: 0 }));
  rows.push(row('C-plain', 'a plain click on an id does not jump', [['click', 'asset:logo', 8]], { selection: [use('asset'), use('asset')], nav: null, liveCount: 0 }));
  return rows;
}

export const navigationCases = {
  json: casesFor('json', 'N-JSON'),
  yaml: casesFor('yaml', 'N-YAML'),
  markdown: casesFor('md', 'N-MD'),
};
