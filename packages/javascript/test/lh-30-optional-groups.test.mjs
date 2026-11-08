// LH-30: a template group whose content variables are all optional and all unfilled is omitted whole, with its picture and card, and
// validation (whose samples fill every variable) reports it as opf/variable-group-omitted.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVariables, validate } from '../dist/index.js';
import { describeFinding, explain } from '../dist/source.js';

const portrait = { src: 'https://example.com/portrait.jpg', alt: 'A customer' };
const template = (variables, blocks, extra = {}) => ({ template: true, name: 'Case study', language: 'en-US', variables, slides: [{ id: 'proof', title: 'Customers', blocks, ...extra }] });
const quoteGroup = { blocks: [{ image: portrait }, { text: 'var:quote' }, { text: 'Said by {{customer}}' }] };
const optional = { quote: { type: 'text', required: false }, customer: { type: 'text', required: false } };
const groupFindings = (document) => validate(document, { only: ['format', 'content'] }).findings?.filter((entry) => entry.ruleId === 'opf/variable-group-omitted') ?? [];

test('LH-30: a group of only unfilled optional variables is omitted with its picture', () => {
  const doc = template(optional, [{ text: 'Our customers say it best.' }, quoteGroup]);
  const { presentation, diagnostics } = resolveVariables(doc);
  assert.deepEqual(presentation.slides[0].blocks, [{ text: 'Our customers say it best.' }], 'the group, its picture included, is gone');
  const notes = diagnostics.filter((entry) => entry.code === 'variable-group-omitted');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].severity, 'info');
  assert.equal(notes[0].path, '/slides/0/blocks/1');
  assert.ok(!diagnostics.some((entry) => entry.code === 'variable-unused'), 'the omitted group still uses its variables');
});

test('LH-30: one filled variable keeps the whole group', () => {
  const doc = template(optional, [quoteGroup]);
  const { presentation, diagnostics } = resolveVariables(doc, { customer: 'Globex' });
  assert.deepEqual(presentation.slides[0].blocks, [{ blocks: [{ image: portrait }, {}, { text: 'Said by Globex' }] }], 'the unfilled reference alone is omitted, as before');
  assert.ok(!diagnostics.some((entry) => entry.code === 'variable-group-omitted'));
  // A template preview uses the examples, so the group draws.
  const previewed = resolveVariables(template({ ...optional, quote: { type: 'text', required: false, example: 'It just works.' } }, [quoteGroup]), {}, { examples: true });
  assert.equal(previewed.presentation.slides[0].blocks.length, 1);
});

test('LH-30: a required variable, a group without variables, a slide itself and color variables never collapse', () => {
  const required = template({ ...optional, customer: { type: 'text' } }, [quoteGroup]);
  assert.equal(resolveVariables(required, {}, { partial: true }).presentation.slides[0].blocks.length, 1, 'a required variable keeps the group');
  const plain = template(optional, [{ blocks: [{ image: portrait }, { text: 'Always shown' }] }, { text: 'var:quote' }, { text: '{{customer}}' }]);
  assert.deepEqual(resolveVariables(plain).presentation.slides[0].blocks, [{ blocks: [{ image: portrait }, { text: 'Always shown' }] }, {}, { text: '' }], 'a group with no variable stays; loose fields are omitted as before');
  const colored = template({ ...optional, brand: '#1F4E79' }, [{ blocks: [{ text: [{ text: 'Brand', color: 'var:brand' }] }] }]);
  assert.equal(resolveVariables(colored).presentation.slides[0].blocks.length, 1, 'a color variable is no content variable');
  // The slide holds blocks too, but only a group inside it is optional content.
  const slide = template(optional, [{ text: 'var:quote' }]);
  assert.equal(resolveVariables(slide).presentation.slides.length, 1);
  // A promoted region that is a group collapses as well.
  const region = { template: true, language: 'en-US', variables: optional, slides: [{ title: 'Customers', left: { text: 'Always' }, right: quoteGroup }] };
  assert.equal(resolveVariables(region).presentation.slides[0].right, undefined);
});

test('LH-30: validation reports the group as info, with words, a fix and an example', () => {
  const doc = template(optional, [{ text: 'Our customers say it best.' }, quoteGroup]);
  const [found] = groupFindings(doc);
  assert.ok(found, 'reported');
  assert.equal(found.severity, 'info');
  assert.equal(found.path, '/slides/0/blocks/1');
  const text = describeFinding(found, { document: doc });
  assert.equal(text.message, 'A group on slide 1 is left out when `quote` and `customer` have no value, with its pictures, cards and other text.');
  assert.equal(text.next, 'give one of them a value to draw the group, or move what should always show out of the group.');
  assert.equal(validate(template(optional, [quoteGroup]), { values: { quote: 'Yes' } }).findings?.filter((entry) => entry.ruleId === 'opf/variable-group-omitted').length ?? 0, 0, 'a filled variable keeps the group');
  const explained = explain('opf/variable-group-omitted');
  assert.equal(explained.severity, 'info');
  assert.ok(explained.fix && explained.example?.problem, 'a fix and an example');
});
