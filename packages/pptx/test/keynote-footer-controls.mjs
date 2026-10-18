import assert from 'node:assert/strict';
import {readFile, mkdir, mkdtemp, writeFile, realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {footerControlVariant, verifyFooterPartChanges, inspectArchive, hash, prepareFooterCopy, verifyFooterControls} from '../scripts/keynote-qualification/pack.mjs';

const resolver = createRequire(path.join(process.env.OPF_KEYNOTE_TEST_CONSUMER ?? process.cwd(), 'package.json'));
const dependencies = createRequire(resolver.resolve('@openpresentation/opf-pptx/package.json'));
const engine = {fflate: dependencies('fflate'), xml: dependencies('fast-xml-parser')};
const input = await readFile(new URL('./fixtures/keynote-noop/baseline.pptx', import.meta.url));
assert.equal(hash(input), 'c51e690ca7a895ebd25a41585a2a51e532fcbb5ef86c79e3447b58a269ed47fe');
const original = Buffer.from(input), result = footerControlVariant(input, engine, {literal: 'Keynote qualification'});
assert.deepEqual(input, original, 'The exact original input archive is immutable');
assert.deepEqual(result.bytes, footerControlVariant(input, engine, {literal: 'Keynote qualification'}).bytes, 'The prepared B archive is deterministic');
const before = engine.fflate.unzipSync(input), after = engine.fflate.unzipSync(result.bytes), removals = result.proof.parts.filter(part => part.changed).map(part => part.removed);
assert.equal(result.proof.actualRemovals, 16); assert.equal(result.proof.changedParts, 16);
assert.equal(result.proof.unchangedParts, Object.keys(before).length - 16);
for (const part of Object.keys(before)) {
  if (/^ppt\/slides\/slide\d+\.xml$/.test(part)) {
    const a = engine.fflate.strFromU8(before[part]), b = engine.fflate.strFromU8(after[part]);
    assert.equal(b, a.replace('<p:ph type="ftr" sz="quarter" idx="11"/>', ''), 'Independent expected token-only byte edit');
    assert.ok(b.includes('<a:spLocks noGrp="1"/>'), 'Existing shape locks stay');
    assert.ok(b.includes('type="slidenum"'), 'Live number fields stay');
  } else assert.deepEqual(after[part], before[part], `${part}: all non-slide bytes stay exact`);
}
const a = inspectArchive(input, engine), b = inspectArchive(result.bytes, engine);
assert.deepEqual(a.slides.map(slide => slide.text), b.slides.map(slide => slide.text));
assert.deepEqual(a.slides.map(slide => slide.notesSemantics), b.slides.map(slide => slide.notesSemantics));
for (let index = 0; index < 16; index++) {
  const originalObjects = a.slides[index].textSemantics.objects, changedObjects = b.slides[index].textSemantics.objects;
  assert.deepEqual(changedObjects.map(object => object.name), originalObjects.map(object => object.name), 'Complete shape and picture paint order stays');
  assert.equal(changedObjects.find(object => object.name === `OPF furniture ${index} part 0 line 0`).placeholderRole, null);
  assert.deepEqual(a.slides[index].shapes.map(shape => shape.geometryEmu), b.slides[index].shapes.map(shape => shape.geometryEmu));
}
const changedInput = replace => {
  const parts = {...before}; parts['ppt/slides/slide2.xml'] = Buffer.from(replace(engine.fflate.strFromU8(parts['ppt/slides/slide2.xml'])));
  return engine.fflate.zipSync(parts);
};
assert.throws(() => footerControlVariant(input, engine, {literal: 'Different current words'}), /literal footer differs/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('OPF furniture 1 part 0 line 0', 'Renamed literal')), engine, {literal: 'Keynote qualification'}), /unique exact literal footer/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('OPF furniture 1 part 1 line 0', 'OPF furniture 1 part 0 line 0')), engine, {literal: 'Keynote qualification'}), /unique exact literal footer/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('K02 Paragraph editing', 'K99 Paragraph editing')), engine, {literal: 'Keynote qualification'}), /original presentation order/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('<p:ph type="ftr" sz="quarter" idx="11"/>', '')), engine, {literal: 'Keynote qualification'}), /one actual placeholder token/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('<p:ph type="ftr"', '<p:ph type="dt"')), engine, {literal: 'Keynote qualification'}), /actual ftr/);
assert.throws(() => footerControlVariant(changedInput(xml => xml.replace('</p:spTree>', '<p:sp><p:nvSpPr><p:cNvPr name="extra"/><p:nvPr><p:ph type="ftr"/></p:nvPr></p:nvSpPr></p:sp></p:spTree>')), engine, {literal: 'Keynote qualification'}), /extra footer binding/);
const tamperedSlide = {...after, 'ppt/slides/slide2.xml': Buffer.from(engine.fflate.strFromU8(after['ppt/slides/slide2.xml']).replace('Keep this second sentence.', 'Keep a changed sentence.'))};
assert.throws(() => verifyFooterPartChanges(before, tamperedSlide, removals), /beyond the one footer token/);
for (const part of ['ppt/notesSlides/notesSlide2.xml', 'ppt/slides/_rels/slide2.xml.rels', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/slideMasters/slideMaster1.xml']) {
  assert.ok(before[part]);
  assert.throws(() => verifyFooterPartChanges(before, {...after, [part]: Buffer.from('unrelated mutation')}, removals), /non-target part changed/);
}
const image = Object.keys(before).find(part => part.startsWith('ppt/media/'));
assert.throws(() => verifyFooterPartChanges(before, {...after, [image]: Buffer.from('picture mutation')}, removals), /non-target part changed/);
assert.throws(() => verifyFooterPartChanges(before, {...after, 'unexpected.xml': Buffer.from('<extra/>')}, removals), /part inventory changed/);
assert.throws(() => verifyFooterPartChanges(before, after, removals.slice(1)), /sixteen token removals/);

const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'keynote-footer-'))), sealed = path.join(directory, 'controls');
await mkdir(path.join(sealed, 'variants'), {recursive: true});
const variants = {}, files = [];
for (const [variant, bytes] of [['native-footer', input], ['ordinary-footer', result.bytes]]) {
  const file = `variants/${variant}.pptx`; await writeFile(path.join(sealed, file), bytes);
  variants[variant] = {file, sha256: hash(bytes)}; files.push({path: file, bytes: bytes.length, sha256: hash(bytes)});
}
await writeFile(path.join(sealed, 'suite.json'), JSON.stringify({schemaVersion: 1, kind: 'keynote-footer-binding-controls', variants, files}));
await verifyFooterControls(sealed);
for (const variant of Object.keys(variants)) {
  const output = path.join(directory, variant); await prepareFooterCopy({suite: sealed, variant, output});
  assert.equal(hash(await readFile(path.join(output, 'editable.pptx'))), variants[variant].sha256);
  const result = JSON.parse(await readFile(path.join(output, 'result.json'))); assert.equal(result.nativeAcceptance, false); assert.ok(result.actions.every(action => action.status === 'not-run'));
  await assert.rejects(prepareFooterCopy({suite: sealed, variant, output}), /EEXIST/);
}
await assert.rejects(prepareFooterCopy({suite: sealed, variant: 'unknown', output: path.join(directory, 'bad')}), /Unknown footer variant/);
await writeFile(path.join(sealed, 'variants/native-footer.pptx'), 'tampered');
await assert.rejects(verifyFooterControls(sealed), /bytes|sha256/);
console.log('Footer A/B control: original archive unchanged; B deterministic with exactly16 literal ftr token removals; all other part bytes, fields, locks, geometry/styles and paint order invariant; malformed targets and unrelated mutations refused; sealed fresh copies and tamper checks pass. No native acceptance.');
