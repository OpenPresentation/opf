// RR-105: a chart part nested deeper than the XML reader allows (but within the archive's own depth limit) never fails the import with
// a non-OPF error from the 0.34 reference-overlay reader: the import reports the part as unreadable (OPFPptxError invalid-pptx), as the
// chart reader always has.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {OPFPptxError, fromPptx, toPptx} from '../dist/index.js';

const deck = {slides: [{title: 'Target', chart: {type: 'line', data: {columns: ['Q', 'V'], rows: [['Q1', 10], ['Q2', 20], ['Q3', 15]]}, referenceLines: [{value: 12, label: 'Goal'}]}}]};
const zip = unzipSync(new Uint8Array(await toPptx(deck)));
const deep = `${'<x>'.repeat(150)}${'</x>'.repeat(150)}`;
for (const path of Object.keys(zip).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name))) zip[path] = strToU8(strFromU8(zip[path]).replace('</c:chartSpace>', `${deep}</c:chartSpace>`));
// opf#1477: the part is unreadable for that chart only: the deck imports, the chart is a placeholder, one diagnostic names the OPF error.
const found = [];
const document = await fromPptx(zipSync(zip), {onDiagnostic: diagnostic => found.push(diagnostic)});
assert.equal(document.slides.length, 1);
const unreadable = found.filter(diagnostic => diagnostic.code === 'chart-unreadable');
assert.equal(unreadable.length, 1, JSON.stringify(found.map(diagnostic => diagnostic.code)));
assert.equal(unreadable[0].reason, 'invalid-pptx', "an OPF error, never the XML reader's own");
assert.ok(OPFPptxError);
console.log('Reference overlays: a malformed chart part is an OPF import error.');
