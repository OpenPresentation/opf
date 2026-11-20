// RR-105 (#1290, ribbon audit gap 14): no exported part names a vendored library, and the workbook embedded in every chart
// names the deck's author (else a neutral "OPF") as its creator and last editor, with a neutral application name. Excel's
// File > Info (Chart Design > Edit Data > Edit in Excel) shows these values; the vendored writer used to name itself there.
//
// RR-103 removed third-party names from the repository; this extends that rule to the bytes OPF writes. The names are read
// from the vendored packages' own UPSTREAM.json records, so the check follows a vendor change and this file names none.
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {examples} from '@openpresentation/opf/examples';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const vendorDirectory = new URL('../vendor/', import.meta.url);
const vendorNames = [];
for (const entry of await readdir(vendorDirectory, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue;
  const upstream = JSON.parse(await readFile(new URL(`${entry.name}/UPSTREAM.json`, vendorDirectory), 'utf8'));
  // "@scope/name-suffix" -> "name": the library's own name without scope or fork suffix.
  vendorNames.push(upstream.name.split('/').pop().split('-')[0]);
}
assert.ok(vendorNames.length >= 2, 'every vendored library records its upstream name');
const vendorPattern = new RegExp(vendorNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');

// Every part, and every part of a nested package (the chart workbooks), with its path.
function* packageParts(bytes, prefix = '') {
  for (const [path, data] of Object.entries(unzipSync(bytes))) {
    if (/\.(?:xlsx|zip)$/i.test(path)) yield* packageParts(data, `${prefix}${path}!`);
    else yield [`${prefix}${path}`, data];
  }
}
const vendorHits = bytes => [...packageParts(bytes)].filter(([, data]) => vendorPattern.test(strFromU8(data, true))).map(([path]) => path);
const workbooks = bytes => Object.entries(unzipSync(bytes)).filter(([path]) => /^ppt\/embeddings\/.*\.xlsx$/.test(path))
  .map(([path, data]) => {
    const parts = unzipSync(data);
    return {path, core: strFromU8(parts['docProps/core.xml']), app: strFromU8(parts['docProps/app.xml'])};
  });
let checks = 0;

const chartSlides = [
  {title: 'Sales', chart: {type: 'column', data: {columns: ['Quarter', 'Sales', 'Cost'], rows: [['Q1', 1, 2], ['Q2', 3, 4]]}}},
  {title: 'Spread', chart: {type: 'histogram', data: {columns: ['Value'], rows: [[1], [2], [5], [8]]}}}
];

// 1. The workbook of a classic and an extended chart: the deck's author, else "OPF"; several authors joined as in the deck.
for (const [author, expected] of [[undefined, 'OPF'], ['Ada Lovelace', 'Ada Lovelace'], [['Ada', 'Grace & Co <x>'], 'Ada; Grace &amp; Co &lt;x&gt;']]) {
  const bytes = await toPptx({name: 'Workbook properties', ...(author === undefined ? {} : {author}), slides: chartSlides}, {});
  const books = workbooks(bytes);
  assert.equal(books.length, 2, 'one workbook per chart');
  for (const {path, core, app} of books) {
    assert.match(core, new RegExp(`<dc:creator>${expected}</dc:creator>`), `${path}: creator`);
    assert.match(core, new RegExp(`<cp:lastModifiedBy>${expected}</cp:lastModifiedBy>`), `${path}: last modified by`);
    assert.match(app, /<Application>OPF<\/Application>/, `${path}: neutral application name`);
    // The deterministic dates stay (normalizeNestedZip).
    assert.match(core, /<dcterms:created xsi:type="dcterms:W3CDTF">1980-01-01T00:00:00Z<\/dcterms:created>/, `${path}: created stamp`);
  }
  assert.deepEqual(vendorHits(bytes), [], 'no part of the chart deck names a vendored library');
  checks++;
}

// 2. Every bundled example (charts, tables, pictures, SmartArt, notes, footers, sections): no part names a vendored library.
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const failures = [];
for (const {file, deck} of examples) {
  const bytes = await toPptx(deck, {imageResolver: async () => image});
  const hits = vendorHits(bytes);
  if (hits.length) failures.push({file, hits});
  checks++;
}
assert.deepEqual(failures, [], 'no exported part names a vendored library');

console.log(`vendor-names: ${checks} exports checked (${examples.length} examples)`);
