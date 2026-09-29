import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {XMLParser} from 'fast-xml-parser';
import {mediaFrameRecord} from '../dist/media-provenance.js';
import {toPptx, fromPptx} from '../dist/index.js';

// FF-29: video payloads export the preview's placeholder. The frame links to a
// web source and every placeholder shape carries OPF_MEDIA_V1, so import
// rebuilds the video block (and the asset entries it references) instead of
// leaving shape-name fallback blocks. Edited groups keep their caption text
// and report invalid-media-provenance.
const enc = new TextEncoder(), dec = new TextDecoder();
const deck = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Media deck', design: {fontScheme: 'roboto'},
  assets: {'demo-video': {src: 'https://cdn.example.com/private/demo.mp4', title: 'Demo'}},
  slides: [
    {title: 'Titled', blocks: [{type: 'video', video: {src: 'https://example.com/walkthrough.mp4', title: 'Walkthrough', description: 'Two minute tour'}}]},
    {title: 'Asset', video: {src: 'asset:demo-video', title: 'Asset clip', description: 'From the registry'}},
    {title: 'Plain', video: 'https://example.com/plain.mp4'},
  ]
};
assert.equal(validatePresentation(deck).valid, true);
const exported = await toPptx(structuredClone(deck), {seed: 1});
const read = async bytes => {
  const issues = [];
  const doc = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validatePresentation(doc).valid, true);
  return {doc, media: issues.filter(issue => /media/.test(issue.code)).map(issue => [issue.code, issue.path])};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const videos = doc => doc.slides.map(slide => (slide.blocks ?? []).filter(block => block.video !== undefined).map(block => block.video));
const junk = doc => doc.slides.flatMap(slide => slide.blocks ?? []).filter(block => /PowerPoint shape|OPF media/.test(block.text ?? ''));
const blockTexts = doc => doc.slides.flatMap(slide => slide.blocks ?? []).map(block => block.text).filter(Boolean);
const tagParts = entries => Object.keys(entries).filter(path => /^ppt\/tags\/opfMedia\d+\.xml$/.test(path));
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const linkedText = href => ({type: 'text', text: [{text: href, link: href}]});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const surfaceLinks = entries => {
  const shapes = parser.parse(dec.decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree']['p:sp'];
  const rels = parser.parse(dec.decode(entries['ppt/slides/_rels/slide1.xml.rels'])).Relationships.Relationship;
  const byId = new Map(rels.map(rel => [rel.Id, rel]));
  return shapes.filter(shape => shape['p:nvSpPr']['p:cNvPr'].name.startsWith('OPF media ')).map(shape => {
    const props = shape['p:nvSpPr']['p:cNvPr'];
    return {name: props.name, shape, rel: byId.get(props['a:hlinkClick']?.['r:id'])};
  });
};
let checks = 0;

// Package shape: frame hyperlink to the web source; one OPF_MEDIA_V1 tag per placeholder shape.
{
  const entries = unzipSync(exported);
  const slide = n => dec.decode(entries[`ppt/slides/slide${n}.xml`]), rels = n => dec.decode(entries[`ppt/slides/_rels/slide${n}.xml.rels`]);
  assert.match(slide(1), /<p:cNvPr id="\d+" name="OPF media slides\.0\.blocks\.0\.video frame"><a:hlinkClick r:id="(rId\d+)"/);
  assert.match(rels(1), /Type="[^"]*\/hyperlink" Target="https:\/\/example\.com\/walkthrough\.mp4" TargetMode="External"/);
  assert.match(rels(2), /Target="https:\/\/cdn\.example\.com\/private\/demo\.mp4"/, 'Asset references link to the dereferenced source.');
  const records = tagParts(entries).map(path => tagValue(dec.decode(entries[path])));
  assert.deepEqual(records.filter(record => record.role === 'frame').map(record => record.video), deck.slides.map(slide => slide.video ?? slide.blocks[0].video));
  assert.deepEqual(records.find(record => record.path === 'slides.1.video' && record.role === 'frame').assets, deck.assets);
  for (const path of ['slides.0.blocks.0.video', 'slides.1.video', 'slides.2.video']) assert.deepEqual(records.filter(record => record.path === path).map(record => record.role).sort(), ['badge', 'caption', 'frame', 'play']);
  checks++;
}

// Unchanged package: every video returns exactly, asset entries included, with no fallback blocks or diagnostics.
{
  const {doc, media} = await read(exported);
  assert.deepEqual(media, []);
  assert.deepEqual(videos(doc), [[deck.slides[0].blocks[0].video], [deck.slides[1].video], [deck.slides[2].video]]);
  assert.deepEqual(doc.assets, deck.assets);
  assert.deepEqual(junk(doc), []);
  assert.deepEqual(blockTexts(doc), [], 'Captions are part of the restored video, not extra text.');
  // Re-export writes the same OPF values.
  const again = unzipSync(await toPptx(doc, {seed: 1}));
  assert.deepEqual(tagParts(again).map(path => tagValue(dec.decode(again[path]))).filter(record => record.role === 'frame').map(record => record.video), videos(doc).flat());
  checks++;
}

// references-only stores structural identities only. Source URLs and displayed
// titles come from the current native hyperlink and caption; off has no tags.
for (const provenance of ['references-only', false]) {
  const entries = unzipSync(await toPptx(structuredClone(deck), {seed: 1, provenance}));
  const records = tagParts(entries).map(path => tagValue(dec.decode(entries[path])));
  assert.ok(records.every(record => record.assets === undefined));
  assert.ok(!records.some(record => JSON.stringify(record).includes('cdn.example.com')), 'No registry URL in media tags.');
  const {doc, media} = await read(zipSync(entries));
  assert.deepEqual(media, []);
  if (provenance === false) {
    assert.equal(records.length, 0);
    assert.deepEqual(videos(doc), [[], [], []]);
    assert.ok(blockTexts(doc).includes('Asset clip'));
  } else {
    assert.ok(records.every(record => record.video === undefined));
    assert.deepEqual(videos(doc), [
      [{src: 'https://example.com/walkthrough.mp4', title: 'Walkthrough'}],
      [{src: deck.assets['demo-video'].src, title: 'Asset clip'}],
      [deck.slides[2].video],
    ]);
    assert.ok(records.every(record => !/https:|Walkthrough|Two minute tour|From the registry/.test(JSON.stringify(record))));
  }
  assert.equal(doc.assets, undefined);
  checks++;
}

// Edits keep native content and name the video that was not restored; decoration never becomes a text block.
{
  const edited = await read(modify(exported, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('<a:t>Walkthrough</a:t>', '<a:t>Renamed tour</a:t>'))));
  assert.deepEqual(edited.media, [['invalid-media-provenance', 'slides.0.blocks.0.video']]);
  assert.deepEqual(videos(edited.doc)[0], []);
  assert.deepEqual(edited.doc.slides[0].blocks, [linkedText('https://example.com/walkthrough.mp4'), {type: 'text', text: 'Renamed tour'}]);
  assert.deepEqual(videos(edited.doc).slice(1), [[deck.slides[1].video], [deck.slides[2].video]], 'Other slides are unaffected.');
  assert.deepEqual(junk(edited.doc), []);

  const removed = await read(modify(exported, entries => text(entries, 'ppt/slides/slide3.xml', xml => xml.replace(/<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="OPF media slides\.2\.video badge">[\s\S]*?<\/p:sp>/, ''))));
  assert.deepEqual(removed.media, [['invalid-media-provenance', 'slides.2.video']]);
  assert.deepEqual(removed.doc.slides[2].blocks, [linkedText('https://example.com/plain.mp4'), {type: 'text', text: 'https://example.com/plain.mp4'}], 'The link and caption both remain editable.');
  assert.deepEqual(junk(removed.doc), []);

  const tampered = await read(modify(exported, entries => {
    const path = tagParts(entries).find(part => { const record = tagValue(dec.decode(entries[part])); return record.role === 'frame' && record.path === 'slides.0.blocks.0.video'; });
    text(entries, path, xml => xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify({v: 1, role: 'frame', path: 'slides.0.blocks.0.video', video: {src: 42}})).toString('hex').toUpperCase()}"`));
  }));
  assert.deepEqual(tampered.media, [['invalid-media-provenance', 'slides.0.blocks.0.video']]);
  assert.deepEqual(tampered.doc.slides[0].blocks, [linkedText('https://example.com/walkthrough.mp4'), {type: 'text', text: 'Walkthrough'}]);
  assert.deepEqual(junk(tampered.doc), []);
  checks++;
}

// An unreadable or ambiguous media tag is not trusted, so its shape is never
// removed by name: it goes through ordinary import. For the badge (a shape
// without text) that is one fallback block, {type: 'text', text: 'PowerPoint
// shape: OPF media <path> badge'}. The rest of the group is then incomplete:
// its other decoration is dropped, the caption stays as text, and
// invalid-media-provenance names the video. An ambiguous tag also reports the
// unattributable shape at the slide path.
{
  const badgeTag = entries => tagParts(entries).find(path => { const record = tagValue(dec.decode(entries[path])); return record.role === 'badge' && record.path === 'slides.0.blocks.0.video'; });
  const fallback = [linkedText('https://example.com/walkthrough.mp4'), {type: 'text', text: 'PowerPoint shape: OPF media slides.0.blocks.0.video badge'}, {type: 'text', text: 'Walkthrough'}];
  const cases = {
    // A second OPF_ identity on the same shape.
    ambiguous: [entries => text(entries, badgeTag(entries), xml => xml.replace('</p:tagLst>', '<p:tag name="OPF_CARD_V1" val="7B7D"/></p:tagLst>')),
      [['invalid-media-provenance', 'slides.0.blocks.0.video'], ['invalid-media-provenance', 'slides.0']]],
    // A tag part that is not XML, and a tag relationship whose part is missing.
    unreadable: [entries => { entries[badgeTag(entries)] = enc.encode('not xml <<<'); }, [['invalid-media-provenance', 'slides.0.blocks.0.video']]],
    missing: [entries => { delete entries[badgeTag(entries)]; }, [['invalid-media-provenance', 'slides.0.blocks.0.video']]],
  };
  for (const [label, [mutate, diagnostics]] of Object.entries(cases)) {
    const {doc, media} = await read(modify(exported, mutate));
    assert.deepEqual(media, diagnostics, `${label}: diagnostics`);
    assert.deepEqual(doc.slides[0].blocks, fallback, `${label}: one badge fallback block and the caption text`);
    assert.deepEqual(videos(doc).slice(1), [[deck.slides[1].video], [deck.slides[2].video]], `${label}: other slides are unaffected`);
  }
  checks++;
}

// Inline video bytes have no exported media part. Even full must omit them;
// limited modes carry no hidden source, description or asset metadata.
for (const assetBacked of [false, true]) for (const provenance of ['full', 'references-only', false]) {
  const value = {src: 'data:video/mp4;base64,PRIVATE_BYTES', title: 'Visible', description: 'PRIVATE_DESCRIPTION'};
  const input = {name: 'Privacy', ...(assetBacked ? {assets: {clip: value}} : {}), slides: [{video: assetBacked ? {src: 'asset:clip', title: 'Visible'} : value}]};
  const issues = [];
  const bytes = await toPptx(input, {seed: 1, provenance, onDiagnostic: issue => issues.push(issue)});
  const entries = unzipSync(bytes), records = tagParts(entries).map(path => tagValue(dec.decode(entries[path])));
  assert.ok(records.every(record => !/PRIVATE_BYTES|PRIVATE_DESCRIPTION|data:/.test(JSON.stringify(record))));
  if (provenance === false) assert.equal(records.length, 0);
  if (provenance === 'full') {
    assert.ok(issues.some(issue => issue.code === 'media-provenance-omitted' && issue.path === 'slides.0.video'));
    assert.deepEqual(records.find(record => record.role === 'frame'), {v: 1, role: 'frame', path: 'slides.0.video', omitted: true});
  }
  const result = await read(bytes);
  assert.deepEqual(videos(result.doc), [[]]);
  assert.ok(blockTexts(result.doc).includes('Visible'));
  checks++;
}

const frameTag = (entries, path) => tagParts(entries).find(part => { const record = tagValue(dec.decode(entries[part])); return record.role === 'frame' && record.path === path; });
const updateTag = (entries, part, update) => text(entries, part, xml => {
  const record = tagValue(xml);
  return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(update(record))).toString('hex').toUpperCase()}"`);
});

// Current native URLs win over stale or forged authored URLs. Removing the
// native link, or making it unsafe/unresolved, never resurrects a tagged URL.
{
  const changed = await read(modify(exported, entries => text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace('https://example.com/walkthrough.mp4', 'https://example.com/new.mp4'))));
  assert.deepEqual(videos(changed.doc)[0], [{src: 'https://example.com/new.mp4', title: 'Walkthrough'}]);
  assert.deepEqual(changed.media, [['media-source-changed', 'slides.0.blocks.0.video']]);
  const forged = await read(modify(exported, entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, video: {...record.video, src: 'https://example.com/forged.mp4'}}))));
  assert.deepEqual(videos(forged.doc)[0], [{src: 'https://example.com/walkthrough.mp4', title: 'Walkthrough'}]);
  assert.deepEqual(forged.media, [['media-source-changed', 'slides.0.blocks.0.video']]);
  for (const [mutate, expected] of [
    [entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<a:hlinkClick\b[^>]*\/>/, '')), ['Walkthrough']],
    [entries => text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace('https://example.com/walkthrough.mp4', 'javascript:alert(1)')), ['javascript:alert(1)', 'Walkthrough']],
    [entries => text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace(/<Relationship\b[^>]*Type="[^"]*\/hyperlink"[^>]*\/>/, '')), ['Walkthrough']],
  ]) {
    const result = await read(modify(exported, mutate));
    assert.deepEqual(videos(result.doc)[0], []);
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.blocks.0.video']]);
    assert.deepEqual(result.doc.slides[0].blocks.map(block => block.text), expected);
  }
  checks++;
}

// Reordering/duplicating slides keeps each slide's group identity. Diagnostics
// use the new slide position, while names and records retain the old identity.
{
  const reorder = entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/(<p:sldIdLst>)([\s\S]*?)(<\/p:sldIdLst>)/, (_match, a, b, c) => a + [...b.matchAll(/<p:sldId\b[^>]*\/>/g)].map(match => match[0]).reverse().join('') + c));
  const reordered = await read(modify(exported, reorder));
  assert.deepEqual(videos(reordered.doc), [[deck.slides[2].video], [deck.slides[1].video], [deck.slides[0].blocks[0].video]]);
  assert.deepEqual(reordered.media, []);
  const edited = await read(modify(exported, entries => {
    reorder(entries);
    text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace('https://example.com/walkthrough.mp4', 'https://example.com/reordered.mp4'));
  }));
  assert.deepEqual(videos(edited.doc)[2], [{src: 'https://example.com/reordered.mp4', title: 'Walkthrough'}]);
  assert.deepEqual(edited.media, [['media-source-changed', 'slides.2.blocks.0.video']]);
  const duplicate = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/(<p:sldIdLst>)(<p:sldId\b[^>]*\/>)/, '$1$2$2'))));
  assert.deepEqual(videos(duplicate.doc), [[deck.slides[0].blocks[0].video], [deck.slides[0].blocks[0].video], [deck.slides[1].video], [deck.slides[2].video]]);
  assert.deepEqual(duplicate.media, []);
  checks++;
}

// Conflicting asset IDs on copied/imported slides must not make one video's
// source silently resolve to another's registry entry.
{
  const input = {name: 'Collision', assets: {clip: {src: 'https://example.com/one.mp4'}}, slides: [
    {title: 'One', video: {src: 'asset:clip', title: 'Clip'}},
    {title: 'Two', video: {src: 'asset:clip', title: 'Clip'}},
  ]};
  const bytes = await toPptx(input, {seed: 1});
  const result = await read(modify(bytes, entries => {
    updateTag(entries, frameTag(entries, 'slides.1.video'), record => ({...record, assets: {clip: {src: 'https://example.com/two.mp4'}}}));
    text(entries, 'ppt/slides/_rels/slide2.xml.rels', xml => xml.replace('https://example.com/one.mp4', 'https://example.com/two.mp4'));
  }));
  assert.deepEqual(videos(result.doc), [[input.slides[0].video], [{src: 'https://example.com/two.mp4', title: 'Clip'}]]);
  assert.deepEqual(result.doc.assets, input.assets);
  assert.deepEqual(result.media, [['media-asset-conflict', 'slides.1.video']]);
  checks++;
}

// Unknown records, data-bearing records, oversized input and duplicated
// caption indices stay ordinary native content, with a diagnostic.
for (const mutate of [
  entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, v: 99})),
  entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, hidden: 'untrusted'})),
  entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, assets: {unrelated: {src: 'https://example.com/unrelated.mp4'}}})),
  entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, video: {src: 'data:video/mp4;base64,UNTRUSTED', title: 'Walkthrough'}})),
  entries => updateTag(entries, frameTag(entries, 'slides.0.blocks.0.video'), record => ({...record, video: {...record.video, description: 'x'.repeat(256 * 1024)}})),
  entries => {
    const part = tagParts(entries).find(part => { const record = tagValue(dec.decode(entries[part])); return record.role === 'caption' && record.path === 'slides.0.blocks.0.video'; });
    updateTag(entries, part, record => ({...record, count: 2}));
  },
]) {
  const result = await read(modify(exported, mutate));
  assert.deepEqual(videos(result.doc)[0], []);
  assert.ok(result.media.some(([code]) => code === 'invalid-media-provenance'));
  assert.ok(blockTexts(result.doc).includes('Walkthrough'));
  assert.deepEqual(videos(result.doc).slice(1), [[deck.slides[1].video], [deck.slides[2].video]]);
  checks++;
}

// A tag cannot invent a hidden non-web source where native content has no
// source evidence. A literal source caption is sufficient current evidence.
for (const video of [{src: 'file:private.mp4', title: 'Visible'}, 'file:private.mp4']) {
  const result = await read(await toPptx({name: 'Non-web', slides: [{title: 'Clip', video}]}, {seed: 1}));
  if (typeof video === 'string') {
    assert.deepEqual(videos(result.doc), [[video]]);
    assert.deepEqual(result.media, []);
  } else {
    assert.deepEqual(videos(result.doc), [[]]);
    assert.ok(blockTexts(result.doc).includes('Visible'));
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
  }
  checks++;
}

// Blank caption lines remain in the complete tagged sequence; deleting or
// duplicating any tagged line cannot hide a native caption edit.
{
  const video = {src: 'https://example.com/multiline.mp4', title: 'One\n\nTwo'};
  const bytes = await toPptx({name: 'Multiline', slides: [{title: 'Clip', video}]}, {seed: 1});
  const result = await read(bytes);
  assert.deepEqual(videos(result.doc), [[video]]);
  assert.deepEqual(result.media, []);
  const captions = tagParts(unzipSync(bytes)).map(part => tagValue(dec.decode(unzipSync(bytes)[part]))).filter(record => record.role === 'caption');
  assert.deepEqual(captions.map(record => record.line), [0, 1, 2]);
  checks++;
}

// Each clickable native surface, including blank caption text boxes, resolves
// to the current dereferenced web source under every provenance mode. The
// caption run hyperlinks keep text colour and suppress hyperlink underlining.
for (const provenance of ['full', 'references-only', false]) {
  const source = 'https://example.com/surfaces.mp4';
  const input = {assets: {clip: {src: source}}, slides: [{video: {src: 'asset:clip', title: 'One\n\nTwo'}}]};
  const bytes = await toPptx(input, {seed: 1, provenance});
  const entries = unzipSync(bytes), surfaces = surfaceLinks(entries);
  assert.equal(surfaces.length, 6);
  for (const surface of surfaces) {
    assert.equal(surface.rel?.Target, source, surface.name);
    assert.equal(surface.rel.TargetMode, 'External');
    assert.ok(surface.rel.Type.endsWith('/hyperlink'));
    if (surface.name.includes('caption')) {
      const body = JSON.stringify(surface.shape['p:txBody']);
      if (body.includes('a:hlinkClick')) {
        assert.ok(body.includes('"val":"tx"'), 'Inherited run hyperlink uses native text colour.');
        assert.ok(body.includes('"u":"none"'));
      }
      assert.ok(!body.includes('"u":"sng"'));
    }
  }
  // Decoration-only relationship edits cannot override the frame. Give each
  // edited surface its own relationship, including captions sharing frame rId.
  for (const role of ['badge', 'play', 'caption line 0']) {
    const result = await read(modify(bytes, entries => {
      text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(new RegExp(`(<p:cNvPr[^>]*name="OPF media slides\\.0\\.video ${role}"><a:hlinkClick r:id=")[^"]+`), '$1rIdSurfaceEdit'));
      text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace('</Relationships>', '<Relationship Id="rIdSurfaceEdit" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/decoration.mp4" TargetMode="External"/></Relationships>'));
    }));
    if (provenance !== false) assert.deepEqual(videos(result.doc), [[provenance === 'full' ? input.slides[0].video : {src: source, title: 'One\n\nTwo'}]]);
    assert.deepEqual(result.media, []);
  }
  if (provenance !== false) {
    const current = 'https://example.com/current-frame.mp4';
    const changed = await read(modify(bytes, entries => {
      text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/(<p:cNvPr[^>]*name="OPF media slides\.0\.video frame"><a:hlinkClick r:id=")[^"]+/, '$1rIdCurrentFrame'));
      text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replace('</Relationships>', `<Relationship Id="rIdCurrentFrame" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${current}" TargetMode="External"/></Relationships>`));
    }));
    assert.deepEqual(videos(changed.doc), [[{src: current, title: 'One\n\nTwo'}]], 'Frame-only edit wins while all other links still point at the old URL.');
    assert.deepEqual(changed.media, provenance === 'full' ? [['media-source-changed', 'slides.0.video']] : []);
  }
  checks++;
}
for (const video of ['file:clip.mp4', 'data:video/mp4;base64,PRIVATE']) {
  const entries = unzipSync(await toPptx({slides: [{video}]}, {seed: 1}));
  assert.ok(surfaceLinks(entries).every(surface => surface.rel === undefined));
  checks++;
}

// Late omissions exercise video-only record overhead, referenced-asset checks,
// aggregate cap after both video/assets assignment, and the finite depth guard.
{
  const limit = 256 * 1024, url = 'https://example.com/omitted.mp4';
  const largeVideo = {src: url, title: 'Visible', description: ''};
  largeVideo.description = 'V'.repeat(limit - Buffer.byteLength(JSON.stringify(largeVideo)));
  const chain = Object.fromEntries(Array.from({length: 9}, (_, index) => [`a${index}`, {src: index === 8 ? url : `asset:a${index + 1}`, description: `PRIVATE_CHAIN_${index}`} ]));
  const cases = [
    {slides: [{video: largeVideo}]},
    {assets: {clip: {src: url, description: 'A'.repeat(limit)}}, slides: [{video: {src: 'asset:clip', title: 'Visible', description: 'PRIVATE_VIDEO'}}]},
    {assets: {clip: {src: 'data:video/mp4;base64,PRIVATE_BYTES'}}, slides: [{video: {src: 'asset:clip', title: 'Visible', description: 'PRIVATE_VIDEO'}}]},
    {assets: {clip: {src: url, description: 'A'.repeat(150000)}}, slides: [{video: {src: 'asset:clip', title: 'Visible', description: 'V'.repeat(150000)}}]},
    {assets: chain, slides: [{video: {src: 'asset:a0', title: 'Visible', description: 'PRIVATE_VIDEO'}}]},
  ];
  for (const input of cases) {
    const issues = [];
    const bytes = await toPptx(input, {seed: 1, provenance: 'full', onDiagnostic: issue => issues.push(issue)});
    const entries = unzipSync(bytes), record = tagValue(dec.decode(entries[frameTag(entries, 'slides.0.video')]));
    assert.deepEqual(record, {v: 1, role: 'frame', path: 'slides.0.video', omitted: true});
    assert.ok(Buffer.byteLength(JSON.stringify(record)) < limit);
    assert.equal(issues.filter(issue => issue.code === 'media-provenance-omitted').length, 1);
    const result = await read(bytes);
    assert.deepEqual(videos(result.doc), [[]]);
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
    assert.ok(blockTexts(result.doc).includes('Visible'));
    assert.deepEqual(junk(result.doc), []);
  }
  // Export dereferencing rejects these before tagging; direct controls keep
  // the same identity-only guarantee for the missing/cyclic guard branches.
  for (const assets of [{}, {clip: {src: 'asset:clip'}}]) assert.deepEqual(mediaFrameRecord({src: 'asset:clip', description: 'PRIVATE'}, 'slides.0.video', {assets}, 'full'), {v: 1, role: 'frame', path: 'slides.0.video', omitted: true});
  checks++;
}

// Exact current caption content survives whitespace-only and empty edits. Full
// mode compares emitted-line evidence (wrapping is not itself an edit); limited
// mode derives the semantic caption directly from current native content.
{
  const source = 'https://example.com/caption.mp4';
  const input = {slides: [{video: {src: source, title: 'A B', description: 'Hidden'}}]};
  const bytes = await toPptx(input, {seed: 1});
  const forgedTitle = await read(modify(bytes, entries => updateTag(entries, frameTag(entries, 'slides.0.video'), record => ({...record, video: {...record.video, title: 'Forged caption'}}))));
  assert.deepEqual(forgedTitle.doc.slides[0].blocks, [linkedText(source), {type: 'text', text: 'A B'}]);
  assert.deepEqual(forgedTitle.media, [['invalid-media-provenance', 'slides.0.video']]);
  for (const caption of ['A  B', ' A B ', 'A\tB', '']) {
    const result = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('<a:t>A B</a:t>', `<a:t>${caption}</a:t>`))));
    assert.deepEqual(videos(result.doc), [[]]);
    assert.deepEqual(result.doc.slides[0].blocks, [linkedText(source), {type: 'text', text: caption}]);
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
    const again = unzipSync(await toPptx(result.doc, {seed: 1}));
    assert.ok(dec.decode(again['ppt/slides/_rels/slide1.xml.rels']).includes(`Target="${source}"`), 'Fallback URL survives re-export.');
  }
  for (const title of [' A  B ', 'A\tB', 'A\r\n\r\nB', '   ', 'This caption wraps because '.repeat(20)]) {
    const current = {...input, slides: [{video: {...input.slides[0].video, title}}]};
    const result = await read(await toPptx(current, {seed: 1}));
    assert.deepEqual(videos(result.doc), [[current.slides[0].video]]);
    assert.deepEqual(result.media, []);
  }
  const restricted = await toPptx(input, {seed: 1, provenance: 'references-only'});
  for (const caption of [' A  B ', 'A\tB', '']) {
    const result = await read(modify(restricted, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('<a:t>A B</a:t>', `<a:t>${caption}</a:t>`))));
    if (caption === '') {
      assert.deepEqual(result.doc.slides[0].blocks, [linkedText(source), {type: 'text', text: ''}]);
      assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
    } else {
      assert.deepEqual(videos(result.doc), [[{src: source, title: caption}]]);
      assert.deepEqual(result.media, []);
    }
  }
  const legacy = await read(modify(bytes, entries => {
    for (const part of tagParts(entries)) updateTag(entries, part, record => { const {fingerprint, boundary, ...old} = record; return old; });
  }));
  assert.deepEqual(legacy.doc.slides[0].blocks, [linkedText(source), {type: 'text', text: 'A B'}]);
  checks++;
}

// Soft wraps carry no source character. Full boundaries preserve exact CR/LF
// spelling; references-only preserves structural LF without authored bytes.
{
  const url = 'https://example.com/boundary.mp4', current = 'https://example.com/current.mp4';
  const title = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(12);
  const local = 'file:///offline/' + 'long-local-path-segment/'.repeat(10) + 'clip.mp4';
  for (const video of [local, {src: url, title}]) {
    const bytes = await toPptx({slides: [{video}]}, {seed: 1});
    const records = tagParts(unzipSync(bytes)).map(path => tagValue(dec.decode(unzipSync(bytes)[path]))).filter(record => record.role === 'caption');
    assert.ok(records.length > 1 && records.some(record => record.boundary === 'soft'), 'Exercise actual measured soft wraps.');
    const result = await read(bytes);
    assert.deepEqual(videos(result.doc), [[video]], 'Unchanged unbroken native content must not gain spaces or lose video intent.');
    assert.deepEqual(result.media, []);
    assert.deepEqual(videos((await read(await toPptx(result.doc, {seed: 1}))).doc), [[video]]);
  }
  for (const provenance of ['full', 'references-only']) {
    const bytes = await toPptx({slides: [{video: {src: url, title}}]}, {seed: 1, provenance});
    const result = await read(modify(bytes, entries => text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replaceAll(url, current))));
    assert.deepEqual(videos(result.doc), [[{src: current, title}]], 'A current URL must not introduce soft-wrap spaces.');
    assert.deepEqual(videos((await read(await toPptx(result.doc, {seed: 1, provenance}))).doc), [[{src: current, title}]]);
  }
  checks++;
}
{
  const url = 'https://example.com/crlf.mp4', current = 'https://example.com/current.mp4', title = 'One\r\n\r\nTwo ';
  const bytes = await toPptx({slides: [{video: {src: url, title}}]}, {seed: 1});
  const changed = await read(modify(bytes, entries => text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replaceAll(url, current))));
  assert.deepEqual(videos(changed.doc), [[{src: current, title}]], 'Changing only the URL preserves full-mode authored CRLF.');
  assert.deepEqual(videos((await read(await toPptx(changed.doc, {seed: 1}))).doc), [[{src: current, title}]]);
  const edited = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('<a:t>One</a:t>', '<a:t>Native  edit</a:t>'))));
  assert.deepEqual(edited.doc.slides[0].blocks, [linkedText(url), {type: 'text', text: 'Native  edit'}, {type: 'text', text: ''}, {type: 'text', text: 'Two '}], 'Edited captions retain separate current native lines.');
  assert.deepEqual(edited.media, [['invalid-media-provenance', 'slides.0.video']]);
  assert.deepEqual((await read(await toPptx(edited.doc, {seed: 1}))).doc.slides[0].blocks.filter(block => typeof block.text === 'string').map(block => block.text), [url, 'Native  edit', '', 'Two ']);
  for (const provenance of ['references-only', false]) {
    const restricted = await toPptx({slides: [{video: {src: url, title}}]}, {seed: 1, provenance});
    const records = tagParts(unzipSync(restricted)).map(path => tagValue(dec.decode(unzipSync(restricted)[path])));
    assert.ok(records.every(record => record.separator === undefined && record.fingerprint === undefined && record.video === undefined), 'Limited tags do not store full source evidence.');
    const result = await read(restricted);
    if (provenance === false) { assert.deepEqual(records, []); assert.deepEqual(videos(result.doc), [[]]); }
    else {
      assert.deepEqual(videos(result.doc), [[{src: url, title: 'One\n\nTwo '}]], 'Restricted hard boundaries retain semantic LF, not unavailable authored CRLF.');
      assert.deepEqual(videos((await read(await toPptx(result.doc, {seed: 1, provenance}))).doc), [[{src: url, title: 'One\n\nTwo '}]]);
    }
  }
  checks++;
}

// Empty current captions cannot be represented by a video title: the renderer
// intentionally displays its source for an authored empty title. Keep current
// links and blank editable text instead of resurrecting a caption on re-export.
{
  const url = 'https://example.com/clear.mp4', current = 'https://example.com/current.mp4';
  for (const [provenance, changeURL] of [['references-only', false], ['full', true]]) {
    const bytes = await toPptx({slides: [{video: {src: url, title: 'Clear me'}}]}, {seed: 1, provenance});
    const result = await read(modify(bytes, entries => {
      text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('<a:t>Clear me</a:t>', '<a:t></a:t>'));
      if (changeURL) text(entries, 'ppt/slides/_rels/slide1.xml.rels', xml => xml.replaceAll(url, current));
    }));
    const target = changeURL ? current : url;
    assert.deepEqual(result.doc.slides[0].blocks, [linkedText(target), {type: 'text', text: ''}]);
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
    const again = await toPptx(result.doc, {seed: 1});
    assert.ok(!dec.decode(unzipSync(again)['ppt/slides/slide1.xml']).includes('name="OPF media '), 'No fabricated media caption on re-export.');
    assert.ok((await read(again)).doc.slides[0].blocks.some(block => block.text === ''));
    assert.ok(dec.decode(unzipSync(again)['ppt/slides/_rels/slide1.xml.rels']).includes(target));
  }
  const input = {assets: {clip: {src: url}}, slides: [{video: {src: 'asset:clip', title: 'Keep'}}, {video: {src: 'asset:clip', title: 'Clear me'}}]};
  const result = await read(modify(await toPptx(input, {seed: 1}), entries => {
    updateTag(entries, frameTag(entries, 'slides.1.video'), record => ({...record, assets: {clip: {src: current}}}));
    text(entries, 'ppt/slides/_rels/slide2.xml.rels', xml => xml.replaceAll(url, current));
    text(entries, 'ppt/slides/slide2.xml', xml => xml.replace('<a:t>Clear me</a:t>', '<a:t></a:t>'));
  }));
  assert.deepEqual(videos(result.doc), [[input.slides[0].video], []]);
  assert.deepEqual(result.doc.slides[1].blocks, [linkedText(current), {type: 'text', text: ''}]);
  assert.deepEqual(result.doc.assets, input.assets);
  assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.1.video']]);
  const again = await toPptx(result.doc, {seed: 1});
  assert.ok(!dec.decode(unzipSync(again)['ppt/slides/slide2.xml']).includes('name="OPF media '));
  assert.ok((await read(again)).doc.slides[1].blocks.some(block => block.text === ''));
  checks++;
}

// Malformed or missing full boundaries cannot inject characters or restore
// hidden text. A matching line fingerprint alone does not authenticate tags.
{
  const url = 'https://example.com/strict.mp4';
  const bytes = await toPptx({slides: [{video: {src: url, title: 'Before\r\nAfter'}}]}, {seed: 1});
  for (const mutate of [
    record => ({...record, separator: 'INJECTED'}),
    record => ({...record, separator: ''}),
    record => ({...record, boundary: 'soft', separator: '\r\n'}),
    record => { const {separator, ...legacy} = record; return legacy; },
  ]) {
    const result = await read(modify(bytes, entries => {
      const part = tagParts(entries).find(path => { const record = tagValue(dec.decode(entries[path])); return record.role === 'caption' && record.line === 0; });
      updateTag(entries, part, mutate);
    }));
    assert.deepEqual(videos(result.doc), [[]]);
    assert.ok(result.media.some(([code]) => code === 'invalid-media-provenance'));
    for (const value of ['Before', 'After']) assert.ok(result.doc.slides[0].blocks.some(block => block.text === value));
    assert.ok(!JSON.stringify(result.doc).includes('INJECTED'));
    assert.ok(result.doc.slides[0].blocks.some(block => JSON.stringify(block) === JSON.stringify(linkedText(url))));
  }
  const original = await toPptx({slides: [{video: {src: url, title: 'A B'}}]}, {seed: 1});
  const forged = await read(modify(original, entries => updateTag(entries, frameTag(entries, 'slides.0.video'), record => ({...record, video: {...record.video, title: 'A  B'}}))));
  assert.deepEqual(forged.doc.slides[0].blocks, [linkedText(url), {type: 'text', text: 'A B'}]);
  assert.deepEqual(forged.media, [['invalid-media-provenance', 'slides.0.video']]);
  checks++;
}

// Edited/damaged caption groups keep ordinary native reading order. Do not
// coalesce native shapes across changed positions or unrelated content.
{
  const input = {slides: [{blocks: [{type: 'video', video: {src: 'https://example.com/order.mp4', title: 'First\r\nSecond'}}, {type: 'text', text: 'Unrelated note'}]}]};
  const bytes = await toPptx(input, {seed: 1});
  for (const [label, ys, expected] of [
    ['reordered', [4000000, 2000000, 6000000], ['Second', 'Edited first', 'Unrelated note']],
    ['interleaved', [2000000, 4000000, 3000000], ['Edited first', 'Unrelated note', 'Second']],
  ]) {
    const result = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => {
      let moved = 0;
      const current = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
        const index = shape.includes('caption line 0"') ? 0 : shape.includes('caption line 1"') ? 1 : shape.includes('<a:t>Unrelated note</a:t>') ? 2 : -1;
        if (index === -1) return shape;
        moved++;
        return shape.replace('<a:t>First</a:t>', '<a:t>Edited first</a:t>').replace(/(<a:off\b[^>]*\by=")[^"]+/, (_match, prefix) => prefix + ys[index]);
      });
      assert.equal(moved, 3, 'Move actual caption and unrelated native text shapes.');
      return current;
    })));
    assert.deepEqual(videos(result.doc), [[]]);
    assert.deepEqual(result.doc.slides[0].blocks.filter(block => typeof block.text === 'string').map(block => block.text), expected, `${label}: preserve current native item order`);
    assert.ok(result.media.some(([code]) => code === 'invalid-media-provenance'));
  }
  checks++;
}

// Parent FF-29 full tags have explicit soft/end boundaries and fingerprints,
// but no separator field. Those boundaries unambiguously insert no character.
// Old hard boundaries cannot distinguish CR/LF/CRLF and stay conservative.
{
  const url = 'https://example.com/parent.mp4';
  const oldFull = async video => modify(await toPptx({slides: [{video}]}, {seed: 1}), entries => {
    for (const part of tagParts(entries)) updateTag(entries, part, record => { const {separator, ...old} = record; return old; });
  });
  for (const video of [{src: url, title: ' A  B '}, {src: url, title: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(12)}, 'file:///offline/' + 'long-local-path-segment/'.repeat(10) + 'clip.mp4']) {
    const result = await read(await oldFull(video));
    assert.deepEqual(videos(result.doc), [[video]], 'Intact parent soft/end tags retain video without inventing characters.');
    assert.deepEqual(result.media, []);
    assert.deepEqual(videos((await read(await toPptx(result.doc, {seed: 1}))).doc), [[video]]);
  }
  const bytes = await oldFull({src: url, title: 'A B'});
  for (const tamper of [
    entries => updateTag(entries, frameTag(entries, 'slides.0.video'), record => ({...record, video: {...record.video, title: 'A  B'}})),
    entries => { const part = tagParts(entries).find(path => tagValue(dec.decode(entries[path])).role === 'caption'); updateTag(entries, part, record => ({...record, fingerprint: '0:deadbeef41c6ce57'})); },
    entries => { const part = tagParts(entries).find(path => tagValue(dec.decode(entries[path])).role === 'caption'); updateTag(entries, part, record => { const {boundary, ...missing} = record; return missing; }); },
  ]) {
    const result = await read(modify(bytes, tamper));
    assert.deepEqual(result.doc.slides[0].blocks, [linkedText(url), {type: 'text', text: 'A B'}]);
    assert.deepEqual(result.media, [['invalid-media-provenance', 'slides.0.video']]);
  }
  const hard = await read(await oldFull({src: url, title: 'One\r\nTwo'}));
  assert.deepEqual(hard.doc.slides[0].blocks, [linkedText(url), {type: 'text', text: 'One'}, {type: 'text', text: 'Two'}]);
  assert.deepEqual(hard.media, [['invalid-media-provenance', 'slides.0.video']], 'Never infer authored CRLF from an old hard boundary.');
  checks++;
}

console.log(`Media placeholder passed: ${checks} groups; identity-only omissions, clickable surfaces, exact caption edits and linked fallback, privacy/current-frame authority, reorder/copy and untrusted tags. Native Office is a separate gate.`);
