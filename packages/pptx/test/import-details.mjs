import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// RR-08 import details: author arrays, run ColorRef colours (variable, scheme slot, role), list item descriptions and
// the `bullets` key come back as authored, from the stored record while the package still matches it and, where PPTX
// itself names the value (a theme slot, an author list), from plain PPTX too. Nothing is restored that the current
// native value no longer agrees with.
const enc = new TextEncoder(), dec = new TextDecoder();
const EXPORT = {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-30'};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const retag = (xml, mutate) => { const value = tagValue(xml); mutate(value); return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`); };
const slideRecord = (bytes, index = 1) => tagValue(dec.decode(unzipSync(bytes)[`ppt/tags/opfSlide${index}.xml`]));
const stripTags = bytes => {
  const kept = {};
  for (const [name, data] of Object.entries(unzipSync(bytes))) {
    if (/^ppt\/tags\//.test(name)) continue;
    if (name === '[Content_Types].xml') kept[name] = enc.encode(dec.decode(data).replace(/<Override [^>]*tags\+xml"[^>]*\/>/g, ''));
    else if (/\.rels$/.test(name)) kept[name] = enc.encode(dec.decode(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, ''));
    else if (/\.xml$/.test(name)) kept[name] = enc.encode(dec.decode(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
    else kept[name] = data;
  }
  return zipSync(kept);
};
// What PowerPoint changes when it saves a deck: shape ids are renumbered, run properties gain editing attributes, the XML
// is reserialised; names, geometry, tags, text and colours stay.
const resave = bytes => modify(bytes, entries => {
  for (const path of Object.keys(entries).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) text(entries, path, xml => {
    let id = 40;
    return xml.replace(/<p:cNvPr id="\d+"/g, () => `<p:cNvPr id="${id++}"`).replace(/<a:rPr /g, '<a:rPr dirty="0" err="0" ').replace(/<\?xml[^>]*\?>/, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n').replace(/></g, '>\n<');
  });
});
const read = async bytes => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validate(deck, {only: ['format']}).valid, true, JSON.stringify(validate(deck, {only: ['format']}).findings));
  return {deck, issues, codes: issues.map(issue => issue.code)};
};
const exportDeck = (document, options = {}) => toPptx({name: 'Details', ...document}, {...EXPORT, ...options});
const noFont = value => JSON.parse(JSON.stringify(value, (key, item) => ['fontSize', 'fontFamily'].includes(key) ? undefined : item));
const withoutColors = value => JSON.parse(JSON.stringify(value, (key, item) => ['fontSize', 'fontFamily', 'color'].includes(key) ? undefined : item));
let checked = 0;

// --- 1. author ----------------------------------------------------------------------------------------------------
{
  const authored = [['Ann Lee', 'Bo Chan'], 'Ann Lee', 'Ann; Bo', ['Solo'], ['A; B', 'C'], 'Ann;'];
  for (const author of authored) {
    const bytes = await exportDeck({author, slides: [{title: 'T', text: 'x'}]});
    assert.match(dec.decode(unzipSync(bytes)['docProps/core.xml']), /<dc:creator>/);
    // With provenance the authored form returns exactly (a string stays a string, an array stays an array).
    assert.deepEqual((await read(resave(bytes))).deck.author, author, JSON.stringify(author));
    assert.deepEqual((await read(bytes)).codes.filter(code => /metadata|invalid/.test(code)), []);
    checked++;
  }
  // Plain PPTX: only an unambiguous "; " list splits; a single name or a trailing separator is never cut.
  const plain = async author => (await read(stripTags(await exportDeck({author, slides: [{title: 'T', text: 'x'}]})))).deck.author;
  assert.deepEqual(await plain(['Ann Lee', 'Bo Chan', 'Cy Doe']), ['Ann Lee', 'Bo Chan', 'Cy Doe']);
  assert.equal(await plain('Ann Lee'), 'Ann Lee');
  assert.equal(await plain('Ann;'), 'Ann;');
  assert.equal(await plain('Ann;  Bo'), 'Ann;  Bo', 'Only the exact "; " join splits, so the split always joins back to the same text');
  assert.equal(await plain(' Ann; Bo'), ' Ann; Bo');
  assert.equal(await plain(['Solo']), 'Solo', 'One author is one string without a record');
  assert.deepEqual(await plain('Doe, J.; Roe, K.'), ['Doe, J.', 'Roe, K.']);
  // Also with provenance off and in references-only mode (no record is stored).
  for (const provenance of [false, 'references-only']) {
    const bytes = await exportDeck({author: ['Ann Lee', 'Bo Chan'], slides: [{title: 'T', text: 'x'}]}, {provenance});
    assert.deepEqual((await read(bytes)).deck.author, ['Ann Lee', 'Bo Chan'], String(provenance));
  }
  // The record only stands while PowerPoint's author field is unchanged.
  const edited = await read(modify(await exportDeck({author: ['Ann Lee', 'Bo Chan'], slides: [{title: 'T', text: 'x'}]}), entries => text(entries, 'docProps/core.xml', xml => xml.replace('Ann Lee; Bo Chan', 'Dee Fox'))));
  assert.equal(edited.deck.author, 'Dee Fox');
  assert.deepEqual(edited.issues.filter(issue => issue.code === 'metadata-reference-changed').map(issue => issue.path), ['author']);
  // The exporter's default creator is not an authored author.
  const none = await exportDeck({slides: [{title: 'T', text: 'x'}]});
  assert.equal((await read(none)).deck.author, undefined, 'No author is invented when none was authored');
  assert.equal((await read(await exportDeck({author: 'OpenPresentation', slides: [{title: 'T', text: 'x'}]}))).deck.author, 'OpenPresentation', 'An authored value equal to the default stays');
  // Damaged records reject the document tag.
  const stored = tagValue(dec.decode(unzipSync(await exportDeck({author: ['Ann Lee', 'Bo Chan'], slides: [{title: 'T', text: 'x'}]}))['ppt/tags/opfDocument.xml']));
  assert.deepEqual(stored.author, ['Ann Lee', 'Bo Chan']);
  assert.equal(stored.metadata?.author, undefined, 'A top-level record: importers up to 0.11.8 reject unknown supplement keys but ignore unknown top-level ones');
  assert.equal(stored.supplement?.metadata?.author, undefined);
  for (const value of [5, [], [1], {a: 1}]) {
    const damaged = await read(modify(await exportDeck({author: ['Ann Lee', 'Bo Chan'], slides: [{title: 'T', text: 'x'}]}), entries => text(entries, 'ppt/tags/opfDocument.xml', xml => retag(xml, record => { record.author = value; }))));
    assert.ok(damaged.codes.includes('invalid-document-provenance'), JSON.stringify(value));
    assert.deepEqual(damaged.deck.author, ['Ann Lee', 'Bo Chan'], 'The native field is read as plain PPTX');
  }
  checked++;
}

// --- 2. Run colours -------------------------------------------------------------------------------------------------
const colorDeck = {
  variables: {brand: {type: 'color', value: '#AA0000'}},
  design: {colorScheme: {accent1: '#112233', accent2: '#445566', hyperlink: '#0000EE'}},
  slides: [
    {title: 'Runs', text: [{text: 'var ', color: 'var:brand'}, {text: 'slot ', color: 'accent2'}, {text: 'role ', color: 'primary'}, {text: 'text ', color: 'text'}, {text: 'hex ', color: '#FF0000'}, {text: 'plain'}]},
    {title: 'Lists', blocks: [
      {type: 'group', blocks: [{type: 'text', text: [{text: 'in a group ', color: 'accent2'}, 'then plain']}, {items: [[{text: 'x', color: 'accent2'}, 'y'], {text: [{text: 'z', color: 'var:brand'}], description: [{text: 'details', color: 'accent1'}]}]}]},
      {bullets: ['p', [{text: 'q', color: 'primary'}]]}]},
    {title: 'Regions', left: {text: [{text: 'L', color: 'accent2'}]}, right: {text: [{text: 'R', color: 'var:brand'}]}}
  ]
};
const colors = (deck, slide) => {
  const out = [];
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (typeof value.text === 'string' && typeof value.color === 'string') out.push([value.text.trim(), value.color]);
      for (const [key, item] of Object.entries(value)) if (key !== 'design' && item && typeof item === 'object') walk(item);
    }
  };
  walk(deck.slides[slide]);
  return out;
};
{
  const bytes = await exportDeck(colorDeck);
  assert.deepEqual(slideRecord(bytes, 1).colors, {n: 6, at: [[0, 'var:brand'], [1, 'accent2'], [2, 'primary'], [3, 'text']]});
  assert.equal(JSON.stringify(slideRecord(bytes, 1).colors).includes('plain'), false, 'The record holds names only');
  for (const save of [false, true]) {
    const {deck, issues} = await read(save ? resave(bytes) : bytes);
    assert.deepEqual(issues.filter(issue => /reference|provenance|color/.test(issue.code)), [], `save ${save}`);
    assert.deepEqual(colors(deck, 0), [['var', 'var:brand'], ['slot', 'accent2'], ['role', 'primary'], ['text', 'text'], ['hex', '#FF0000'], ['plain', '#FFFFFF']], `save ${save}`);
    assert.deepEqual(colors(deck, 1).filter(([, color]) => !/^#/.test(color)), [['in a group', 'accent2'], ['x', 'accent2'], ['z', 'var:brand'], ['details', 'accent1'], ['q', 'primary']]);
    assert.deepEqual(colors(deck, 2), [['L', 'accent2'], ['R', 'var:brand']]);
    assert.deepEqual(deck.variables, colorDeck.variables);
    // Words and structure are untouched by the colour pass.
    assert.equal(deck.slides[0].blocks, undefined);
    assert.deepEqual(withoutColors(deck.slides[1].blocks[1]), {bullets: ['p', [{text: 'q'}]]});
  }
  checked++;

  // A colour changed in PowerPoint is the author's new value: it is not overwritten by the stored name.
  const edited = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => { assert.match(xml, /<a:srgbClr val="AA0000"\/>/); return xml.replace(/<a:srgbClr val="AA0000"\/>/, '<a:srgbClr val="00AA00"/>'); })));
  assert.deepEqual(colors(edited.deck, 0).slice(0, 3), [['var', '#00AA00'], ['slot', 'accent2'], ['role', 'primary']]);
  // A theme slot edited in the theme part moves every named run with it: the reference still resolves to the run colour.
  const retheme = await read(modify(bytes, entries => text(entries, 'ppt/theme/theme1.xml', xml => xml.replace(/(<a:accent2>)<a:srgbClr val="445566"\/>/, '$1<a:srgbClr val="778899"/>'))));
  assert.deepEqual(colors(retheme.deck, 0).slice(1, 2), [['slot', 'accent2']], 'the slot name follows the edited theme');
  // A run recoloured to something the name no longer resolves to keeps the literal.
  const recolored = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<a:schemeClr val="accent2"\/>/, '<a:srgbClr val="010203"/>'))));
  assert.deepEqual(colors(recolored.deck, 0).slice(0, 3), [['var', 'var:brand'], ['slot', '#010203'], ['role', 'primary']]);
  checked++;

  // A slide whose text runs changed since export keeps the resolved colours and says so.
  const mismatch = await read(modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, record => { record.colors.n += 1; }))));
  assert.deepEqual(colors(mismatch.deck, 0).slice(0, 3), [['var', '#AA0000'], ['slot', '#445566'], ['role', '#112233']]);
  assert.deepEqual(mismatch.issues.filter(issue => issue.code === 'color-reference-changed').map(issue => issue.path), ['slides.0']);
  // Damaged records reject the slide tag.
  for (const [name, mutate] of Object.entries({
    'a literal as a name': record => { record.colors.at[0][1] = '#AA0000'; },
    'an unknown name': record => { record.colors.at[0][1] = 'banana'; },
    'an index past the slots': record => { record.colors.at[0][0] = 99; },
    'a repeated index': record => { record.colors.at[1][0] = record.colors.at[0][0]; },
    'no slots': record => { record.colors.n = 0; },
    'not a list': record => { record.colors.at = 'accent2'; }
  })) {
    const damaged = await read(modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate))));
    assert.deepEqual(damaged.issues.filter(issue => issue.code === 'invalid-document-provenance').map(issue => issue.path), ['slides.0'], name);
    assert.deepEqual(colors(damaged.deck, 0)[0], ['var', '#AA0000'], name);
  }
  // Without the content structure (references-only, provenance off) the record is not stored.
  assert.equal(slideRecord(await exportDeck(colorDeck, {provenance: 'references-only'}), 1).colors, undefined);
  checked++;

  // Plain PPTX: a bare theme slot names itself where the document's scheme holds that colour; variables stay resolved.
  const plain = await read(stripTags(bytes));
  assert.deepEqual(colors(plain.deck, 0).slice(0, 5), [['var', '#AA0000'], ['slot', 'accent2'], ['role', 'accent1'], ['text', 'light1'], ['hex', '#FF0000']]);
  assert.deepEqual(plain.issues.filter(issue => /color/.test(issue.code)), []);
  assert.equal(JSON.stringify(plain.deck).includes('_opfScheme'), false, 'The transient marker never reaches the document');
  // A literal that happens to equal a slot colour stays a literal (srgbClr names no slot); a transform is not the slot colour.
  const literal = await read(stripTags(await exportDeck({design: colorDeck.design, slides: [{title: 'T', text: [{text: 'same', color: '#445566'}]}]})));
  assert.deepEqual(colors(literal.deck, 0), [['same', '#445566']]);
  const dimmed = await read(modify(stripTags(bytes), entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<a:schemeClr val="accent2"\/>/, '<a:schemeClr val="accent2"><a:lumMod val="50000"/></a:schemeClr>'))));
  assert.match(colors(dimmed.deck, 0)[1][1], /^#[0-9A-F]{6}$/);
  assert.equal(colors(dimmed.deck, 0)[1][1] === '#445566', false);
  // A re-saved plain deck behaves the same.
  assert.deepEqual(colors((await read(resave(stripTags(bytes)))).deck, 0).slice(1, 3), [['slot', 'accent2'], ['role', 'accent1']]);
  checked++;

  // The imported references export the same colours as the authored ones (the uncoloured last run is imported with its resolved default).
  const again = await toPptx((await read(bytes)).deck, {...EXPORT, provenance: false});
  const original = dec.decode(unzipSync(await exportDeck(colorDeck, {provenance: false}))['ppt/slides/slide1.xml']);
  const reexport = dec.decode(unzipSync(again)['ppt/slides/slide1.xml']);
  assert.deepEqual([...reexport.matchAll(/<a:(?:schemeClr|srgbClr) val="[^"]+"/g)].map(match => match[0]).slice(0, 7), [...original.matchAll(/<a:(?:schemeClr|srgbClr) val="[^"]+"/g)].map(match => match[0]).slice(0, 7));
  checked++;
}

// --- Hostile input: package names and tag values never reach inherited properties or unbounded sizes ----------------
{
  const bytes = stripTags(await exportDeck(colorDeck));
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'dk1x', 'phClr']) {
    const hostile = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<a:schemeClr val="accent2"\/>/, `<a:schemeClr val="${name}"/>`))));
    assert.equal(JSON.stringify(hostile.deck).includes('_opfScheme'), false, name);
    assert.ok(colors(hostile.deck, 0).every(([, color]) => typeof color === 'string'), name);
  }
  // A slot map that names a prototype key is no slot either.
  const mapped = await read(modify(bytes, entries => text(entries, 'ppt/slideMasters/slideMaster1.xml', xml => xml.replace(/<p:clrMap [^>]*\/>/, match => match.replace(/tx1="[^"]*"/, 'tx1="__proto__"')))));
  assert.equal(JSON.stringify(mapped.deck).includes('_opfScheme'), false);
  // The stored author is bounded in size and shape.
  const big = await read(modify(await exportDeck({author: ['Ann Lee', 'Bo Chan'], slides: [{title: 'T', text: 'x'}]}), entries => text(entries, 'ppt/tags/opfDocument.xml', xml => retag(xml, record => { record.author = ['x'.repeat(5000), 'y']; }))));
  assert.ok(big.codes.includes('invalid-document-provenance'));
  checked++;
}

// --- 3. List item descriptions come back as the item's description -------------------------------------------------
{
  const items = [{text: 'Alpha', description: 'About alpha'}, 'Beta', {text: [{text: 'Gam', bold: true}, 'ma'], description: [{text: 'rich ', italic: true}, 'detail'], level: 1}];
  const forms = {
    root: {items},
    group: {blocks: [{type: 'group', blocks: [{items}, {type: 'text', text: 'beside'}]}]},
    region: {left: {items}, right: {text: 'R'}},
    blocks: {blocks: [{items}, {items: ['p', 'q']}]}
  };
  const dig = slide => slide.items ?? slide.left?.items ?? slide.blocks[0].items ?? slide.blocks[0].blocks[0].items;
  for (const strip of [false, true]) for (const save of [false, true]) for (const [name, slide] of Object.entries(forms)) {
    let bytes = await exportDeck({slides: [{title: 'T', ...slide}]});
    if (save) bytes = resave(bytes);
    if (strip) bytes = stripTags(bytes);
    const {deck} = await read(bytes);
    const back = strip ? deck.slides[0].blocks.find(block => block.type === 'list' && JSON.stringify(block).includes('Alpha')).items : dig(deck.slides[0]);
    // opf-pptx#212: with the slide record the items return as authored; without tags the runs carry their native look.
    if (!strip) assert.deepEqual(back, items, `${name} save ${save}: authored items`);
    else assert.deepEqual(noFont(withoutColors(back)).map(item => Array.isArray(item) ? item : item), [
      {text: [{text: 'Alpha'}], description: [{text: 'About alpha'}]},
      [{text: 'Beta'}],
      {text: [{text: 'Gam', bold: true}, {text: 'ma'}], description: [{text: 'rich ', italic: true}, {text: 'detail'}], level: 1}
    ], `${name} strip ${strip} save ${save}`);
    assert.equal(JSON.stringify(deck.slides[0]).includes('About alpha'), true);
    assert.equal(deck.slides[0].blocks?.some(block => block.type === 'text' && /About alpha|rich detail/.test(JSON.stringify(block.text))) ?? false, false, 'the description is no separate text block');
    checked++;
  }
}

// --- 4. `bullets` keeps its key in every container ------------------------------------------------------------------
{
  const bullets = ['one', [{text: 'two ', bold: true}, 'b'], {text: 'three', level: 1}];
  const cases = {
    'root bullets': {bullets},
    'block bullets': {blocks: [{bullets}, {items: ['i', 'j']}]},
    'group bullets': {blocks: [{type: 'group', id: 'g', blocks: [{bullets}, {type: 'text', text: 'beside'}]}, {bullets: ['p', 'q']}]},
    'region bullets': {left: {bullets}, right: {items: ['z']}},
    'region group bullets': {left: {type: 'group', blocks: [{bullets}, {bullets: ['y']}]}, right: {text: 'R'}},
    'typed text bullets': {blocks: [{type: 'text', bullets}, {type: 'list', items: ['a']}]},
    'items stay items': {blocks: [{items: ['a', 'b']}, {type: 'list', items: ['c']}]}
  };
  const keys = (value, found = []) => {
    if (Array.isArray(value)) value.forEach(item => keys(item, found));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (key === 'bullets' || key === 'items') found.push(key); keys(item, found); }
    return found;
  };
  const authoredKeys = value => keys({...value});
  for (const save of [false, true]) for (const [name, slide] of Object.entries(cases)) {
    const bytes = await exportDeck({slides: [{title: 'T', ...slide}]});
    const {deck, issues} = await read(save ? resave(bytes) : bytes);
    const {title, ...rest} = deck.slides[0];
    assert.deepEqual(issues.filter(issue => /structure|reference|provenance/.test(issue.code)), [], name);
    assert.deepEqual(keys(rest), authoredKeys(slide), `${name}: list keys as authored (save ${save})`);
    assert.deepEqual(withoutColors(rest).blocks?.map(block => block.type), slide.blocks?.map(block => block.type), name);
    // The authored words are all still there.
    for (const word of ['one', 'three']) if (JSON.stringify(slide).includes(word)) assert.ok(JSON.stringify(rest).includes(word), name);
    checked++;
  }
  // `bullets` is only valid beside type 'text', so a typed block comes back as text.
  const typed = (await read(await exportDeck({slides: [{title: 'T', blocks: [{type: 'text', bullets}, {type: 'list', items: ['a']}]}]}))).deck.slides[0].blocks;
  assert.deepEqual([typed[0].type, typed[1].type, Object.keys(typed[0]).sort(), Object.keys(typed[1]).sort()], ['text', 'list', ['bullets', 'type'], ['items', 'type']]);
  // Plain PPTX carries no record: a list is a list with `items` (a typed `list` block cannot hold `bullets`).
  const plain = (await read(stripTags(await exportDeck({slides: [{title: 'T', blocks: [{bullets}, {bullets: ['p']}]}]})))).deck.slides[0];
  assert.deepEqual(plain.blocks.map(block => [block.type, Object.keys(block).filter(key => key === 'items' || key === 'bullets')]), [['list', ['items']], ['list', ['items']]]);
  // A deck exported before this record (no flag) still imports with `items`.
  const bytes = await exportDeck({slides: [{title: 'T', blocks: [{bullets}, {items: ['x']}]}]});
  const record = slideRecord(bytes).content;
  assert.equal(record.blocks[0].bullets, true);
  assert.equal(record.blocks[1].bullets, undefined);
  const old = await read(modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { delete value.content.blocks[0].bullets; }))));
  assert.deepEqual(old.deck.slides[0].blocks.map(block => Object.keys(block).filter(key => key === 'items' || key === 'bullets')), [['items'], ['items']]);
  // Damaged flags reject the slide tag.
  for (const [name, mutate] of Object.entries({
    'false flag': value => { value.content.blocks[0].bullets = false; },
    'string flag': value => { value.content.blocks[0].bullets = 'yes'; }
  })) {
    const damaged = await read(modify(bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate))));
    assert.deepEqual(damaged.issues.filter(issue => issue.code === 'invalid-document-provenance').map(issue => issue.path), ['slides.0'], name);
  }
  // The flag marks lists only.
  const image = await exportDeck({slides: [{title: 'T', blocks: [{text: 'a'}, {text: 'b'}]}]});
  const bad = await read(modify(image, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.blocks[0] = {t: 'leaf', k: 'image', bullets: true}; }))));
  assert.deepEqual(bad.issues.filter(issue => issue.code === 'invalid-document-provenance').map(issue => issue.path), ['slides.0']);
  checked++;
}

console.log(`Import detail checks passed (${checked}): author arrays, run colour references (variables, scheme slots, roles; provenance, plain PPTX, edits, a PowerPoint-style re-save, damaged records), item descriptions in every container and the bullets key.`);
