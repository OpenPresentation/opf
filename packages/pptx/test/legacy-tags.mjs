// Typed legacy provenance adaptation. Literal data is not a structural path.
import assert from 'node:assert/strict';
import {currentTag, currentTags, legacyRegionOrder, upgradeTag} from '../src/legacy-tags.js';

const literal = 'slides.0.left';
const arbitrary = {
  text: literal,
  code: {source: literal, language: 'text'},
  table: {columns: ['Field'], rows: [[literal]]},
  extensions: {note: literal, titleAlignment: 'left', [literal]: 'literal key'},
};
for (const family of ['document', 'slide', 'data', 'datasets', 'image', 'annotation', 'furniture']) {
  const input = structuredClone(arbitrary);
  assert.deepEqual(upgradeTag(input, family), input, `${family}: arbitrary unknown fields are opaque`);
}
assert.equal(upgradeTag(arbitrary), arbitrary, 'a caller without a known family cannot migrate arbitrary JSON');

const slide = {
  v: 1,
  design: {titleAlignment: 'left', contentAlignment: 'right', footer: {left: {text: [{text: literal, lang: 'fr-FR'}]}}},
  content: {form: 'regions', regions: {left: {t: 'leaf', k: 'text', ext: arbitrary}, right: {t: 'leaf', k: 'text'}, center: {t: 'leaf', k: 'text'}}},
  lists: [['slides.0.left.items', [[0, 'text']]]],
  listRuns: [['slides.0.right.items', {text: {fontFamily: 'Georgia'}}]],
  overlays: [[0, {id: literal, at: {block: literal, edge: 'end', width: 1.01, height: 0.5}}]],
  extensions: arbitrary,
};
const migrated = upgradeTag(slide, 'slide');
assert.equal(migrated.design.titleAlignment, 'start');
assert.equal(migrated.design.contentAlignment, 'end');
assert.deepEqual(migrated.design.footer.start.text, [{text: literal, language: 'fr-FR'}]);
assert.deepEqual(Object.keys(migrated.content.regions), ['start', 'end', 'center']);
assert.deepEqual(migrated.content.regions.start.ext, arbitrary);
assert.equal(migrated.lists[0][0], 'slides.0.start.items');
assert.equal(migrated.listRuns[0][0], 'slides.0.end.items');
assert.deepEqual(migrated.overlays[0][1], {id: literal, at: {block: literal, edge: 'end', widthPx: 1.01, height: 0.5}});
assert.deepEqual(legacyRegionOrder(migrated), ['center', 'start', 'end'], 'legacy color slots keep the old lexical region order');
assert.deepEqual(slide.content.regions.left.ext, arbitrary, 'input is not mutated');
assert.deepEqual(migrated.extensions, arbitrary);

const current = currentTag({...slide, overlays: [[0, {at: {block: 'target', edge: 'end', width: 1.01, height: 0.5}}]]});
assert.equal(upgradeTag(current, 'slide'), current, 'current marker makes fractional 1.01 unambiguous');
assert.equal(upgradeTag(current, 'slide').overlays[0][1].at.width, 1.01);
const map = new Map([['a', {v: 1}]]);
assert.deepEqual(currentTags(map).get('a'), {v: 1, vocabulary: 2});
assert.deepEqual(map.get('a'), {v: 1});

const document = {v: 1, design: {chartPrimary: 'right'}, metadata: {extensions: arbitrary}, catalogs: {custom: {themes: {sample: {design: {titleAlignment: 'left'}, extensions: arbitrary}}}}};
const upgradedDocument = upgradeTag(document, 'document');
assert.equal(upgradedDocument.design.chartPrimary, 'end');
assert.equal(upgradedDocument.catalogs.custom.themes.sample.design.titleAlignment, 'start');
assert.deepEqual(upgradedDocument.metadata.extensions, arbitrary);
assert.deepEqual(upgradedDocument.catalogs.custom.themes.sample.extensions, arbitrary);

const data = {v: 1, kind: 'table', authored: {columns: ['Field'], rows: [[literal, {value: [{text: literal, lang: 'fr-FR'}], style: {align: 'left', borders: {left: {width: 1}}}}]]}, extensions: arbitrary};
const upgradedData = upgradeTag(data, 'data');
assert.equal(upgradedData.authored.rows[0][0], literal);
assert.deepEqual(upgradedData.authored.rows[0][1], {value: [{text: literal, language: 'fr-FR'}], style: {align: 'start', borders: {left: {width: 1}}}});
assert.deepEqual(upgradedData.extensions, arbitrary);
assert.deepEqual(upgradeTag({[literal]: {columns: [literal], rows: [[literal]]}}, 'datasets'), {[literal]: {columns: [literal], rows: [[literal]]}});
assert.deepEqual(upgradeTag({vocabulary: {columns: ['Field'], rows: [[literal]]}}, 'datasets'), {vocabulary: {columns: ['Field'], rows: [[literal]]}});
const legacyDatasets = {sample: {columns: ['Field'], rows: [[{value: [{text: literal, lang: 'fr-FR'}], style: {align: 'left'}}]]}};
const adaptedDatasets = upgradeTag(legacyDatasets, 'datasets');
assert.equal(adaptedDatasets, legacyDatasets, 'datasets are opaque scalar tables, not authored rich-table payloads');
assert.equal(legacyDatasets.sample.rows[0][0].value[0].lang, 'fr-FR');

assert.deepEqual(upgradeTag({v: 1, role: 'caption', path: literal, field: literal + '.caption', align: 'right', text: literal, extension: arbitrary}, 'annotation'),
  {v: 1, role: 'caption', path: 'slides.0.start', field: 'slides.0.start.caption', align: 'end', text: literal, extension: arbitrary});
assert.deepEqual(upgradeTag({v: 1, path: literal, treatment: {placement: {edge: 'left', size: 0.4}, overlay: {edge: 'right', color: 'accent1'}, caption: {align: 'left', text: literal}}, properties: arbitrary}, 'image'),
  {v: 1, path: 'slides.0.start', treatment: {placement: {edge: 'start', size: 0.4}, overlay: {edge: 'end', color: 'accent1'}, caption: {align: 'start', text: literal}}, properties: arbitrary});
assert.deepEqual(upgradeTag({v: 1, definitions: {footer: {value: {left: {text: literal}}}}, templates: {'footer.right': literal}, images: {'footer.left': {reference: literal}}, parts: [{kind: 'footer', zone: 'right', names: [literal]}]}, 'furniture'),
  {v: 1, definitions: {footer: {value: {start: {text: literal}}}}, templates: {'footer.end': literal}, images: {'footer.start': {reference: literal}}, parts: [{kind: 'footer', zone: 'end', names: [literal]}]});

for (const input of [
  {design: {footer: {left: {text: 'old'}, start: {text: 'new'}}}},
  {content: {form: 'regions', regions: {left: {}, start: {}}}},
  {overlays: [[0, {at: {width: 40, widthPx: 50}}]]},
]) assert.throws(() => upgradeTag(input, 'slide'), /Ambiguous legacy/);
assert.throws(() => upgradeTag({vocabulary: 3}, 'slide'), /Unsupported native provenance vocabulary/);

const hostile = JSON.parse('{"design":{"titleAlignment":"left"},"__proto__":{"polluted":true},"toString":"slides.0.left"}');
const upgradedHostile = upgradeTag(hostile, 'slide');
assert.equal({}.polluted, undefined);
assert.equal(upgradedHostile.toString, literal);
assert.deepEqual(Object.getOwnPropertyDescriptor(upgradedHostile, '__proto__').value, {polluted: true});
let deep = {t: 'leaf', k: 'text'};
for (let index = 0; index < 100; index++) deep = {t: 'group', blocks: [deep]};
assert.throws(() => upgradeTag({content: {form: 'blocks', blocks: [deep]}}, 'slide'), /depth limit/);

console.log('Typed legacy provenance: literal/key preservation, every family, unit versions, collisions, depth and current records pass.');
