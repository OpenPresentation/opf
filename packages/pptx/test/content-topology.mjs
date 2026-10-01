import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {contentTopology, rebuildContent, validateTopology, softWrappedLines, REGION_KEYS, MAX_GROUP_DEPTH} from '../dist/content-topology.js';
import {validatePresentation} from '@openpresentation/opf';

// Spec-gap closure P1: a slide's content structure (nested groups, promoted
// regions, the root payload form, block ids and extensions, group composition)
// survives export -> import through the OPF_SLIDE_V1 `content` record while
// the slide's arrangement is unchanged.
const enc = new TextEncoder(), dec = new TextDecoder();
const EXPORT = {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-30'};
const read = async (bytes, {strip = false} = {}) => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validatePresentation(deck).valid, true, JSON.stringify(validatePresentation(deck).errors));
  return {deck, issues, provenance: issues.filter(issue => /provenance|reference|structure|slide-id|block-id/.test(issue.code))};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const retag = (xml, mutate) => { const value = tagValue(xml); mutate(value); return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`); };
// Imported text carries resolved run styles; compare the words and the structure.
const words = value => JSON.parse(JSON.stringify(value, (key, item) => ['fontSize', 'fontFamily', 'color'].includes(key) ? undefined : item));
const content = slide => { const {title, design, ...rest} = slide; return words(rest); };
const slideRecord = (bytes, index = 1) => tagValue(dec.decode(unzipSync(bytes)[`ppt/tags/opfSlide${index}.xml`]));
const roundTrip = async slide => {
  const bytes = await toPptx({name: 'Topology', slides: [{title: 'Probe', ...slide}]}, EXPORT);
  const {deck, provenance} = await read(bytes);
  return {bytes, slide: deck.slides[0], provenance, record: slideRecord(bytes)};
};

// Every form returns as authored: nested groups, each region family, ids,
// extensions, group composition, and the root payload with its slide type.
{
  const cases = {
    'nested group': {blocks: [{type: 'group', blocks: [{type: 'text', text: 'Inner A'}, {type: 'text', text: 'Inner B'}]}, {type: 'text', text: 'Outer'}]},
    '3-deep group': {blocks: [{type: 'group', blocks: [{type: 'group', blocks: [{type: 'group', blocks: [{type: 'text', text: 'Deep A'}, {type: 'text', text: 'Deep B'}]}]}]}]},
    'block id and extensions': {blocks: [{id: 'b1', type: 'text', text: 'Block one', extensions: {'x-a': 1}}, {type: 'text', text: 'Block two'}]},
    'group id, extensions and composition': {blocks: [{type: 'group', id: 'g1', extensions: {'x-g': true}, composition: {mode: 'column', weights: [1, 2]}, blocks: [{type: 'text', text: 'a'}, {type: 'text', text: 'b'}]}]},
    'regions left/right': {left: {text: 'Left'}, right: {text: 'Right'}},
    'regions left/center/right': {left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}},
    'regions top/middle/bottom': {top: {text: 'T'}, middle: {text: 'M'}, bottom: {text: 'B'}},
    'regions spanning': {'left+center': {text: 'Wide'}, right: {text: 'R'}},
    'regions 2-D': {'top:left': {text: 'TL'}, 'top:right': {text: 'TR'}, 'bottom:left': {text: 'BL'}, 'bottom:right': {text: 'BR'}},
    'region holding a group': {left: {type: 'group', blocks: [{type: 'text', text: 'g1'}, {type: 'text', text: 'g2'}]}, right: {text: 'R'}},
    'region host id': {left: {id: 'host', text: 'L', extensions: {'x-h': 1}}, right: {text: 'R'}},
    'root text with type': {type: 'text', text: 'Body'},
    'root list': {items: ['one', 'two']},
    'slide extensions': {extensions: {'x-vendor': {a: 1}}, text: 'Body'},
    'side-by-side lists': {blocks: [{type: 'list', items: ['a', 'b']}, {type: 'list', items: ['c', 'd']}]},
    'every payload kind': {blocks: [{type: 'text', text: 'Para'}, {type: 'list', items: ['a', 'b']}, {type: 'quote', quote: 'Q'}, {type: 'metric', metric: '42'}, {type: 'code', code: 'x = 1'},
      {type: 'timeline', timeline: [{when: '2024', what: 'Founded'}]}, {type: 'chart', chart: {type: 'column', data: {columns: ['a', 'b'], rows: [['x', 1]]}}}]}
  };
  for (const [name, source] of Object.entries(cases)) {
    const {slide, provenance, record} = await roundTrip(source);
    assert.deepEqual(provenance, [], name);
    assert.ok(record.content, `${name}: content stored`);
    const expected = words({...source});
    const actual = content(slide);
    // Payload values are the imported native ones; structure, keys, ids, extensions and composition must match.
    const shape = value => JSON.parse(JSON.stringify(value, (key, item) => {
      if (['text', 'items', 'quote', 'metric', 'code', 'timeline', 'chart', 'table', 'image', 'video'].includes(key)) return key;
      return item;
    }));
    assert.deepEqual(shape(actual), shape(expected), name);
    if (!/payload kind|root list|side-by-side/.test(name)) assert.deepEqual(actual, expected, name);
  }
  // Lists rejoin their list leaf: native lines interleave in reading order when two lists sit side by side.
  const lists = await roundTrip(cases['side-by-side lists']);
  assert.deepEqual(lists.slide.blocks.map(block => block.items.map(item => item[0].text)), [['a', 'b'], ['c', 'd']]);
  // The record stores only structure and boxes, never words.
  const record = (await roundTrip(cases['nested group'])).record;
  assert.deepEqual(record.content.form, 'blocks');
  assert.equal(JSON.stringify(record.content).includes('Inner'), false);
  assert.ok(record.content.blocks[0].blocks[0].box.every(number => typeof number === 'number'));
}

// The slide type is restored with the content form; without the form it would not validate.
{
  const {slide, provenance} = await roundTrip({type: 'text', text: 'Body'});
  assert.deepEqual(provenance, []);
  assert.equal(slide.type, 'text');
  assert.equal(slide.text, 'Body');
  assert.equal(slide.blocks, undefined);
}

// Root shorthand with several payloads composes one item per field: each returns as its own root field (F3).
{
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const chart = {type: 'column', data: {columns: ['a', 'b'], rows: [['x', 1], ['y', 2]]}};
  for (const [name, source] of Object.entries({'text and chart': {text: 'Body', chart}, 'text and image': {text: 'Body', image: {src: png, alt: 'Dot'}}, 'three payloads': {text: 'Body', chart, items: ['one', 'two']}})) {
    const {slide, provenance, record} = await roundTrip(source);
    assert.deepEqual(provenance, [], name);
    assert.equal(record.content.form, 'root', name);
    assert.deepEqual(record.content.fields.map(item => item.field).sort(), Object.keys(source).sort(), name);
    assert.ok(record.content.fields.every(item => Array.isArray(item.box)), name);
    assert.equal(slide.blocks, undefined, name);
    assert.equal(slide.text, 'Body', name);
    if (source.chart) assert.deepEqual(words(slide.chart).data, chart.data, name);
    if (source.image) assert.deepEqual(slide.image, source.image, name);
    if (source.items) assert.deepEqual(slide.items.map(item => item[0].text), ['one', 'two'], name);
  }
}

// A root `bullets` payload takes its key back (the importer names every list `items`), typed or not (F5).
{
  const typed = await roundTrip({type: 'text', bullets: ['one', 'two']});
  assert.deepEqual(typed.provenance, []);
  assert.equal(typed.slide.type, 'text');
  assert.deepEqual(typed.slide.bullets.map(item => item[0].text), ['one', 'two']);
  assert.equal(typed.slide.items, undefined);
  const untyped = await roundTrip({bullets: ['one', 'two']});
  assert.deepEqual(untyped.provenance, []);
  assert.deepEqual(untyped.slide.bullets.map(item => item[0].text), ['one', 'two']);
  assert.equal(untyped.slide.items, undefined);
  assert.equal(untyped.slide.type, undefined);
}

// Ids: any schema string up to 256 characters round-trips (the empty string included);
// a longer one leaves the topology unstored at export and is rejected at import (F2).
{
  const short = await roundTrip({blocks: [{id: '', type: 'text', text: 'A'}, {id: 'x'.repeat(256), type: 'text', text: 'B'}]});
  assert.deepEqual(short.provenance, []);
  assert.deepEqual(short.slide.blocks.map(block => block.id), ['', 'x'.repeat(256)]);
  const issues = [];
  const long = await toPptx({name: 'Long id', tone: 'formal', slides: [{title: 'Probe', blocks: [{id: 'y'.repeat(300), type: 'text', text: 'A'}, {type: 'text', text: 'B'}]}]}, {...EXPORT, onDiagnostic: issue => issues.push(issue)});
  const omitted = issues.filter(issue => issue.code === 'document-provenance-omitted');
  assert.deepEqual(omitted.map(issue => issue.path), ['slides.0.content']);
  assert.match(omitted[0].message, /blocks\.0\.id is longer than 256 characters/);
  assert.equal(slideRecord(long).content, undefined);
  const {deck, provenance} = await read(long);
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['document-provenance-omitted', 'slides.0.content']]);
  assert.equal(deck.tone, 'formal');
  assert.equal(deck.slides[0].blocks.length, 2);
  const tampered = modify(short.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.blocks[0].id = 'z'.repeat(257); })));
  assert.deepEqual((await read(tampered)).provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0']]);
}

// Edited geometry: a moved object changes the slide's structure, so the stored
// topology is not applied and the slide keeps its flat blocks (with the
// existing slide-reference-changed for `type`).
{
  const source = {blocks: [{type: 'group', id: 'g', blocks: [{type: 'text', text: 'A'}, {type: 'text', text: 'B'}]}]};
  const bytes = await toPptx({name: 'Edited', slides: [{title: 'Probe', ...source}, {title: 'Typed', type: 'text', text: 'Body'}]}, EXPORT);
  const move = xml => xml.replace(/(<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<a:off x=")(\d+)"/g, (_, before, x) => `${before}${Number(x) + 25400}"`);
  const moved = modify(bytes, entries => { text(entries, 'ppt/slides/slide1.xml', move); text(entries, 'ppt/slides/slide2.xml', move); });
  const {deck, provenance} = await read(moved);
  assert.equal(deck.slides[0].blocks.every(block => block.type === 'text'), true, 'Flat blocks stay.');
  assert.deepEqual(deck.slides[1].blocks.map(block => block.type), ['text']);
  assert.equal(deck.slides[1].type, undefined);
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['slide-reference-changed', 'slides.0.content'], ['slide-reference-changed', 'slides.1.content'], ['slide-reference-changed', 'slides.1.type']]);
}

// Stored boxes that no longer contain a block, or hold several, abort the
// rebuild for that slide only and report content-structure-changed.
{
  const bytes = await toPptx({name: 'Boxes', slides: [{title: 'Probe', left: {text: 'L'}, right: {text: 'R'}}, {title: 'Two', left: {text: 'L2'}, right: {text: 'R2'}}]}, EXPORT);
  const shrunk = modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.regions.right.box = [0, 0, 1, 1]; })));
  const one = await read(shrunk);
  assert.deepEqual(one.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']]);
  assert.equal(one.deck.slides[0].left, undefined);
  assert.equal(one.deck.slides[0].blocks.length, 2);
  assert.deepEqual(Object.keys(one.deck.slides[1]).filter(key => /left|right/.test(key)), ['left', 'right'], 'Other slides still rebuild.');
  const crowded = modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.regions.left.box = [0, 0, 1300, 740]; delete value.content.regions.right.box; })));
  const two = await read(crowded);
  assert.deepEqual(two.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']]);
  assert.match(two.provenance[0].message, /2 blocks lie in one stored content box/);
}

// The stored slide `type` belongs to the authored form: when the structure hash
// still matches but the rebuild fails, the type is not put back on the flat blocks.
{
  const bytes = await toPptx({name: 'Typed boxes', slides: [{title: 'Probe', type: 'text', text: 'Body'}]}, EXPORT);
  const broken = modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.box = [0, 0, 1, 1]; })));
  const {deck, provenance} = await read(broken);
  assert.equal(deck.slides[0].type, undefined, 'No type on the flat blocks.');
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']]);
  assert.match(provenance[0].message, /stored slide type "text" was not restored either/);
}

// A damaged record rejects the slide tag as a whole; nothing else is lost.
{
  const bytes = await toPptx({name: 'Damaged', tone: 'formal', slides: [{title: 'Probe', id: 'one', left: {text: 'L'}, right: {text: 'R'}}]}, EXPORT);
  for (const [name, mutate] of Object.entries({
    'unknown region key': value => { value.content.regions['sideways:up'] = value.content.regions.left; },
    'unknown form': value => { value.content.form = 'tree'; },
    'unknown kind': value => { value.content.regions.left.k = 'script'; },
    'bad box': value => { value.content.regions.left.box = ['1', 2, 3]; },
    'too deep': value => { let node = value.content.regions.left; for (let depth = 0; depth <= MAX_GROUP_DEPTH; depth += 1) node = {t: 'group', blocks: [node]}; value.content.regions.left = node; },
    'too many nodes': value => { value.content = {form: 'blocks', blocks: Array.from({length: 300}, () => ({t: 'leaf', k: 'text'}))}; },
    'bad section': value => { value.section = 42; },
    'bad extensions': value => { value.extensions = []; }
  })) {
    const damaged = modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate)));
    const {deck, provenance} = await read(damaged);
    assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0']], name);
    assert.equal(deck.slides[0].id, undefined, name);
    assert.equal(deck.tone, 'formal', name);
    assert.equal(deck.slides[0].blocks.length, 2, name);
  }
}

// Duplicated slides: PowerPoint copies the tag, block ids stay unique.
{
  const bytes = await toPptx({name: 'Duplicate', slides: [{title: 'Probe', id: 'one', blocks: [{id: 'b1', type: 'text', text: 'A'}, {type: 'group', id: 'g1', blocks: [{type: 'text', text: 'B'}]}]}]}, EXPORT);
  const duplicated = modify(bytes, entries => {
    entries['ppt/slides/slide2.xml'] = entries['ppt/slides/slide1.xml'];
    entries['ppt/slides/_rels/slide2.xml.rels'] = enc.encode(dec.decode(entries['ppt/slides/_rels/slide1.xml.rels']).replace(/opfSlide1\.xml/, 'opfSlide2.xml'));
    entries['ppt/tags/opfSlide2.xml'] = entries['ppt/tags/opfSlide1.xml'];
    text(entries, '[Content_Types].xml', xml => xml.replace('</Types>', '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/tags/opfSlide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>'));
    text(entries, 'ppt/_rels/presentation.xml.rels', xml => xml.replace('</Relationships>', '<Relationship Id="rIdCopy" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>'));
    text(entries, 'ppt/presentation.xml', xml => xml.replace('</p:sldIdLst>', '<p:sldId id="400" r:id="rIdCopy"/></p:sldIdLst>'));
  });
  const {deck, provenance} = await read(duplicated);
  assert.deepEqual(deck.slides.map(slide => [slide.id, slide.blocks[0].id, slide.blocks[1].id]), [['one', 'b1', 'g1'], [undefined, undefined, undefined]]);
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['duplicate-slide-id', 'slides.1.id'], ['duplicate-block-id', 'slides.1.blocks.0.id'], ['duplicate-block-id', 'slides.1.blocks.1.id']]);
  assert.equal(deck.slides[1].blocks[1].type, 'group', 'The structure still returns.');
}

// Without the document tag, slide records still rebuild their content (a pasted slide keeps its groups).
{
  const bytes = await toPptx({name: 'Pasted', tone: 'formal', slides: [{title: 'Probe', left: {type: 'group', blocks: [{type: 'text', text: 'g1'}, {type: 'text', text: 'g2'}]}, right: {text: 'R'}}]}, EXPORT);
  const stripped = modify(bytes, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, '')));
  const {deck, provenance} = await read(stripped);
  assert.deepEqual(provenance, []);
  assert.equal(deck.tone, undefined);
  assert.deepEqual(content(deck.slides[0]), {left: {type: 'group', blocks: [{type: 'text', text: 'g1'}, {type: 'text', text: 'g2'}]}, right: {text: 'R'}});
}

// Modes: 'references-only' and false store no topology; a deck that states
// nothing but content still gets slide tags; deeper nesting is reported, not stored.
{
  const slide = {title: 'Probe', blocks: [{type: 'group', blocks: [{type: 'text', text: 'A'}]}]};
  const refs = unzipSync(await toPptx({name: 'Modes', design: {fontScheme: 'arial'}, slides: [slide]}, {...EXPORT, provenance: 'references-only'}));
  assert.equal(tagValue(dec.decode(refs['ppt/tags/opfSlide1.xml'])).content, undefined);
  const none = unzipSync(await toPptx({name: 'Modes', slides: [slide]}, {...EXPORT, provenance: false}));
  assert.equal(none['ppt/tags/opfSlide1.xml'], undefined);
  const plain = unzipSync(await toPptx({name: 'Modes', slides: [slide]}, EXPORT));
  assert.ok(plain['ppt/tags/opfSlide1.xml'], 'Content topology alone is worth a slide tag.');
  assert.ok(plain['ppt/tags/opfDocument.xml'], 'The document tag carries the native evidence.');
  const empty = unzipSync(await toPptx({name: 'Modes', slides: [{title: 'Only a title'}]}, EXPORT));
  assert.equal(Object.keys(empty).some(path => /opfDocument|opfSlide/.test(path)), false, 'A deck without content states nothing.');
  let deep = {type: 'text', text: 'Deep'};
  for (let depth = 0; depth <= MAX_GROUP_DEPTH; depth += 1) deep = {type: 'group', blocks: [deep]};
  const issues = [];
  const tooDeep = unzipSync(await toPptx({name: 'Deep', tone: 'formal', slides: [{title: 'Probe', blocks: [deep]}]}, {...EXPORT, onDiagnostic: issue => issues.push(issue)}));
  assert.deepEqual(issues.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['slides.0.content']);
  assert.equal(tagValue(dec.decode(tooDeep['ppt/tags/opfSlide1.xml'])).content, undefined);
}

// Unit contract of the record builder, validator and rebuilder.
{
  assert.equal(REGION_KEYS.length, 48);
  const slide = {title: 'T', blocks: [{type: 'group', id: 'g', composition: {mode: 'row'}, blocks: [{type: 'text', text: 'a', id: 'a'}]}, {image: 'data:image/png;base64,AA=='}]};
  const items = [{path: 'slides.2.blocks.0.blocks.0.text', box: {x: 1.26, y: 2, width: 3, height: 4}}, {path: 'slides.2.blocks.1.image', box: {x: 5, y: 6, width: 7, height: 8}}];
  const topology = contentTopology(slide, items, 2);
  assert.deepEqual(topology, {form: 'blocks', blocks: [{t: 'group', id: 'g', typed: true, comp: {mode: 'row'}, blocks: [{t: 'leaf', k: 'text', id: 'a', typed: true, box: [1.3, 2, 3, 4]}]}, {t: 'leaf', k: 'image', box: [5, 6, 7, 8]}]});
  assert.deepEqual(validateTopology(topology), topology);
  assert.equal(contentTopology({title: 'T'}, [], 0), undefined);
  assert.equal(contentTopology({title: 'T', blocks: []}, [], 0), undefined);
  const reasons = [];
  assert.equal(contentTopology({title: 'T', blocks: [{type: 'shape'}]}, [], 0, reason => reasons.push(reason)), undefined);
  assert.match(reasons[0], /no known content payload/);
  assert.throws(() => validateTopology({form: 'regions', regions: {__proto__: {}, 'left': {t: 'leaf', k: 'text'}, 'up:down': {t: 'leaf', k: 'text'}}}), /Unknown region key/);
  assert.throws(() => validateTopology({form: 'blocks', blocks: [{t: 'leaf', k: 'text', comp: {}}]}), /no composition/);
  assert.throws(() => validateTopology({form: 'blocks', blocks: [{t: 'leaf', k: 'text', id: 'x'.repeat(300)}]}), /node id/);
  // Rebuild: the smallest containing box wins; a leaf without a block is dropped; a stray block aborts.
  const blocks = [{type: 'text', text: 'outer'}, {type: 'text', text: 'inner'}];
  const nested = {form: 'blocks', blocks: [{t: 'group', typed: true, blocks: [{t: 'leaf', k: 'text', typed: true, box: [0, 0, 100, 100]}, {t: 'leaf', k: 'text', typed: true, box: [10, 10, 20, 20]}]}, {t: 'leaf', k: 'text', box: [500, 500, 10, 10]}]};
  const rebuilt = rebuildContent(nested, blocks, [{x: 0, y: 0, width: 100, height: 100}, {x: 11, y: 11, width: 18, height: 18}]);
  assert.deepEqual(rebuilt, {fields: {blocks: null, ...{blocks: [{type: 'group', blocks: [{type: 'text', text: 'outer'}, {type: 'text', text: 'inner'}]}]}}, ids: []});
  assert.match(rebuildContent(nested, blocks, [{x: 0, y: 0, width: 100, height: 100}, {x: 300, y: 300, width: 5, height: 5}]).reason, /lies in no stored content box/);
  // Overflowing content starts inside its box: the origin decides when no box contains the whole block.
  assert.deepEqual(rebuildContent(nested, blocks, [{x: 0, y: 0, width: 100, height: 100}, {x: 12, y: 12, width: 80, height: 400}]).fields.blocks[0].blocks.length, 2);
  assert.match(rebuildContent(nested, blocks, [{x: 0, y: 0, width: 100, height: 100}, null]).reason, /no native bounds/);
  assert.match(rebuildContent(nested, blocks, [{x: 0, y: 0, width: 100, height: 100}]).reason, /no native bounds/);
  // A root payload removes `blocks` and spreads the imported payload.
  assert.deepEqual(rebuildContent({form: 'root', field: 'text', box: [0, 0, 10, 10]}, [{type: 'text', text: 'hi'}], [{x: 1, y: 1, width: 2, height: 2}]), {fields: {blocks: null, text: 'hi'}, ids: []});
  assert.deepEqual(rebuildContent({form: 'root', field: 'text', box: [0, 0, 10, 10]}, [], []), {fields: {blocks: null}, ids: []});
}


// Wrapped text: a rich-text `text` payload that wraps exports one native line shape per soft wrap
// (no names, no tags) and imports as one text block per line. The record counts the lines, so the
// authored payload returns: runs concatenated in order, the wrap not turned into a break.
{
  const long = 'The quick brown fox jumps over the lazy dog and keeps running across the wide open field until the sun sets behind the distant hills and everyone goes home, and then it sleeps.';
  const runs = [{text: 'Bold start ', bold: true}, {text: long}, {text: ' Italic end.', italic: true}];
  const styled = value => JSON.parse(JSON.stringify(value, (key, item) => ['fontSize', 'fontFamily', 'color'].includes(key) ? undefined : item));
  // Rich-text root: several native lines, one authored payload, no diagnostic.
  const root = await roundTrip({text: runs});
  assert.deepEqual(root.provenance, []);
  assert.ok(root.record.content.lines >= 2, 'The record counts the exported lines.');
  assert.equal(root.record.content.form, 'root');
  assert.equal(JSON.stringify(root.record.content).includes('quick'), false, 'Still no words in the record.');
  assert.equal(root.slide.blocks, undefined);
  assert.deepEqual(styled(root.slide.text), runs);
  // The count is the number of native line shapes.
  const shapes = [...dec.decode(unzipSync(root.bytes)['ppt/slides/slide1.xml']).matchAll(/<p:cNvPr id="\d+" name="Text \d+"/g)];
  assert.equal(shapes.length, root.record.content.lines);
  // A plain string root already returns whole through its tagged lines.
  const plain = await roundTrip({text: long});
  assert.deepEqual(plain.provenance, []);
  assert.equal(plain.slide.text, long);
  // A wrapped text inside a nested group and inside a promoted region, beside unwrapped siblings.
  const group = await roundTrip({blocks: [{type: 'group', id: 'g', blocks: [{type: 'text', text: runs}, {type: 'text', text: 'Short'}]}, {type: 'text', text: 'Outer'}]});
  assert.deepEqual(group.provenance, []);
  assert.equal(group.record.content.blocks[0].blocks[0].lines >= 2, true);
  assert.equal(group.record.content.blocks[0].blocks[1].lines, undefined);
  assert.deepEqual(styled(group.slide.blocks[0].blocks[0].text), runs);
  assert.deepEqual(group.slide.blocks[0].blocks.slice(1).map(block => block.text), ['Short']);
  assert.equal(group.slide.blocks[0].id, 'g');
  assert.equal(group.slide.blocks[1].text, 'Outer');
  const region = await roundTrip({left: {text: runs}, right: {text: 'Right'}});
  assert.deepEqual(region.provenance, []);
  assert.ok(region.record.content.regions.left.lines >= 3);
  assert.deepEqual(styled(region.slide.left.text), runs);
  assert.equal(region.slide.right.text, 'Right');
  assert.equal(region.slide.blocks, undefined);
  // With an id and extensions: the leaf identity comes back with the rejoined payload.
  const typed = await roundTrip({blocks: [{id: 'body', type: 'text', text: runs, extensions: {'x-a': 1}}, {type: 'text', text: 'Next'}]});
  assert.deepEqual(typed.provenance, []);
  assert.deepEqual([typed.slide.blocks[0].id, typed.slide.blocks[0].type, typed.slide.blocks[0].extensions], ['body', 'text', {'x-a': 1}]);
  assert.deepEqual(styled(typed.slide.blocks[0].text), runs);
  // Single-line rich text carries no count.
  const single = await roundTrip({text: [{text: 'Short ', bold: true}, {text: 'line'}]});
  assert.equal(single.record.content.lines, undefined);
  assert.deepEqual(single.provenance, []);
  // A hard break between lines is not a soft wrap: nothing is marked, the lines are not joined and the
  // slide keeps its flat blocks with the existing diagnostic (no newline is invented or dropped).
  const hard = await roundTrip({text: [{text: 'First paragraph', bold: true}, {text: `\nSecond ${long}`}]});
  assert.equal(hard.record.content.lines, undefined);
  assert.deepEqual(hard.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']]);
  assert.equal(hard.slide.text, undefined);
  assert.ok(hard.slide.blocks.length >= 3);
  assert.deepEqual(styled(hard.slide.blocks[0].text), [{text: 'First paragraph', bold: true}]);
  // An edited deck: a deleted line changes the slide's shapes, so the stored structure is not applied
  // (and nothing is rejoined from the lines that remain).
  const lineName = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="Text 2"[\s\S]*?<\/p:sp>/;
  const deleted = modify(root.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => { assert.match(xml, lineName); return xml.replace(lineName, ''); }));
  const edited = await read(deleted);
  assert.deepEqual(edited.provenance.map(issue => [issue.code, issue.path]), [['slide-reference-changed', 'slides.0.content']]);
  assert.equal(edited.deck.slides[0].text, undefined);
  assert.equal(edited.deck.slides[0].blocks.length, root.record.content.lines - 1);
  // A record whose count no longer matches the lines reports and keeps the flat blocks.
  for (const lines of [root.record.content.lines + 1, root.record.content.lines - 1].filter(count => count >= 2)) {
    const mismatch = modify(root.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.lines = lines; })));
    const result = await read(mismatch);
    assert.deepEqual(result.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']], `count ${lines}`);
    assert.match(result.provenance[0].message, new RegExp(`${root.record.content.lines} blocks lie in one stored content box`));
    assert.equal(result.deck.slides[0].text, undefined);
    assert.equal(result.deck.slides[0].blocks.length, root.record.content.lines);
  }
  // Edited text keeps its place: the current native words return, joined in order.
  const retyped = modify(root.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('open field', 'closed field')));
  const retypedResult = await read(retyped);
  assert.deepEqual(retypedResult.provenance, []);
  assert.equal(retypedResult.deck.slides[0].text.map(run => run.text).join('').includes('closed field'), true);
  // Damaged counts reject the slide tag as a whole.
  for (const [name, mutate] of Object.entries({
    'one line': value => { value.content.lines = 1; },
    'fraction': value => { value.content.lines = 2.5; },
    'string': value => { value.content.lines = '2'; },
    'huge': value => { value.content.lines = 100000; },
    'not text': value => { value.content.field = 'items'; }
  })) {
    const damaged = await read(modify(root.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate))));
    assert.deepEqual(damaged.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0']], name);
  }
  assert.throws(() => validateTopology({form: 'blocks', blocks: [{t: 'leaf', k: 'list', lines: 2}]}), /wrapped line count/);
  assert.throws(() => validateTopology({form: 'root', fields: [{field: 'items', lines: 2}]}), /root payload fields/);
  assert.equal(validateTopology({form: 'blocks', blocks: [{t: 'leaf', k: 'text', lines: 2, box: [0, 0, 1, 1]}]}).blocks[0].lines, 2);
}

// Unit contract of the soft-wrap count and the rejoin.
{
  const item = (value, lines) => ({field: 'text', value, text: {richLines: lines.map(parts => ({fragments: parts.map(part => ({text: part}))}))}});
  const runs = [{text: 'Hello '}, {text: 'bold world ', bold: true}, {text: 'again'}];
  assert.equal(softWrappedLines(item(runs, [['Hello ', 'bold '], ['world ', 'aga'], ['in']])), 3);
  assert.equal(softWrappedLines(item('abc def', [['abc '], ['def']])), 2);
  assert.equal(softWrappedLines(item('abc def', [['abc def']])), undefined, 'One line carries no count.');
  assert.equal(softWrappedLines(item('abc\ndef', [['abc'], ['def']])), undefined, 'A dropped newline is a hard break.');
  assert.equal(softWrappedLines(item('abc  def', [['abc '], ['def']])), undefined, 'Collapsed whitespace is not a soft wrap.');
  assert.equal(softWrappedLines(item('abc def', [['abc '], ['de']])), undefined, 'Dropped characters at the end.');
  assert.equal(softWrappedLines(item('abc def', [['abc '], [], ['def']])), undefined, 'A blank line.');
  assert.equal(softWrappedLines({...item('abc def', [['abc '], ['def']]), field: 'quote'}), undefined);
  assert.equal(softWrappedLines(item([{text: 1}], [['1'], ['2']])), undefined);
  // Rejoin: runs a wrap cut in two merge at the seam; other runs stay.
  const at = y => ({x: 0, y, width: 100, height: 10});
  const leaf = {form: 'root', field: 'text', box: [0, 0, 100, 100], lines: 3};
  const lines = [{type: 'text', text: [{text: 'Hello ', fontSize: 12}, {text: 'bold ', bold: true, fontSize: 12}]}, {type: 'text', text: [{text: 'world ', bold: true, fontSize: 12}, {text: 'again', fontSize: 12}]}, {type: 'text', text: [{text: ' and more', fontSize: 12}]}];
  assert.deepEqual(rebuildContent(leaf, lines, [at(0), at(10), at(20)]).fields.text, [{text: 'Hello ', fontSize: 12}, {text: 'bold world ', bold: true, fontSize: 12}, {text: 'again and more', fontSize: 12}]);
  // Reading order within the leaf is the top-to-bottom order of the lines, whatever order the blocks arrived in.
  assert.deepEqual(rebuildContent(leaf, [lines[1], lines[2], lines[0]], [at(10), at(20), at(0)]).fields.text.map(run => run.text), ['Hello ', 'bold world ', 'again and more']);
  assert.equal(rebuildContent({...leaf, lines: 2}, [{type: 'text', text: 'abc '}, {type: 'text', text: 'def'}], [at(0), at(10)]).fields.text, 'abc def');
  assert.deepEqual(rebuildContent({...leaf, lines: 2}, [{type: 'text', text: [{text: 'abc '}]}, {type: 'text', text: 'def'}], [at(0), at(10)]).fields.text, [{text: 'abc def'}]);
  // Not provable: a different count, an unmarked leaf, a list block, or a payload that is not text keeps the reason.
  assert.match(rebuildContent({...leaf, lines: 2}, lines, [at(0), at(10), at(20)]).reason, /3 blocks lie in one stored content box/);
  assert.match(rebuildContent({...leaf, lines: undefined}, lines, [at(0), at(10), at(20)]).reason, /3 blocks lie in one stored content box/);
  assert.match(rebuildContent({...leaf, lines: 2}, [lines[0], {type: 'list', items: ['x']}], [at(0), at(10)]).reason, /2 blocks lie in one stored content box/);
  assert.match(rebuildContent({...leaf, lines: 2}, [lines[0], {type: 'text', text: 5}], [at(0), at(10)]).reason, /2 blocks lie in one stored content box/);
}

console.log('Content topology passed: nested groups, every region family, block ids and extensions, group composition, root payloads with slide type, side-by-side lists, rich text that wraps over several native lines (root, group, region), edited geometry, box mismatches, damaged records, duplicated slides, pasted slides, provenance modes and the record contract.');
