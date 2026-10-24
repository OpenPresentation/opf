// The language pieces of the source editor that need no browser (artifacts/source-editor/TEST-PLAN.md, section 8.5): what a position of a JSON draft
// means, the list a position gets and its order, the text accepting an item writes, the snippets, the plain-words problem text of core's findings and
// the edits of the quick fixes. Real core, real schemas, the default catalog.
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { gallery } from '@openpresentation/gallery';
import { validate } from '@openpresentation/opf';
import { contextAt, tokenAt } from '../dist/source-json.js';
import { completionResult, planCompletion, valueTemplate } from '../dist/source-completions.js';
import { SNIPPETS, fragmentValue, renderJson, snippetsFor } from '../dist/source-snippets.js';
import { describeFinding, distance, nearest } from '../dist/source-messages.js';
import { applySourceEdits, fixesForFinding } from '../dist/source-fixes.js';
import { buildProblems, summarize } from '../dist/source-problems.js';
import { analyzeSyntax, findDuplicateKeys } from '../dist/source-syntax.js';
import { locateJson } from '../dist/source-ranges.js';
import { normalizeFinding } from '../dist/source-findings.js';
import { describeField } from '@openpresentation/opf/schema';

const caret = (doc) => { const at = doc.indexOf('|'); return { text: doc.slice(0, at) + doc.slice(at + 1), at }; };
const catalogs = [gallery];
const labels = (doc, explicit = true) => {
  const { text, at } = caret(doc);
  const state = EditorState.create({ doc: text });
  const result = completionResult(state, at, { explicit, catalogs });
  return result ? result.options.map((option) => option.label) : null;
};

// ---- what a position means ---------------------------------------------------------------------------------------------------------------------
const contexts = [
  ['key after a quote', '{\n  "slides": [],\n  "de|"\n}', { mode: 'key', path: [], existing: ['slides'], quoted: true, text: 'de' }],
  ['key, bare word', '{\n  "slides": [],\n  de|\n}', { mode: 'key', path: [], existing: ['slides'], quoted: false, text: 'de' }],
  ['key in a nested object', '{"slides": [{"title": "a", |}]}', { mode: 'key', path: ['slides', 0], existing: ['title'], quoted: false, text: '' }],
  ['value after a colon', '{"design": {"titleAlignment": |}}', { mode: 'value', path: ['design', 'titleAlignment'], key: 'titleAlignment', quoted: false, text: '' }],
  ['value in quotes', '{"design": {"titleAlignment": "ce|"}}', { mode: 'value', path: ['design', 'titleAlignment'], key: 'titleAlignment', quoted: true, text: 'ce' }],
  ['item of a list', '{"slides": [{"title": "a"}, |]}', { mode: 'item', path: ['slides', 1], quoted: false, text: '' }],
  ['item in quotes', '{"audience": ["bo|"]}', { mode: 'item', path: ['audience', 0], quoted: true, text: 'bo' }],
  ['a blank document', '|', { mode: 'value', path: [], quoted: false, text: '' }],
  ['an empty object', '{|}', { mode: 'key', path: [], existing: [], quoted: false, text: '' }],
  ['a broken line before it', '{\n  "name": "x"\n  "sli|\n}', { mode: 'key', path: [], quoted: true, text: 'sli' }],
  ['a CRLF document', '{\r\n  "slides": [],\r\n  "de|"\r\n}', { mode: 'key', path: [], existing: ['slides'], quoted: true, text: 'de' }],
];
for (const [name, doc, want] of contexts) {
  const { text, at } = caret(doc);
  const context = contextAt(text, at, { explicit: true });
  assert.ok(context, name);
  assert.equal(context.mode, want.mode, `${name}: mode`);
  assert.deepEqual(context.path, want.path, `${name}: path`);
  if (want.existing) assert.deepEqual([...context.existing].sort(), [...want.existing].sort(), `${name}: existing keys`);
  if (want.key) assert.equal(context.key, want.key, `${name}: key`);
  assert.equal(context.token.quoted, want.quoted, `${name}: quoted`);
  assert.equal(text.slice(context.token.from, context.token.to), want.text, `${name}: token text`);
}
// Where no token can be completed: after a finished value, between members, in a comment-looking position.
for (const doc of ['{"a": 1,| "b": 2}x', '{"slides": []}|', '{"a": [1, 2]|}']) {
  const { text, at } = caret(doc);
  assert.equal(contextAt(text, at, { explicit: false }), null, doc);
}
// Typing `:` and the space after it opens the value place; Ctrl+Space does anywhere a token fits.
assert.ok(tokenAt('{"a":', 5, false), 'typing a colon');
assert.ok(tokenAt('{"a": ', 6, false), 'typing the space after the colon');
assert.equal(tokenAt('{"a":  ', 7, false), null, 'two spaces are not a trigger');

// ---- the list a position gets and its order ------------------------------------------------------------------------------------------------
const slideKeys = labels('{"slides": [{|}]}');
assert.deepEqual(slideKeys.slice(0, 20), ['title', 'subtitle', 'layout', 'items', 'text', 'notes', 'image', 'chart', 'table', 'quote', 'code', 'metric', 'timeline', 'blocks', 'design', 'id', 'section', 'tag', 'hidden', 'beat'], 'a slide: the common keys in the curated order');
assert.ok(slideKeys.length < 45, `a slide offers ${slideKeys.length} keys, not the 75 of the schema`);
assert.equal(slideKeys.some((label) => label.includes(':')), false, 'the region keys are hidden');
assert.ok(labels('{"slides": [{"top+mi|"}]}').some((label) => label.startsWith('top+middle')), 'a typed prefix shows the region keys');
assert.deepEqual(labels('{"slides": [], "design": {|}}').slice(0, 7), ['theme', 'colorScheme', 'fontScheme', 'dimensions', 'background', 'header', 'footer'], 'design: the common keys first');
assert.deepEqual(labels('{"slides": [], "organization": {|}}').slice(0, 2), ['id', 'name'], 'organization: required members first');
assert.deepEqual(labels('{|}').slice(0, 6), ['slides', 'name', 'design', 'language', 'audience', 'purpose'], 'the deck: required first, then the common keys');
assert.equal(labels('{"slides": [{"title": "a", |}]}').includes('title'), false, 'keys already there are not offered');
// Equal boost: CodeMirror then lists them by label, as VS Code does.
assert.deepEqual([...labels('{"design": {"titleAlignment": |}}')].sort((a, b) => a.localeCompare(b)), ['center', 'left', 'right']);
assert.deepEqual([...labels('{"template": |}')].sort(), ['false', 'true']);
assert.equal(labels('{"slides": [{"title": |}]}'), null, 'free text offers nothing');
assert.equal(labels('{"duration": |}'), null, 'a number offers nothing');
assert.equal(labels('{"slides": [{"notes": "He said |"}]}'), null);
assert.deepEqual(labels('{"design": |}'), ['{}']);
assert.deepEqual(labels('{"slides": |}'), ['[]']);
assert.deepEqual(labels('{"slides": [|]}').slice(0, 2), ['{}', 'slide'].sort((a, b) => 0 * a.length * b.length) && ['{}', 'slide'], 'a slide entry: an object and the snippets');
assert.ok(labels('{"slides": [{"layout": |}]}').includes('pillars'));
assert.ok(labels('{"slides": [{"layout": |}]}').length >= 20 && labels('{"slides": [{"layout": |}]}').length <= 40);
assert.equal(labels('{"slides": [{"layout": |}]}')[0], 'cover', 'layouts in the order of their intents: openers first');
assert.deepEqual(labels('{"catalogs": {"custom": {"layouts": {"mine": {"name": "Mine", "regions": [{"name": "title"}]}}}}, "slides": [{"layout": |}]}')[0], 'mine', 'records of the document come first');
assert.ok(labels('{"audience": ["|"]}').includes('board'), 'a list of catalog ids');
assert.equal(labels('{|}', false), null, 'an empty object is not asked for unless Ctrl+Space (no token yet)');
assert.deepEqual(labels('|').slice(0, 2), ['{}', 'deck'].sort().reverse().reverse() && ['{}', 'deck'], 'a blank document: an object and the deck snippet');
// The same input, the same list.
assert.deepEqual(labels('{"slides": [{|}]}'), slideKeys);

// ---- what accepting writes (SPEC 4.6) ---------------------------------------------------------------------------------------------------------
const plan = (doc, label, opf) => {
  const { text, at } = caret(doc);
  const context = contextAt(text, at, { explicit: true });
  return planCompletion(context, { label, opf }, text, context.token.end);
};
const keyPlan = (doc, key) => plan(doc, key, { kind: 'key', key });
assert.deepEqual(keyPlan('{"slides": [], "de|"}', 'description'), { template: '"description": "${1}"${0}', fields: 1, chain: false });
assert.deepEqual(keyPlan('{"slides": [], "templ|"}', 'template'), { template: '"template": ', fields: 0, chain: true }, 'a boolean key: the value list opens');
assert.deepEqual(keyPlan('{"slides": [], "durat|"}', 'duration'), { template: '"duration": ${1}${0}', fields: 1, chain: false });
assert.deepEqual(keyPlan('{"name": "x", "slid|"}', 'slides'), { template: '"slides": [${1}]${0}', fields: 1, chain: false });
assert.deepEqual(keyPlan('{"slides": [], "desig|"}', 'design'), { template: '"design": {${1}}${0}', fields: 1, chain: false });
assert.deepEqual(keyPlan('{"slides": [], "organ|"}', 'organization'), { template: '"organization": {\n\t"id": "${1}",\n\t"name": "${2}"\n}${0}', fields: 2, chain: false }, 'required members, one stop each');
assert.deepEqual(keyPlan('{"design": {"titleA|"}}', 'titleAlignment'), { template: '"titleAlignment": "${1}"${0}', fields: 1, chain: true }, 'a closed set: the list opens inside the quotes');
assert.deepEqual(keyPlan('{"slides": [{"title|"}]}', 'title'), { template: '"title": "${1}"${0}', fields: 1, chain: false });
assert.equal(keyPlan('{"name": "x", "desc|"\n  "slides": []}', 'description').template, '"description": "${1}",${0}', 'a comma when a property follows');
assert.equal(keyPlan('{"des|": {}}', 'design').template, '"design"', 'the colon that follows is kept');
assert.equal(plan('{"slides": [{"layout": |}]}', 'cover', { kind: 'literal', literal: '"cover"' }).template, '"cover"');
assert.equal(plan('{"slides": [{"layout": |\n"title": "a"}]}', 'cover', { kind: 'literal', literal: '"cover"' }).template, '"cover",', 'a comma before the next property');
assert.equal(plan('{"slides": [], "organization": |}', '{}', { kind: 'template' }).template.startsWith('{\n\t"id"'), true);
assert.equal(valueTemplate(describeField(['slides', 0, 'chart'], {})).template.startsWith('{\n'), true, 'a chart: required members');

// ---- snippets ------------------------------------------------------------------------------------------------------------------------------------
const wrap = (snippet) => {
  const value = fragmentValue(snippet.fragment);
  if (snippet.where === 'slide') return { slides: [value] };
  if (snippet.where === 'reference') return { slides: [{ title: 'a' }], references: [value] };
  if (snippet.where === 'dataset') return { slides: [{ title: 'a' }], datasets: { [snippet.name.text]: value } };
  if (snippet.where === 'markdown') return { slides: [{ title: 'a', [snippet.key]: value }] };
  return value;
};
for (const snippet of SNIPPETS) {
  const result = validate(wrap(snippet), { only: ['format'] });
  assert.deepEqual(result.findings.filter((finding) => finding.severity === 'error').map((finding) => `${finding.path} ${finding.message}`), [], `snippet ${snippet.prefix} is a valid fragment`);
  const rendered = renderJson(snippet.fragment);
  assert.ok(rendered.text.endsWith('${0}'), `${snippet.prefix} ends at $0`);
  assert.deepEqual(rendered.fields.map((field) => field.index), [...rendered.fields.map((field) => field.index)].sort((a, b) => a - b), `${snippet.prefix}: stops in order`);
  // The snippet text with its markers resolved is the same JSON.
  const plain = rendered.text.replace(/\$\{0\}/, '').replace(/\$\{\d+(?::((?:\\[{}\\]|[^{}\\])*))?\}/g, (_all, text = '') => text.replace(/\\([{}\\])/g, '$1')).replaceAll('\t', '  ');
  assert.deepEqual(JSON.parse(plain), fragmentValue(snippet.fragment, { literal: true }), `${snippet.prefix}: the rendered text parses to the fragment`);
}
assert.deepEqual(snippetsFor('item', ['slides', 0]).map((snippet) => snippet.prefix).slice(0, 3), ['slide', 'slide-text', 'slide-image']);
assert.deepEqual(snippetsFor('item', ['references', 0]).map((snippet) => snippet.prefix), ['reference']);
assert.deepEqual(snippetsFor('value', []).map((snippet) => snippet.prefix), ['deck']);
assert.deepEqual(snippetsFor('key', ['datasets']).map((snippet) => snippet.prefix), ['dataset']);
assert.deepEqual(snippetsFor('key', []), [], 'JSON and YAML have properties for the deck keys');
assert.equal(renderJson({ a: [] }, { comma: true }).text, '{\n\t"a": []\n},${0}');

// ---- problem text and quick fixes ---------------------------------------------------------------------------------------------------------------
const finding = (text, index = 0) => normalizeFinding(validate(text).findings.filter((entry) => entry.ruleId === 'opf/schema' || entry.ruleId === 'opf/unresolved-reference')[index]);
const context = (text) => {
  const draft = JSON.parse(text);
  return { unit: '  ', valueAt: (segments) => segments.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), draft), keysOf: () => ['slides', 'name', 'design'], catalogKind: (segments) => (segments.at(-1) === 'layout' ? 'layouts' : undefined), catalogCount: () => 28, starter: (_segments, property) => (property === 'slides' ? [{ title: 'Slide title' }] : '') };
};
const said = (text, index = 0) => describeFinding(finding(text, index), context(text));
assert.deepEqual(said('{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}'), { message: '`titleAlignment` must be left, center or right, but is `middle`.', next: 'did you mean `center`?' });
assert.equal(said('{"slides":[{"items":"One"}]}').message, '`items` should be a list, but it is text (`One`).');
assert.equal(said('{"slides":[{"items":"One"}]}').next, 'write ["One"].');
assert.equal(said('{"name":"x"}').message, 'The deck is missing `slides`.');
assert.equal(said('{"name":"x"}').next, 'add "slides": [ { "title": "…" } ].');
assert.equal(said('{"slides":[],"organization":{"name":"a"}}').message, '`organization` is missing `id`.');
assert.equal(said('{"slides":[]}').message, '`slides` needs at least 1 item.');
assert.equal(said('{"slides":[{"title":"a","layout":""}]}').message, '`layout` must be a layout id such as `pillars` or `acme:hero` (lowercase letters, digits and hyphens), but it is empty.');
assert.equal(said('{"slides":[{"title":"a","layout":""}]}').next, 'press Ctrl+Space for the 28 layouts, or remove it to let OPF pick.');
assert.equal(said('{"slides":[{"title":"a"}],"design":{"colorScheme":{"accent1":"#12"}}}').message, '`accent1` must be a hex color like `#1F4E79` (3, 6 or 8 hex digits), but is `#12`.');
assert.equal(said('{"slides":[{"title":42}]}').message, '`title` should be text or a list, but it is a number (`42`).');
assert.equal(said('{"slides":[{"title":"a"}],"duration":0}').message, '`duration` must be at least 1, but is a number (`0`).');
assert.equal(said('{"slids":[]}', 1).message, '`slids` is not a property of the deck.');
assert.equal(said('{"slids":[]}', 1).next, 'did you mean `slides`? To keep custom data, put it under `extensions`.');
assert.equal(said('{"slides":[{"title":"a","layout":"pilars"}]}').next.startsWith('did you mean `pillars`?'), true);
assert.equal(describeFinding({ ruleId: 'opf/missing-alt-text', message: 'This picture has no alt text.', help: 'Describe it. Or mark it decorative.', path: '/slides/0/image' }).next, 'describe it.', 'any other finding keeps its sentence and the first of its help');
assert.equal(distance('middle', 'center') > 2, true);
assert.deepEqual(nearest('middle', ['left', 'center', 'right']).close, ['center'], 'the alias table');
assert.deepEqual(nearest('lefft', ['left', 'center', 'right']).close, ['left']);
assert.deepEqual(nearest('zzzz', ['left', 'center']).close, []);

// Every fix, applied to its text, removes its finding (and keeps the text a parseable object where the fix is about the value).
const unit = '  ';
const fixed = (text, title, index = 0) => {
  const found = finding(text, index);
  const fix = fixesForFinding(found, text, { ...context(text), unit }).find((entry) => entry.title === title);
  assert.ok(fix, `${title} is offered for ${text}`);
  return applySourceEdits(text, fix.edits);
};
assert.deepEqual(JSON.parse(fixed('{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', 'Change to center')).design, { titleAlignment: 'center' });
assert.equal(validate(fixed('{"slides":[{"title":"a"}],"design":{"titleAlignment":"middle"}}', 'Change to left'), { only: ['format'] }).valid, true);
assert.deepEqual(JSON.parse(fixed('{"slids":[{"title":"a"}]}', 'Rename to slides', 1)), { slides: [{ title: 'a' }] });
assert.deepEqual(JSON.parse(fixed('{"slides":[{"title":"a"}],"foo":1}', 'Remove property')), { slides: [{ title: 'a' }] });
assert.deepEqual(JSON.parse(fixed('{"name":"x"}', 'Add `slides`')), { name: 'x', slides: [{ title: 'Slide title' }] });
assert.deepEqual(JSON.parse(fixed('{"slides":[{"items":"One"}]}', 'Wrap in a list')), { slides: [{ items: ['One'] }] });
assert.deepEqual(JSON.parse(fixed('{"slides":[]}', 'Add a slide')), { slides: [{ title: 'Slide title' }] });
assert.deepEqual(JSON.parse(fixed('{"slides":[{"title":"a","layout":"pilars"}]}', 'Change to pillars')), { slides: [{ title: 'a', layout: 'pillars' }] });
assert.equal(fixed('{\n  "slides": [],\n  "organization": {\n    "name": "a"\n  }\n}', 'Add `id`'), '{\n  "slides": [],\n  "organization": {\n    "name": "a",\n    "id": ""\n  }\n}', 'an added member keeps the indentation');

// ---- the rows of the panel -----------------------------------------------------------------------------------------------------------------------
const rowsOf = (text) => {
  const found = [...analyzeSyntax(text).map((problem) => normalizeFinding(problem, 'syntax'))];
  if (found.length) return buildProblems({ format: 'json', text, findings: found, context: context('{}') });
  const duplicates = findDuplicateKeys(text);
  if (duplicates.length) return buildProblems({ format: 'json', text, findings: duplicates, context: context('{}') });
  return buildProblems({ format: 'json', text, findings: validate(text).findings.map((entry) => normalizeFinding(entry, 'schema')), context: context(text) });
};
{
  const owner = '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}';
  const rows = rowsOf(owner);
  assert.equal(rows.length, 1, 'the owner case is one problem');
  assert.equal(rows[0].message, '`design` needs a value.');
  assert.equal(owner.slice(rows[0].from, rows[0].to), '"design":');
  assert.deepEqual([rows[0].line, rows[0].column], [3, 3]);
  assert.match(rows[0].next, /Ctrl\+Space/);
  assert.deepEqual(rows[0].fixes.map((fix) => fix.title), ['Add { }', 'Remove "design"']);
  assert.equal(JSON.parse(applySourceEdits(owner, rows[0].fixes[0].edits.map((edit) => ({ ...edit })))).design !== undefined, true);
  assert.equal(summarize(rows), '1 problem: 1 error');
}
{
  const text = '{"slids":[]}';
  const rows = rowsOf(text);
  assert.equal(rows.length, 1, 'the missing-property row is merged into the rename');
  assert.equal(text.slice(rows[0].from, rows[0].to), '"slids"');
  assert.deepEqual(rows[0].fixes.map((fix) => fix.title), ['Rename to slides', 'Remove property']);
}
{
  const text = '{"slides":[{"title":42}],"design":{"theme":"neon-dreams"}}';
  const rows = rowsOf(text);
  assert.deepEqual(rows.map((row) => text.slice(row.from, row.to)), ['42', '"neon-dreams"'], 'position order, each over its own value');
  assert.equal(summarize(rows), '2 problems: 1 error, 1 warning');
}
{
  const text = '{"slides":[],"name":"a","name":"b"}';
  const rows = rowsOf(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].fixes.map((fix) => fix.title), ['Remove the first', 'Remove the second']);
  assert.deepEqual(JSON.parse(applySourceEdits(text, rows[0].fixes[1].edits)), { slides: [], name: 'a' });
  assert.deepEqual(JSON.parse(applySourceEdits(text, rows[0].fixes[0].edits)), { slides: [], name: 'b' });
  assert.equal(rows[0].finding.related.length, 1, 'the first key is marked too');
}
assert.equal(summarize([]), 'No problems');
assert.deepEqual(locateJson('{"a": {"b": 1}}', ['a', 'b'], 'key'), { from: 7, to: 10, exact: true });
assert.deepEqual(locateJson('{"a": {"b": 1}}', ['a', 'c'], 'value'), { from: 6, to: 14, exact: false }, 'a missing member is its container');
console.log('Source language units: contexts, lists and their order, accepted text, snippets, problem text, quick fixes and panel rows pass.');
