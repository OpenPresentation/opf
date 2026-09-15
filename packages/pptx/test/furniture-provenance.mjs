import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {validatePresentation} from '@openpresentation/opf';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';

const fonts = await loadOfficeFontRegistry(), enc = new TextEncoder(), dec = new TextDecoder();
const literal = '  Native header\twords\r\nsecond line  \r\n';
const image = {src: `data:image/png;base64,${(await readFile(new URL('fixtures/images/wide.png', import.meta.url))).toString('base64')}`, alt: '  current picture alt  '};
const effective = (deck, index, kind) => deck.slides[index].design?.[kind] ?? deck.design?.[kind];
const exportDeck = async (deck, options = {}) => {
  const source = structuredClone(deck);
  const bytes = await toPptx(deck, {...options, strictAssets: true});
  assert.deepEqual(deck, source, 'Export leaves the source unchanged.');
  return bytes;
};
let imports = 0;
const read = async bytes => {
  const copy = new Uint8Array(bytes), issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(bytes, copy, 'Import leaves its input unchanged.');
  assert.equal(validatePresentation(deck).valid, true);
  imports++;
  return {deck, issues};
};
const xml = (entries, mutate, index = 1) => {
  const path = `ppt/slides/slide${index}.xml`;
  entries[path] = enc.encode(mutate(dec.decode(entries[path])));
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const tagFiles = entries => Object.keys(entries).filter(path => /^ppt\/tags\/opfFurniture\d+\.xml$/.test(path));
const manifestFile = 'ppt/tags/opfFurnitureSlide0.xml';
const tagData = bytes => JSON.parse(Buffer.from(dec.decode(bytes).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const editTag = (entries, file, mutate) => {
  const content = dec.decode(entries[file]), data = tagData(entries[file]);
  mutate(data);
  entries[file] = enc.encode(content.replace(/\bval="[^"]+"/, `val="${Buffer.from(JSON.stringify(data)).toString('hex').toUpperCase()}"`));
};
const firstTextTag = entries => tagFiles(entries).find(path => tagData(entries[path]).role === 'text');
const furnitureShapes = (content, mutate) => content.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => shape.includes('name="OPF furniture ') ? mutate(shape) : shape);

let matrix = 0;
for (const textMeasurement of [undefined, fonts.textMeasurement])
for (const dimensions of [{widthInches: 13.333333, heightInches: 7.5}, {widthInches: 5.625, heightInches: 10}])
for (const local of [false, true]) {
  const definitions = {header: {left: {image, text: literal}, center: {organization: true}, right: {section: true}},
    footer: {left: {date: ' 2026-09-14 '}, center: {text: '', section: false, organization: false}, right: {slideNumber: true}}};
  const source = {organization: {id: 'native_org', name: '  Current Org  '}, design: {fontScheme: 'roboto', dimensions, ...(!local ? definitions : {})},
    slides: ['Overview', ''].map((section, index) => ({title: `Title ${index}`, text: `Body ${index}`, section, ...(local ? {design: definitions} : {})}))};
  const bytes = await exportDeck(source, {textMeasurement});
  assert.deepEqual(await exportDeck(source, {textMeasurement}), bytes, 'Furniture tags are deterministic.');
  const {deck, issues} = await read(bytes);
  assert.deepEqual(deck.organization, source.organization);
  for (let index = 0; index < 2; index++) {
    for (const kind of ['header', 'footer']) assert.deepEqual(effective(deck, index, kind), definitions[kind]);
    assert.equal(deck.slides[index].section, source.slides[index].section);
    assert.deepEqual(deck.slides[index].blocks, [{type: 'text', text: `Body ${index}`}]);
  }
  assert.ok(!issues.some(issue => issue.code === 'invalid-furniture-provenance'));
  if (local) assert.equal(deck.design.header, undefined);
  else assert.deepEqual(deck.design.header, definitions.header);
  const entries = unzipSync(bytes);
  for (const path of [...tagFiles(entries), ...Object.keys(entries).filter(path => /opfFurnitureSlide/.test(path))]) {
    const data = JSON.stringify(tagData(entries[path]));
    for (const forbidden of ['Native header', 'Current Org', 'Overview', '2026-09-14', 'current picture alt', image.src]) assert.ok(!data.includes(forbidden), 'Tags contain no stale words or image payloads.');
  }
  matrix++;
}

const flags = {design: {fontScheme: 'roboto', header: {left: {text: 'Inherited'}}, footer: false}, slides: [
  {title: 'Disabled', text: 'Body', design: {header: false}},
  {title: 'Empty', text: 'Body', design: {header: {}}},
  {title: 'Inherited', text: 'Body'},
  {title: 'Inactive flags', text: 'Body', design: {header: {left: {}, center: {slideNumber: false, section: false, organization: false, date: false}}}},
]};
const flagBytes = await exportDeck(flags), flagResult = (await read(flagBytes)).deck;
assert.deepEqual(flagResult.design.header, flags.design.header);
assert.equal(flagResult.design.footer, false);
for (const index of [0, 1, 3]) assert.deepEqual(flagResult.slides[index].design.header, flags.slides[index].design.header);
const missingDisabled = (await read(modify(flagBytes, entries => {delete entries[manifestFile];}))).deck;
assert.equal(missingDisabled.design.header, undefined, 'Missing false marker cannot enable a global inherited header.');
assert.equal(effective(missingDisabled, 0, 'header'), undefined);
assert.equal(effective(missingDisabled, 2, 'header').left.text, 'Inherited');

const fixture = {design: {fontScheme: 'roboto', header: {left: {text: literal}}, footer: {right: {slideNumber: true}}}, slides: [
  {title: 'First', text: 'First body'}, {title: 'Second', text: 'Second body'},
]};
const bytes = await exportDeck(fixture);
const changed = (await read(modify(bytes, entries => xml(entries, content => content.replace('Native header', 'Edited header'))))).deck;
assert.equal(effective(changed, 0, 'header').left.text, literal.replace('Native header', 'Edited header'));
assert.equal(effective(changed, 1, 'header').left.text, literal);
assert.equal(changed.design.header, undefined, 'Disagreeing current literals stay local.');
const cleared = (await read(modify(bytes, entries => xml(entries, content => furnitureShapes(content, shape => shape.includes('part 0 line') ? shape.replace(/<a:t>[\s\S]*?<\/a:t>/g, '<a:t></a:t>') : shape))))).deck;
assert.equal(effective(cleared, 0, 'header').left.text, '\r\n\r\n');
assert.ok(!JSON.stringify(cleared.slides[0]).includes('Native header'));
const renamed = (await read(modify(bytes, entries => xml(entries, content => content.replace(/name="OPF furniture [^"]+"/g, 'name="Renamed by the user"'))))).deck;
assert.equal(renamed.design.header.left.text, literal, 'Roles rely on tags, not current shape names.');
const shapesReordered = (await read(modify(bytes, entries => xml(entries, content => {
  const shapes = [...content.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
  return content.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, () => shapes.pop());
})))).deck;
assert.equal(shapesReordered.design.header.left.text, literal);
const slidesReordered = await read(modify(bytes, entries => {
  const path = 'ppt/presentation.xml', content = dec.decode(entries[path]);
  const ids = [...content.matchAll(/<p:sldId\s[^>]+\/>/g)].map(match => match[0]);
  assert.equal(ids.length, 2);
  entries[path] = enc.encode(content.replace(/<p:sldId\s[^>]+\/>/g, () => ids.pop()));
}));
assert.equal(slidesReordered.deck.slides[0].title, 'Second');
assert.equal(slidesReordered.deck.design.header.left.text, literal);
for (const index of [0, 1]) {
  assert.equal(effective(slidesReordered.deck, index, 'footer'), undefined);
  assert.ok(slidesReordered.deck.slides[index].blocks.some(block => block.text === String(2 - index)), 'Reordering cannot silently renumber current visible text.');
}
assert.ok(slidesReordered.issues.some(issue => issue.code === 'invalid-furniture-provenance'));

const corruptions = {
  missingManifest: entries => { delete entries[manifestFile]; },
  missingTextTag: entries => { delete entries[firstTextTag(entries)]; },
  badEncoding: entries => { const file = firstTextTag(entries); entries[file] = enc.encode(dec.decode(entries[file]).replace(/val="[^"]+"/, 'val="bad"')); },
  badGroup: entries => editTag(entries, firstTextTag(entries), data => {data.group = '999';}),
  badCount: entries => editTag(entries, firstTextTag(entries), data => {data.count++;}),
  badLine: entries => editTag(entries, firstTextTag(entries), data => {data.line = -1;}),
  badSeparator: entries => editTag(entries, firstTextTag(entries), data => {data.separator = 'STALE_INJECTED_WORDS';}),
  badManifestRole: entries => editTag(entries, manifestFile, data => {data.role = 'unknown';}),
  badManifestTopology: entries => editTag(entries, manifestFile, data => {data.parts[0].zone = 'constructor';}),
  mixedIdentity: entries => {const file = firstTextTag(entries); entries[file] = enc.encode(dec.decode(entries[file]).replace('</p:tagLst>', '<p:tag name="OPF_TEXT_V1" val="00"/></p:tagLst>'));},
  duplicatedShape: entries => xml(entries, content => {const shape = [...content.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find(match => match[0].includes('name="OPF furniture '))[0]; return content.replace('</p:spTree>', shape + '</p:spTree>');}),
  duplicatedManifestLink: entries => xml(entries, content => content.replace(/(<\/p:spTree><p:custDataLst>)(<p:tags[^>]+\/>)/, '$1$2$2')),
};
for (const [name, mutate] of Object.entries(corruptions)) {
  const {deck, issues} = await read(modify(bytes, mutate));
  assert.equal(effective(deck, 0, 'header'), undefined, `${name}: ambiguous furniture is not consumed`);
  assert.equal(effective(deck, 1, 'header').left.text, literal, `${name}: valid slides remain recoverable`);
  for (const word of ['Native header', 'words', 'second line', 'First body']) assert.ok(JSON.stringify(deck.slides[0]).includes(word), `${name}: current ${word}`);
  assert.ok(!JSON.stringify(deck).includes('STALE_INJECTED_WORDS'), name);
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'), name);
}

const clearedNumber = (await read(modify(bytes, entries => xml(entries, content => furnitureShapes(content,
  shape => shape.includes('part 1 line') ? shape.replace(/<a:t>[\s\S]*?<\/a:t>/g, '<a:t></a:t>') : shape))))).deck;
assert.equal(effective(clearedNumber, 0, 'footer'), undefined);
assert.ok(!JSON.stringify(clearedNumber.slides[0]).includes('PowerPoint shape:'), 'Clearing generated text must not synthesize a shape description.');
assert.ok(clearedNumber.slides[0].blocks.some(block => block.text === ''), 'The cleared native text remains empty.');

const imageSource = {design: {fontScheme: 'roboto', header: {left: {image, text: 'Image label'}}}, slides: [{title: 'Picture', text: 'Body'}]};
const imageBytes = await exportDeck(imageSource), replacement = await readFile(new URL('fixtures/images/tall.png', import.meta.url));
const imageChanged = (await read(modify(imageBytes, entries => {
  const file = Object.keys(entries).find(path => /^ppt\/media\/.*\.png$/.test(path));
  assert.ok(file); entries[file] = new Uint8Array(replacement);
  xml(entries, content => content.replace('current picture alt', 'edited picture alt'));
}))).deck;
assert.equal(effective(imageChanged, 0, 'header').left.image.src, `data:image/png;base64,${replacement.toString('base64')}`);
assert.equal(effective(imageChanged, 0, 'header').left.image.alt, '  edited picture alt  ');
for (const damage of ['tag', 'media', 'picture']) {
  const {deck, issues} = await read(modify(imageBytes, entries => {
    if (damage === 'tag') delete entries[tagFiles(entries).find(path => tagData(entries[path]).role === 'image')];
    if (damage === 'media') delete entries[Object.keys(entries).find(path => /^ppt\/media\/.*\.png$/.test(path))];
    if (damage === 'picture') xml(entries, content => content.replace(/<p:pic>[\s\S]*?<\/p:pic>/, ''));
  }));
  assert.equal(effective(deck, 0, 'header'), undefined, damage);
  assert.ok(JSON.stringify(deck).includes('Image label'), damage);
  if (damage === 'tag') assert.ok(JSON.stringify(deck).includes(image.src), 'Current image is retained outside furniture.');
  else assert.ok(!JSON.stringify(deck).includes(image.src), 'Deleted image is not resurrected.');
  assert.ok(issues.some(issue => issue.code === 'invalid-furniture-provenance'), damage);
}

const metadata = {organization: {id: 'current_org', name: 'Original organization'}, design: {fontScheme: 'roboto',
  header: {left: {organization: true}, right: {section: true}}, footer: {right: {section: true}}},
  slides: [{title: 'One', text: 'Body one', section: 'First section'}, {title: 'Two', text: 'Body two', section: 'Second section'}]};
const metadataBytes = await exportDeck(metadata);
const organizationChanged = (await read(modify(metadataBytes, entries => {for (const i of [1, 2]) xml(entries, content => content.replace('Original organization', 'Current organization'), i);}))).deck;
assert.deepEqual(organizationChanged.organization, {id: 'current_org', name: 'Current organization'});
assert.ok(!JSON.stringify(organizationChanged).includes('Original organization'));
const disagreed = await read(modify(metadataBytes, entries => xml(entries, content => content.replace('Original organization', 'Different organization'))));
assert.equal(disagreed.deck.organization, undefined);
for (const index of [0, 1]) assert.equal(effective(disagreed.deck, index, 'header'), undefined);
assert.ok(JSON.stringify(disagreed.deck.slides[0]).includes('Different organization'));
assert.ok(JSON.stringify(disagreed.deck.slides[1]).includes('Original organization'));
const sectionChanged = (await read(modify(metadataBytes, entries => xml(entries, content => content.replaceAll('First section', 'Current section'))))).deck;
assert.equal(sectionChanged.slides[0].section, 'Current section');
const sectionConflict = (await read(modify(metadataBytes, entries => xml(entries, content => content.replace('First section', 'Different section'))))).deck;
assert.equal(sectionConflict.slides[0].section, undefined);
for (const kind of ['header', 'footer']) assert.equal(effective(sectionConflict, 0, kind), undefined);
for (const text of ['Different section', 'First section']) assert.ok(JSON.stringify(sectionConflict.slides[0]).includes(text));

const native = new PptxGenJS(), nativeSlide = native.addSlide();
nativeSlide.addText('Ordinary title', {x: .4, y: .3, w: 8, h: .4, fontSize: 28});
nativeSlide.addText('Positioned footer', {x: .4, y: 6, w: 8, h: .4, fontSize: 16});
const untagged = (await read(await native.write({outputType: 'uint8array'}))).deck;
for (const kind of ['header', 'footer']) assert.equal(effective(untagged, 0, kind), undefined);
assert.ok(JSON.stringify(untagged).includes('Positioned footer'));
console.log(`Furniture provenance: ${matrix} measured/estimated local/inherited wide/portrait cases, ${Object.keys(corruptions).length} damaged-tag controls, edits/clearing/reordering, current images and metadata conflicts pass (${imports} validated imports). Native Office is a separate gate.`);
