// opf-pptx#221: the "Image unavailable" placeholder of an image that cannot be embedded (a remote source is never fetched) is
// one native group, so PowerPoint moves or deletes it as one object. The group `OPF image placeholder N group` carries the
// accessible name (descr) the preview gives its <g>; it holds the dashed panel `OPF image placeholder N` and the label lines
// (`... text line i`) or the cross strokes (`... icon i`), each an editable shape with its own box. The group transform is
// the identity, so no member moves. In `full` mode the panel carries OPF_IMAGE_PLACEHOLDER_V1 and import restores the image
// block (the round trip is deep-equal); without the tag the shapes import as ordinary content, as before. Logo and furniture
// placeholders stay ungrouped (generated furniture is never grouped, src/master-furniture.js).
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true});
const slideXml = (bytes, index = 1) => strFromU8(unzipSync(bytes)[`ppt/slides/slide${index}.xml`]);
const unescape = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (xml, name) => { const match = new RegExp(`\\b${name}="([^"]*)"`).exec(xml); return match ? unescape(match[1]) : undefined; };
const groups = xml => [...xml.matchAll(/<p:grpSp>[\s\S]*?<\/p:grpSp>/g)].map(([group]) => group);
const members = group => [...group.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({xml: shape, name: attr(shape.match(/<p:cNvPr\b[^>]*>/)[0], 'name'), descr: attr(shape.match(/<p:cNvPr\b[^>]*>/)[0], 'descr'),
  box: shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(Number)}));
const read = async (bytes, options = {}) => {
  const diagnostics = [];
  const deck = await fromPptx(bytes, {...options, onDiagnostic: issue => diagnostics.push(issue)});
  return {deck, diagnostics};
};
const edit = (bytes, transform) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) if (/\.(xml|rels)$/.test(name)) parts[name] = strToU8(transform(name, strFromU8(parts[name])));
  return zipSync(parts);
};
let checks = 0;

const long = 'A description long enough that no label can fit. '.repeat(120);
// 1. Export: one group per placeholder, the label and the cross form, with the accessible name on the group.
for (const [label, alt, kind] of [['label', 'Sales by region & <quarter>', 'text line'], ['cross', long, 'icon']]) {
  const bytes = await toPptx({slides: [{title: 'Picture', image: {src: 'https://example.invalid/missing.png', alt}}]});
  const xml = slideXml(bytes);
  assert.equal(XMLValidator.validate(xml), true, `${label}: the slide is well-formed`);
  const [group, ...others] = groups(xml);
  assert.equal(others.length, 0, `${label}: one group`);
  const nv = group.match(/<p:nvGrpSpPr>[\s\S]*?<\/p:nvGrpSpPr>/)[0];
  assert.equal(attr(nv, 'name'), 'OPF image placeholder 1 group');
  assert.equal(attr(nv, 'descr'), `Image unavailable: ${alt}`, `${label}: the group carries the accessible name`);
  // CT_GroupShape: nvGrpSpPr (cNvPr, cNvGrpSpPr, nvPr), grpSpPr, then the members.
  const [node] = parser.parse(group);
  assert.deepEqual(node['p:grpSp'].map(child => Object.keys(child)[0]), ['p:nvGrpSpPr', 'p:grpSpPr', 'p:sp', 'p:sp', 'p:sp']);
  assert.deepEqual(node['p:grpSp'][0]['p:nvGrpSpPr'].map(child => Object.keys(child)[0]), ['p:cNvPr', 'p:cNvGrpSpPr', 'p:nvPr']);
  const shapes = members(group);
  assert.deepEqual(shapes.map(shape => shape.name), ['OPF image placeholder 1', `OPF image placeholder 1 ${kind} 1`.replace('text line 1', 'text line 0'), `OPF image placeholder 1 ${kind} ${kind === 'icon' ? 2 : 1}`]);
  assert.ok(shapes.every(shape => shape.descr === undefined), `${label}: no member repeats the accessible name`);
  // The identity transform: the group box is the members' union and chOff/chExt equal off/ext.
  const [x, y, cx, cy] = group.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><a:chOff x="(-?\d+)" y="(-?\d+)"\/><a:chExt cx="(\d+)" cy="(\d+)"\/>/).slice(1, 5).map(Number);
  assert.deepEqual(group.match(/<a:chOff x="(-?\d+)" y="(-?\d+)"\/><a:chExt cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(Number), [x, y, cx, cy]);
  const left = Math.min(...shapes.map(shape => shape.box[0])), top = Math.min(...shapes.map(shape => shape.box[1]));
  assert.deepEqual([x, y, cx, cy], [left, top, Math.max(...shapes.map(shape => shape.box[0] + shape.box[2])) - left, Math.max(...shapes.map(shape => shape.box[1] + shape.box[3])) - top]);
  assert.deepEqual(shapes[0].box, [x, y, cx, cy], `${label}: the panel spans the group`);
  // Unique object ids across the slide.
  const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${label}: unique ids`);
  checks += 2;
}

// 2. The record: the panel carries OPF_IMAGE_PLACEHOLDER_V1 in full mode only, never on the group.
{
  const source = {slides: [{title: 'Picture', blocks: [{image: {src: 'https://example.invalid/missing.png', alt: 'Alt'}, fit: 'cover', focus: {x: 0.2, y: 0.8}}, {text: 'Body'}]}]};
  const tagOf = bytes => {
    const parts = unzipSync(bytes), name = Object.keys(parts).find(path => /^ppt\/tags\/opfImagePlaceholder\d+\.xml$/.test(path));
    return name && JSON.parse(Buffer.from(attr(strFromU8(parts[name]), 'val'), 'hex').toString('utf8'));
  };
  const bytes = await toPptx(structuredClone(source));
  assert.deepEqual(tagOf(bytes), {v: 1, slide: 'slides.0', path: 'slides.0.blocks.0.image', image: {src: 'https://example.invalid/missing.png', alt: 'Alt'}, treatment: {fit: 'cover', focus: {x: 0.2, y: 0.8}}});
  const [group] = groups(slideXml(bytes));
  assert.match(members(group)[0].xml, /<p:custDataLst><p:tags r:id="[^"]+"\/><\/p:custDataLst>/, 'the tag is on the panel');
  assert.doesNotMatch(group.match(/<p:nvGrpSpPr>[\s\S]*?<\/p:nvGrpSpPr>/)[0], /custDataLst/);
  for (const provenance of ['references-only', false]) {
    const plain = await toPptx(structuredClone(source), {provenance});
    assert.equal(tagOf(plain), undefined, `${provenance}: no placeholder record`);
    assert.equal(groups(slideXml(plain)).length, 1, `${provenance}: still one group`);
  }
  checks += 2;
}

// 3. Round trips: the image block returns as authored (sources, alt, fields, caption, root and block forms, both shapes).
{
  const decks = {
    root: {slides: [{title: 'Root', image: {src: 'https://example.invalid/a.png', alt: 'A chart of sales'}}]},
    string: {slides: [{title: 'String', blocks: [{image: 'https://example.invalid/b.png'}, {text: 'Body'}]}]},
    asset: {assets: {hero: {src: 'https://example.invalid/hero.png', alt: 'Hero'}}, slides: [{title: 'Asset', blocks: [{image: 'asset:hero', fit: 'contain'}, {text: 'Body'}]}]},
    caption: {slides: [{title: 'Caption', image: {src: 'https://example.invalid/c.png', alt: 'Captioned'}, caption: 'Figure 1'}]},
    cross: {slides: [{title: 'Cross', image: {src: 'https://example.invalid/d.png', alt: long}}]},
    two: {slides: [{title: 'Two', blocks: [{image: {src: 'https://example.invalid/e.png', alt: 'First'}}, {image: {src: 'https://example.invalid/f.png', alt: 'Second'}}]}, {title: 'Next', image: 'https://example.invalid/g.png'}]},
  };
  for (const [label, deck] of Object.entries(decks)) {
    const {deck: imported, diagnostics} = await read(await toPptx(structuredClone(deck)));
    assert.deepEqual(imported, deck, `${label}: untouched round trip`);
    assert.deepEqual(diagnostics.filter(issue => /grouped|image-provenance|structure-changed|caption/.test(issue.code)), [], `${label}: no group, image or structure diagnostics`);
    checks++;
  }
}

// 4. Without a valid record the shapes are ordinary content (as before), and an exported placeholder group is no reflow warning.
{
  const source = {slides: [{title: 'Picture', image: {src: 'https://example.invalid/missing.png', alt: 'Alt'}}]};
  const plain = await read(await toPptx(structuredClone(source), {provenance: false}));
  assert.equal(plain.deck.slides[0].image, undefined);
  assert.ok(JSON.stringify(plain.deck.slides[0]).includes('Image unavailable'), 'the label imports as text');
  assert.ok(!plain.diagnostics.some(issue => issue.code === 'grouped-text-reflow'), 'no grouped-text warning for the placeholder group');
  // A damaged record is reported and restores nothing.
  const damaged = edit(await toPptx(structuredClone(source)), (name, xml) => !/^ppt\/tags\/opfImagePlaceholder\d+\.xml$/.test(name) ? xml : xml.replace(/\bval="([^"]+)"/, (_match, hex) => {
    const value = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    value.slide = 'slides.7';
    return `val="${Buffer.from(JSON.stringify(value), 'utf8').toString('hex').toUpperCase()}"`;
  }));
  const broken = await read(damaged);
  assert.equal(broken.deck.slides[0].image, undefined);
  assert.ok(broken.diagnostics.some(issue => issue.code === 'invalid-image-provenance'), 'the damaged record is reported');
  // A deleted panel leaves its label lines as ordinary text.
  const deleted = edit(await toPptx(structuredClone(source)), (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : xml.replace(/<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="OPF image placeholder 1"[\s\S]*?<\/p:sp>/, ''));
  const orphan = await read(deleted);
  assert.equal(orphan.deck.slides[0].image, undefined);
  assert.ok(JSON.stringify(orphan.deck.slides[0]).includes('Image unavailable'));
  // A group the exporter did not write still warns.
  const foreign = edit(await toPptx({slides: [{title: 'T', text: 'Body'}]}), (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : xml.replace('</p:spTree>', '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="90" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/><a:chOff x="0" y="0"/><a:chExt cx="20" cy="20"/></a:xfrm></p:grpSpPr></p:grpSp></p:spTree>'));
  assert.ok((await read(foreign)).diagnostics.some(issue => issue.code === 'grouped-text-reflow'));
  checks += 4;
}

// 5. Logo and furniture placeholders are not grouped; a quote photo placeholder is.
{
  const src = 'https://example.invalid/missing.png';
  const logo = slideXml(await toPptx({organization: {id: 'acme', name: 'Acme', role: 'primary', logo: src}, slides: [{title: 'Cover', layout: 'title'}]}));
  assert.equal(groups(logo).length, 0, 'the logo placeholder keeps its tagged panel ungrouped');
  assert.match(logo, /name="OPF image placeholder 1" descr="Image unavailable: /);
  const footer = slideXml(await toPptx({design: {footer: {left: {image: src}}}, slides: [{title: 'Footer', text: 'Body'}, {title: 'Two', text: 'Body'}]}));
  assert.equal(groups(footer).length, 0, 'generated furniture is never grouped');
  const quote = slideXml(await toPptx({slides: [{quote: {text: 'Ship it.', attribution: 'Priya Raman', photo: {src, alt: 'Priya Raman'}}}]}));
  assert.deepEqual(groups(quote).map(group => attr(group.match(/<p:cNvPr\b[^>]*>/)[0], 'name')), ['OPF image placeholder 1 group']);
  checks += 3;
}

console.log(`Image placeholder group passed: ${checks} checks (one p:grpSp in schema order with the accessible name and an identity transform, editable members, the full-mode record, untouched round trips, ordinary import without a valid record, logo and furniture ungrouped).`);
