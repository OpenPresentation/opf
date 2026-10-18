// RR-86: opt-in literal footer shape; compare every uncompressed package part.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {nativeFurnitureParts} from '../dist/native-furniture.js';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fonts = await loadFonts({pack: 'office'});
const options = {fonts, seed: 1, date: '2026-09-10'};
const textShapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const name = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
const literalToken = '<p:ph type="ftr" sz="quarter" idx="11"/>';
const effective = (deck, index) => deck.slides[index].design?.footer ?? deck.design?.footer;
const source = (footer, slides = [{title: 'One', text: 'Current body words.'}]) => ({
  design: {fontScheme: 'roboto', ...(footer === undefined ? {} : {footer})}, slides
});
const cases = [
  ['no-footer', source(undefined), 0],
  ['repeated-literal', source({center: {text: 'ORIGINAL_LITERAL'}, right: {text: '{{slide.number}}'}},
    [{title: 'One', text: 'First body.'}, {title: 'Two', text: 'Second body.'}, {title: 'Three', text: 'Third body.'}]), 3],
  ['date-number', source({left: {date: true}, center: {text: 'Literal footer'}, right: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}},
    [{title: 'One'}, {title: 'Two', design: {footer: {left: {date: '2026-09-10'}, center: {text: 'Local literal'}, right: {text: '{{slide.number}}'}}}}]), 2],
  ['multiple-zones', source({left: {text: 'First literal'}, center: {text: 'Second literal'}, right: {text: 'Page {{slide.number}}'}},
    [{title: 'One'}, {title: 'Two'}]), 2],
  ['multiline', source({center: {text: 'First line\nSecond line'}, right: {text: '{{slide.number}}'}}), 0],
  ['empty-literal', source({center: {text: ''}, right: {text: '{{slide.number}}'}}), 0],
  ['number-only', source({left: {date: true}, right: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}},
    [{title: 'One'}, {title: 'Two'}]), 0],
  ['linked-socials', {...source({left: {socials: true}, center: {text: 'Literal beside links'}, right: {text: '{{slide.number}}'}},
    [{title: 'One'}, {title: 'Two'}]), organization: {id: 'acme', name: 'Acme', socials: {linkedin: 'acme'}}}, 2]
];
const modes = ['full', 'references-only', false];
const argument = key => {const index = process.argv.indexOf(key); return index === -1 ? undefined : process.argv[index + 1];};
const record = argument('--record-baseline'), baseline = argument('--baseline');
assert.ok(!(record && baseline));
const recorded = [];
if (record) {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), '7f300b42166c55ee14f8f9432e7340ded26f5ee4');
  // Record only from the approved clean runtime base, before this option exists.
  execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'src', 'dist']);
  await mkdir(record);
}
const base = baseline && JSON.parse(await readFile(path.join(baseline, 'manifest.json')));
if (base) {
  assert.equal(base.revision, '7f300b42166c55ee14f8f9432e7340ded26f5ee4');
  assert.equal(base.lockSha256, hash(await readFile(new URL('../package-lock.json', import.meta.url))));
}
let defaultProof = 0, tokenRemovals = 0;
const fixtures = new Map();
for (const mode of modes) for (const [id, deck, expected] of cases) {
  const exportOptions = {...options, provenance: mode};
  const original = structuredClone(deck), bytes = await toPptx(deck, exportOptions);
  assert.deepEqual(deck, original, `${id}: source unchanged`);
  const file = `${id}-${mode}.pptx`;
  if (record) {
    await writeFile(path.join(record, file), bytes, {flag: 'wx'});
    recorded.push({file, bytes: bytes.length, sha256: hash(bytes)}); continue;
  }
  if (base) {
    const reference = await readFile(path.join(baseline, file)), entry = base.files.find(entry => entry.file === file);
    assert.equal(hash(reference), entry.sha256); assert.equal(reference.length, entry.bytes);
    assert.deepEqual(bytes, new Uint8Array(reference), `${file}: default ZIP bytes equal approved pre-option main`);
    defaultProof++;
  }
  assert.deepEqual(await toPptx(deck, {...exportOptions, footerText: 'native'}), bytes, `${file}: explicit native equals default bytes`);
  const shaped = await toPptx(deck, {...exportOptions, footerText: 'shape'});
  const before = unzipSync(bytes), after = unzipSync(shaped);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), `${file}: same package parts`);
  let removed = 0;
  for (const part of Object.keys(before)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(part)) {
      assert.deepEqual(after[part], before[part], `${file}: ${part} stays byte-identical`); continue;
    }
    const xml = strFromU8(before[part]);
    const desired = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      if (!shape.includes(literalToken)) return shape;
      assert.match(name(shape), /^OPF furniture \d+ part \d+ line 0$/);
      assert.match(shape, /<a:spLocks noGrp="1"\/>/);
      assert.doesNotMatch(shape, /<a:fld\b/, 'Literal footer target is not a live-field shape');
      assert.equal(shape.split(literalToken).length - 1, 1);
      removed++; return shape.replace(literalToken, '');
    });
    assert.deepEqual(after[part], strToU8(desired), `${file}: ${part} differs only by literal ftr token`);
  }
  assert.equal(removed, expected, `${file}: exact eligible literal footer count`);
  if (!removed) assert.deepEqual(shaped, bytes, `${file}: ineligible/no-footer archive stays exact`);
  tokenRemovals += removed;
  if (id === 'linked-socials') assert.ok(Object.values(after).some(value => strFromU8(value).includes('<a:hlinkClick ')), 'Real linked furniture remains linked');
  const read = async archive => {
    const diagnostics = [], deck = await fromPptx(archive, {onDiagnostic: issue => diagnostics.push(issue)});
    return {deck, diagnostics};
  };
  assert.deepEqual(await read(shaped), await read(bytes), `${file}: changing binding does not change current import`);
  if (id === 'repeated-literal') fixtures.set(mode, {bytes: shaped, entries: after});
}
if (record) {
  await writeFile(path.join(record, 'manifest.json'), JSON.stringify({revision: '7f300b42166c55ee14f8f9432e7340ded26f5ee4',
    lockSha256: hash(await readFile(new URL('../package-lock.json', import.meta.url))), node: process.version, files: recorded}, null, 2) + '\n', {flag: 'wx'});
  console.log(`Recorded ${cases.length} clean-main cases (${recorded.length} archives); no candidate claim.`);
} else {
  for (const value of [null, false, true, '', 'auto', 'Shape', 1, {}, []]) {
    await assert.rejects(toPptx(source(undefined), {...options, footerText: value}), error => error.code === 'invalid-footer-text-option' && error.path === 'options.footerText');
  }
  // Linked literal text is ineligible in core's native part contract, even if a future public source can produce it.
  const part = {kind: 'footer', type: 'text', field: 'text', text: 'Linked text', fit: {sourceLines: ['Linked text'], lines: ['Linked text']}, links: [{start: 0, end: 11, href: 'https://example.test'}]};
  assert.equal(nativeFurnitureParts({parts: [part]}).size, 0);
  for (const [mode, fixture] of fixtures) {
    const slide = 'ppt/slides/slide1.xml', original = strFromU8(fixture.entries[slide]);
    const target = textShapes(original).find(shape => shape.includes('ORIGINAL_LITERAL'));
    assert.ok(target); assert.doesNotMatch(target, /<p:ph\b/); assert.match(target, /<a:spLocks noGrp="1"\/>/);
    const current = async transform => {
      const entries = {...fixture.entries, [slide]: strToU8(original.replace(target, transform(target)))};
      return fromPptx(zipSync(entries));
    };
    const edited = await current(shape => shape.replace('ORIGINAL_LITERAL', 'CURRENT_LITERAL'));
    assert.equal(effective(edited, 0).center.text, 'CURRENT_LITERAL');
    for (const index of [1, 2]) assert.equal(effective(edited, index).center.text, 'ORIGINAL_LITERAL');
    for (const transform of [shape => shape.replace('ORIGINAL_LITERAL', ''), () => '']) {
      const result = await current(transform);
      assert.ok(!JSON.stringify(result.slides[0]).includes('ORIGINAL_LITERAL'), `${mode}: current clear/delete does not replay old words`);
      assert.notEqual(effective(result, 0)?.center?.text, 'ORIGINAL_LITERAL');
      assert.equal(effective(result, 0).right.text, '{{slide.number}}', 'Current live number remains a number field');
      for (const index of [1, 2]) assert.equal(effective(result, index).center.text, 'ORIGINAL_LITERAL');
    }
  }
  console.log(`Footer shape option passed: ${cases.length}/8 cases x ${modes.length} provenance modes, ${tokenRemovals} exact ftr removals, default pre-option byte proof ${defaultProof}/24 when supplied; current edit/clear/delete authority.`);
}
