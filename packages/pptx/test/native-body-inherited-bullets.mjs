// Current Keynote archive inheritance, without native applications or source-word replay.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {fromPptx} from '../dist/index.js';

const directory = new URL('./fixtures/keynote-native-bullets/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory)));
const bytes = await readFile(new URL(manifest.file, directory));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(bytes.length, manifest.bytes); assert.equal(hash(bytes), manifest.sha256);
const original = unzipSync(bytes), slide = 'ppt/slides/slide17.xml', layout = 'ppt/slideLayouts/slideLayout33.xml', master = 'ppt/slideMasters/slideMaster1.xml';
const xml = strFromU8(original[slide]);
const body = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g).find(shape => shape.includes('OPF native body slides.16.items'));
assert.ok(body.includes('<p:ph type="body" idx="1"/>'));
assert.equal((body.match(/<a:p>/g) ?? []).length, 3);
assert.ok(!body.includes('a:buChar'), 'Actual local body does not repeat inherited character bullets');
assert.match(strFromU8(original[master]), /<p:bodyStyle>[\s\S]*?<a:buChar char="•"\/>/);
const plain = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(plain).join('') : value?.text === undefined ? '' : plain(value.text);
const entries = deck => deck.slides[16].blocks?.find(block => block.type === 'list');
const currentText = deck => (deck.slides[16].blocks ?? []).map(block => plain(block.text ?? block.items)).join('\n');
async function read(parts = original) {
  const diagnostics = [], deck = await fromPptx(parts === original ? bytes : zipSync(parts), {onDiagnostic: value => diagnostics.push(value)});
  return {deck, diagnostics};
}
const {deck, diagnostics} = await read();
assert.deepEqual(entries(deck).items.map(plain), ['KN_ORIGINAL_FLAT_LIST', 'Bold flat item', 'Final flat item.']);
assert.equal(entries(deck).items[1][0].bold, true);
assert.equal(entries(deck).numbering, undefined, 'Character bullets never become numbered entries');
// Exact reviewed post-style import; no typography fields are normalized away.
// The companion inherited-style test asserts every current Body default and
// the complete import fingerprint. c529 retains its pre-style fingerprint.
assert.equal(hash(JSON.stringify({...deck, slides: deck.slides.slice(0, 16)})), '55a00618f3228b1379b5b6469d83fb35e65bb670f33c8bdb0f3e229a66773075');
assert.equal(hash(JSON.stringify(diagnostics)), 'db2fa6bd5a00ab2921d77b514e1efb3331b005dd55d6978da374bee721541fc2');
assert.equal(diagnostics.length, 21, 'All existing adaptations and the precise current K11 paint gap remain explicit');
assert.deepEqual(diagnostics.filter(value => value.path === 'slides.10.charts.0.series.0.line.color'), [{
  code: 'chart-option-adapted', option: 'series.0.line.color',
  message: "Line series 'Demand' has explicit native solid paint that is not retained as per-series formatting in OPF; imported chart colors follow its design and semantic highlight.",
  path: 'slides.10.charts.0.series.0.line.color',
}]);
const changed = (transform = value => value, edit = () => {}) => {
  const parts = {...original, [slide]: strToU8(xml.replace(body, transform(body)))}; edit(parts); return parts;
};
const paragraph = (shape, token, index = undefined) => {
  let position = 0;
  return shape.replace(/<a:pPr\b[^>]*>/g, tag => `${tag}${index === undefined || position++ === index ? token : ''}`);
};
const placeholderStyle = (parts, part, style) => {
  let count = 0;
  parts[part] = strToU8(strFromU8(parts[part]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    if (!shape.includes('<p:ph type="body" idx="1"/>')) return shape;
    count++; return shape.replace(/<a:lstStyle>[\s\S]*?<\/a:lstStyle>|<a:lstStyle\/>/, `<a:lstStyle>${style}</a:lstStyle>`);
  }));
  assert.equal(count, 1);
};
const noList = async parts => {const {deck} = await read(parts); assert.equal(entries(deck), undefined); assert.ok(currentText(deck).includes('KN_ORIGINAL_FLAT_LIST')); return deck;};

await noList(changed(shape => paragraph(shape, '<a:buNone/>')));
await noList(changed(shape => shape.replace('<a:lstStyle/>', '<a:lstStyle><a:defPPr><a:buNone/></a:defPPr></a:lstStyle>')));
await noList(changed(undefined, parts => placeholderStyle(parts, layout, '<a:lvl1pPr><a:buNone/></a:lvl1pPr>')));
await noList(changed(undefined, parts => placeholderStyle(parts, master, '<a:lvl1pPr><a:buNone/></a:lvl1pPr>')));
const localWins = await read(changed(shape => paragraph(shape, '<a:buChar char="○"/>'), parts => placeholderStyle(parts, layout, '<a:lvl1pPr><a:buNone/></a:lvl1pPr>')));
assert.equal(entries(localWins.deck).items.length, 3, 'Current paragraph bullet overrides inherited cancellation');
const shapeWins = await read(changed(shape => shape.replace('<a:lstStyle/>', '<a:lstStyle><a:lvl1pPr><a:buChar char="○"/></a:lvl1pPr></a:lstStyle>'), parts => placeholderStyle(parts, layout, '<a:lvl1pPr><a:buNone/></a:lvl1pPr>')));
assert.equal(entries(shapeWins.deck).items.length, 3, 'Shape level overrides layout');

const modified = await read(changed(shape => shape.replace('KN_ORIGINAL_FLAT_LIST', 'CURRENT_FLAT_ITEM').replace('Final flat item.', 'CURRENT_LAST_ITEM')));
assert.deepEqual(entries(modified.deck).items.map(plain), ['CURRENT_FLAT_ITEM', 'Bold flat item', 'CURRENT_LAST_ITEM']);
assert.ok(!currentText(modified.deck).includes('KN_ORIGINAL_FLAT_LIST'));
const appended = await read(changed(shape => shape.replace('</p:txBody>', '<a:p><a:pPr/><a:r><a:t>CURRENT_ADDED_ITEM</a:t></a:r></a:p></p:txBody>')));
assert.equal(entries(appended.deck).items.length, 4); assert.equal(plain(entries(appended.deck).items[3]), 'CURRENT_ADDED_ITEM');
const removed = await read(changed(shape => shape.replace(/<a:p>[\s\S]*?<\/a:p>/, '')));
assert.deepEqual(entries(removed.deck).items.map(plain), ['Bold flat item', 'Final flat item.']);
const cleared = await read(changed(shape => shape.replace(/<a:p>[\s\S]*?<\/a:p>/g, '<a:p><a:pPr/></a:p>')));
assert.equal(entries(cleared.deck), undefined); assert.ok(!currentText(cleared.deck).includes('KN_ORIGINAL_FLAT_LIST'));
const deleted = await read(changed(() => ''));
assert.equal(entries(deleted.deck), undefined); assert.ok(!currentText(deleted.deck).includes('Bold flat item'));
const mixed = await read(changed(shape => paragraph(shape, '<a:buNone/>', 1)));
assert.equal(entries(mixed.deck).items.length, 3); assert.ok(mixed.diagnostics.some(d => d.code === 'mixed-body-paragraphs'));
const level = await read(changed(shape => shape.replaceAll('<a:pPr marL=', '<a:pPr lvl="1" marL=')));
assert.ok(entries(level.deck).items.every(item => item.level === 1), 'Current outline level controls inherited membership');
const numbered = await read(changed(undefined, parts => placeholderStyle(parts, layout, '<a:lvl1pPr><a:buAutoNum type="romanUcPeriod" startAt="3"/></a:lvl1pPr>')));
assert.deepEqual(entries(numbered.deck).numbering, {style: 'roman-upper', start: 3}, 'Inherited auto-numbering retains its exact scheme and start');

await noList(changed(shape => shape.replace('<p:ph type="body" idx="1"/>', '')));
await noList(changed(shape => shape.replace('<p:ph type="body" idx="1"/>', '<p:ph type="body" idx="999"/>')));
await noList(changed(undefined, parts => {const path = 'ppt/slides/_rels/slide17.xml.rels'; parts[path] = strToU8(strFromU8(parts[path]).replace(/<Relationship\b[^>]*Type="[^"]*\/slideLayout"[^>]*\/>/, ''));}));
await noList(changed(undefined, parts => {const path = 'ppt/slideLayouts/_rels/slideLayout33.xml.rels'; parts[path] = strToU8(strFromU8(parts[path]).replace(/<Relationship\b[^>]*Type="[^"]*\/slideMaster"[^>]*\/>/, ''));}));
await noList(changed(undefined, parts => {delete parts[master];}));
await noList(changed(undefined, parts => {parts[master] = strToU8(strFromU8(parts[master]).replace('<p:ph type="body" idx="1"/>', '<p:ph type="body" idx="999"/>'));}));
await noList(changed(undefined, parts => {
  const path = 'ppt/slides/_rels/slide17.xml.rels', value = strFromU8(parts[path]);
  const relation = value.match(/<Relationship\b[^>]*Type="[^"]*\/slideLayout"[^>]*\/>/)[0];
  parts[path] = strToU8(value.replace('</Relationships>', relation.replace('Id="rId1"', 'Id="ambiguous-layout"') + '</Relationships>'));
}));
await noList(changed(undefined, parts => {
  const value = strFromU8(parts[layout]), placeholder = value.match(/<p:sp>[\s\S]*?<\/p:sp>/g).find(shape => shape.includes('<p:ph type="body" idx="1"/>'));
  parts[layout] = strToU8(value.replace('</p:spTree>', placeholder + '</p:spTree>'));
}));
console.log('Retained Keynote master bullets: K17 semantic items/current styles, paragraph/shape/layout/master precedence, explicit cancellation, levels/numbers, edits/add/delete/clear, mixed diagnostics and missing/ambiguous bindings pass; reviewed other16 import and21 diagnostic fingerprints exact.');
