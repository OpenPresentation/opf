// RR-86: coherent opt-in bodies, current-content import and explicit measured fallbacks.
// Archive controls only; no native application or raster qualification.
import assert from 'node:assert/strict';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {readLayoutTag} from '../src/template-layouts.js';
import {toPptx, fromPptx, catalogs} from './helpers/default-catalog.mjs';

const options = {seed: 986, timestamp: '2026-10-15T00:00:00Z', zipDate: '2026-10-15T00:00:00Z'};
const part = 'ppt/slides/slide1.xml';
const decode = (entries, path) => strFromU8(entries[path]);
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const bodyShapes = entries => shapes(decode(entries, part)).filter(shape => shape.includes('name="OPF native body '));
const plain = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(plain).join('') : value?.text !== undefined ? plain(value.text) : '';
const texts = deck => deck.slides.flatMap(slide => [slide.text, ...(slide.blocks ?? []).map(block => block.text ?? (block.items ?? []).map(plain).join('\n'))]).map(plain).join('\n');
const deck = slide => ({name: 'Native body control', design: {fontScheme: 'roboto'}, slides: [slide]});
async function exported(source, extra = {}) {
  const before = JSON.stringify(source), diagnostics = [];
  const bytes = new Uint8Array(await toPptx(source, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  assert.equal(JSON.stringify(source), before, 'Export never rewrites source');
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics};
}
function layoutPart(entries, slide = 1) {
  const rel = [...decode(entries, `ppt/slides/_rels/slide${slide}.xml.rels`).matchAll(/<Relationship\b[^>]*\/>/g)].map(([rel]) => rel).find(rel => /Type="[^"]*\/slideLayout"/.test(rel));
  return 'ppt/' + rel.match(/Target="\.\.\/([^"]+)"/)[1];
}
function editBody(base, transform, wholeSlide = xml => xml) {
  const entries = unzipSync(base);
  let count = 0;
  const xml = decode(entries, part).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    if (!shape.includes('name="OPF native body ')) return shape;
    count++; return transform(shape);
  });
  assert.equal(count, 1);
  entries[part] = strToU8(wholeSlide(xml));
  return zipSync(entries, {mtime: new Date('2000-01-01T00:00:00Z'), level: 0});
}
async function imported(bytes) {
  const diagnostics = [], value = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.equal(validate(value, {only: ['format']}).valid, true);
  return {value, diagnostics};
}

await assert.rejects(() => toPptx(deck({text: 'Body'}), {bodyText: 'invalid'}), error => error.code === 'invalid-body-text-mode' && error.path === 'options.bodyText');

const auto = deck({title: 'Anchor title', text: 'First paragraph\n\nLast paragraph\n'});
const measured = await exported(auto), explicitMeasured = await exported(auto, {bodyText: 'measured'});
assert.deepEqual(explicitMeasured.bytes, measured.bytes, 'Explicit measured is byte-identical to default');
assert.equal(bodyShapes(measured.entries).length, 0);
assert.match(decode(measured.entries, layoutPart(measured.entries)), /type="titleOnly"/);
const native = await exported(auto, {bodyText: 'native'});
assert.deepEqual(native.diagnostics, []);
assert.equal(bodyShapes(native.entries).length, 1, 'Exactly one real body, independent of paragraph or wrap count');
const [body] = bodyShapes(native.entries);
assert.match(body, /<p:ph type="body" idx="300"\/>/);
assert.match(body, /<a:bodyPr[^>]*wrap="square"/);
assert.match(body, /<a:noAutofit\/>/);
assert.ok(!/normAutofit|spAutoFit|p:tags/.test(body));
assert.equal((body.match(/<a:p>/g) ?? []).length, 4, 'Hard and blank/trailing paragraphs survive');
assert.match(body, /<a:defRPr[^>]*><a:solidFill>/, 'Defaults use valid run-property color structure');
assert.match(body, /<a:endParaRPr[^>]*sz="1875"/);
assert.match(body, /<a:latin typeface="Roboto"/);
assert.match(decode(native.entries, layoutPart(native.entries)), /type="tx"/);
assert.match(decode(native.entries, part), /<p:ph type="title"\/>/, 'Accepted title remains a real title');
assert.equal(plain((await imported(native.bytes)).value.slides[0].text), auto.slides[0].text);

const rich = deck({title: 'Rich body', layout: 'two-column', blocks: [
  {text: [{text: 'Bold ', bold: true, italic: true, fontSize: 24, color: '#123456'}, {text: 'Normal ', bold: false, italic: false, underline: false, fontSize: 22}, {text: 'Link', link: 'https://example.org', fontFamily: 'Roboto', lang: 'fr-FR'}]},
  {metric: {value: 24, label: 'Teams'}}
]});
const nativeRich = await exported(rich, {bodyText: 'native'});
assert.deepEqual(nativeRich.diagnostics, []);
const [richBody] = bodyShapes(nativeRich.entries);
assert.match(richBody, /<a:rPr[^>]*sz="2400"[^>]*b="1"[^>]*i="1"/);
assert.match(richBody, /<a:srgbClr val="123456"/);
assert.match(richBody, /<a:rPr[^>]*sz="2200"[^>]*u="none"/);
assert.match(richBody, /<a:rPr[^>]*lang="fr-FR"/);
assert.match(richBody, /<a:hlinkClick /);
const nativeLayout = layoutPart(nativeRich.entries), tag = readLayoutTag(nativeRich.entries, nativeLayout);
assert.equal(tag.reference, 'two-column');
assert.equal(tag.regions['300'], 'first');
assert.equal(tag.regions['101'], 'second', 'Unselected object slots keep their original indexes');
assert.match(decode(nativeRich.entries, nativeLayout), /name="Two columns \(native body\)"/);
const defaultsForSameTemplate = Object.keys(nativeRich.entries).filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)).map(path => decode(nativeRich.entries, path));
assert.ok(defaultsForSameTemplate.some(xml => /name="Two columns"/.test(xml) && !/type="body"/.test(xml)), 'Original catalog layout remains available');
const importedRich = (await imported(nativeRich.bytes)).value.slides[0].blocks[0].text;
assert.equal(plain(importedRich), 'Bold Normal Link');
assert.equal(importedRich.find(run => run.text === 'Bold ').fontSize, 24, 'Authored run size is points');
assert.equal(importedRich.find(run => run.text === 'Normal ').bold, false);
assert.equal(importedRich.find(run => run.text === 'Normal ').italic, false);

const centered = deck({title: 'Anchor', layout: 'custom:anchored', text: 'Centered body', design: {contentAlignment: 'right'}});
centered.catalogs = {custom: {layouts: {anchored: {name: 'Anchored', areas: [['title'], ['body']], rows: ['auto', 1], regions: {body: {accepts: ['text'], flow: 'none', anchor: 'middle'}}}}}};
const centeredOutput = await exported(centered, {bodyText: 'native'});
const [centeredBody] = bodyShapes(centeredOutput.entries);
assert.match(centeredBody, /anchor="ctr"/); assert.match(centeredBody, /<a:pPr[^>]*algn="r"/);
const context = resolveSlideContext(centered, 0, {catalogs}), geometry = composeSlide(context.slide, context.options);
const regionBox = geometry.regions[0].box;
assert.match(centeredBody, new RegExp(`<a:off x="${Math.round(regionBox.x * 9525)}" y="${Math.round(regionBox.y * 9525)}"/><a:ext cx="${Math.round(regionBox.width * 9525)}" cy="${Math.round(regionBox.height * 9525)}"/>`), 'Body uses whole allocated region, not its centered line box');

const bulletDeck = deck({title: 'Bullets', layout: 'list', blocks: [{type: 'list', items: ['One bullet that remains a paragraph even when it wraps. '.repeat(5), [{text: 'Bold item', bold: true}]]}]});
const bullets = await exported(bulletDeck, {bodyText: 'native'});
assert.deepEqual(bullets.diagnostics, []);
assert.equal(bodyShapes(bullets.entries).length, 1);
assert.equal((bodyShapes(bullets.entries)[0].match(/<a:p>/g) ?? []).length, 2, 'One paragraph per source entry, no per-line fake bodies');
assert.equal((await imported(bullets.bytes)).value.slides[0].blocks[0].items.length, 2);
const appendedBullet = editBody(bullets.bytes, shape => {
  return shape.replace('</p:txBody>', '<a:p><a:r><a:t>ADDED_ITEM</a:t></a:r><a:endParaRPr/></a:p></p:txBody>');
});
assert.equal((await imported(appendedBullet)).value.slides[0].blocks[0].items.length, 3);
assert.ok(texts((await imported(appendedBullet)).value).includes('ADDED_ITEM'));
const mixedBullet = editBody(bullets.bytes, shape => shape.replace('</p:txBody>', '<a:p><a:pPr><a:buNone/></a:pPr><a:r><a:t>PLAIN_AFTER_LIST</a:t></a:r><a:endParaRPr/></a:p></p:txBody>'));
const mixedImport = await imported(mixedBullet);
assert.ok(texts(mixedImport.value).includes('PLAIN_AFTER_LIST'));
assert.ok(mixedImport.diagnostics.some(diagnostic => diagnostic.code === 'mixed-body-paragraphs'));

for (const provenance of ['full', 'references-only', false]) {
  const source = deck({title: 'Anchor title', text: [{text: 'ORIGINAL_BODY', fontSize: 26}]});
  const output = await exported(source, {bodyText: 'native', provenance});
  const changed = editBody(output.bytes, shape => shape.replace(/<a:t>ORIGINAL_BODY<\/a:t>/, '<a:t>CURRENT_BODY</a:t>'));
  const current = (await imported(changed)).value;
  assert.ok(texts(current).includes('CURRENT_BODY')); assert.ok(!texts(current).includes('ORIGINAL_BODY'));
  const appended = editBody(changed, shape => shape.replace('</p:txBody>', '<a:p><a:r><a:t>ADDED_PARAGRAPH</a:t></a:r><a:endParaRPr/></a:p></p:txBody>'));
  assert.ok(texts((await imported(appended)).value).includes('CURRENT_BODY\nADDED_PARAGRAPH'));
  const titleDeleted = editBody(changed, shape => shape, xml => shapes(xml).filter(shape => shape.includes('name="OPF heading ')).reduce((xml, heading) => xml.replace(heading, ''), xml));
  const withoutTitle = (await imported(titleDeleted)).value;
  assert.equal(withoutTitle.slides[0].title, undefined, 'Body never becomes a title after title deletion');
  assert.ok(texts(withoutTitle).includes('CURRENT_BODY'));
  const cleared = editBody(changed, shape => shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody>'));
  assert.ok(!/ORIGINAL_BODY|CURRENT_BODY/.test(texts((await imported(cleared)).value)), 'Cleared placeholder never restores old words');
  const removed = editBody(changed, () => '');
  assert.ok(!/ORIGINAL_BODY|CURRENT_BODY/.test(texts((await imported(removed)).value)), 'Deleted body stays deleted');
  const resized = editBody(changed, shape => shape.replace(/<a:ext cx="(\d+)"/, (_, width) => `<a:ext cx="${Number(width) - 95250}"`));
  const resizeImport = await imported(resized);
  assert.ok(texts(resizeImport.value).includes('CURRENT_BODY'));
  if (provenance === 'full') assert.ok(resizeImport.diagnostics.some(diagnostic => diagnostic.code === 'slide-reference-changed'));
  const extraShape = editBody(changed, shape => shape, xml => {
    const copied = bodyShapes(unzipSync(changed))[0].replace(/name="OPF native body [^"]*"/, 'name="Added body"').replace(/<p:cNvPr id="\d+"/, '<p:cNvPr id="900"')
      .replace(/<p:ph\b[^>]*\/>/, '').replace(/CURRENT_BODY/g, 'NEW_OBJECT').replace(/<a:off x="(\d+)" y="\d+"/, '<a:off x="$1" y="5500000"');
    return xml.replace('</p:spTree>', copied + '</p:spTree>');
  });
  const extraImport = await imported(extraShape);
  assert.ok(texts(extraImport.value).includes('CURRENT_BODY') && texts(extraImport.value).includes('NEW_OBJECT'));
  if (provenance === 'full') assert.ok(extraImport.diagnostics.some(diagnostic => diagnostic.code === 'slide-reference-changed'));
}

const fallbacks = [
  ['group', {title: 'Group', blocks: [{blocks: [{text: 'Grouped'}]}]}, 'complex-composition'],
  ['K04 description/nesting', {title: 'List', layout: 'list', items: [{text: 'Parent', description: 'Description'}, {text: 'Child', level: 1}]}, 'unsupported-list'],
  ['K06 columns', {title: 'List', layout: 'list', items: Array.from({length: 14}, (_, index) => `Agenda item ${index + 1} with a few more words`)}, 'multi-column'],
  // RR-88: one numbered sequence is native (test/native-title-and-bodies.mjs); an entry with its own start is not.
  ['restarted numbering', {title: 'List', items: ['First', {text: 'Second', start: 7}], numbering: 'arabic'}, 'unsupported-list'],
  ['tabs', {title: 'Tabs', text: 'First\tSecond'}, 'unsupported-text'],
  ['Arabic in LTR deck', {title: 'Arabic', text: 'مرحبا بالعالم'}, 'unsupported-text'],
  ['Hebrew phrase in LTR deck', {title: 'Hebrew', text: 'A phrase: שלום'}, 'unsupported-text'],
  ['Arabic letter mark', {title: 'Control', text: '\u061C123'}, 'unsupported-text'],
  ['annotated', {title: 'Note', text: [{text: 'With note', footnote: 'Supporting note'}]}, 'annotated-text'],
  ['unsupported effect', {title: 'Effect', text: [{text: 'Superscript', superscript: true}]}, 'unsupported-text']
];
for (const [name, slide, reason] of fallbacks) {
  const source = deck(slide), output = await exported(source, {bodyText: 'native'}), measured = await exported(source);
  assert.equal(bodyShapes(output.entries).length, 0, name);
  assert.ok(output.diagnostics.some(diagnostic => diagnostic.code === 'native-body-fallback' && diagnostic.reason === reason && /^slides\.0\./.test(diagnostic.path)), name + ': path-specific fallback');
  assert.deepEqual(output.bytes, measured.bytes, name + ': unsupported body retains exact measured output');
}

console.log('Native body prototype passed: one truthful body, exact defaults, hard paragraphs, rich sizes/styles, flat bullets, layout variants/anchors, current edits and deletion in every provenance mode, K04/K06 and diagnosed measured fallbacks. No native application acceptance.');
