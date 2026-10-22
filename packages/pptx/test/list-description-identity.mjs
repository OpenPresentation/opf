import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {listLineRoles, validateListRoles, MAX_LIST_BREAKS} from '../dist/content-topology.js';

const source = {slides: [{title: 'List', items: [{text: 'With a description', description: 'about it'}, {text: 'Second', description: 'second details', level: 1}], numbering: 'arabic'}]};
const bytes = await toPptx(source);
const slidePath = 'ppt/slides/slide1.xml';
function replaceOne(text, pattern, replacement) {
  const global = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
  assert.equal([...text.matchAll(global)].length, 1, `one mutation target: ${pattern}`);
  const changed = text.replace(pattern, replacement);
  assert.notEqual(changed, text, `mutation changes bytes: ${pattern}`);
  return changed;
}
function edit(data, part, transform) {
  const parts = unzipSync(data);
  assert.ok(parts[part], `part exists: ${part}`);
  const before = strFromU8(parts[part]), after = transform(before);
  assert.notEqual(after, before, 'XML mutation changes its target part');
  parts[part] = strToU8(after);
  return zipSync(parts);
}
function shape(xml, line, transform) {
  return replaceOne(xml, new RegExp(`<p:sp><p:nvSpPr><p:cNvPr id="\\d+" name="OPF list slides\\.0\\.items line ${line}"[\\s\\S]*?</p:sp>`), transform);
}
const lineEdit = (transform, data = bytes, line = 1) => edit(data, slidePath, xml => shape(xml, line, transform));
const resize = size => xml => replaceOne(xml, /(<a:rPr\b[^>]*\b)sz="\d+"/, `$1sz="${size * 100}"`);
const recolor = xml => replaceOne(xml, /(<a:rPr\b[^>]*>)<a:solidFill>[\s\S]*?<\/a:solidFill>/, '$1<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>');
const items = async data => { const slide = (await fromPptx(data)).slides[0]; return slide.items ?? slide.blocks?.find(block => block.items)?.items; };
const expected = description => [{text: 'With a description', description}, source.slides[0].items[1]];
assert.deepEqual(await fromPptx(bytes), source);
for (const size of [24, 36]) assert.deepEqual(await items(lineEdit(resize(size))), expected([{text: 'about it', fontSize: size}]), 'only edited native size returns');
assert.deepEqual(await items(lineEdit(recolor)), expected([{text: 'about it', color: '#FF0000'}]), 'only edited native color returns');
assert.deepEqual(await items(lineEdit(xml => resize(36)(replaceOne(xml, /about it/, 'NEW native words')))), expected([{text: 'NEW native words', fontSize: 36}]), 'current native words and size return');
assert.deepEqual(await items(lineEdit(xml => replaceOne(xml, /about it/, ''))), ['With a description', source.slides[0].items[1]], 'cleared description is never replayed');

const multiline = {slides:[{title:'List',items:[{text:'one\ntwo',description:'three\nfour'},'five']}]};
const multilineBytes = await toPptx(multiline);
assert.deepEqual(await fromPptx(multilineBytes), multiline);
assert.deepEqual(await items(lineEdit(xml => resize(36)(replaceOne(xml, /four/, 'EDITED later line')), multilineBytes, 3)), [{text:'one\ntwo',description:['three',{text:'\nEDITED later line',fontSize:36}]}, 'five'], 'later description line edits keep preceding text and hard break');
const nested = {slides:[{title:'List',items:[{text:'one',level:1,description:'nested'},'two'],numbering:'arabic'}]};
assert.deepEqual(await fromPptx(await toPptx(nested)), nested);
assert.deepEqual((await fromPptx(await toPptx({slides:[{title:'List',items:[{text:'one',description:''},'two']}]}))).slides[0].items, ['one','two'], 'empty descriptions emit no native content');

const tagEdit = change => edit(bytes, 'ppt/tags/opfSlide1.xml', xml => replaceOne(xml, /val="([^"]+)"/, (_, hex) => {
  const record = JSON.parse(Buffer.from(hex,'hex').toString());
  const before = JSON.stringify(record); change(record); assert.notEqual(JSON.stringify(record), before, 'tag mutation changes record');
  return `val="${Buffer.from(JSON.stringify(record)).toString('hex')}"`;
}));
const tag = JSON.parse(Buffer.from(strFromU8(unzipSync(bytes)['ppt/tags/opfSlide1.xml']).match(/val="([^"]+)"/)[1],'hex').toString());
assert.deepEqual(tag.listRoles[0][1], [[0,'text',true],[0,'description',false],[1,'text',true],[1,'description',false]]);
assert.doesNotMatch(JSON.stringify(tag.listRoles), /about|With/);
for (const value of [[], [['slides.0.items',[[0,'description',true]]]], [['slides.0.items',[[0,'text',true],[2,'description',false]]]], [['slides.0.items',[[0,'text',true]]],['slides.0.items',[[0,'text',true]]]]]) assert.throws(() => validateListRoles(value));
const omissions = [];
assert.equal(listLineRoles([{field:'items',path:'slides.0.items',text:{listEntries:[{text:{richLines:Array.from({length:MAX_LIST_BREAKS},()=>({}))},description:{richLines:[{}]}}]}}], (path, reason) => omissions.push({path,reason})), undefined);
assert.equal(omissions.length, 1);
assert.equal(omissions[0].path, 'slides.0.items');
assert.match(omissions[0].reason, /bounded/);

// Refused topology never loses the current native words (except explicit deletion).
const words = document => JSON.stringify(document);
function noRecoveredDescription(document) {
  assert.match(words(document), /about it/, 'native description words retained');
  assert.doesNotMatch(words(document), /"description":\[\{"text":"about it"/, 'description role was refused');
}
for (const damaged of [tagEdit(r => {delete r.listRoles;}),tagEdit(r => {r.listRoles[0][1][1][0]=99;}),tagEdit(r => {r.native.listIdentity='00000000000000';})]) noRecoveredDescription(await fromPptx(lineEdit(resize(36), damaged)));
for (const mutate of [
  xml => replaceOne(xml, /line 1/, 'line 9'),
  xml => replaceOne(xml, /line 1/, 'line 0'),
  xml => replaceOne(xml, /<a:xfrm>[\s\S]*?<\/a:xfrm>/, '<a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="1000"/></a:xfrm>'),
  xml => replaceOne(xml, /<a:buNone\/>/, '<a:buChar char="•"/>'),
]) noRecoveredDescription(await fromPptx(lineEdit(xml => mutate(resize(36)(xml)))));
const removed = lineEdit(()=>''); assert.doesNotMatch(words(await fromPptx(removed)), /about it/, 'deleted native description is not replayed');
const resized = lineEdit(resize(36));
const reordered = edit(resized, slidePath, xml => {
  const pattern = /<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="OPF list slides\.0\.items line [01]"[\s\S]*?<\/p:sp>/g;
  const matches = [...xml.matchAll(pattern)]; assert.equal(matches.length, 2);
  assert.match(matches[0][0], /line 0"/); assert.match(matches[1][0], /line 1"/);
  const positions = matches.map(match => match[0].match(/<a:xfrm>[\s\S]*?<\/a:xfrm>/)[0]);
  let index=0; const after=xml.replace(pattern, () => matches[1-index++][0]);
  assert.deepEqual([...after.matchAll(pattern)].map(match=>match[0].match(/<a:xfrm>[\s\S]*?<\/a:xfrm>/)[0]), positions.toReversed(), 'only physical order changes; geometry remains attached to names');
  return after;
});
noRecoveredDescription(await fromPptx(reordered));
const legacy = await toPptx(source, {provenance:false});
const legacyEdited = await fromPptx(lineEdit(resize(36), legacy));
noRecoveredDescription(legacyEdited);
const legacyItems = await items(lineEdit(resize(36), legacy));
assert.equal(legacyItems[0].some(run => run.text === 'about it' && run.fontSize === 36), true, 'provenance-free heuristic joins resized description into entry text and keeps its native size');
console.log('list-description-identity: exact native edits, multiline roles, topology refusals and omission budgets PASS');
