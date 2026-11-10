// FA-37, FA-38: OPF tags written before 0.34 hold the layout words `left` and `right` and a run's `lang`. The importer reads a tag
// through upgradeTag (src/legacy-tags.js), which rewrites exactly those words and nothing else. The PowerPoint-saved fixtures of
// test/header-footer-dialog.mjs and test/rr-105-tag-ownership.mjs are the end-to-end check; this file states the rule record by record.
import assert from 'node:assert/strict';
import {upgradeTag} from '../src/legacy-tags.js';

let checks = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

// A furniture manifest: zones in the definitions, in the slots of images, templates, formats and shared parts, and on each part.
same(upgradeTag({
  v: 1,
  definitions: {footer: {value: {left: {text: 'literal', date: true}, center: {text: 'literal'}, right: {text: 'literal'}}}, header: {value: false}},
  images: {'footer.left': {reference: 'var:organization.logo.icon'}},
  templates: {'footer.right': '{{slide.number}}'},
  formats: {'footer.left': {dateFormat: 'yyyy'}},
  shared: {'footer.left.image': {on: 'master'}},
  parts: [{kind: 'footer', zone: 'left', field: 'text', names: ['OPF footer left']}, {kind: 'footer', zone: 'right', field: 'text'}],
}), {
  v: 1,
  definitions: {footer: {value: {start: {text: 'literal', date: true}, center: {text: 'literal'}, end: {text: 'literal'}}}, header: {value: false}},
  images: {'footer.start': {reference: 'var:organization.logo.icon'}},
  templates: {'footer.end': '{{slide.number}}'},
  formats: {'footer.start': {dateFormat: 'yyyy'}},
  shared: {'footer.start.image': {on: 'master'}},
  // An object name is the name of a shape in the file: it stays what the file says.
  parts: [{kind: 'footer', zone: 'start', field: 'text', names: ['OPF footer left']}, {kind: 'footer', zone: 'end', field: 'text'}],
}, 'a furniture manifest');

// Stored design: the hints, the zones and an overlay band; stored content: the promoted regions.
same(upgradeTag({
  v: 1,
  design: {titleAlignment: 'left', contentAlignment: 'right', chartPrimary: 'left', footer: {left: {text: 'A'}, right: {text: 'C'}}, background: {type: 'image', src: 'x', overlay: {color: '#000', opacity: .4, edge: 'left'}}},
  content: {form: 'regions', regions: {left: {kind: 'text'}, 'top:right': {kind: 'list'}, 'center+right': {kind: 'image'}, bottom: {kind: 'text'}}},
}), {
  v: 1,
  design: {titleAlignment: 'start', contentAlignment: 'end', chartPrimary: 'start', footer: {start: {text: 'A'}, end: {text: 'C'}}, background: {type: 'image', src: 'x', overlay: {color: '#000', opacity: .4, edge: 'start'}}},
  content: {form: 'regions', regions: {start: {kind: 'text'}, 'top:end': {kind: 'list'}, 'center+end': {kind: 'image'}, bottom: {kind: 'text'}}},
}, 'stored design and content');

// A caption record, with the paths that name a region; an image's placement, overlay and caption; a slide's own footer path.
same(upgradeTag({v: 1, role: 'caption', path: 'slides.0.left', field: 'slides.0.left.caption', position: 'below', align: 'right'}),
  {v: 1, role: 'caption', path: 'slides.0.start', field: 'slides.0.start.caption', position: 'below', align: 'end'}, 'a caption record');
same(upgradeTag({fields: {placement: {edge: 'right', size: .4}, overlay: {color: '#000', opacity: .3, edge: 'left'}, caption: {text: 'c', align: 'right'}}}),
  {fields: {placement: {edge: 'end', size: .4}, overlay: {color: '#000', opacity: .3, edge: 'start'}, caption: {text: 'c', align: 'end'}}}, 'image fields');
same(upgradeTag({path: 'slides.3.design.footer.left.text', other: 'design.header.right.image', region: 'slides.1.top+middle:left+center.text'}),
  {path: 'slides.3.design.footer.start.text', other: 'design.header.end.image', region: 'slides.1.top+middle:start+center.text'}, 'paths');

// A table cell's alignment and a run's language change; the physical sides of the same record do not.
same(upgradeTag({
  table: {rows: [[{value: 1, style: {align: 'right', borders: {left: {color: '#000', width: 1}, right: 'none'}, padding: {left: 4, right: 4}}}]]},
  chart: {legend: 'left', dataLabels: {position: 'right'}},
  crop: {left: 0, right: .1, top: 0, bottom: 0},
  text: [{text: 'Bonjour', lang: 'fr-FR'}, 'x'],
}), {
  table: {rows: [[{value: 1, style: {align: 'end', borders: {left: {color: '#000', width: 1}, right: 'none'}, padding: {left: 4, right: 4}}}]]},
  chart: {legend: 'left', dataLabels: {position: 'right'}},
  crop: {left: 0, right: .1, top: 0, bottom: 0},
  text: [{text: 'Bonjour', language: 'fr-FR'}, 'x'],
}, 'logical words change, physical sides stay');

// Authored text is never a word to rewrite: a title, a note or a code source that says "left" or "slides.0.left is here" stays.
same(upgradeTag({title: 'Turn left', notes: 'slides.0.left is the first column', code: {source: '{"left": 1, "lang": "fr"}', language: 'json'}, items: ['left', 'right']}),
  {title: 'Turn left', notes: 'slides.0.left is the first column', code: {source: '{"left": 1, "lang": "fr"}', language: 'json'}, items: ['left', 'right']}, 'authored text');

// A record of a current export is returned as it is (the same object), and so is anything that is not a record.
const current = {v: 1, design: {titleAlignment: 'start', footer: {start: {text: 'A'}}}, text: [{text: 'x', language: 'fr'}]};
assert.equal(upgradeTag(current), current); checks++;
for (const value of [undefined, null, 'left', 7, true]) { assert.equal(upgradeTag(value), value); checks++; }
// A key that is already there is never overwritten.
same(upgradeTag({design: {footer: {left: {text: 'old'}, start: {text: 'new'}}}}), {design: {footer: {left: {text: 'old'}, start: {text: 'new'}}}}, 'no collision');

// Tags are untrusted input: a hostile key names an own property, never the prototype, and deep nesting ends without a stack overflow.
const hostile = upgradeTag(JSON.parse('{"design":{"footer":{"left":{"text":"A"}}},"__proto__":{"polluted":true}}'));
assert.equal({}.polluted, undefined); assert.equal(Object.getPrototypeOf(hostile), Object.prototype); assert.deepEqual(hostile.design, {footer: {start: {text: 'A'}}}); checks += 3;
const nested = levels => { let value = {titleAlignment: 'left'}; for (let level = 0; level < levels; level++) value = {child: value, titleAlignment: 'left'}; return value; };
const at = (value, levels) => { for (let level = 0; level < levels; level++) value = value.child; return value; };
// The walk stops 64 levels down (no record an exporter writes nests that far): above that the words are upgraded, below they stay.
const upgraded = upgradeTag(nested(200));
assert.equal(upgraded.titleAlignment, 'start'); assert.equal(at(upgraded, 60).titleAlignment, 'start'); assert.equal(at(upgraded, 150).titleAlignment, 'left'); checks += 3;
// A record too deep to serialize is returned as it is, and the reader's own depth limit refuses it.
const abyss = nested(20000);
assert.equal(upgradeTag(abyss), abyss); checks++;

console.log(`OPF tags written before 0.34: ${checks} checks pass.`);
