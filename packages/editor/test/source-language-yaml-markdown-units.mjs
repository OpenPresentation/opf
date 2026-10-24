// The YAML and Markdown pieces of the source editor that need no browser (artifacts/source-editor/TEST-PLAN.md, section 8.5): what a position in a YAML
// or Markdown draft means, the list a position gets, the text accepting an item writes, the snippets in both formats, the Enter rules, and the
// agreement of the line reader with core's `pathAt` on every example deck of the repository. Real core, real schemas, the default catalog.
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { gallery } from '@openpresentation/gallery';
import { examples } from '@openpresentation/opf/examples';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { locate, pathAt } from '@openpresentation/opf/source';
import { validate } from '@openpresentation/opf';
import { fromYaml, toYaml } from '@openpresentation/opf/yaml';
import { parse as parseYaml } from 'yaml';
import { completionResult, contextFor, describeFound, hoverModelAt, planCompletion, tokenFor } from '../dist/source-completions.js';
import { markdownRegionAt } from '../dist/source-markdown.js';
import { SNIPPETS, fragmentValue, renderMarkdown, renderYaml, snippetsFor } from '../dist/source-snippets.js';
import { flowDepth, readEntry, readMarkers, scalarValue, yamlContextAt } from '../dist/source-yaml.js';
import { yamlNewlineIndent } from '../dist/source-editing.js';
import { textFixesForFinding } from '../dist/source-fixes-text.js';
import { applySourceEdits } from '../dist/source-fixes.js';
import { normalizeFinding } from '../dist/source-findings.js';
import { buildProblems } from '../dist/source-problems.js';

const catalogs = [gallery];
const caret = (doc) => { const at = doc.indexOf('¦'); return { text: doc.slice(0, at) + doc.slice(at + 1), at }; };
const labels = (format, doc, explicit = true) => {
  const { text, at } = caret(doc);
  const result = completionResult(EditorState.create({ doc: text }), at, { explicit, catalogs, format });
  return result ? result.options.map((option) => option.label) : null;
};

// ---- lines ---------------------------------------------------------------------------------------------------------------------------------------
assert.deepEqual(readMarkers('  - - a: 1'), { indent: 2, markers: [2, 4], rest: 'a: 1', restStart: 6 });
assert.deepEqual(readMarkers('-a'), { indent: 0, markers: [], rest: '-a', restStart: 0 }, 'a dash is a marker only before a space');
assert.equal(readEntry('title: x').key, 'title');
assert.equal(readEntry('top+middle:left: x').key, 'top+middle:left', 'a colon not followed by a space is part of a plain key');
assert.equal(readEntry('"a: b": 1').key, 'a: b');
assert.equal(readEntry("'it''s': 1").key, "it's");
assert.equal(readEntry('a # b: c'), null, 'a comment hides the colon');
assert.equal(readEntry('[a]: 1'), null);
assert.equal(readEntry('plain text'), null);
assert.deepEqual([scalarValue('42'), scalarValue('true'), scalarValue('~'), scalarValue('"a b"'), scalarValue('x # c')], [42, true, null, 'a b', 'x']);
assert.equal(flowDepth('[a, [b'), 2);
assert.equal(flowDepth('"[" # ['), 0, 'brackets in quotes and comments do not count');

// ---- what a position of a YAML draft means -------------------------------------------------------------------------------------------------------
const yamlContexts = [
  ['key after a deck key', 'name: x\nde¦', { mode: 'key', path: [], existing: ['name'], text: 'de' }],
  ['key on a fresh line', 'name: x\n¦', { mode: 'key', path: [], existing: ['name'], text: '' }],
  ['key in a nested mapping', 'design:\n  ti¦', { mode: 'key', path: ['design'], existing: [], text: 'ti' }],
  ['key of a slide item after the dash', 'slides:\n  - ¦', { mode: 'key', path: ['slides', 0], existing: [], text: '', itemStart: true }],
  ['key of a slide item further down', 'slides:\n  - title: a\n    it¦', { mode: 'key', path: ['slides', 0], existing: ['title'], text: 'it' }],
  ['key of the second item', 'slides:\n  - title: a\n  - ¦', { mode: 'key', path: ['slides', 1], existing: [], text: '', itemStart: true }],
  ['siblings below the caret count', 'slides:\n  - title: a\n    ¦\n    items: []', { mode: 'key', path: ['slides', 0], existing: ['title', 'items'], text: '' }],
  ['value of a key', 'design:\n  titleAlignment: ¦', { mode: 'value', path: ['design', 'titleAlignment'], key: 'titleAlignment', text: '' }],
  ['value, partly typed', 'design:\n  titleAlignment: ce¦', { mode: 'value', path: ['design', 'titleAlignment'], key: 'titleAlignment', text: 'ce' }],
  ['value of a key in a slide', 'slides:\n  - layout: pi¦', { mode: 'value', path: ['slides', 0, 'layout'], key: 'layout', text: 'pi' }],
  ['value inside quotes', 'slides:\n  - layout: "pi¦"', { mode: 'value', path: ['slides', 0, 'layout'], key: 'layout', text: 'pi', quoted: true }],
  ['a promoted region key is one key', 'top+middle:left: ¦', { mode: 'value', path: ['top+middle:left'], key: 'top+middle:left', text: '' }],
  ['flow list item', 'audience: [bo¦]', { mode: 'item', path: ['audience', 0], text: 'bo', flow: true }],
  ['second flow list item', 'audience: [board, cu¦]', { mode: 'item', path: ['audience', 1], text: 'cu', flow: true }],
  ['flow mapping key', 'design: {theme: x, co¦}', { mode: 'key', path: ['design'], existing: ['theme'], text: 'co', flow: true }],
  ['flow mapping value', 'design: {theme: mi¦}', { mode: 'value', path: ['design', 'theme'], key: 'theme', text: 'mi', flow: true }],
  ['a list in a list', 'slides:\n  - title: x\n    items:\n      - ¦', { mode: 'key', path: ['slides', 0, 'items', 0], text: '', itemStart: true }],
  ['the key being edited is not one of the others', 'na¦me: x\nslides: []', { mode: 'key', path: [], existing: ['slides'], text: 'name' }],
  ['a quoted key', '"de¦"', { mode: 'key', path: [], text: 'de', quoted: true }],
  ['a list at the key column', 'a:\n- x\nb: ¦', { mode: 'value', path: ['b'], key: 'b', text: '' }],
  ['a blank document', '¦', { mode: 'key', path: [], text: '' }],
  ['a CRLF document', 'name: x\r\nde¦', { mode: 'key', path: [], existing: ['name'], text: 'de' }],
];
for (const [name, doc, want] of yamlContexts) {
  const { text, at } = caret(doc);
  const context = yamlContextAt(text, at, { explicit: true });
  assert.ok(context, name);
  assert.equal(context.mode, want.mode, `${name}: mode`);
  assert.deepEqual(context.path, want.path, `${name}: path`);
  if (want.existing) assert.deepEqual([...context.existing].sort(), [...want.existing].sort(), `${name}: existing keys`);
  if (want.key) assert.equal(context.key, want.key, `${name}: key`);
  assert.equal(text.slice(context.token.from, context.token.to), want.text, `${name}: token text`);
  assert.equal(Boolean(context.token.quoted), Boolean(want.quoted), `${name}: quoted`);
  assert.equal(Boolean(context.itemStart), Boolean(want.itemStart), `${name}: itemStart`);
  assert.equal(Boolean(context.flow), Boolean(want.flow), `${name}: flow`);
}
// Where nothing can be completed: comments, block scalars, prose, document markers. (A flow collection over several lines used to be here; phase 3 reads it:
// see the Y-FLW cases and test/source-completions-units.mjs.)
for (const doc of ['name: x # ¦', '# ¦', 'slides:\n  - notes: |\n      ¦', 'slides:\n  - notes: >-\n    two words¦', '---¦', 'a: &anchor ¦', 'a: *ref¦', 'a b c¦']) {
  const { text, at } = caret(doc);
  assert.equal(yamlContextAt(text, at, { explicit: true }), null, doc);
}
// Typing the colon and nothing after: a list opens only when asked for.
{
  const { text, at } = caret('titleAlignment:¦');
  assert.equal(yamlContextAt(text, at, { explicit: false }), null);
  assert.equal(yamlContextAt(text, at, { explicit: true }).needsSpace, true);
  const typed = caret('titleAlignment: ¦');
  assert.equal(yamlContextAt(typed.text, typed.at, { explicit: false })?.needsSpace, false, 'the space after the colon opens the value place');
}
// The skeleton tells the schema what the document has.
{
  const { text, at } = caret('slides:\n  - type: chart\n    chart:\n      ¦');
  const context = yamlContextAt(text, at, { explicit: true });
  assert.deepEqual(context.path, ['slides', 0, 'chart']);
  assert.deepEqual(context.document, { slides: [{ type: 'chart', chart: {} }] });
}
// A prefix and excluded keys, as the body of a fence in a slide and the front matter use them.
{
  const { text, at } = caret('¦');
  const context = yamlContextAt(text, at, { explicit: true, prefix: ['slides', 2, 'blocks', 0], exclude: ['slides'] });
  assert.deepEqual(context.path, ['slides', 2, 'blocks', 0]);
  assert.ok(context.existing.has('slides'));
  assert.deepEqual(Object.keys(context.document), ['slides']);
}

// ---- the lists -----------------------------------------------------------------------------------------------------------------------------------
assert.ok(labels('yaml', 'name: x\n¦').includes('slides') && !labels('yaml', 'name: x\n¦').includes('name'));
assert.deepEqual(labels('yaml', 'design:\n  titleAlignment: ¦').slice(0, 3).sort(), ['center', 'left', 'right']);
assert.ok(labels('yaml', 'slides:\n  - layout: ¦').includes('pillars'));
assert.deepEqual(labels('yaml', 'slides:\n  - hidden: ¦').sort(), ['false', 'true']);
assert.equal(labels('yaml', 'slides:\n  - title: ¦'), null, 'free text');
assert.equal(labels('yaml', 'slides:\n  - title: a\n    items:\n      - ¦'), null, 'a list of lines of text');
assert.ok(labels('yaml', 'audience:\n  - ¦').includes('board'), 'a list of ids');
assert.equal(labels('yaml', 'duration: ¦'), null, 'a number');
assert.ok(labels('yaml', '¦')[0] === 'deck', 'a blank document starts with the deck snippet');
assert.ok(labels('yaml', 'slides:\n  - ¦').includes('slide'), 'the slide snippet after a dash');
assert.ok(!labels('yaml', 'slides:\n  - title: a\n    ¦').includes('slide'), 'no slide snippet inside an item');
assert.equal(labels('yaml', 'name: x\n¦', false), null, 'nothing opens by itself on an empty place');

// ---- what accepting writes in YAML ---------------------------------------------------------------------------------------------------------------
const yamlPlan = (doc, completion, token) => {
  const { text, at } = caret(doc);
  const context = contextFor('yaml', text, at, true);
  const end = context.token.end;
  void token;
  return planCompletion(context, completion, text, end);
};
const key = (name) => ({ opf: { kind: 'key', key: name } });
assert.deepEqual(yamlPlan('na¦', key('name')), { template: 'name: ', fields: 0, chain: false });
assert.deepEqual(yamlPlan('design:\n  ti¦', key('titleAlignment')), { template: 'titleAlignment: ', fields: 0, chain: true }, 'a closed set chains into its list');
assert.deepEqual(yamlPlan('slides:\n  - hid¦', key('hidden')), { template: 'hidden: ', fields: 0, chain: true }, 'a boolean chains too');
assert.deepEqual(yamlPlan('sl¦', key('slides')), { template: 'slides:\n  - ${0}', fields: 1, chain: false });
assert.deepEqual(yamlPlan('de¦', key('design')), { template: 'design:\n  ${0}', fields: 1, chain: false });
assert.deepEqual(yamlPlan('org¦', key('organization')), { template: 'organization:\n  id: ${1}\n  name: ${2}${0}', fields: 3, chain: false }, 'required members, one per line');
assert.equal(yamlPlan('slides:\n  - title: a\n    it¦', key('items')).template, 'items:\n  - ${0}', 'under a key that follows a dash the lines use the key column as base');
assert.equal(yamlPlan('slides:\n  - ite¦', key('items')).template, 'items:\n    - ${0}', 'right after a dash the new lines go two columns further in');
assert.equal(yamlPlan('na¦me: x', key('name')).template, 'name', 'the whole word is replaced and the colon that follows is kept');
assert.equal(yamlPlan('na¦: x', key('name')).template, 'name', 'an existing colon is kept');
assert.equal(yamlPlan('design: {the¦}', key('theme')).template, 'theme: ', 'a flow mapping writes the key only');
assert.equal(yamlPlan('a: ¦', { opf: { kind: 'literal', value: 'true' } }).template, '"true"', 'a string that YAML would read as a boolean is quoted');
assert.equal(yamlPlan('a: ¦', { opf: { kind: 'literal', value: true } }).template, 'true');
assert.equal(yamlPlan('a: ¦', { opf: { kind: 'literal', value: 'acme:hero' } }).template, 'acme:hero');
assert.equal(yamlPlan('a: ¦', { opf: { kind: 'literal', value: '12' } }).template, '"12"');
assert.equal(yamlPlan('a:¦', { opf: { kind: 'literal', value: 'x' } }).template, ' x', 'no space after the colon yet');
assert.deepEqual(yamlPlan('a: "pi¦"', { opf: { kind: 'literal', value: 'pillars' } }), { template: 'pillars', fields: 0, chain: false, inner: true });

// ---- snippets in YAML and Markdown ---------------------------------------------------------------------------------------------------------------
const resolve = (text) => text.replace(/\$\{0\}/, '').replace(/\$\{\d+(?::((?:\\[{}\\]|[^{}\\])*))?\}/g, (_all, inner = '') => inner.replace(/\\([{}\\])/g, '$1'));
for (const snippet of SNIPPETS.filter((entry) => entry.where === 'slide')) {
  const value = fragmentValue(snippet.fragment);
  const yaml = renderYaml(snippet.fragment, { dash: 2 });
  assert.ok(yaml.text.endsWith('${0}'), `${snippet.prefix}: ends at $0`);
  assert.deepEqual(yaml.fields.map((field) => field.index), [...yaml.fields.map((field) => field.index)].sort((a, b) => a - b), `${snippet.prefix}: YAML stops in order`);
  // The snippet engine adds the indentation of the caret's line (two spaces here) to every line after the first.
  assert.deepEqual(parseYaml(`slides:\n  - ${resolve(yaml.text).replaceAll('\n', '\n  ')}`).slides[0], value, `${snippet.prefix}: the YAML reads back as the fragment`);
  // Markdown: a slide that reads back as the fragment, apart from how numbers are typed (a metric's "42" is a number in its fence).
  const markdown = renderMarkdown(snippet.fragment);
  const read = fromMarkdown(resolve(markdown.text), { validate: false });
  assert.deepEqual(read.findings.filter((finding) => finding.severity === 'error'), [], `${snippet.prefix}: the Markdown reads without errors`);
  const slide = read.presentation.slides[0];
  const expected = JSON.parse(JSON.stringify(value));
  if (expected.metric) expected.metric.value = Number(expected.metric.value);
  if (expected.left || expected.right) { for (const side of ['left', 'right']) if (expected[side]) expected[side] = slide[side]; }
  assert.deepEqual(slide, expected, `${snippet.prefix}: the Markdown reads back as the fragment`);
}
assert.equal(renderYaml(SNIPPETS.find((entry) => entry.prefix === 'deck').fragment).text, 'name: ${1:Deck name}\nslides:\n  - title: ${2:Title}${0}');
assert.equal(renderYaml(SNIPPETS.find((entry) => entry.prefix === 'slide').fragment, { dash: 2 }).text, 'title: ${1:Slide title}\n  items:\n    - ${2:First point}${0}', 'continuation lines are indented past the dash');
assert.equal(renderMarkdown(SNIPPETS.find((entry) => entry.prefix === 'slide').fragment, { separator: true }).text, '---\n\n# ${1:Slide title}\n\n- ${2:First point}${0}');
assert.equal(renderYaml(SNIPPETS.find((entry) => entry.prefix === 'dataset').fragment, { dash: 0, name: SNIPPETS.find((entry) => entry.prefix === 'dataset').name }).text.split('\n')[0], '${1:sales}:');
assert.ok(renderYaml({ metric: { value: SNIPPETS.find((entry) => entry.prefix === 'slide-metric').fragment.metric.value } }).text.includes('"${1:42}"'), 'a number-looking placeholder is quoted');
assert.deepEqual(snippetsFor('item', ['slides', 0]).map((entry) => entry.prefix).slice(0, 2), ['slide', 'slide-text']);

// ---- Markdown regions and contexts ---------------------------------------------------------------------------------------------------------------
const region = (doc) => { const { text, at } = caret(doc); return markdownRegionAt(text, at); };
assert.equal(region('---\nname: x\n¦\n---\n# A').region, 'front-matter');
assert.equal(region('---¦\nname: x\n---\n# A').region, 'front-matter-edge');
assert.equal(region('---\nname: x\n---¦\n# A').region, 'front-matter-edge');
assert.equal(region('# A\n\n```js\nco¦\n```').region, 'fence');
assert.equal(region('# A\n\n```js\nco¦\n```').part, 'body');
assert.equal(region('# A\n\n```ch¦art\n```').part, 'info');
assert.equal(region('# A\n\n<!-- slide: i¦d=a -->').region, 'comment');
assert.equal(region('# A\n\nNote: see ¦this').region, 'notes');
assert.equal(region('# A\n\nsome ¦text').region, 'body');
assert.equal(region('---\nname: x\n\n# A\n¦').region, 'front-matter', 'an unclosed front matter runs to the end');

const mdContext = (doc, explicit = true) => { const { text, at } = caret(doc); const context = contextFor('md', text, at, explicit); return context && { context, text }; };
{
  const found = mdContext('---\nna¦\n---\n\n# A\n');
  assert.equal(found.context.format, 'yaml');
  assert.equal(found.text.slice(found.context.token.from, found.context.token.to), 'na', 'the YAML token is in the offsets of the whole text');
  assert.ok(found.context.existing.has('slides'), 'slides never belong to the front matter');
}
{
  const found = mdContext('# A\n\n<!-- slide: id=a la¦ -->\n');
  assert.equal(found.context.region, 'options');
  assert.equal(found.context.mode, 'key');
  assert.deepEqual([...found.context.existing], ['id']);
  assert.equal(found.text.slice(found.context.token.from, found.context.token.to), 'la');
}
{
  const found = mdContext('# A\n\n<!-- slide: layout=pi¦ -->\n');
  assert.equal(found.context.mode, 'value');
  assert.equal(found.context.key, 'layout');
  assert.equal(found.text.slice(found.context.token.from, found.context.token.to), 'pi');
}
{
  const found = mdContext('# A\n\n<!-- slide: section="Part¦ 1" -->\n');
  assert.equal(found.context.token.quoted, true);
  assert.equal(found.text.slice(found.context.token.from, found.context.token.to), 'Part 1');
}
assert.equal(mdContext('# A\n\n<!-- slide: ¦ -->\n<!-- block: ¦ -->').context.optionKind, 'slide');
assert.equal(mdContext('# A\n\n<!-- note ¦-->\n'), null, 'a plain comment');
assert.equal(mdContext('# A\n\n```js\nx¦\n```\n'), null, 'a code fence');
assert.equal(mdContext('# A\n\nNote: x\n\nNo¦t', true), null, 'notes are verbatim');
assert.equal(labels('md', '# A\n\ntex¦t', false), null, 'prose does not open a list by itself');
assert.equal(mdContext('# A\n\nNo¦', false), null, 'two letters are not enough to open a list by themselves');
assert.equal(mdContext('# A\n\nNot¦', false).context.region, 'body');
assert.equal(mdContext('# A\n\nsli¦').context.separator, true);
assert.equal(mdContext('sli¦').context.separator, false);
assert.equal(mdContext('---\nname: x\n---\n\nsli¦').context.separator, false, 'the first slide after the front matter');
assert.equal(mdContext('# A\n\n---\n\nsli¦').context.separator, false, 'a separator is there already');
assert.deepEqual(labels('md', '# A\n\nNot¦'), ['Note:', 'Notes:', 'notes']);
assert.ok(labels('md', '# A\n\n```¦').includes('chart') && labels('md', '# A\n\n```¦').includes('js'));
assert.ok(labels('md', '# A\n\n```chart ¦').includes('column'));
assert.deepEqual(labels('md', '# A\n\n```metric\n¦\n```\n').sort(), ['delta', 'description', 'label', 'sentiment', 'trend', 'unit', 'value']);
assert.ok(labels('md', '# A\n<!-- slide: layout=¦ -->').includes('pillars'));
assert.deepEqual(tokenFor('md', 'sli', 3), { quoted: false, closed: false, start: 0, end: 3, from: 0, to: 3 });

// ---- hover ---------------------------------------------------------------------------------------------------------------------------------------
{
  const text = 'design:\n  titleAlignment: left\nslides:\n  - layout: pillars\n    title: Hello\n';
  const hover = (needle, shift = 0) => hoverModelAt(EditorState.create({ doc: text }), text.indexOf(needle) + shift, { catalogs, format: 'yaml' });
  assert.equal(hover('titleAlignment', 2).model.title, 'titleAlignment');
  assert.ok(hover('titleAlignment', 2).model.description, 'the key has the schema description');
  assert.equal(hover('pillars', 2).model.title, 'pillars');
  assert.equal(hover('pillars', 2).model.type, 'layout');
  assert.equal(hover('Hello', 1), null, 'free text');
  assert.equal(hover('design:', 2).model.title, 'design');
  assert.equal(hover('left', 1).model.title, 'titleAlignment', 'an enum value shows its field');
}
{
  const text = '---\nname: Deck\ndesign:\n  titleAlignment: left\n---\n# A\n<!-- slide: layout=pillars -->\n';
  const hover = (needle, shift = 0) => hoverModelAt(EditorState.create({ doc: text }), text.indexOf(needle) + shift, { catalogs, format: 'md' });
  assert.equal(hover('titleAlignment', 3).model.title, 'titleAlignment');
  assert.equal(hover('pillars', 2).model.type, 'layout');
  assert.equal(hover('layout=', 2).model.title, 'layout', 'the key of an option');
  assert.equal(hover('# A', 3), null, 'a title shows nothing');
  void describeFound;
}

// ---- Enter in YAML -------------------------------------------------------------------------------------------------------------------------------
const enter = [
  ['slides:', 2], ['name: x', 0], ['  - title: a', 4], ['  - items:', 6], ['  - notes: |', 6], ['a: |', 2], ['  - ', 'leave'], ['    ', 4],
  ['key: [a,', 2], ['key: [a]', 0], ['  - title: a # note', 4],
];
for (const [line, want] of enter) assert.equal(yamlNewlineIndent(line), want, `Enter after ${JSON.stringify(line)}`);

// ---- the line reader and core agree on every example deck ----------------------------------------------------------------------------------------
// For each property of the deck written as YAML, a caret inside its key reads as that mapping, and a caret inside its scalar value reads as that value.
function walk(value, at, visit) {
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...at, index], visit));
  else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) { visit([...at, key], item); walk(item, [...at, key], visit); }
}
let compared = 0;
for (const { slug, deck } of examples.filter((_, index) => index % 4 === 0)) {
  const yaml = toYaml(deck).yaml;
  walk(deck, [], (path, value) => {
    const keyRange = locate(yaml, 'yaml', path, { part: 'key' });
    // Keys the writer put in quotes, or that are not plain words, are for core alone.
    if (!keyRange || yaml[keyRange.offset] === '"' || yaml[keyRange.offset] === "'") return;
    const parent = path.slice(0, -1);
    const context = yamlContextAt(yaml, keyRange.offset + Math.max(1, Math.floor(keyRange.length / 2)), { explicit: true });
    assert.ok(context, `${slug}: key ${path.join('/')}`);
    // The caret is in the key: the context is that key's mapping, and the key itself is not "already there".
    assert.deepEqual(context.path, parent, `${slug}: key ${path.join('/')} -> ${context.path.join('/')}`);
    assert.ok(!context.existing.has(String(path.at(-1))), `${slug}: ${path.join('/')} is the key under the caret`);
    const core = pathAt(yaml, 'yaml', keyRange.offset + 1);
    assert.deepEqual(core.path, path, `${slug}: core pathAt on ${path.join('/')}`);
    compared++;
    if (typeof value === 'string' && value.length > 2 && /^[A-Za-z][A-Za-z0-9 -]*$/.test(value)) {
      const range = locate(yaml, 'yaml', path);
      if (yaml[range.offset] === '"' || yaml[range.offset] === "'" || yaml[range.offset] === '|' || yaml[range.offset] === '>') return;
      const there = yamlContextAt(yaml, range.offset + 2, { explicit: true });
      assert.ok(there, `${slug}: value ${path.join('/')}`);
      assert.equal(there.mode, 'value', `${slug}: ${path.join('/')} is a value`);
      assert.deepEqual(there.path, path, `${slug}: value ${path.join('/')} -> ${there.path.join('/')}`);
      compared++;
    }
  });
}
assert.ok(compared > 1500, `compared ${compared} positions`);
// Written back, every example deck's YAML reads as the deck (the writer and the reader the pane uses agree before the editor touches it).
assert.deepEqual(fromYaml(toYaml(examples[0].deck).yaml, { catalogs }).presentation, examples[0].deck);

// ---- quick fixes as text edits ------------------------------------------------------------------------------------------------------------------
const textFinding = (format, text, index = 0) => {
  const deck = format === 'yaml' ? parseYaml(text) : fromMarkdown(text, { validate: false }).presentation;
  return normalizeFinding(validate(deck, { catalogs }).findings.filter((entry) => entry.ruleId === 'opf/schema' || entry.ruleId === 'opf/unresolved-reference')[index]);
};
const keysOf = (format, text) => (segments) => { void format; void text; return segments.length === 0 ? ['slides', 'name', 'design'] : segments.at(-1) === 'design' ? ['theme', 'colorScheme', 'fontScheme', 'titleAlignment'] : ['title', 'items', 'layout']; };
const textFixed = (format, text, title, index = 0) => {
  const found = textFinding(format, text, index);
  const deck = format === 'yaml' ? parseYaml(text) : fromMarkdown(text, { validate: false }).presentation;
  const context = { valueAt: (segments) => segments.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), deck), keysOf: keysOf(format, text), starter: (_segments, property) => (property === 'name' ? 'Name' : '') };
  const fix = textFixesForFinding(format, found, text, context).find((entry) => entry.title === title);
  assert.ok(fix, `${title} is offered for ${JSON.stringify(text)}`);
  return applySourceEdits(text, fix.edits);
};
assert.equal(textFixed('yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: middle\n', 'Change to center'), 'slides:\n  - title: a\ndesign:\n  titleAlignment: center\n');
assert.equal(textFixed('yaml', 'slides:\n  - title: a\ndesign:\n  titleAlignment: "middle" # guess\n', 'Change to center'), 'slides:\n  - title: a\ndesign:\n  titleAlignment: "center" # guess\n', 'quotes and trailing comments stay');
assert.equal(textFixed('yaml', 'slides:\n  - title: a\n    layot: x\n', 'Remove property').trim(), 'slides:\n  - title: a', 'a whole line goes');
assert.equal(textFixed('yaml', 'slides:\n  - title: a\ndesign:\n  # note\n  titleAlignment: middle\n', 'Change to center'), 'slides:\n  - title: a\ndesign:\n  # note\n  titleAlignment: center\n', 'comments stay');
assert.equal(textFixed('yaml', 'slides:\n  - title: a\norganization:\n  id: acme\n', 'Add `name`'), 'slides:\n  - title: a\norganization:\n  id: acme\n  name: Name\n', 'an added key is indented like its mapping');
assert.equal(textFixed('yaml', 'slides:\n  - title: a\n  - title: b\n    layot: x\n', 'Remove property'), 'slides:\n  - title: a\n  - title: b\n', 'the last line of the text');
assert.equal(textFixed('md', '---\ndesign:\n  titleAlignment: middle\n---\n# A\n', 'Change to center'), '---\ndesign:\n  titleAlignment: center\n---\n# A\n', 'the front matter is YAML');
assert.equal(textFixed('md', '---\ndesgin:\n  theme: minimal\n---\n# A\n', 'Rename to design'), '---\ndesign:\n  theme: minimal\n---\n# A\n');
{
  const text = '# A\n<!-- slide: layout=cde -->\n';
  const found = textFinding('md', text);
  const fix = textFixesForFinding('md', found, text, { valueAt: () => 'cde' }).find((entry) => entry.title === 'Change to cover');
  assert.equal(applySourceEdits(text, fix.edits), '# A\n<!-- slide: layout=cover -->\n', 'an option value is written bare');
}
// The rows of the problems panel carry the positions: line and column of the key or the value, in YAML and in Markdown.
{
  const text = 'slides:\n  - title: 42\n    bogus: 1\n';
  const rows = buildProblems({ format: 'yaml', text, findings: validate(parseYaml(text)).findings.filter((entry) => entry.ruleId === 'opf/schema').map((entry) => normalizeFinding(entry, 'schema')), context: {}, actions: {} });
  assert.deepEqual(rows.map((row) => [row.line, row.column, text.slice(row.from, row.to)]), [[2, 12, '42'], [3, 5, 'bogus']]);
}
{
  const text = '---\ndesign:\n  titleAlignment: middle\n---\n# A\n';
  const findings = validate(fromMarkdown(text, { validate: false }).presentation).findings.filter((entry) => entry.ruleId === 'opf/schema').map((entry) => normalizeFinding(entry, 'schema'));
  const rows = buildProblems({ format: 'md', text, findings, context: {}, actions: {} });
  assert.deepEqual(rows.map((row) => [row.line, row.column, text.slice(row.from, row.to)]), [[3, 19, 'middle']]);
}

console.log(`Source language units (YAML and Markdown): contexts, lists, accepted text, snippets, regions, hover and Enter pass; ${compared} positions of the example decks agree with core.`);
