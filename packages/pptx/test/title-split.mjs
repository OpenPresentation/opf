// LH-76: a "Topic: qualifier" title that would wrap is drawn as the topic (Title placeholder) and the qualifier at the subtitle
// size, as core composes it. The export tags both as one title group, so import restores the whole authored title.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, resolvePresentation, toPptx} from './helpers/default-catalog.mjs';

const fonts = await loadFonts({pack: 'office'}), dec = new TextDecoder();
const title = 'Market sizing: a bottom-up estimate across every region we serve today and the three we enter next year';
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {layout: 'text', title, text: 'Body remains present'},
  {layout: 'text', title: 'Short title', text: 'A one-line title keeps its role size.'},
]};
const items = resolvePresentation(deck, {fonts}).slides[0].geometry.items.filter(item => item.titleSplit);
assert.deepEqual(items.map(item => [item.field, item.path, item.value]), [['title', 'slides.0.title', 'Market sizing'], ['subtitle', 'slides.0.title', title.slice(15)]]);
assert.equal(items[0].text.lines.length, 1, 'the topic stays on one line');

const bytes = await toPptx(deck, {fonts}), entries = unzipSync(bytes);
const xml = dec.decode(entries['ppt/slides/slide1.xml']);
assert.match(xml, /name="OPF heading slides\.0\.title line 0"/);
assert.match(xml, /name="OPF heading slides\.0\.title line 1"/);
assert.ok(!/OPF heading slides\.0\.subtitle/.test(xml), 'the qualifier is part of the title group, not a subtitle');
const tags = Object.keys(entries).filter(file => file.startsWith('ppt/tags/opfHeading')).map(file => JSON.parse(Buffer.from(dec.decode(entries[file]).match(/val="([^"]+)"/)[1], 'hex').toString()));
const join = tags.find(tag => tag.group === 'slides.0.title' && tag.line === 0);
assert.deepEqual([join.field, join.boundary, join.separator], ['title', 'split', ': ']);

const imported = await fromPptx(bytes);
assert.equal(imported.slides[0].title, title, 'import restores the whole authored title');
assert.equal(imported.slides[0].subtitle, undefined, 'the split adds no subtitle to the document');
assert.equal(imported.slides[1].title, 'Short title');
console.log('Title split: the topic and qualifier export as one tagged title group and import as the authored title.');
