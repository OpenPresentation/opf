import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {validate} from '@openpresentation/opf';
import {fromPptx} from '../dist/index.js';

const fixture = new URL('./fixtures/registry033-schema/', import.meta.url);
const read = name => readFile(new URL(name, fixture));
const old = JSON.parse(await read('registry033-import.opf.json'));
const expected = structuredClone(old);
assert.equal(expected.design.titleAlignment, 'left');
expected.design.titleAlignment = 'start';
assert.deepEqual(Object.keys(expected.design.footer), ['right']);
expected.design.footer = {end: expected.design.footer.right};
for (const shape of expected.slides[0].shapes) {
  for (const key of ['width', 'height']) if (shape.at[key] > 1) {
    shape.at[key + 'Px'] = shape.at[key]; delete shape.at[key];
  }
}
const cell = expected.slides[1].table.rows[0][1];
assert.equal(cell.style.align, 'left'); cell.style.align = 'start';
cell.value = cell.value.map(({lang, ...run}) => ({...run, language: lang}));
const importDeck = (bytes, diagnostics = []) => fromPptx(bytes, {catalogs: [gallery], onDiagnostic: finding => diagnostics.push(finding)});
const plain = value => typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');

test('genuine published 0.33 source/archive/old-import identities remain immutable', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  for (const [name, record] of Object.entries(manifest.files)) {
    const bytes = await read(name);
    assert.equal(bytes.length, record.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, name);
  }
  const receipt = JSON.parse(await read('receipt.json'));
  for (const pkg of receipt.packages) {
    assert.equal(pkg.version, '0.33.0');
    assert.equal(pkg.gitHead, '26fd4de9cee7e57f9e0620eddcad2dcef04e00e3');
    assert.match(pkg.integrity, /^sha512-/);
  }
});

test('genuine old registry PPTX imports as the exact current document without rewriting authored literals', async () => {
  const diagnostics = [], back = await importDeck(await read('registry033.pptx'), diagnostics);
  assert.deepEqual(back, expected);
  assert.equal(validate(back, {catalogs: [gallery], only: ['format']}).valid, true);
  assert.equal(back.slides[0].shapes[0].at.widthPx, 160);
  assert.equal(back.slides[0].shapes[1].at.widthPx, 1.01);
  assert.equal(back.slides[0].shapes[1].at.height, 0.5);
  assert.deepEqual(back.datasets, old.datasets);
  assert.deepEqual(back.extensions, old.extensions);
  assert.deepEqual(back.slides[1].table.rows[0][1].style.borders, old.slides[1].table.rows[0][1].style.borders);
  assert.equal(diagnostics.some(finding => /invalid-.*provenance|dataset-unavailable/.test(finding.code)), false);
});

test('current text, rich table text and cache edits in an old registry PPTX are not overwritten by provenance', async () => {
  const entries = unzipSync(await read('registry033.pptx'));
  const edit = (part, before, after) => {
    const xml = strFromU8(entries[part]); assert.ok(xml.includes(before), part + ' contains exact target');
    entries[part] = strToU8(xml.replace(before, after));
  };
  edit('ppt/slides/slide1.xml', '<a:t>Literal slides.0.left</a:t>', '<a:t>Edited! slides.0.left</a:t>');
  edit('ppt/slides/slide2.xml', '<a:t>Bonjour </a:t>', '<a:t>Bonsoir </a:t>');
  // The actual 0.33 table writer stored French only in provenance; its native
  // runs say en-US. Apply a real XML proofing edit too, and require that current
  // override instead of restoring an unobserved language from stale source.
  const tableXml = strFromU8(entries['ppt/slides/slide2.xml']);
  const currentRun = [...tableXml.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(match => match[0]).find(run => run.includes('<a:t>Bonsoir </a:t>'));
  assert.ok(currentRun);
  assert.match(currentRun, /lang="en-US"/);
  entries['ppt/slides/slide2.xml'] = strToU8(tableXml.replace(currentRun, currentRun.replace('lang="en-US"', 'lang="fr-FR" altLang="en-US"')));
  const chartPart = Object.keys(entries).find(name => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  assert.ok(chartPart);
  edit(chartPart, '<c:v>12</c:v>', '<c:v>13</c:v>');
  const back = await importDeck(zipSync(entries));
  assert.equal(plain(back.slides[0].blocks[0].text), 'Edited! slides.0.left');
  const editedCell = back.slides[1].table.rows[0][1];
  assert.equal(plain(editedCell.value), 'Bonsoir slides.0.left');
  assert.ok(editedCell.value.some(run => run?.language === 'fr-FR'));
  assert.equal(editedCell.style.align, 'start');
  const accent = /<a:accent1>\s*<a:srgbClr val="([0-9A-Fa-f]+)"/.exec(strFromU8(entries['ppt/theme/theme1.xml']))?.[1];
  assert.ok(accent);
  assert.deepEqual(editedCell.style.borders.left, {color: '#' + accent.toUpperCase(), width: 1});
  assert.deepEqual(back.slides[0].shapes.map(shape => shape.at), expected.slides[0].shapes.map(shape => shape.at));
  assert.deepEqual(back.datasets, expected.datasets);
  assert.deepEqual(back.extensions, expected.extensions);
  assert.equal(back.slides[2].chart.data.dataset, undefined, 'edited native cache cannot regain the stale dataset reference');
  assert.equal(back.slides[2].chart.data.rows[0][1], 13);
});

test('an old table text edit cannot recover a French override that its native XML never stored', async () => {
  const entries = unzipSync(await read('registry033.pptx'));
  const xml = strFromU8(entries['ppt/slides/slide2.xml']);
  assert.ok(xml.includes('<a:t>Bonjour </a:t>'));
  entries['ppt/slides/slide2.xml'] = strToU8(xml.replace('<a:t>Bonjour </a:t>', '<a:t>Bonsoir </a:t>'));
  const back = await importDeck(zipSync(entries));
  const value = back.slides[1].table.rows[0][1].value;
  assert.equal(plain(value), 'Bonsoir slides.0.left');
  assert.equal(value.some(run => run?.language === 'fr-FR'), false, 'current en-US native text cannot regain stale French source proofing');
});
