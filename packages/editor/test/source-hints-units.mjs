// The shape hint without a browser (artifacts/source-editor/SPEC.md, section 8.2): `shapeAt` reads a text of any of the three formats at a position and
// says which object the caret is in, the rows to show and their states. Real core, real schemas, the default catalog.
import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { shapeAt } from '../dist/source-hints.js';

const catalogs = [gallery];
const at = (format, doc) => {
  const caret = doc.indexOf('|');
  return shapeAt(format, doc.replace('|', ''), caret, { catalogs });
};
const states = (shape) => Object.fromEntries(shape.rows.map((row) => [row.key, row.state]));

// A slide with a layout: the layout's regions, then the notes. `next` is the first required region the slide does not have.
{
  const shape = at('json', '{\n  "slides": [{\n    "layout": "pillars",\n    "title": "a",\n    |\n  }]\n}');
  assert.equal(shape.kind, 'slide');
  assert.equal(shape.title, 'slide · layout "pillars"');
  assert.equal(shape.aside, 'slide 1 of 1');
  assert.deepEqual(shape.rows.map((row) => row.key), ['title', 'items', 'notes']);
  assert.deepEqual(states(shape), { title: 'set', items: 'next', notes: 'optional' });
  assert.equal(shape.next, 'items');
  assert.equal(shape.sentence, 'Slide with layout pillars: title set, items next, notes optional');
  assert.equal(shape.rows[0].description, 'Slide title');
  assert.match(shape.rows[1].description, /^The pillars \(text, list, metric, image, group\)$|^The pillars \(text, list, metric, image or group\)$/);
  assert.deepEqual(shape.path, ['slides', 0]);
  assert.equal(shape.atMember, true);
}
// Everything the layout wants is there: nothing is next.
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a","items":["x"],|}]}').next, undefined);
assert.deepEqual(states(at('json', '{"slides":[{"layout":"pillars","title":"a","items":["x"],|}]}')), { title: 'set', items: 'set', notes: 'optional' });
// A block pinned to a region counts as that region being set.
{
  const shape = at('json', '{"slides":[{"layout":"two-column","title":"a","blocks":[{"region":"first","type":"text","text":"x"}],|}]}');
  assert.deepEqual(shape.rows.map((row) => [row.key, row.state]), [['title', 'set'], ['items', 'set'], ['text', 'next'], ['notes', 'optional']]);
  assert.match(shape.rows[1].description, /^The first \(text, list, quote/);
  assert.match(shape.rows[2].description, /^The second \(/);
}
// A region that takes one or two kinds is written by those keys; the media region of a cover.
assert.deepEqual(at('json', '{"slides":[{"layout":"cover",|}]}').rows.map((row) => row.key), ['title', 'image / video', 'notes']);
// The second slide of three.
assert.equal(at('json', '{"slides":[{"title":"a"},{"layout":"agenda",|},{"title":"c"}]}').aside, 'slide 2 of 3');
// Nothing needs the text to be valid: an object that is not closed, a comma after the last member.
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a",|').next, 'items');
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a",|},]}').next, 'items');

// A slide without a layout: its common fields; an unknown layout is named.
{
  const shape = at('json', '{"slides":[{"title":"a",|}]}');
  assert.equal(shape.title, 'slide');
  assert.deepEqual(shape.rows.slice(0, 3).map((row) => [row.key, row.state]), [['title', 'set'], ['subtitle', 'optional'], ['layout', 'optional']]);
  assert.equal(shape.next, undefined, 'a slide has no required field');
  assert.equal(at('json', '{"slides":[{"layout":"nope",|}]}').title, 'slide · layout "nope" (not found)');
}

// Other objects: the required fields first (organization: id and name), a chart its type and data, a block the field of its type.
{
  const organization = at('json', '{"slides":[],"organization":{|}}');
  assert.equal(organization.title, 'organization');
  assert.equal(organization.aside, '2 required');
  assert.deepEqual(organization.rows.slice(0, 2).map((row) => [row.key, row.state]), [['id', 'next'], ['name', 'optional']]);
  assert.equal(organization.rows.length <= 8, true, 'a short list');
  const half = at('json', '{"slides":[],"organization":{"id":"acme",|}}');
  assert.deepEqual(half.rows.slice(0, 2).map((row) => [row.key, row.state]), [['id', 'set'], ['name', 'next']]);
  const chart = at('json', '{"slides":[{"chart":{"type":"column",|}}]}');
  assert.equal(chart.title, 'chart');
  assert.deepEqual(chart.rows.slice(0, 2).map((row) => [row.key, row.state]), [['type', 'set'], ['data', 'next']]);
  const block = at('json', '{"slides":[{"blocks":[{"type":"chart",|}]}]}');
  assert.equal(block.title, 'block · type "chart"');
  assert.deepEqual(block.rows.map((row) => [row.key, row.state]), [['type', 'set'], ['chart', 'next'], ['id', 'optional'], ['region', 'optional']]);
  assert.equal(at('json', '{"slides":[{"blocks":[{"chart":{"type":"bar","data":{}},|}]}]}').title, 'block · type "chart"', 'the type follows from the field when it is not written');
  assert.equal(at('json', '{"slides":[{"blocks":[{|}]}]}').next, 'type', 'a block with nothing: its type is next');
  const deck = at('json', '{"slides":[{"title":"a"}],|}');
  assert.equal(deck.title, 'deck');
  assert.deepEqual(deck.rows[0] && [deck.rows[0].key, deck.rows[0].state], ['slides', 'set'], 'the deck: slides is its one required field');
}
// The innermost object decides, a list or a value does not: the slide for a caret in its list; no hint where the schema has no shape.
assert.equal(at('json', '{"slides":[{"layout":"pillars","items":["a",|]}]}').title, 'slide · layout "pillars"');
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a|"}]}').kind, 'slide');
assert.equal(at('json', '{"slides":[{"title":"a","extensions":{|}}]}'), null, 'extensions has no shape');
assert.equal(at('json', '{"slides":[{"title":"a","extensions":{"x":1,|}}]}'), null);
assert.equal(shapeAt('json', '', 0, { catalogs }), null, 'an empty text');
assert.equal(at('json', '{"slides":[{"layout":"pillars","items":["a",|]}]}').atMember, false, 'inside a list: not between the members of the slide');
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a|"}]}').atMember, false, 'inside a value');
assert.equal(at('json', '{"slides":[{"layout":"pillars","title":"a"|}]}').atMember, false, 'right after a value is still the value');

// YAML: the slide mapping, a new item after a dash, a flow mapping.
{
  const shape = at('yaml', 'slides:\n  - layout: pillars\n    title: a\n    |\n');
  assert.equal(shape.title, 'slide · layout "pillars"');
  assert.deepEqual(states(shape), { title: 'set', items: 'next', notes: 'optional' });
  assert.equal(shape.atMember, true);
  assert.deepEqual(states(at('yaml', 'organization:\n  id: acme\n  |\n')).name, 'next');
  assert.equal(at('yaml', 'slides:\n  - |\n').kind, 'slide', 'a dash with nothing yet is a new slide');
  assert.equal(at('yaml', 'slides:\n  - {layout: pillars, title: a|}\n').next, 'items');
  assert.equal(at('yaml', 'slides:\n  - title: Hello|\n').atMember, false);
}

// Markdown: the slide the caret is in, with the layout from its options comment; the front matter; an opf-slide fence.
{
  const md = '# A\n\n---\n\n<!-- slide: layout=pillars -->\n# B\n\n|';
  const shape = at('md', md);
  assert.equal(shape.title, 'slide · layout "pillars"');
  assert.equal(shape.aside, 'slide 2 of 2');
  assert.deepEqual(states(shape), { title: 'set', items: 'next', notes: 'optional' });
  assert.equal(shape.where, 'body');
  assert.equal(shape.atMember, false, 'the prose of a slide: no automatic hint');
  assert.match(shape.rows[0].description, /# Title/, 'Markdown rows say how the field is written');
  assert.equal(states(at('md', '# A\n\n<!-- slide: layout=pillars -->\n\n- one\n|')).items, 'set');
  assert.equal(at('md', '# A\n\n---\n\n|# B').aside, 'slide 2 of 2', 'after a separator: the next slide');
  assert.equal(at('md', '# A\n|\n\n---\n\n# B').aside, 'slide 1 of 2');
  assert.deepEqual(states(at('md', '---\norganization:\n  id: a\n  |\n---\n# A')).name, 'next');
  const fence = at('md', '<!-- slide: layout=agenda -->\n# A\n\n```opf-slide\nnotes: n\n|\n```\n');
  assert.equal(fence.title, 'slide · layout "agenda"');
  assert.deepEqual(states(fence), { title: 'set', items: 'next', notes: 'set' });
  assert.equal(fence.atMember, true);
  assert.equal(shapeAt('md', '---\nname: x\n---\n# A', 3, { catalogs }), null, 'the line of the front matter fence has no shape');
}
console.log('Shape hint: slides by layout, other objects by schema, blocks by type, in JSON, YAML and Markdown.');
