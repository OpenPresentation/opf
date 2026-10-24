// The completion pieces of phase 3 that need no browser (artifacts/source-editor/TEST-PLAN.md, section 8.5): which field takes which kind of
// cross reference (the ONE rule table, checked against the schema so a renamed definition or a reworded description fails here), the facts read
// from a draft, the lists the references give in the three formats, the ranking by the regions of a layout, the footer for records of a catalog that
// is not registered, the snippets of the deck's keys and the YAML contexts over several lines. Real core, real schemas, the default catalog.
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { gallery } from '@openpresentation/gallery';
import { validate } from '@openpresentation/opf';
import { schemas } from '@openpresentation/opf/schemas';
import { parse as parseYaml } from 'yaml';
import { getNodeValue, parseTree } from 'jsonc-parser';
import { completionResult, unloadedFooter } from '../dist/source-completions.js';
import { REFERENCE_RULES, beatsOf, columnSourceFor, factsOf, flatRegions, jsonDeckParts, layoutKeys, referenceSiteAt, regionNames, valueAt, yamlDeckParts } from '../dist/source-references.js';
import { KEY_SNIPPETS, SNIPPETS, keySnippetsFor, snippetJson, snippetYaml, snippetsFor } from '../dist/source-snippets.js';
import { openQuote, yamlContextAt } from '../dist/source-yaml.js';

const catalogs = [gallery];
const caret = (doc) => { const at = doc.indexOf('|'); return { text: doc.slice(0, at) + doc.slice(at + 1), at }; };
const labels = (doc, format = 'json', explicit = true) => {
  const { text, at } = caret(doc);
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit, catalogs, format });
  return result ? result.options.map((option) => option.label) : null;
};

// ---- the rule table against the schema -----------------------------------------------------------------------------------------------
const presentation = schemas.presentation;
const defs = presentation.$defs;
const properties = [];
(function collect(node, owner) {
  if (Array.isArray(node)) { for (const item of node) collect(item, owner); return; }
  if (!node || typeof node !== 'object') return;
  for (const [key, child] of Object.entries(node.properties ?? {})) properties.push({ owner, key, node: child });
  for (const [key, child] of Object.entries(node)) collect(child, key === '$defs' ? owner : owner);
}(presentation, ''));
// The owner of a property is the definition it sits in: walk the definitions one by one.
properties.length = 0;
for (const [name, definition] of Object.entries(defs)) {
  (function walk(node) {
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node.properties ?? {})) properties.push({ owner: name, key, node: child });
    for (const child of Object.values(node)) walk(child);
  }(definition));
}
for (const [key, child] of Object.entries(presentation.properties)) properties.push({ owner: '(root)', key, node: child });

const refName = (node) => /#\/\$defs\/([^/]+)$/.exec(node?.$ref ?? '')?.[1];
const describes = (rule, node) => rule.phrases.some((phrase) => (node.description ?? '').includes(phrase));

for (const rule of REFERENCE_RULES) {
  for (const definition of rule.definitions) assert.ok(defs[definition], `rule ${rule.kind}: $defs.${definition} exists`);
  for (const key of rule.keys) {
    const hits = properties.filter((entry) => entry.key === key && describes(rule, entry.node));
    assert.ok(hits.length > 0, `rule ${rule.kind}: some property named ${key} carries one of ${JSON.stringify(rule.phrases)} in its description`);
  }
}

// Drift guard: every property of the schema that speaks of an `asset:<id>`, a `var:<id>` or a dataset id is a site of a rule (by definition when it is a
// reference to one, by name when it is written inline), unless it is the registry itself.
const REGISTRIES = new Set(['Assets', 'Variables', 'Datasets']);
const speaks = [['asset', /asset:<id>|or Asset/], ['color', /var:<id>/]];
for (const { owner, key, node } of properties) {
  for (const [kind, pattern] of speaks) {
    if (!pattern.test(node.description ?? '')) continue;
    const target = refName(node) ?? refName(node.items) ?? refName(node.additionalProperties);
    if (target && REGISTRIES.has(target)) continue;
    const rule = REFERENCE_RULES.find((entry) => entry.kind === kind);
    const covered = target ? REFERENCE_RULES.some((entry) => entry.definitions.includes(target)) : rule.keys.includes(key) && describes(rule, node);
    assert.ok(covered, `${owner}.${key} speaks of a ${kind} reference but no rule covers it (${target ?? 'inline'}): add it to REFERENCE_RULES`);
  }
}
// Every property that holds a dataset id, a citation, a beat or a region is covered, and nothing else is named like one.
for (const { owner, key, node } of properties) {
  if (refName(node) === 'DatasetId') assert.ok(REFERENCE_RULES.find((rule) => rule.kind === 'dataset').definitions.includes('DatasetId'), `${owner}.${key}`);
  for (const [kind, name] of [['cite', 'cite'], ['beat', 'beat'], ['region', 'region']]) {
    if (key !== name) continue;
    const rule = REFERENCE_RULES.find((entry) => entry.kind === kind);
    assert.ok(describes(rule, node), `${owner}.${key} is named like a ${kind} reference but its description does not say so`);
  }
  if (key === 'dataset' && !refName(node)) assert.fail(`${owner}.dataset is a dataset id written inline: give it the DatasetId definition`);
}

// ---- which fields are references -------------------------------------------------------------------------------------------------------
const SITES = [
  ['asset', ['slides', 0, 'image'], { slides: [{ image: '' }] }],
  ['asset', ['slides', 0, 'image', 'src'], { slides: [{ image: { src: '' } }] }],
  ['asset', ['slides', 0, 'video'], { slides: [{ video: '' }] }],
  ['asset', ['slides', 0, 'quote', 'photo'], { slides: [{ quote: { text: 'a', photo: '' } }] }],
  ['asset', ['design', 'watermark'], { design: { watermark: '' } }],
  ['asset', ['design', 'watermark', 'src'], { design: { watermark: { src: '' } } }],
  ['asset', ['design', 'header', 'left', 'image'], { design: { header: { left: { image: '' } } } }],
  ['asset', ['organization', 'logo'], { organization: { id: 'a', name: 'A', logo: '' } }],
  ['asset', ['assets', 'logo', 'src'], { assets: { logo: { src: '' } } }],
  ['asset', ['speaker', 'photo'], { speaker: { name: 'A', photo: '' } }],
  ['asset', ['slides', 0, 'design', 'background', 'src'], { slides: [{ design: { background: { type: 'image', src: '' } } }] }],
  ['dataset', ['slides', 0, 'chart', 'data', 'dataset'], { slides: [{ chart: { data: { dataset: '' } } }] }],
  ['dataset', ['slides', 0, 'table', 'dataset'], { slides: [{ table: { dataset: '' } }] }],
  ['datasetColumn', ['slides', 0, 'table', 'fields', 0], { slides: [{ table: { dataset: 'a', fields: [''] } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'data', 'fields', 1], { slides: [{ chart: { data: { dataset: 'a', fields: ['x', ''] } } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'mapping', 'category'], { slides: [{ chart: { mapping: { category: '' } } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'mapping', 'x'], { slides: [{ chart: { mapping: { x: '' } } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'line', 0], { slides: [{ chart: { line: [''] } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'secondaryAxis', 0], { slides: [{ chart: { secondaryAxis: [''] } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'highlight', 'series', 0], { slides: [{ chart: { highlight: { series: [''] } } }] }],
  ['datasetColumn', ['slides', 0, 'chart', 'mapping', 'series', 0], { slides: [{ chart: { mapping: { series: [''] } } }] }],
  ['cite', ['slides', 0, 'title', 0, 'cite'], { slides: [{ title: [{ text: 'x', cite: '' }] }] }],
  ['cite', ['slides', 0, 'title', 0, 'cite', 0], { slides: [{ title: [{ text: 'x', cite: [''] }] }] }],
  ['beat', ['slides', 0, 'beat'], { slides: [{ beat: '' }] }],
  ['beat', ['slides', 0, 'beat', 1], { slides: [{ beat: ['a', ''] }] }],
  ['region', ['slides', 0, 'blocks', 0, 'region'], { slides: [{ blocks: [{ region: '' }] }] }],
  ['color', ['slides', 0, 'title', 0, 'color'], { slides: [{ title: [{ text: 'x', color: '' }] }] }],
  ['color', ['slides', 0, 'design', 'background', 'color'], { slides: [{ design: { background: { type: 'solid', color: '' } } }] }],
  ['color', ['slides', 0, 'chart', 'colors', 0], { slides: [{ chart: { colors: [''] } }] }],
  ['color', ['slides', 0, 'table', 'rows', 0, 0, 'style', 'fill'], { slides: [{ table: { rows: [[{ text: 'a', style: { fill: '' } }]] } }] }],
  // Not references: free text, other ids, lists as a whole.
  [null, ['slides', 0, 'title'], { slides: [{ title: '' }] }],
  [null, ['slides', 0, 'notes'], { slides: [{ notes: '' }] }],
  [null, ['slides', 0, 'id'], { slides: [{ id: '' }] }],
  [null, ['slides', 0, 'tag'], { slides: [{ tag: '' }] }],
  [null, ['slides', 0, 'chart', 'type'], { slides: [{ chart: { type: '' } }] }],
  [null, ['slides', 0, 'chart', 'data', 'fields'], { slides: [{ chart: { data: { dataset: 'a', fields: [] } } }] }],
  [null, ['slides', 0, 'chart', 'highlight', 'categories', 0], { slides: [{ chart: { highlight: { categories: [''] } } }] }],
  [null, ['slides', 0, 'chart', 'mapping', 'series'], { slides: [{ chart: { mapping: { series: [] } } }] }],
  [null, ['design', 'logo'], { design: { logo: '' } }],
  [null, ['slides', 0, 'layout'], { slides: [{ layout: '' }] }],
  [null, ['slides', 0, 'items', 0], { slides: [{ items: [''] }] }],
  [null, ['name'], { name: '' }],
  [null, [], {}],
];
for (const [kind, path, document] of SITES) {
  const site = referenceSiteAt(path, document);
  if (kind === null) { assert.equal(site, null, `${path.join('.')} is not a reference`); continue; }
  assert.ok(site, `${path.join('.')} is a ${kind} reference`);
  assert.equal(site.kind, kind, `${path.join('.')}: kind`);
}
assert.deepEqual(referenceSiteAt(['slides', 0, 'chart', 'data', 'fields', 1], { slides: [{ chart: { data: { dataset: 'a', fields: ['x', ''] } } }] }).path, ['slides', 0, 'chart', 'data', 'fields'], 'a column entry belongs to the fields list');

// ---- the facts of a draft ----------------------------------------------------------------------------------------------------------------
const DECK = {
  narrative: 'classic-story',
  assets: { logo: 'logo.png', photo: { src: 'p.jpg', title: 'A photo' } },
  datasets: { sales: { title: 'Sales', columns: ['Quarter', { name: 'Revenue', format: '$#,##0' }], rows: [['Q1', 1]] }, empty: { columns: [], rows: [] } },
  variables: { brand: { type: 'text', value: 'Acme' }, tint: '#123456', hero: { type: 'image', value: 'a.png' } },
  references: [{ id: 'smith2020', text: 'Smith, 2020.' }, { id: '' }, 'junk', { text: 'no id' }],
  slides: [{ title: 'a' }],
};
const facts = factsOf(DECK);
assert.deepEqual(facts.assets, [{ id: 'logo', detail: 'logo.png', src: 'logo.png', mediaType: '' }, { id: 'photo', detail: 'p.jpg', src: 'p.jpg', mediaType: '' }]);
assert.deepEqual(facts.datasets, [{ id: 'sales', title: 'Sales', columns: ['Quarter', 'Revenue'] }, { id: 'empty', title: '', columns: [] }]);
assert.deepEqual(facts.variables, [{ id: 'brand', type: 'text' }, { id: 'tint', type: 'color' }, { id: 'hero', type: 'image' }]);
assert.deepEqual(facts.references, [{ id: 'smith2020', text: 'Smith, 2020.' }]);
assert.equal(facts.narrative, 'classic-story');
assert.deepEqual(factsOf(undefined).assets, []);
assert.deepEqual(factsOf({ assets: 3, datasets: [], variables: 'x', references: {} }).datasets, [], 'malformed parts are ignored');
// The same deck as JSON text and as YAML text gives the same facts (the JSON reader skips the rows).
const jsonText = JSON.stringify(DECK);
const fromJson = factsOf(jsonDeckParts(parseTree(jsonText), getNodeValue));
assert.deepEqual(fromJson, facts, 'JSON facts');
const yamlText = 'name: x\nnarrative: classic-story\nassets:\n  logo: logo.png\n  photo:\n    src: p.jpg\n    title: A photo\ndatasets:\n  sales:\n    title: Sales\n    columns:\n      - Quarter\n      - {name: Revenue, format: "$#,##0"}\n    rows:\n      - [Q1, 1]\n  empty:\n    columns: []\n    rows: []\nvariables:\n  brand: {type: text, value: Acme}\n  tint: "#123456"\n  hero: {type: image, value: a.png}\nreferences:\n  - id: smith2020\n    text: Smith, 2020.\nslides:\n  - title: a\n';
assert.deepEqual(factsOf(yamlDeckParts(yamlText)), { ...facts, deck: { name: 'x' } }, 'YAML facts (and the deck name the built-ins read)');
assert.deepEqual(factsOf(yamlDeckParts('assets:\n  logo: [unclosed\nreferences:\n  - id: ok\n    text: fine\n')).references, [{ id: 'ok', text: 'fine' }], 'a block that does not parse does not hide the others');
const readFrom = (document) => (path) => valueAt(document, path);
assert.deepEqual(columnSourceFor({ path: ['slides', 0, 'table', 'fields'] }, readFrom({ slides: [{ table: { dataset: 'sales' } }] })), { dataset: 'sales' });
assert.deepEqual(columnSourceFor({ path: ['slides', 0, 'chart', 'mapping', 'category'] }, readFrom({ slides: [{ chart: { data: { dataset: 'sales' } } }] })), { dataset: 'sales' });
assert.deepEqual(columnSourceFor({ path: ['slides', 0, 'chart', 'highlight', 'series'] }, readFrom({ slides: [{ chart: { data: { columns: ['Q', { name: 'R' }], rows: [] } } }] })), { inline: ['Q', 'R'] }, 'a chart with its own data: its columns');
assert.equal(columnSourceFor({ path: ['slides', 0, 'chart', 'mapping', 'series'] }, () => undefined), null);
assert.equal(valueAt({ a: [{ b: 1 }] }, ['a', 0, 'b']), 1);
assert.equal(valueAt({ a: 1 }, ['a', 'b', 'c']), undefined);

// ---- the lists the references give, in the three formats ------------------------------------------------------------------------------------
const SALES = '"datasets":{"sales":{"columns":["Quarter","Revenue"],"rows":[]},"pipeline":{"columns":["Stage"],"rows":[]}}';
const JSON_LISTS = [
  ['{"assets":{"logo":"a.png"},"slides":[{"image":"|"}]}', ['asset:logo'], []],
  [`{${SALES},"slides":[{"chart":{"data":{"dataset":"|"}}}]}`, ['sales', 'pipeline'], []],
  [`{${SALES},"slides":[{"table":{"dataset":"sales","fields":["|"]}}]}`, ['Quarter', 'Revenue'], ['Stage']],
  [`{${SALES},"slides":[{"chart":{"data":{"dataset":"pipeline"},"mapping":{"series":["|"]}}}]}`, ['Stage'], ['Quarter']],
  ['{"references":[{"id":"r1","text":"R"}],"slides":[{"title":[{"text":"x","cite":"|"}]}]}', ['r1'], []],
  ['{"narrative":"classic-story","slides":[{"beat":"|"}]}', ['opening', 'closing'], []],
  ['{"slides":[{"layout":"two-column","blocks":[{"region":"|"}]}]}', ['first', 'second', 'left'], ['title']],
  ['{"variables":{"brand":{"type":"color","value":"#123456"},"hero":{"type":"image","value":"a.png"}},"slides":[{"title":[{"text":"x","color":"|"}]}]}', ['var:brand'], ['var:hero']],
  ['{"variables":{"brand":{"type":"color","value":"#123456"},"hero":{"type":"image","value":"a.png"}},"slides":[{"image":"|"}]}', ['var:hero'], ['var:brand']],
];
for (const [doc, has, not] of JSON_LISTS) {
  const got = labels(doc);
  assert.ok(got, doc);
  for (const label of has) assert.ok(got.includes(label), `${doc}: ${label} in ${got.slice(0, 12)}`);
  for (const label of not) assert.ok(!got.includes(label), `${doc}: no ${label}`);
}
assert.equal(labels('{"slides":[{"image":"|"}]}'), null, 'no assets, no list');
assert.equal(labels('{"narrative":"nope","slides":[{"beat":"|"}]}'), null, 'a narrative that is not there has no beats');
assert.equal(labels('{"variables":{"a":{"type":"text","value":"x"}},"slides":[{"notes":"|"}]}'), null, 'free text offers nothing');
const YAML_LISTS = [
  ['assets:\n  logo: a.png\nslides:\n  - image: |', ['asset:logo']],
  ['datasets:\n  sales:\n    columns: [Quarter, Revenue]\n    rows: []\nslides:\n  - table:\n      dataset: sales\n      fields: [|]', ['Quarter', 'Revenue']],
  ['datasets:\n  sales:\n    columns: [Quarter, Revenue]\n    rows: []\nslides:\n  - chart:\n      data:\n        dataset: sales\n      mapping:\n        category: |', ['Quarter', 'Revenue']],
  ['references:\n  - id: r1\n    text: R\nslides:\n  - title:\n      - text: x\n        cite: |', ['r1']],
  ['narrative: classic-story\nslides:\n  - beat: |', ['opening']],
];
for (const [doc, has] of YAML_LISTS) {
  const got = labels(doc, 'yaml');
  assert.ok(got, doc);
  for (const label of has) assert.ok(got.includes(label), `${doc}: ${label}`);
}
const MD_LISTS = [
  ['---\nnarrative: classic-story\n---\n\n# A\n<!-- slide: beat=| -->\n', ['opening', 'closing']],
  ['---\nassets:\n  logo: a.png\n---\n\n# A\n\n```opf-slide\nimage: |\n```\n', ['asset:logo']],
  ['---\ndatasets:\n  sales:\n    columns: [Quarter, Revenue]\n    rows: []\n---\n\n# A\n\n```opf-block\ntable:\n  dataset: sales\n  fields: [|]\n```\n', ['Quarter', 'Revenue']],
  ['---\nvariables:\n  brand:\n    type: text\n    value: Acme\n---\n\n# Hello {{|', ['brand']],
];
for (const [doc, has] of MD_LISTS) {
  const got = labels(doc, 'md');
  assert.ok(got, doc);
  for (const label of has) assert.ok(got.includes(label), `${doc}: ${label} in ${got.slice(0, 10)}`);
}
// {{ completes the name of a variable and replaces only what was typed after the braces.
{
  const { text, at } = caret('{"variables":{"brand":{"type":"text","value":"A"},"year":{"type":"number","value":1}},"slides":[{"title":"Hi {{br|"}]}');
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit: false, catalogs, format: 'json' });
  assert.ok(result, '{{ opens the variables');
  assert.deepEqual(result.options.map((option) => option.label).filter((label) => !label.includes('.') && label !== 'speakers'), ['brand', 'year'], 'the declared variables come first, then the built-in ones');
  assert.deepEqual(result.options.slice(0, 2).map((option) => option.label), ['brand', 'year']);
  assert.equal(text.slice(result.from, result.to), 'br');
  assert.ok(result.validFor('bra') && !result.validFor('br a'));
  assert.deepEqual(result.options[0].opf, { kind: 'variable', name: 'brand' });
  assert.equal(labels('{"variables":{"a":{"type":"text","value":"x"}},"slides":[{"title":"Hi {br|"}]}'), null, 'a single { is text');
}

// ---- the order of the keys by the layout's regions ------------------------------------------------------------------------------------------
const order = (doc, format = 'json') => labels(doc, format);
const agenda = order('{"slides":[{"layout":"agenda",\n|}]}');
assert.deepEqual(agenda.slice(0, 2), ['title', 'items'], 'agenda: its regions first');
assert.ok(agenda.indexOf('items') < agenda.indexOf('subtitle'));
assert.deepEqual(order('{"slides":[{"layout":"cover",\n|}]}').slice(0, 3), ['title', 'image', 'video'], 'cover: the media region calls for image and video');
const plain = order('{"slides":[{\n|}]}');
assert.deepEqual(plain.slice(0, 4), ['title', 'subtitle', 'layout', 'items'], 'no layout: the common order');
assert.deepEqual(order('{"slides":[{"layout":"nope",\n|}]}').slice(0, 3), ['title', 'subtitle', 'items'], 'an unknown layout: the common order');
assert.deepEqual(order('{"slides":[{"layout":"agenda","title":"a",\n|}]}').slice(0, 2), ['items', 'subtitle'], 'set keys are not offered again');
assert.deepEqual(order('{"slides":[{"layout":"agenda",\n|}]}'), order('{"slides":[{"layout":"agenda",\n|}]}'), 'same input, same order');
assert.deepEqual(order('slides:\n  - layout: agenda\n    |', 'yaml').slice(0, 2), ['title', 'items']);
assert.deepEqual(order('{"organization":{\n|}}').slice(0, 2), ['id', 'name'], 'required members stay first');
const mine = { name: 'Mine', regions: [{ name: 'title' }, { name: 'quote', accepts: ['quote'] }, { name: 'side', accepts: ['image', 'video'] }, { name: 'wide', accepts: ['text', 'list', 'image'] }] };
assert.deepEqual(flatRegions(mine).map((region) => region.name), ['title', 'quote', 'side', 'wide']);
assert.deepEqual(layoutKeys(mine, ['title', 'subtitle', 'quote', 'image', 'video', 'text', 'items']), ['title', 'quote', 'image', 'video'], 'one or two kinds call for their keys; a region of many does not');
assert.deepEqual(layoutKeys(undefined, ['title']), []);
assert.deepEqual(regionNames({ regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'first' }, { name: 'second' }] }] }), ['first', 'second']);
assert.deepEqual(beatsOf({ beats: [{ id: 'a', name: 'A' }, { id: 3 }, 'x'] }), [{ id: 'a', name: 'A', description: '' }]);

// ---- the footer of a list of records of a catalog that is not registered ------------------------------------------------------------------------
const group = (source) => ({ catalogs: { acme: { source, layouts: {} }, custom: { layouts: {} } } });
assert.equal(unloadedFooter(group('https://acme.test'), catalogs), 'Records from catalog acme are not loaded');
assert.equal(unloadedFooter(group('https://www.pptx.gallery'), catalogs), '');
assert.equal(unloadedFooter({ catalogs: { custom: { layouts: {} } } }, catalogs), '');
assert.equal(unloadedFooter({}, catalogs), '');
assert.equal(unloadedFooter(undefined, catalogs), '');
assert.equal(unloadedFooter({ catalogs: { b: { source: 'x' }, a: { source: 'y' } } }, []), 'Records from catalog b, a are not loaded');
{
  const { text, at } = caret('{"catalogs":{"acme":{"source":"https://acme.test","layouts":{"bespoke":{"name":"B","regions":[{"name":"title"}]}}}},"slides":[{"layout":"|"}]}');
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit: true, catalogs, format: 'json' });
  assert.ok(result.options.some((option) => option.label === 'acme:bespoke'), 'the embedded record is still offered');
  assert.ok(result.options.every((option) => option.opfFooter === 'Records from catalog acme are not loaded'), 'every option carries the line');
  const other = completionResult(EditorState.create({ doc: '{"slides":[{"layout":"x"}],"design":{"titleAlignment":"left"}}' }), 58, { explicit: true, catalogs, format: 'json' });
  assert.ok(!other || other.options.every((option) => !option.opfFooter), 'no line for a field that is not a catalog reference');
}

// ---- the snippets of the deck's keys ----------------------------------------------------------------------------------------------------------
assert.deepEqual(keySnippetsFor([]).map((snippet) => snippet.prefix), ['design', 'organization', 'speaker']);
assert.deepEqual(keySnippetsFor(['slides', 0]), []);
assert.deepEqual(snippetsFor('key', []), [], 'the deck keys are not items of their own');
const plainText = (template) => template.replace(/\$\{(\d+)(?::((?:\\.|[^}\\])*))?\}/g, (_all, _index, text = '') => text.replace(/\\(.)/g, '$1')).replaceAll('\t', '  ');
for (const snippet of keySnippetsFor([])) {
  const json = snippetJson(snippet);
  const value = JSON.parse(`{${plainText(json.text)}}`);
  assert.ok(snippet.key in value, `${snippet.prefix}: JSON has the key`);
  const yaml = snippetYaml(snippet);
  // An empty stop is an empty string in JSON and a null in YAML until it is typed over.
  assert.deepEqual(parseYaml(plainText(yaml.text)), JSON.parse(JSON.stringify(value, (_key, item) => (item === '' ? null : item))), `${snippet.prefix}: YAML reads back as the same value`);
  assert.equal(json.fields.length, yaml.fields.length, `${snippet.prefix}: same tab stops`);
  const comma = snippetJson(snippet, { comma: true });
  assert.ok(comma.text.endsWith('},${0}'), `${snippet.prefix}: a comma when a property follows`);
}
assert.deepEqual(snippetJson(keySnippetsFor([])[0]).fields, [{ index: 1, text: '', choice: true }, { index: 2, text: '', choice: true }, { index: 3, text: '', choice: true }], 'design: each stop is a choice of a catalog');
{
  const deck = { slides: [{ title: 'a' }], organization: { id: 'acme', name: 'Acme Inc.' }, speaker: { id: 'alice', name: 'Name' }, design: { theme: 'minimal', colorScheme: 'boost', fontScheme: 'aptos' } };
  assert.deepEqual(validate(deck, { catalogs }).findings.filter((finding) => finding.severity === 'error'), [], 'the values of the snippets make a valid deck');
}
for (const snippet of KEY_SNIPPETS) assert.ok(snippet.key && snippet.where === 'deck-key' && !SNIPPETS.includes(snippet), `${snippet.prefix}: a key snippet, not an item of the list`);
// A property accepted with a snippet writes the snippet (JSON, YAML); a key that already has its colon, or sits in a flow mapping, stays plain.
{
  const { text, at } = caret('{\n  "slides": [],\n  "des|"\n}');
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit: true, catalogs, format: 'json' });
  const design = result.options.find((option) => option.label === 'design');
  assert.equal(design.opf.snippet, 'design');
  assert.equal(result.options.filter((option) => option.label === 'design').length, 1, 'listed once');
  const slideKeys = completionResult(EditorState.create({ doc: '{"slides":[{\n\n}]}' }), 14, { explicit: true, catalogs, format: 'json' });
  assert.ok(slideKeys.options.find((option) => option.label === 'design') && !slideKeys.options.find((option) => option.label === 'design').opf.snippet, 'design in a slide is the plain key');
}

// ---- YAML over several lines ----------------------------------------------------------------------------------------------------------------------
const at = (doc, options) => { const { text, at: position } = caret(doc); return yamlContextAt(text, position, { explicit: true, ...options }); };
{
  const list = at('audience: [board,\n  |]');
  assert.deepEqual([list.mode, list.path], ['item', ['audience', 1]], 'a continued flow list: the second entry');
  const map = at('design: {theme: minimal,\n  |}');
  assert.deepEqual([map.mode, map.path, [...map.existing]], ['key', ['design'], ['theme']]);
  const value = at('design: {theme: minimal,\n  titleAlignment: |}');
  assert.deepEqual([value.mode, value.path, value.key], ['value', ['design', 'titleAlignment'], 'titleAlignment']);
  const three = at('audience: [board,\n  customer,\n  |]');
  assert.deepEqual(three.path, ['audience', 2]);
  const commented = at('audience: [board, # first\n  |]');
  assert.deepEqual(commented.path, ['audience', 1], 'a comment above does not count');
  const dash = at('slides:\n  - {title: a,\n    |}');
  assert.deepEqual([dash.mode, dash.path, [...dash.existing]], ['key', ['slides', 0], ['title']]);
  const nested = at('design: {a: [1,\n  2,\n  |]}');
  assert.equal(nested.mode, 'item');
  assert.equal(at('audience: [board,\n  customer]\n|', {}).mode, 'key', 'after the collection closed: a key again');
}
assert.equal(openQuote('"abc'), '"');
assert.equal(openQuote('"abc"'), null);
assert.equal(openQuote('"a\\"b'), '"', 'an escaped quote does not close');
assert.equal(openQuote("'it''s"), "'", 'a doubled quote does not close');
assert.equal(openQuote("'it''s'"), null);
assert.equal(openQuote('plain "text'), null, 'a quote inside plain text does not open a scalar');
{
  const inside = at('slides:\n  - title: "first\n      second {{|"');
  assert.ok(inside?.multiline, 'a line of a quoted scalar: text');
  assert.equal(inside.token.quoted, true);
  assert.equal(at('slides:\n  - title: "first\n      second|"'), null, 'text with no braces: nothing to complete');
  const after = at('slides:\n  - title: "first\n      second"\n    |');
  assert.deepEqual([after.mode, after.path, [...after.existing]], ['key', ['slides', 0], ['title']], 'the keys after the scalar are found');
  const fake = at('slides:\n  - title: "a\n      layout: b"\n    |');
  assert.deepEqual([...fake.existing], ['title'], 'text in a continuation that looks like a key is not one');
  const prose = at('slides:\n  - title: Hello\n      there {{|');
  assert.ok(prose?.multiline, 'a sentence that runs on');
}
console.log('Source completions: references, ranking, footer, snippets and multi-line YAML pass.');
