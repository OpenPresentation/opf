// FR-08: an embed leaves as its static form, linked to its address: a picture (the preview, contained on the surface color) or the card
// (a native group). OPF_EMBED_V1 restores the embed on import while its link and its picture (or the card's title text) are as exported.
// A 0.36.0 importer keeps working: it ignores the tag, and the slide record's topology names only kinds it knows.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';

const dec = new TextDecoder(), enc = new TextEncoder();
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const other = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==', 'base64'));
const dataUri = bytes => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const source = () => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Embeds', language: 'en-US',
  assets: {shot: dataUri(png)},
  slides: [
    {id: 'live', title: 'Revenue, live', embed: {src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot'}},
    {id: 'card', title: 'The card', embed: 'https://www.prototype.example.com/checkout'},
    {id: 'beside', title: 'Beside text', blocks: [{text: 'The checkout flow we tested with twelve customers.'}, {embed: {src: 'https://prototype.example.com/checkout', title: 'Prototype'}, caption: 'Prototype, version 3'}]},
  ],
});
assert.equal(validate(source(), {only: ['format']}).valid, true);

const export_ = async (deck = source(), options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(deck, {...options, onDiagnostic: entry => diagnostics.push(entry)});
  return {bytes, entries: unzipSync(bytes), diagnostics};
};
const slidePart = (entries, number) => dec.decode(entries[`ppt/slides/slide${number}.xml`]);
const relsPart = (entries, number) => dec.decode(entries[`ppt/slides/_rels/slide${number}.xml.rels`]);
const tagValues = entries => Object.entries(entries).filter(([path]) => /^ppt\/tags\/.*\.xml$/.test(path)).flatMap(([path, bytes]) => [...dec.decode(bytes).matchAll(/<p:tag name="([^"]+)" val="([0-9A-F]+)"/g)].map(match => ({path, name: match[1], value: JSON.parse(dec.decode(Uint8Array.from(match[2].match(/../g), byte => parseInt(byte, 16))))})));
const importer = async (bytes) => {
  const found = [];
  const deck = await fromPptx(bytes, {onDiagnostic: entry => found.push(entry)});
  return {deck, found};
};
const errorsOf = deck => validate(deck, {only: ['format']}).findings.filter(finding => finding.severity === 'error');

// --- export: the picture, the card, the link ------------------------------------------------------------------------
const {bytes, entries, diagnostics} = await export_();
assert.deepEqual(diagnostics.filter(entry => entry.code !== 'info'), [], JSON.stringify(diagnostics));
const first = slidePart(entries, 1);
assert.match(first, /<p:pic>[\s\S]*name="OPF embed slides\.0\.embed" descr="Revenue dashboard"><a:hlinkClick r:id="rId\d+"[\s\S]*<\/p:pic>/, 'a picture named for the embed, described by its title, with a click link');
assert.match(relsPart(entries, 1), /Target="https:\/\/app\.example\.com\/dashboards\/revenue" TargetMode="External"/);
assert.match(first, /<a:prstGeom prst="rect"><a:avLst><\/a:avLst><\/a:prstGeom><a:solidFill><a:schemeClr val="bg1">/, 'the picture is filled with the surface color');
const second = slidePart(entries, 2);
assert.match(second, /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF embed slides\.1\.embed group" descr="prototype\.example\.com"\/>/, 'the card is one group described by its title');
for (const part of ['', ' badge', ' arrow', ' title line 0']) assert.match(second, new RegExp(`name="OPF embed slides\\.1\\.embed${part}"><a:hlinkClick`), `the card's ${part || 'panel'} links to the page`);
assert.match(second, /prst="roundRect"/);
// FR-08b: the card's block is centered (core's embedCardLayout decides; the export draws its boxes): every part is centered on the panel across,
// the title and the site name are center-aligned, and the block (badge top to site bottom) is centered down.
{
  const box = name => { const part = new RegExp(`name="OPF embed slides\\.1\\.embed${name}">[\\s\\S]*?<a:off x="(\\d+)" y="(\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"/>`).exec(second); assert.ok(part, name || 'panel'); const [x, y, w, h] = part.slice(1).map(Number); return {x, y, w, h}; };
  const panel = box(''), parts = [' badge', ' title line 0'].map(box), pt = 12700 / 2;
  for (const part of parts) assert.ok(Math.abs(part.x + part.w / 2 - (panel.x + panel.w / 2)) <= pt, 'centered across');
  const top = Math.min(...parts.map(part => part.y)), bottom = Math.max(...parts.map(part => part.y + part.h));
  assert.ok(Math.abs((top + bottom) / 2 - (panel.y + panel.h / 2)) <= pt, 'centered down');
  assert.equal((second.match(/algn="ctr"/g) ?? []).length, 1, 'the title line is center-aligned (an embed named by its site has no site line)');
  assert.match(second, /name="OPF embed slides\.1\.embed title line 0">[\s\S]*?sz="3000"/, 'a full-slide card carries the 30 pt (40 px) ceiling title');
}
assert.match(second, /prst="rightArrow"/);
assert.match(second, /<a:xfrm rot="18900000">/, 'the arrow is turned 45 degrees to point up and right');
assert.doesNotMatch(second, /checkout/, 'the card never prints the address');
assert.match(second, /<a:t>prototype\.example\.com<\/a:t>/);
const third = slidePart(entries, 3);
assert.match(third, /name="OPF embed slides\.2\.blocks\.1\.embed group"/);
assert.match(third, /<a:t>Prototype<\/a:t>[\s\S]*<a:t>prototype\.example\.com<\/a:t>/, 'the title, then the site name');
assert.match(third, /<a:t>Prototype, version 3<\/a:t>/, 'the caption follows');
assert.equal((third.match(/algn="ctr"/g) ?? []).length, 2, 'the title and the site name of a card beside text are center-aligned');

// --- tags -----------------------------------------------------------------------------------------------------------
const tags = tagValues(entries).filter(tag => tag.name === 'OPF_EMBED_V1');
assert.equal(tags.length, 3);
const [picture, panel] = tags;
assert.deepEqual(picture.value.embed, {src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 1.6});
assert.equal(picture.value.written, 'Revenue dashboard');
assert.match(picture.value.evidence.media, /^\d+:[0-9a-f]{16}$/);
assert.equal(picture.value.preview, undefined, 'an asset: preview is not a recordable source: the picture is the preview');
assert.equal(panel.value.evidence.text, 'prototype.example.com');
// A 0.36.0 importer: the only OPF tag a native object carries is the one it does not know, and the slide record's topology names kinds it reads.
const known36 = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'shape'];
const records = tagValues(entries).filter(tag => tag.name === 'OPF_SLIDE_V1');
assert.equal(records.length, 3);
for (const {value} of records) {
  const topology = value.content;
  assert.ok(topology, 'the slide keeps its content topology');
  const kinds = JSON.stringify(topology).match(/"k":"([a-z]+)"/g)?.map(entry => entry.slice(5, -1)) ?? [];
  const fields = topology.form === 'root' ? (topology.fields ?? [topology]).map(field => field.field) : [];
  assert.ok(kinds.every(kind => known36.includes(kind)), `topology kinds ${kinds}`);
  assert.ok(fields.every(field => ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram'].includes(field)), `root fields ${fields}`);
  assert.ok(!JSON.stringify(value).includes('"embed"') || value === undefined, 'no record a 0.36.0 importer validates carries an embed kind');
}

// --- import: the embed comes back -----------------------------------------------------------------------------------
{
  const {deck, found} = await importer(bytes);
  assert.deepEqual(errorsOf(deck), [], JSON.stringify(errorsOf(deck)));
  assert.deepEqual(found.filter(entry => entry.code === 'embed-provenance-changed'), []);
  assert.deepEqual(deck.slides.map(slide => slide.id), ['live', 'card', 'beside']);
  assert.equal(deck.slides[0].embed.src, 'https://app.example.com/dashboards/revenue');
  assert.equal(deck.slides[0].embed.title, 'Revenue dashboard');
  assert.equal(deck.slides[0].embed.aspectRatio, 1.6);
  assert.match(deck.slides[0].embed.preview, /^data:image\/png;base64,/, 'the picture is the preview again');
  assert.equal(deck.slides[0].blocks, undefined);
  assert.equal(deck.slides[1].embed, 'https://www.prototype.example.com/checkout');
  assert.deepEqual(deck.slides[2].blocks, [{text: 'The checkout flow we tested with twelve customers.'}, {embed: {src: 'https://prototype.example.com/checkout', title: 'Prototype'}, caption: 'Prototype, version 3'}]);
}

// A relative or web preview is recorded and given back as written, with no picture bytes of its own in the document.
{
  const deck = source();
  deck.slides[0].embed.preview = 'https://cdn.example.com/shots/revenue.png';
  const {bytes: exported, diagnostics: reported} = await export_(deck, {imageResolver: () => dataUri(png)});
  assert.deepEqual(reported.filter(entry => entry.code === 'unresolved-asset'), []);
  assert.equal(tagValues(unzipSync(exported)).find(tag => tag.name === 'OPF_EMBED_V1').value.preview, 'https://cdn.example.com/shots/revenue.png');
  const {deck: back} = await importer(exported);
  assert.equal(back.slides[0].embed.preview, 'https://cdn.example.com/shots/revenue.png');
}

// A preview nothing resolved exports the card, and says so.
{
  const deck = source();
  deck.slides[0].embed.preview = 'https://cdn.example.com/shots/revenue.png';
  const {entries: cardEntries, diagnostics: reported} = await export_(deck);
  assert.ok(reported.some(entry => entry.code === 'unresolved-asset' && /exports as its card/.test(entry.message)), JSON.stringify(reported));
  assert.match(slidePart(cardEntries, 1), /name="OPF embed slides\.0\.embed group"/);
}

// --- evidence: what changes in PowerPoint leaves what is there ------------------------------------------------------
const mutate = (change) => {
  const copy = {...entries};
  change(copy);
  return zipSync(copy);
};
{
  // A replaced picture: the bytes are not the exported ones.
  const media = Object.keys(entries).find(path => path.startsWith('ppt/media/') && entries[path].length === png.length);
  assert.ok(media, 'the exported picture part');
  const {deck, found} = await importer(mutate(copy => { copy[media] = other.slice(); }));
  assert.ok(found.some(entry => entry.code === 'embed-provenance-changed' && /picture was replaced/.test(entry.message)), JSON.stringify(found));
  assert.equal(deck.slides[0].embed, undefined);
  assert.ok(JSON.stringify(deck.slides[0]).includes('"image"'), 'a picture is what is there');
  assert.deepEqual(errorsOf(deck), []);
}
{
  // A changed link.
  const {deck, found} = await importer(mutate(copy => { copy['ppt/slides/_rels/slide1.xml.rels'] = enc.encode(dec.decode(copy['ppt/slides/_rels/slide1.xml.rels']).replace('https://app.example.com/dashboards/revenue', 'https://other.example.com/x')); }));
  assert.ok(found.some(entry => entry.code === 'embed-provenance-changed' && /link no longer opens/.test(entry.message)), JSON.stringify(found));
  assert.equal(deck.slides[0].embed, undefined);
  assert.deepEqual(errorsOf(deck), []);
}
{
  // An edited card title.
  const {deck, found} = await importer(mutate(copy => { copy['ppt/slides/slide2.xml'] = enc.encode(dec.decode(copy['ppt/slides/slide2.xml']).replace('<a:t>prototype.example.com</a:t>', '<a:t>Our prototype</a:t>')); }));
  assert.ok(found.some(entry => entry.code === 'embed-provenance-changed' && /title text was edited/.test(entry.message)), JSON.stringify(found));
  assert.equal(deck.slides[1].embed, undefined);
  assert.deepEqual(errorsOf(deck), []);
}
{
  // A renamed object.
  const {found} = await importer(mutate(copy => { copy['ppt/slides/slide1.xml'] = enc.encode(dec.decode(copy['ppt/slides/slide1.xml']).replace('name="OPF embed slides.0.embed"', 'name="Dashboard"')); }));
  assert.ok(found.some(entry => entry.code === 'embed-provenance-changed' && /renamed/.test(entry.message)), JSON.stringify(found));
}

// --- without the tag: a linked picture and shapes, as any other file ----------------------------------------------------
{
  const {bytes: plain, entries: plainEntries} = await export_(source(), {provenance: 'references-only'});
  assert.equal(tagValues(plainEntries).filter(tag => tag.name === 'OPF_EMBED_V1').length, 0);
  const {deck} = await importer(plain);
  assert.deepEqual(errorsOf(deck), []);
  assert.equal(JSON.stringify(deck).includes('"embed"'), false, 'nothing says it was an embed');
}
console.log('embed: ok');
