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
await assert.rejects(fromPptx(zipSync(zip)), error => error instanceof OPFPptxError && error.code === 'invalid-pptx', 'an OPF error, never the XML reader\'s own');
console.log('Reference overlays: a malformed chart part is an OPF import error.');
