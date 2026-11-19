// PPTX: an org chart's assistant and a Venn's overlap label are written as editable shapes from core's geometry, and come back on import.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync, strFromU8} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {gallery} from '@openpresentation/gallery';

const options = {catalogs: [gallery], seed: 3401, timestamp: '2026-11-16T00:00:00Z', zipDate: '2026-11-16T00:00:00Z'};
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const named = (xml, name) => shapes(xml).find(shape => shape.includes(`name="${name}"`));

test('an assistant is a node with its two-segment elbow, and import keeps assistant: true', async () => {
  const items = [{text: 'Pilot lead', level: 0}, {text: 'Chief of staff', level: 1, assistant: true}, {text: 'Delivery', level: 1}, {text: 'Evidence', level: 1}];
  const document = {language: 'en-US', slides: [{layout: 'org-chart', title: 'Give the pilot lead a chief of staff', items}]};
  const bytes = new Uint8Array(await toPptx(document, options)), xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  assert.ok(/<a:prstGeom prst="rect">/.test(named(xml, 'OPF arrangement slides.0.items node 1')), 'the assistant is a rectangle like the other nodes');
  const segments = shapes(xml).filter(shape => /name="OPF arrangement slides\.0\.items connector 1 segment \d"/.test(shape));
  assert.equal(segments.length, 2, 'down the manager\'s line, then across to the assistant');
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.slides[0].items, [items[0].text, ...items.slice(1)]);
});

test('the overlap label is an opaque fully rounded rectangle over the circles, and import keeps overlap: true', async () => {
  const items = ['Clear scope', 'Evidence', 'Shared goal', {text: 'Ready to scale', overlap: true}];
  const document = {language: 'en-US', slides: [{layout: 'venn', title: 'Where the pilot earns its keep', items}]};
  const bytes = new Uint8Array(await toPptx(document, options)), xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const pill = named(xml, 'OPF arrangement slides.0.items node 3');
  assert.ok(pill.includes('<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 50000"/></a:avLst></a:prstGeom>'), 'fully rounded');
  assert.match(pill, /<p:spPr>[\s\S]*?<a:solidFill><a:schemeClr val="bg1"><\/a:schemeClr><\/a:solidFill><a:ln[^>]*><a:solidFill><a:schemeClr val="accent1">/, 'background fill, primary outline');
  assert.ok(!pill.includes('<a:alpha'), 'opaque, unlike the circles');
  assert.ok(xml.indexOf('name="OPF arrangement slides.0.items node 2"') < xml.indexOf('name="OPF arrangement slides.0.items node 3"'), 'after the circles');
  assert.ok(xml.indexOf('name="OPF arrangement slides.0.items node 3"') < xml.indexOf('<a:t>Ready to scale</a:t>'), 'its text over it');
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.slides[0].items, items);
});
