// Phase 4 completion units (artifacts/source-editor/SPEC.md, sections 3.4 and 4): the built-in variables after `{{` (names from core's
// `listBuiltinVariables`, the document's own first, grouped by prefix, each saying whether the document sets it), accepting a variable with several
// cursors, and the target of a Markdown image `![alt](`. Real core, the default catalog, no browser.
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { gallery } from '@openpresentation/gallery';
import { listBuiltinVariables } from '@openpresentation/opf';
import { applyCompletion, completionResult } from '../dist/source-completions.js';
import { builtinVariables, factsOf } from '../dist/source-references.js';

const catalogs = [gallery];
const caret = (doc) => { const at = doc.indexOf('|'); return { text: doc.slice(0, at) + doc.slice(at + 1), at }; };
const result = (doc, format = 'json', explicit = false) => {
  const { text, at } = caret(doc);
  return { text, at, found: completionResult(EditorState.create({ doc: text }), at, { explicit, catalogs, format }) };
};
const labels = (doc, format, explicit) => result(doc, format, explicit).found?.options.map((option) => option.label) ?? null;

// ---- the built-in names come from core ---------------------------------------------------------------------------------------------------
const FULL = { name: 'Q3', description: 'Review', author: ['Ada', 'Grace'], speaker: { id: 'ada', name: 'Ada Lovelace', title: 'CTO' }, organization: { id: 'acme', name: 'Acme Corp', tagline: 'Build' }, slides: [] };
const inline = listBuiltinVariables(FULL).filter((entry) => !(entry.scope === 'slide' && entry.kind === 'image')).map((entry) => entry.name);
const listed = builtinVariables(factsOf(FULL)).map((entry) => entry.name);
assert.deepEqual([...listed].sort(), [...inline].sort(), 'every inline built-in of core, no logo, nothing else');
assert.ok(!listed.some((name) => /\.logo/.test(name)), 'a logo is a whole-field image, never inside {{ }}');
for (const name of ['deck.name', 'speaker.name', 'speaker.ada.title', 'speakers', 'organization.name', 'organization.acme.tagline', 'slide.number', 'slide.section', 'deck.slideCount']) assert.ok(listed.includes(name), `${name} is offered`);
// Grouped by prefix: deck.*, speaker.* (and speakers), organization.*, then the per-slide ones.
const group = (name) => (name === 'speakers' ? 'speaker' : name.split('.')[0]);
const order = listed.map(group);
assert.deepEqual([...new Set(order)], ['deck', 'speaker', 'organization', 'slide'], 'one run per prefix, in this order');
assert.equal(listed[order.lastIndexOf('deck')], 'deck.slideCount', 'deck.slideCount sits with the deck names, after the others');
assert.equal(listed.at(-1), 'slide.section', 'the slide names come last');

// A built-in the document does not set says so; one it sets shows its value.
{
  const bare = builtinVariables(factsOf({ slides: [] }));
  const name = bare.find((entry) => entry.name === 'organization.name');
  assert.equal(name.available, false);
  assert.match(name.detail, /not set/);
  assert.match(name.doc, /resolves to nothing/);
  const set = builtinVariables(factsOf(FULL)).find((entry) => entry.name === 'organization.name');
  assert.equal(set.available, true);
  assert.match(set.detail, /Acme Corp/);
  assert.doesNotMatch(set.doc, /resolves to nothing/);
  const slide = bare.find((entry) => entry.name === 'slide.number');
  assert.match(slide.detail, /per slide/);
  assert.equal(slide.available, true);
  assert.match(builtinVariables(factsOf({ author: ['Ada', 'Grace'] })).find((entry) => entry.name === 'deck.author').detail, /Ada, Grace/, 'a list is joined');
}

// ---- {{ in the three formats -----------------------------------------------------------------------------------------------------------------
const JSON_DECK = (title) => `{"variables":{"brand":{"type":"text","value":"Acme"}},"organization":{"id":"acme","name":"Acme Corp"},"slides":[{"title":"${title}"}]}`;
{
  const got = labels(JSON_DECK('Hi {{|'), 'json');
  assert.equal(got[0], 'brand', 'the document\'s own variables come first');
  for (const name of ['deck.name', 'speaker.name', 'organization.name', 'slide.number']) assert.ok(got.includes(name), `JSON: ${name}`);
  assert.ok(got.indexOf('deck.name') < got.indexOf('speaker.name') && got.indexOf('speaker.name') < got.indexOf('organization.name') && got.indexOf('organization.name') < got.indexOf('slide.number'), 'grouped by prefix');
  const org = result(JSON_DECK('Hi {{org|'), 'json').found;
  const named = org.options.filter((option) => option.label.startsWith('org'));
  assert.equal(named[0].label, 'organization.name', 'the names under a prefix, in core\'s order');
  assert.equal(named[0].detail, 'built-in · Acme Corp', 'the value the document gives');
  assert.deepEqual(named[0].opf, { kind: 'variable', name: 'organization.name', builtin: true });
  assert.ok(org.validFor('organization.leg') && !org.validFor('organization name'));
  const sp = result(JSON_DECK('Hi {{speaker.|'), 'json').found;
  assert.ok(sp.options.some((option) => option.label === 'speaker.name' && /not set/.test(option.detail)), 'speaker.name is not set in this deck');
  assert.equal(labels(JSON_DECK('Hi {|'), 'json'), null, 'a single { is text');
  assert.equal(labels('{"slides":[{"title":"{{|"}]}', 'json').includes('deck.slideCount'), true, 'no declared variables: the built-ins are still offered');
}
{
  const got = labels('organization:\n  id: acme\n  name: Acme\nvariables:\n  brand: {type: text, value: Acme}\nslides:\n  - title: "Hello {{|"', 'yaml');
  assert.equal(got[0], 'brand');
  assert.ok(got.includes('organization.name') && got.includes('organization.acme.name') && got.includes('deck.name'));
  assert.equal(result('organization:\n  id: acme\n  name: Acme\nslides:\n  - title: "Hi {{org|"', 'yaml').found.options.find((option) => option.label === 'organization.name').detail, 'built-in · Acme');
  const plain = labels('slides:\n  - title: Hello {{|', 'yaml');
  assert.ok(plain.includes('slide.number'), 'a plain scalar too');
}
{
  const front = '---\nname: Q3\nspeaker:\n  name: Ada\nvariables:\n  brand:\n    type: text\n    value: Acme\n---\n\n';
  const got = labels(`${front}# Hello {{|`, 'md');
  assert.equal(got[0], 'brand');
  assert.ok(got.includes('deck.name') && got.includes('speaker.name') && got.includes('speakers'));
  assert.equal(result(`${front}# Hello {{sp|`, 'md').found.options.find((option) => option.label === 'speaker.name').detail, 'built-in · Ada');
  assert.equal(labels(`${front}# A\n\nNote: see {{|`, 'md'), null, 'Note: lines are verbatim');
  assert.ok(labels(`${front}# A\n\n\`\`\`opf-block\ntext: "Hi {{|"\n\`\`\`\n`, 'md').includes('deck.name'), 'an opf-block fence too');
}

// ---- accepting a variable with several cursors --------------------------------------------------------------------------------------------------------
/** A stand-in for the view: `applyCompletion` only reads `state` and dispatches transactions. */
const viewOf = (text, positions) => {
  const view = {
    state: EditorState.create({ doc: text, extensions: [EditorState.allowMultipleSelections.of(true)], selection: EditorSelection.create(positions.map((at) => EditorSelection.cursor(at)), positions.length - 1) }),
    dispatch(spec) { view.state = view.state.update(spec).state; },
  };
  return view;
};
const accept = (doc, name, cursors) => {
  const { text, at } = caret(doc);
  const positions = cursors ? cursors(text) : [at];
  const view = viewOf(text, positions);
  const main = view.state.selection.main.head;
  const found = completionResult(view.state, main, { explicit: false, catalogs, format: 'json' });
  const option = found.options.find((entry) => entry.label === name);
  applyCompletion(view, option, found.from, found.to, () => {}, 'json');
  return { text: view.state.doc.toString(), heads: view.state.selection.ranges.map((range) => range.head), view };
};
{
  const one = accept('{"slides":[{"title":"Hi {{or|"}]}', 'organization.name');
  assert.equal(one.text, '{"slides":[{"title":"Hi {{organization.name}}"}]}');
  assert.deepEqual(one.heads, [one.text.indexOf('}}"') + 2]);
  const closed = accept('{"slides":[{"title":"Hi {{or|}} there"}]}', 'organization.name');
  assert.equal(closed.text, '{"slides":[{"title":"Hi {{organization.name}} there"}]}', 'braces that are there are not doubled');
  // Several cursors: the typed name goes at every one, the braces are closed at each, and the carets end after them.
  const doc = '{"slides":[{"title":"A {{br"},{"title":"B {{br"},{"title":"C {{br"}]}';
  const cursors = (text) => [...text.matchAll(/\{\{br/g)].map((match) => match.index + 4);
  const many = accept(doc.replace('{{br"},{"title":"B', '{{br|"},{"title":"B'), 'deck.name', cursors);
  assert.equal(many.text, '{"slides":[{"title":"A {{deck.name}}"},{"title":"B {{deck.name}}"},{"title":"C {{deck.name}}"}]}');
  assert.deepEqual(many.heads, [...many.text.matchAll(/\}\}/g)].map((match) => match.index + 2), 'a caret after each closing braces');
  assert.equal(many.view.state.selection.ranges.length, 3);
  // With and without braces already there, at different cursors.
  const mixed = '{"slides":[{"title":"A {{br}} x"},{"title":"B {{br"}]}';
  const both = accept(mixed.replace('{{br}}', '{{br|}}'), 'deck.name', (text) => [...text.matchAll(/\{\{br/g)].map((match) => match.index + 4));
  assert.equal(both.text, '{"slides":[{"title":"A {{deck.name}} x"},{"title":"B {{deck.name}}"}]}');
  // Several cursors on one line.
  const line = accept('{"slides":[{"title":"{{br| and {{br"}]}', 'deck.name', (text) => [...text.matchAll(/\{\{br/g)].map((match) => match.index + 4));
  assert.equal(line.text, '{"slides":[{"title":"{{deck.name}} and {{deck.name}}"}]}', 'two cursors on a line');
}
// One undo step: a single transaction changes the document.
{
  const { text } = caret('{"slides":[{"title":"A {{br|"},{"title":"B {{br"}]}');
  const view = viewOf(text, [...text.matchAll(/\{\{br/g)].map((match) => match.index + 4));
  let transactions = 0;
  const dispatch = view.dispatch;
  view.dispatch = (spec) => { transactions++; dispatch(spec); };
  const found = completionResult(view.state, view.state.selection.main.head, { explicit: false, catalogs, format: 'json' });
  applyCompletion(view, found.options.find((entry) => entry.label === 'slide.number'), found.from, found.to, () => {}, 'json');
  assert.equal(transactions, 1, 'one transaction, so one undo step');
  assert.equal(view.state.doc.toString(), '{"slides":[{"title":"A {{slide.number}}"},{"title":"B {{slide.number}}"}]}');
}

// ---- the target of a Markdown image ---------------------------------------------------------------------------------------------------------------------
const FRONT = '---\nassets:\n  logo: logo.png\n  clip:\n    src: intro.mp4\n    mediaType: video/mp4\n  photo:\n    src: photo.jpg\n    title: A photo\nvariables:\n  hero: {type: image, value: a.png}\n  brand: {type: text, value: Acme}\n  tint: "#123456"\n---\n\n';
{
  const got = labels(`${FRONT}# A\n\n![alt](|)`, 'md');
  assert.deepEqual(got, ['asset:logo', 'asset:clip', 'asset:photo', 'var:hero'], 'every asset, then the image variables (not text or color ones)');
  assert.deepEqual(labels(`${FRONT}# A\n\n![](|`, 'md'), got, 'the same with no alt text and no closing parenthesis');
  assert.deepEqual(labels(`${FRONT}# A\n\n- ![x](|)`, 'md'), got, 'in a list item too');
  const typed = result(`${FRONT}# A\n\n![](asset:lo|)`, 'md').found;
  assert.equal(typed.options.length, 4, 'the engine filters, the source gives the whole list');
  assert.equal(typed.to - typed.from, 'asset:lo'.length, 'it replaces only the target text');
  assert.ok(typed.validFor('asset:log') && typed.validFor('var:h') && !typed.validFor('a b') && !typed.validFor('asset)'));
  assert.equal(labels(`${FRONT}# A\n\n![](|)`, 'md', true)[0], 'asset:logo', 'Ctrl+Space inside the parentheses');
  assert.equal(labels(`${FRONT}# A\n\nsee [link](|)`, 'md'), null, 'a link is not an image');
  assert.equal(labels(`${FRONT}# A\n\nNote: ![](|)`, 'md'), null, 'notes are verbatim');
  assert.equal(labels(`${FRONT}# A\n\n![alt](asset:logo)|`, 'md'), null, 'after the closing parenthesis');
  assert.equal(labels('# A\n\n![](|)', 'md'), null, 'a deck with no assets offers nothing');
  assert.equal(labels(`${FRONT}# A\n\n\`\`\`js\n![](|)\n\`\`\`\n`, 'md'), null, 'code is verbatim');
  // A video line (as=video) lists the videos first.
  assert.deepEqual(labels(`${FRONT}# A\n\n<!-- block: as=video -->\n![clip](|)`, 'md'), ['asset:clip', 'asset:logo', 'asset:photo', 'var:hero']);
  assert.deepEqual(labels(`${FRONT}# A\n\n<!-- block: id=v as="video" -->\n\n![clip](|)`, 'md'), ['asset:clip', 'asset:logo', 'asset:photo', 'var:hero'], 'a blank line between is fine');
  assert.deepEqual(labels(`${FRONT}# A\n\n<!-- block: as=bullets -->\n![clip](|)`, 'md'), got);
  // Accepting replaces the target and closes the parenthesis when it is not there.
  const take = (doc, label) => {
    const { text, at } = caret(doc);
    const state = EditorState.create({ doc: text, selection: { anchor: at } });
    const view = { state, dispatch(spec) { view.state = view.state.update(spec).state; } };
    const found = completionResult(state, at, { explicit: true, catalogs, format: 'md' });
    applyCompletion(view, found.options.find((entry) => entry.label === label), found.from, found.to, () => {}, 'md');
    return { text: view.state.doc.toString(), head: view.state.selection.main.head };
  };
  assert.deepEqual(take(`${FRONT}# A\n\n![alt](lo|`, 'asset:logo'), { text: `${FRONT}# A\n\n![alt](asset:logo)`, head: `${FRONT}# A\n\n![alt](asset:logo)`.length }, 'the parenthesis is closed');
  const closed = take(`${FRONT}# A\n\n![alt](asset:lo|)\n`, 'asset:logo');
  assert.equal(closed.text, `${FRONT}# A\n\n![alt](asset:logo)\n`, 'an existing parenthesis is kept, not doubled');
  assert.equal(closed.head, closed.text.indexOf(')\n'), 'the caret stays before it');
  assert.equal(take(`${FRONT}# A\n\n![alt](|) tail`, 'var:hero').text, `${FRONT}# A\n\n![alt](var:hero) tail`);
}
console.log('Source completions (phase 4): built-in variables, multi-cursor variables and Markdown image targets pass.');
