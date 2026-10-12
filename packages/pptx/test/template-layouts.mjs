// RR-81: OPF 0.19 layout templates as native PowerPoint slide layouts (src/template-layouts.js, core 0.19-layouts.md section 8).
// Every template a slide uses becomes one p:sldLayout with a placeholder per area of the empty layout (composeLayoutAreas),
// tagged OPF_LAYOUT_V1; slides relate to it; the lone picture, chart or table of a `none` region binds to its placeholder.
// Import maps the layout back (a slide added in PowerPoint, Change Layout) and pins a block typed into a region placeholder
// where plain binding would move it. The 28 built-in templates round-trip deep-equal, embedded and from a registered catalog.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {resolveSlideContext, validate} from '@openpresentation/opf';
import {composeLayoutAreas, composeSlide, layoutTemplate} from '@openpresentation/opf/composition';
import {defaultCatalog, toPptx, fromPptx} from './helpers/default-catalog.mjs';

const dec = new TextDecoder(), enc = new TextEncoder();
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const ordered = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false, preserveOrder: true});
const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', date: '2026-10-10'};
// The 28 built-in layouts of OPF 0.19 (core packages/javascript/test/fixtures/layout-templates-0.19.json at RR-79): replace with
// @openpresentation/gallery@^2 once gallery 2.0.0 (RR-80) is published.
const templates = defaultCatalog.layouts;
assert.equal(Object.keys(templates).length, 28);
// A registered catalog of the 28, as gallery 2.0.0 will be: bare ids resolve to it first.
const gallery2 = Object.freeze({source: 'pkg:@openpresentation/gallery@2', layouts: templates});
const png = async name => `data:image/png;base64,${Buffer.from(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url))).toString('base64')}`;
const wide = await png('wide.png'), square = await png('square.png');

const text = (entries, path) => dec.decode(entries[path]);
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
function resolvePart(source, target) {
  const parts = source.split('/').slice(0, -1);
  for (const piece of target.split('/')) { if (piece === '..') parts.pop(); else if (piece !== '.' && piece) parts.push(piece); }
  return parts.join('/');
}
const relationships = (entries, path) => entries[relsOf(path)] ? [...text(entries, relsOf(path)).matchAll(/<Relationship\b[^>]*\/>/g)].map(([node]) => ({
  id: node.match(/\sId="([^"]*)"/)[1], type: node.match(/\sType="([^"]*)"/)[1], target: node.match(/\sTarget="([^"]*)"/)[1], node})) : [];
const related = (entries, path, type) => { const rel = relationships(entries, path).find(item => item.type === `${REL}/${type}`); return rel && resolvePart(path, rel.target); };
const layoutOf = (entries, number) => related(entries, `ppt/slides/slide${number}.xml`, 'slideLayout');
const layoutParts = entries => Object.keys(entries).filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const layoutTag = (entries, path) => {
  const rid = text(entries, path).match(/<\/p:spTree><p:custDataLst><p:tags r:id="([^"]+)"\/><\/p:custDataLst>/)?.[1];
  const rel = rid && relationships(entries, path).find(item => item.id === rid);
  if (!rel) return undefined;
  return JSON.parse(Buffer.from(text(entries, resolvePart(path, rel.target)).match(/name="OPF_LAYOUT_V1" val="([^"]+)"/)[1], 'hex').toString('utf8'));
};
const placeholders = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)[1], type: shape.match(/<p:ph\b[^>]*\btype="(\w+)"/)?.[1] ?? 'obj', idx: shape.match(/<p:ph\b[^>]*\bidx="(\d+)"/)?.[1],
  box: shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)?.slice(1).map(Number)}));
// The placeholder kind of a region and its index: a base per kind plus the region's position among that kind's regions.
const kindOf = region => {
  const accepts = new Set(region.accepts), only = (...kinds) => [...accepts].every(kind => kinds.includes(kind));
  return only('image') ? 'pic' : only('chart') ? 'chart' : only('table') ? 'tbl' : only('video') ? 'media'
    : region.role === 'media' && accepts.has('image') && only('image', 'video', 'group') ? 'pic' : only('text', 'list') ? 'body' : 'obj';
};
const IDX_BASE = {obj: 100, body: 300, pic: 500, chart: 700, tbl: 900, media: 1100};
const indexesOf = record => {
  const regions = new Map(layoutTemplate(record).regions.map(region => [region.name, region])), counts = {};
  return Object.fromEntries(Object.keys(record.regions).map(name => { const kind = kindOf(regions.get(name)); counts[kind] = (counts[kind] ?? -1) + 1; return [name, IDX_BASE[kind] + counts[kind]]; }));
};
const sample = {
  text: () => ({text: 'A short paragraph of body text.'}),
  list: () => ({items: ['Alpha', 'Beta', 'Gamma']}),
  image: () => ({image: {src: wide}}),
  video: () => ({video: 'https://example.com/clip.mp4'}),
  chart: () => ({chart: {type: 'bar', data: {columns: ['Quarter', 'Value'], rows: [['Q1', 1], ['Q2', 2]]}}}),
  table: () => ({table: {columns: ['A', 'B'], rows: [[1, 2], [3, 4]]}}),
  code: () => ({code: 'const a = 1;'}),
  metric: () => ({metric: {value: 12, label: 'Customers'}}),
  quote: () => ({quote: {text: 'Words worth keeping.', attribution: 'Someone'}}),
  timeline: () => ({timeline: {events: [{when: 'Q1', what: 'Pilot'}, {when: 'Q2', what: 'Launch'}]}}),
};
// One slide per template with a block for every region (the first sample kind it accepts), then one with only a title: every
// region collapses, and the slide still uses the full layout.
const contentSlides = () => Object.entries(templates).map(([id, record]) => {
  const blocks = layoutTemplate(record).regions.map(region => sample[region.accepts.find(kind => sample[kind])]());
  return {layout: id, title: `${record.name} slide`, ...(blocks.length ? {blocks} : {subtitle: 'Subtitle'})};
});
const emptySlides = () => Object.entries(templates).map(([id, record]) => ({layout: id, title: `${record.name} (empty)`}));

const exportDeck = async (deck, options = {}) => {
  const diagnostics = [], before = structuredClone(deck);
  const bytes = await toPptx(deck, {catalogs: [], ...FIXED, onDiagnostic: item => diagnostics.push(item), ...options});
  assert.deepEqual(deck, before, 'Export leaves the source unchanged.');
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(?:xml|rels)$/.test(path)) parser.parse(dec.decode(data));
  return {bytes, entries, diagnostics};
};
const read = async (input, options = {}) => {
  const reports = [], imported = await fromPptx(input, {onDiagnostic: item => reports.push(item), ...options});
  assert.equal(validate(imported, {only: ['format']}).valid, true, JSON.stringify(validate(imported, {only: ['format']}).findings));
  return {imported, reports};
};
const mutate = (entries, edits) => {
  const copy = {...entries};
  for (const [path, change] of Object.entries(edits)) copy[path] = typeof change === 'function' ? enc.encode(change(text(entries, path))) : enc.encode(change);
  return zipSync(copy);
};
// The PresentationML child sequences the layout and bound slide parts use (ECMA-376 Part 1, pml.xsd and dml-main.xsd).
const SEQUENCES = {
  'p:sldLayout': ['p:cSld', 'p:clrMapOvr', 'p:transition', 'p:timing', 'p:hf', 'p:extLst'],
  'p:cSld': ['p:bg', 'p:spTree', 'p:custDataLst', 'p:controls', 'p:extLst'],
  'p:sp': ['p:nvSpPr', 'p:spPr', 'p:style', 'p:txBody', 'p:extLst'],
  'p:nvSpPr': ['p:cNvPr', 'p:cNvSpPr', 'p:nvPr'],
  'p:pic': ['p:nvPicPr', 'p:blipFill', 'p:spPr', 'p:style', 'p:extLst'],
  'p:nvPicPr': ['p:cNvPr', 'p:cNvPicPr', 'p:nvPr'],
  'p:graphicFrame': ['p:nvGraphicFramePr', 'p:xfrm', 'a:graphic', 'p:extLst'],
  'p:nvGraphicFramePr': ['p:cNvPr', 'p:cNvGraphicFramePr', 'p:nvPr'],
  'p:nvPr': ['p:ph', 'a:audioCd', 'a:wavAudioFile', 'a:audioFile', 'a:videoFile', 'a:quickTimeFile', 'p:custDataLst', 'p:extLst'],
  'p:txBody': ['a:bodyPr', 'a:lstStyle', 'a:p'],
  'p:spPr': ['a:xfrm', 'a:custGeom', 'a:prstGeom', 'a:noFill', 'a:solidFill', 'a:gradFill', 'a:blipFill', 'a:pattFill', 'a:grpFill', 'a:ln', 'a:effectLst', 'a:effectDag', 'a:scene3d', 'a:sp3d', 'a:extLst'],
};
function checkOrder(xml, label) {
  let checked = 0;
  const walk = nodes => {
    for (const node of nodes) {
      const name = Object.keys(node).find(key => key !== ':@');
      if (!name || name === '#text') continue;
      const children = node[name];
      if (SEQUENCES[name] && Array.isArray(children)) {
        const sequence = SEQUENCES[name];
        let position = -1;
        for (const child of children) {
          const childName = Object.keys(child).find(key => key !== ':@');
          if (!childName || childName === '#text') continue;
          const at = sequence.indexOf(childName);
          assert.ok(at >= 0, `${label}: ${childName} is not a member of ${name}`);
          assert.ok(at >= position, `${label}: ${childName} is out of sequence in ${name}`);
          position = at;
        }
        checked++;
      }
      if (Array.isArray(children)) walk(children);
    }
  };
  walk(ordered.parse(xml));
  return checked;
}
let checked = 0;

// ---- 1. The 28 templates, each on a filled slide and on an empty one, embedded under catalogs.custom.layouts.
const embedded = {name: 'Templates', catalogs: {custom: {layouts: templates}}, slides: [...contentSlides(), ...emptySlides()]};
const {bytes, entries, diagnostics} = await exportDeck(embedded);
assert.deepEqual(diagnostics.filter(item => /layout|region|packaging/.test(item.code)), [], 'No layout or region diagnostics.');
{
  const layouts = layoutParts(entries);
  assert.equal(layouts.length, 29, 'The master layout and one slide layout per template.');
  assert.equal(layoutTag(entries, layouts[0]), undefined, 'The master\'s own layout stays untagged (automatic slides and 0.18 records).');
  const master = 'ppt/slideMasters/slideMaster1.xml', masterXml = text(entries, master);
  const listed = [...masterXml.matchAll(/<p:sldLayoutId id="(\d+)" r:id="([^"]+)"\/>/g)];
  assert.equal(listed.length, 29);
  const ids = [...text(entries, 'ppt/presentation.xml').matchAll(/<p:sldMasterId id="(\d+)"/g), ...listed].map(match => Number(match[1]));
  assert.equal(new Set(ids).size, ids.length, 'Master and layout ids are unique.');
  assert.ok(listed.every(match => Number(match[1]) >= 2147483648), 'Layout ids are in the reserved range.');
  const masterRels = relationships(entries, master);
  assert.deepEqual(listed.map(match => resolvePart(master, masterRels.find(rel => rel.id === match[2]).target)).sort(), [...layouts].sort(), 'The master lists every layout.');
  const types = text(entries, '[Content_Types].xml');
  const byId = new Map();
  for (const path of layouts.slice(1)) {
    assert.ok(types.includes(`<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`), `${path} has a content type`);
    const xml = text(entries, path), tag = layoutTag(entries, path);
    assert.ok(tag, `${path} carries OPF_LAYOUT_V1`);
    const tagPath = resolvePart(path, relationships(entries, path).find(rel => rel.type === `${REL}/tags`).target);
    assert.ok(types.includes(`<Override PartName="/${tagPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`));
    const record = templates[tag.id];
    assert.ok(record, `${tag.id} is a template`);
    assert.deepEqual({v: tag.v, group: tag.group, reference: tag.reference, source: tag.source}, {v: 1, group: 'custom', reference: tag.id, source: undefined});
    assert.match(tag.hash, /^[0-9a-f]{16}$/);
    assert.deepEqual(tag.record, record, 'An embedded template carries its record (full provenance)');
    assert.deepEqual(tag.regions, Object.fromEntries(Object.entries(indexesOf(record)).map(([name, idx]) => [String(idx), name])), `${tag.id}: region indexes follow the record`);
    byId.set(tag.id, path);
    assert.equal(xml.match(/<p:cSld name="([^"]*)"/)[1], record.name, 'The layout is named by the record');
    const expectedType = {cover: 'title', section: 'secHead', text: 'obj', list: 'obj', agenda: 'obj', faq: 'obj', 'two-column': 'twoObj', comparison: 'twoObj', 'image-beside': 'picTx'}[tag.id] ?? 'cust';
    assert.match(xml, new RegExp(`<p:sldLayout\\b[^>]*\\btype="${expectedType}"`), `${tag.id} is a ${expectedType} layout`);
    // A placeholder per area at composeLayoutAreas' box (bled regions to the slide edge), and RR-11's three footer placeholders.
    const shapes = placeholders(xml), parsed = layoutTemplate(record);
    const {areas} = composeLayoutAreas(record, {presentation: embedded});
    const emu = value => Math.round(value * 9525);
    for (const area of areas.filter(item => !item.heading)) {
      const region = parsed.regions.find(item => item.name === area.name), shape = shapes.find(item => item.name === area.name);
      assert.ok(shape, `${tag.id}: a placeholder for ${area.name}`);
      assert.equal(shape.idx, String(indexesOf(record)[area.name]), `${tag.id}.${area.name}: the index of its kind`);
      const type = kindOf(region);
      assert.ok(Number(shape.idx) >= IDX_BASE[type] && Number(shape.idx) < IDX_BASE[type] + 100, "The index is in its kind's range");
      assert.equal(shape.type, type, `${tag.id}.${area.name} is a ${type} placeholder`);
      const {x, y, width, height} = area.box;
      assert.deepEqual(shape.box, [emu(x), emu(y), emu(width), emu(height)], `${tag.id}.${area.name} sits at its composed box`);
    }
    const title = shapes.filter(item => ['title', 'ctrTitle'].includes(item.type));
    assert.equal(title.length, 1, `${tag.id}: one title placeholder`);
    assert.equal(title[0].type, ['cover', 'section'].includes(tag.id) ? 'ctrTitle' : 'title');
    assert.equal(shapes.some(item => item.type === 'subTitle' && item.idx === '1'), ['cover', 'section'].includes(tag.id), `${tag.id}: a subtitle placeholder on cover and section only`);
    if (['cover', 'section'].includes(tag.id)) {
      const {parts} = areas.find(item => item.name === 'title');
      const boxOf = box => [box.x, box.y, box.width, box.height].map(emu);
      assert.deepEqual(title[0].box, boxOf(parts.title), `${tag.id}: ctrTitle at core's title part`);
      assert.deepEqual(shapes.find(item => item.type === 'subTitle').box, boxOf(parts.subtitle), `${tag.id}: subTitle at core's subtitle part`);
    }
    if (['cover', 'section'].includes(tag.id)) {
      const {parts} = areas.find(item => item.name === 'title');
      assert.deepEqual(title[0].box, [parts.title.x, parts.title.y, parts.title.width, parts.title.height].map(emu), );
      assert.deepEqual(shapes.find(item => item.type === 'subTitle').box, [parts.subtitle.x, parts.subtitle.y, parts.subtitle.width, parts.subtitle.height].map(emu), );
    }
    assert.deepEqual(shapes.filter(item => ['dt', 'ftr', 'sldNum'].includes(item.type)).map(item => `${item.type}:${item.idx}`), ['dt:10', 'ftr:11', 'sldNum:12']);
    assert.match(xml, /<p:hf\b[^>]*\/><\/p:sldLayout>|<p:hf\b[^>]*\/>\s*<\/p:sldLayout>/);
    const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${tag.id}: shape ids are unique`);
    assert.ok(checkOrder(xml, path) > 10, `${path} is in schema order`);
  }
  assert.deepEqual([...byId.keys()], Object.keys(templates).sort(), 'Every embedded template has its layout, by id.');
  // Change Layout pairs placeholders by idx: across all 28 layouts an idx always names one placeholder kind.
  const kinds = new Map();
  for (const path of layouts.slice(1)) for (const shape of placeholders(text(entries, path)).filter(item => Number(item.idx) >= 100)) {
    assert.equal(kinds.get(shape.idx) ?? shape.type, shape.type, `idx ${shape.idx} is one kind in every layout`);
    kinds.set(shape.idx, shape.type);
  }
  assert.ok(kinds.size >= 6);
  // Each slide relates to its template's layout, the filled and the empty slide to the same part.
  const count = Object.keys(templates).length;
  Object.keys(templates).forEach((id, index) => {
    assert.equal(layoutOf(entries, index + 1), byId.get(id), `slide ${index + 1} uses ${id}`);
    assert.equal(layoutOf(entries, count + index + 1), byId.get(id), `the empty ${id} slide uses the full layout`);
  });
  // The lone picture, chart or table of a `none` region is its placeholder's content; flowing regions stay free shapes.
  const slideXml = id => text(entries, `ppt/slides/slide${Object.keys(templates).indexOf(id) + 1}.xml`);
  const bound = xml => [...xml.matchAll(/<p:(pic|graphicFrame)>[\s\S]*?<\/p:\1>/g)].map(([shape]) => shape).filter(shape => /<p:ph\b/.test(shape))
    .map(shape => shape.match(/<p:ph\b[^>]*\/>/)[0]);
  for (const id of ['cover', 'image', 'image-beside', 'hero']) assert.deepEqual(bound(slideXml(id)), [`<p:ph type="pic" idx="${indexesOf(templates[id]).media}"/>`], `${id}: the picture fills its placeholder`);
  assert.deepEqual(bound(slideXml('chart-beside')), ['<p:ph type="chart" idx="700"/>']);
  assert.deepEqual(bound(slideXml('table-beside')), ['<p:ph type="tbl" idx="900"/>']);
  for (const id of ['gallery', 'chart', 'table', 'dashboard', 'team', 'logos']) assert.deepEqual(bound(slideXml(id)), [], `${id}: flowing regions draw free shapes`);
  for (const id of Object.keys(templates)) {
    const xml = slideXml(id);
    assert.ok(checkOrder(xml, `${id} slide`) > 3);
    assert.ok([...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].every(([shape]) => !/<p:ph\b/.test(shape) || /<a:picLocks noGrp="1"/.test(shape)), 'A placeholder picture is locked against grouping, as PowerPoint writes it');
    assert.ok(!/<p:sp>(?:(?!<\/p:sp>)[\s\S])*<p:ph\b(?:(?!<\/p:sp>)[\s\S])*<\/p:sp>/.test(xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*type="(?:title|ctrTitle|dt|ftr|sldNum)"[\s\S]*?<\/p:sp>/g, '')),
      `${id}: no empty region placeholder is instantiated on a filled slide (no prompt)`);
  }
  // The content topology names the region each root block was drawn in.
  const slideTag = number => JSON.parse(Buffer.from(text(entries, `ppt/tags/opfSlide${number}.xml`).match(/val="([^"]+)"/)[1], 'hex').toString('utf8'));
  assert.deepEqual(slideTag(Object.keys(templates).indexOf('comparison') + 1).content.blocks.map(node => node.in), ['first', 'second', 'verdict']);
  checked++;
}
{
  const {imported} = await read(bytes);
  assert.ok(isDeepStrictEqual(imported, embedded), 'The embedded 28 templates round-trip deep-equal.');
  checked++;
}

// ---- 2. The same deck against a registered catalog (as gallery 2.0.0 will be): bare ids, nothing embedded.
{
  const deck = {name: 'Registered', slides: contentSlides()};
  const catalogs = [gallery2, defaultCatalog];
  const {bytes: output, entries: parts} = await exportDeck(deck, {catalogs});
  const tags = layoutParts(parts).slice(1).map(path => layoutTag(parts, path));
  assert.deepEqual(tags.map(tag => tag.id), Object.keys(templates), 'One layout per template, in catalog order (the 0.18 records of the default catalog have none).');
  assert.ok(tags.every(tag => tag.group === 'default' && tag.source === gallery2.source), 'A registered layout records its catalog source');
  assert.ok(tags.every(tag => tag.record === undefined), 'A registered template carries no record');
  const {imported} = await read(output, {catalogs});
  assert.ok(isDeepStrictEqual(imported, deck), 'Registered templates round-trip deep-equal.');
  checked++;
}

// ---- 2b. One slide on one registered template: Change Layout reaches every template the deck can resolve, the registered
// catalog's in catalog order and then the embedded custom templates by id, used or not. A second script profile (its own slide
// master, opf-pptx#168) gets the same set.
{
  const custom = {'zz-notes': {name: 'Notes', areas: ['title', 'notes'], rows: ['auto', 1], regions: {notes: {accepts: ['text', 'list']}}},
    'aa-split': {name: 'Split', areas: ['title title', 'start end'], rows: ['auto', 1], regions: {start: {accepts: ['text']}, end: {accepts: ['image']}}}};
  const deck = {name: 'One template', language: 'ja', catalogs: {custom: {layouts: custom}, gallery: {source: defaultCatalog.source}}, slides: [{layout: 'pillars', title: '日本語の見出し', blocks: [{text: 'ひらがな'}]},
    {title: '日本語の見出し', text: 'カタカナ', design: {fontScheme: 'gallery:ms-mincho'}}]};
  const catalogs = [gallery2, defaultCatalog];
  const {bytes: output, entries: parts} = await exportDeck(deck, {catalogs});
  const masters = Object.keys(parts).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path)).sort();
  assert.equal(masters.length, 2, 'Two script profiles, two slide masters');
  const order = [...Object.keys(templates), ...Object.keys(defaultCatalog.layouts), 'aa-split', 'zz-notes'];
  for (const master of masters) {
    const listed = [...text(parts, master).matchAll(/<p:sldLayoutId id="\d+" r:id="([^"]+)"\/>/g)].map(match => resolvePart(master, relationships(parts, master).find(rel => rel.id === match[1]).target));
    assert.equal(layoutTag(parts, listed[0]), undefined, `${master} keeps its own layout first`);
    assert.deepEqual(listed.slice(1).map(path => layoutTag(parts, path).id).filter(id => id !== 'auto'), order, `${master} lists every reachable template in order`);
  }
  assert.equal(layoutParts(parts).length, 2 * (order.length + 1) + 1);
  assert.equal(layoutTag(parts, layoutOf(parts, 1)).id, 'pillars');
  assert.equal(layoutTag(parts, layoutOf(parts, 2)).id, 'auto', 'The automatic slide uses OPF auto');
  assert.notEqual(related(parts, layoutOf(parts, 1), 'slideMaster'), related(parts, layoutOf(parts, 2), 'slideMaster'));
  const {imported} = await read(output, {catalogs});
  assert.ok(isDeepStrictEqual(imported, deck), JSON.stringify(imported.catalogs));
  checked++;
}

// ---- 2c. A deck with a footer and a placed picture band: every layout placeholder sits at the region box the filled slide
// composes to (core composeLayoutAreas with the slide's options and placements), and cover and section titles at the heading parts.
{
  // An `auto` row is as tall as its content; on the empty layout it holds two body lines, so the text blocks here are two lines.
  // Cards on: each template's own design (comparison draws cards), then cards on every template; a carded auto row holds the card's
  // insets on the slide and on the empty layout alike.
  const band = {edge: 'left', size: 0.2}, twoLines = block => block.text !== undefined ? {text: 'First line.\nSecond line.'} : block;
  for (const contentBox of [undefined, true]) {
  const deck = {name: 'Bands', catalogs: {custom: {layouts: templates}}, design: {...(contentBox !== undefined ? {contentBox} : {}), footer: {left: {text: 'Board review'}, right: {text: '{{slide.number}}'}}},
    slides: contentSlides().map(slide => ({...slide, subtitle: 'Subtitle', blocks: [{image: {src: square}, placement: band}, ...(slide.blocks ?? []).map(twoLines)]}))};
  const {entries: parts} = await exportDeck(deck);
  const emu = value => Math.round(value * 9525), boxOf = box => [box.x, box.y, box.width, box.height].map(emu);
  let compared = 0;
  for (const [index, slide] of deck.slides.entries()) {
    const context = resolveSlideContext(deck, index, {});
    const geometry = composeSlide(context.slide, context.options);
    const shapes = placeholders(text(parts, layoutOf(parts, index + 1)));
    for (const region of geometry.regions) {
      assert.equal(region.collapsed, undefined, `${slide.layout}.${region.name} is filled`);
      assert.deepEqual(shapes.find(item => item.name === region.name).box, boxOf(region.box), `${slide.layout}.${region.name} (contentBox ${contentBox}): the placeholder is the slide's region box`);
      compared++;
    }
    const heading = geometry.headingAreas.find(area => area.name === 'title');
    const title = shapes.find(item => ['title', 'ctrTitle'].includes(item.type));
    assert.deepEqual(title.box, boxOf(['cover', 'section'].includes(slide.layout) ? heading.parts.title : heading.box), `${slide.layout}: the title placeholder`);
  }
  assert.ok(compared >= 35, `${compared} regions compared`);
  }
  checked++;
}

// ---- 3. A region pin round-trips (OPF_SLIDE_V1 records it); a custom template is one more layout.
const roadmap = {name: 'Roadmap review', catalogs: {custom: {layouts: {'roadmap-split': {name: 'Roadmap split', summary: 'A roadmap with notes over metrics beside it.',
  areas: ['title title', 'timeline notes', 'timeline metrics'], columns: [2, 1], rows: ['auto', 1, 1],
  regions: {timeline: {accepts: ['timeline'], role: 'primary', flow: 'none'}, notes: {accepts: ['text', 'list'], role: 'secondary', flow: 'column'}, metrics: {accepts: ['metric', 'text'], role: 'supporting', flow: 'grid'}}}}}},
  slides: [{layout: 'roadmap-split', title: '2027 roadmap', blocks: [{timeline: {events: [{when: 'Q1', what: 'Pilot'}, {when: 'Q2', what: 'Launch'}]}},
    {metric: {value: 12, label: 'Pilot customers'}}, {metric: {value: '94%', label: 'Retention'}}, {items: ['Hiring two engineers', 'Security review in Q1']},
    {region: 'metrics', text: 'Targets agreed with finance.'}]}]};
{
  const {bytes: output, entries: parts} = await exportDeck(roadmap);
  const layout = layoutOf(parts, 1);
  assert.equal(layoutTag(parts, layout).id, 'roadmap-split');
  assert.match(text(parts, layout), /<p:sldLayout\b[^>]*\btype="cust"/);
  assert.deepEqual(placeholders(text(parts, layout)).map(item => `${item.name}:${item.type}`).slice(0, 4), ['Title:title', 'timeline:obj', 'notes:body', 'metrics:obj']);
  const {imported} = await read(output);
  assert.ok(isDeepStrictEqual(imported, roadmap), JSON.stringify(imported.slides[0].blocks));
  checked++;
}

// ---- 4. A long list in columns: one shape per line in its column at core's breaks, numbering across columns, every item back.
{
  const items = Array.from({length: 14}, (_, index) => `Agenda item ${index + 1} with a few more words`);
  const deck = {name: 'Agenda', catalogs: {custom: {layouts: {agenda: templates.agenda}}}, slides: [{layout: 'agenda', title: 'Agenda', blocks: [{items, numbering: 'arabic'}]}]};
  const {bytes: output, entries: parts} = await exportDeck(deck);
  const lines = [...text(parts, 'ppt/slides/slide1.xml').matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => /name="OPF list slides\.0\.blocks\.0\.items line \d+"/.test(shape));
  assert.equal(lines.length, 14, 'Every item is drawn, not only the first column');
  const columns = [...new Set(lines.map(shape => Number(shape.match(/<a:off x="(-?\d+)"/)[1])))];
  assert.equal(columns.length, 2, 'Two columns');
  const starts = lines.map(shape => Number(shape.match(/startAt="(\d+)"/)?.[1] ?? 1));
  assert.deepEqual(starts, Array.from({length: 14}, (_, index) => index + 1), 'Numbering continues across the columns');
  assert.ok(!/numCol=/.test(text(parts, 'ppt/slides/slide1.xml')), 'No native multi-column body: core breaks the columns');
  const {imported} = await read(output);
  assert.ok(isDeepStrictEqual(imported, deck), JSON.stringify(imported.slides[0]));
  checked++;
}

// ---- 5. Change Layout in PowerPoint: the slide's layout relationship names another OPF layout. The relationship wins.
{
  const deck = {name: 'Change', catalogs: {custom: {layouts: {pillars: templates.pillars, text: templates.text}}},
    slides: [{layout: 'pillars', title: 'Three pillars', blocks: [{text: 'People'}, {text: 'Process'}, {text: 'Platform'}]}, {layout: 'text', title: 'Text', blocks: [{text: 'Body.'}]}]};
  const {entries: parts} = await exportDeck(deck);
  const target = layoutOf(parts, 2).replace(/^ppt\/slideLayouts\//, '../slideLayouts/');
  const changed = mutate(parts, {'ppt/slides/_rels/slide1.xml.rels': xml => xml.replace(/(Type="[^"]*\/slideLayout" Target=")[^"]*"/, `$1${target}"`)});
  const {imported, reports} = await read(changed);
  assert.equal(imported.slides[0].layout, 'text');
  assert.deepEqual(imported.slides[0].blocks, deck.slides[0].blocks, 'The content stays flat blocks the new layout binds');
  assert.ok(reports.some(item => item.code === 'layout-changed' && item.path === 'slides.0.layout'));
  checked++;
}

// ---- 6. A slide added in PowerPoint with an OPF layout: its title placeholder and the text typed into the `verdict` placeholder.
// Plain binding would put a lone text into `first`, so the block keeps its region with a pin. Placeholders carry no xfrm, and the
// untouched ones (`first`, `second`, a date, a text body with no paragraph) are prompts, not empty blocks.
{
  const deck = {name: 'New slide', catalogs: {custom: {layouts: {comparison: templates.comparison}}},
    slides: [{layout: 'comparison', title: 'Before and after', blocks: [{text: 'Before.'}, {text: 'After.'}, {text: 'Ship it.'}]}]};
  const {entries: parts} = await exportDeck(deck);
  const layout = layoutOf(parts, 1);
  const idxOf = name => placeholders(text(parts, layout)).find(item => item.name === name).idx, verdictIdx = idxOf('verdict');
  // The untouched placeholders PowerPoint copies onto a new slide: only <p:ph>, no xfrm, an empty text body (the prompt shows).
  const prompt = (id, name, ph) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
  const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    prompt(4, 'Content Placeholder 3', `<p:ph idx="${idxOf('first')}"/>`) + prompt(5, 'Content Placeholder 4', `<p:ph idx="${idxOf('second')}"/>`) +
    prompt(6, 'Date Placeholder 5', '<p:ph type="dt" sz="half" idx="10"/>') +
    `<p:sp><p:nvSpPr><p:cNvPr id="7" name="Empty Text Placeholder 6"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="${verdictIdx}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Added in PowerPoint</a:t></a:r></a:p></p:txBody></p:sp>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Text Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="${verdictIdx}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Typed into the verdict.</a:t></a:r></a:p></p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const added = mutate(parts, {
    'ppt/slides/slide2.xml': slide,
    'ppt/slides/_rels/slide2.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../${layout.replace(/^ppt\//, '')}"/></Relationships>`,
    'ppt/_rels/presentation.xml.rels': xml => xml.replace('</Relationships>', `<Relationship Id="rIdAdded" Type="${REL}/slide" Target="slides/slide2.xml"/></Relationships>`),
    'ppt/presentation.xml': xml => xml.replace('</p:sldIdLst>', '<p:sldId id="900" r:id="rIdAdded"/></p:sldIdLst>'),
    '[Content_Types].xml': xml => xml.replace('</Types>', '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'),
  });
  const {imported} = await read(added);
  assert.ok(isDeepStrictEqual(imported.slides[0], deck.slides[0]), 'The exported slide is unchanged');
  const {title, blocks, layout: added_layout} = imported.slides[1];
  assert.deepEqual({title, blocks, layout: added_layout}, {title: 'Added in PowerPoint', blocks: [{type: 'text', text: 'Typed into the verdict.', region: 'verdict'}], layout: 'comparison'});
  checked++;
}

// ---- 7. Without provenance the layout still comes back from the tagged slide layout.
{
  const deck = {name: 'Plain', catalogs: {custom: {layouts: {pillars: templates.pillars, quote: templates.quote}}},
    slides: [{layout: 'pillars', title: 'Pillars', blocks: [{text: 'One'}, {text: 'Two'}]}, {layout: 'quote', title: 'Quote', blocks: [{quote: {text: 'Less is more.'}}]}]};
  const {bytes: output} = await exportDeck(deck, {provenance: false});
  const {imported} = await read(output);
  assert.deepEqual(imported.slides.map(slide => slide.layout), ['pillars', 'quote']);
  checked++;
}

// ---- 8. RR-72 furniture: a slide that hides the footer uses a copy of its template layout (`Pillars (no furniture)`), with the
// placeholders and the OPF_LAYOUT_V1 tag; repeated footer text sits on the master. Import maps the copy back to its template.
{
  const deck = {name: 'Furniture', catalogs: {custom: {layouts: {pillars: templates.pillars, text: templates.text}}},
    design: {footer: {left: {text: 'Board review'}, right: {text: 'Confidential draft'}}},
    slides: [{layout: 'pillars', title: 'One', blocks: [{text: 'A'}, {text: 'B'}]}, {layout: 'text', title: 'Two', blocks: [{text: 'Body.'}]},
      {layout: 'pillars', title: 'Three', blocks: [{text: 'C'}], design: {footer: false}}, {title: 'Automatic', text: 'Composed automatically.'}]};
  const {bytes: output, entries: parts} = await exportDeck(deck);
  const third = layoutOf(parts, 3), first = layoutOf(parts, 1);
  assert.notEqual(third, first);
  assert.equal(text(parts, third).match(/<p:cSld name="([^"]*)"/)[1], 'Pillars (no furniture)');
  assert.match(text(parts, third), /showMasterSp="0"/);
  assert.deepEqual(layoutTag(parts, third), layoutTag(parts, first));
  assert.deepEqual(placeholders(text(parts, third)).map(item => item.name), placeholders(text(parts, first)).map(item => item.name));
  assert.ok(checkOrder(text(parts, third), third) > 5);
  assert.equal(layoutTag(parts, layoutOf(parts, 4)).id, 'auto', 'The automatic slide uses OPF auto');
  const {imported} = await read(output);
  assert.ok(isDeepStrictEqual(imported, deck), JSON.stringify(imported.slides.map(slide => [slide.layout, slide.design])));
  checked++;
}

// ---- 9. A damaged layout tag is reported and the layout read as foreign; the stored layout still restores.
{
  const deck = {name: 'Damaged', catalogs: {custom: {layouts: {pillars: templates.pillars}}}, slides: [{layout: 'pillars', title: 'One', blocks: [{text: 'A'}]}]};
  const {entries: parts} = await exportDeck(deck);
  const tagPath = Object.keys(parts).find(path => /^ppt\/tags\/opfLayout\d+\.xml$/.test(path));
  const {imported, reports} = await read(mutate(parts, {[tagPath]: xml => xml.replace(/val="[^"]+"/, 'val="7B7D"')}));
  assert.ok(reports.some(item => item.code === 'invalid-layout-provenance'));
  assert.ok(isDeepStrictEqual(imported, deck));
  checked++;
}

// ---- 10. Automatic slides use the dedicated OPF auto layout independently of host catalogs.
{
  const deck = {name: 'Classic', slides: [{title: 'Title', subtitle: 'Subtitle'}, {layout: 'auto', title: 'Text', text: 'Body.'}, {title: 'Auto', blocks: [{image: {src: square}}]}]};
  const {entries: parts} = await exportDeck(deck);
  assert.equal(layoutParts(parts).length, 2);
  assert.equal(layoutTag(parts, layoutOf(parts, 3)).id, 'auto');
  assert.match(text(parts, 'ppt/slides/slide3.xml'), /<p:ph type="title"\/>/);
  // Registering v2 templates exposes the templates and OPF auto on automatic slides. This is the intentional 0.19 contract.
  const registered = await exportDeck(deck, {catalogs: [gallery2, defaultCatalog]});
  assert.equal(layoutParts(registered.entries).length, 30);
  assert.equal(layoutTag(registered.entries, layoutOf(registered.entries, 3)).id, 'auto');
  checked++;
}

console.log(`Template layouts passed (${checked}): 28 templates as native slide layouts (placeholder per area, types, geometry, OPF_LAYOUT_V1, schema order), every reachable template in catalog order on every master, bound placeholder objects, embedded and registered round trips, region pins, list columns, Change Layout, a slide added in PowerPoint, no provenance, furniture variants, a damaged tag and automatic titleOnly layouts.`);
