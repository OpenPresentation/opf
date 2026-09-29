// Controls for the PPTX run extraction (FF-38). Run: node --test pptx-runs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {runElements} from './pptx-runs.mjs';

test('a plain a:r run is extracted', () => {
  const r = runElements('<a:r><a:rPr lang="en-US" sz="1200"/><a:t>Hello</a:t></a:r>');
  assert.deepEqual(r.map(x => x.tag), ['r']); assert.match(r[0].inner, /<a:t>Hello<\/a:t>/);
});
test('an a:fld slide-number field with id and type attributes is extracted (the pre-fix regex missed it)', () => {
  const xml = '<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US" sz="1200"/><a:t>1</a:t></a:fld>';
  assert.equal([...xml.matchAll(/<a:(r|fld)>(.*?)<\/a:\1>/gs)].length, 0, 'the old pattern finds nothing');
  const r = runElements(xml);
  assert.equal(r.length, 1); assert.equal(r[0].tag, 'fld'); assert.match(r[0].attrs, /type="slidenum"/); assert.match(r[0].inner, /<a:t>1<\/a:t>/);
});
test('a date field and an attribute-free a:fld are extracted', () => {
  const r = runElements('<a:fld id="{X}" type="datetime1"><a:t>9/29/2026</a:t></a:fld><a:fld><a:t>7</a:t></a:fld>');
  assert.deepEqual(r.map(x => x.tag), ['fld', 'fld']); assert.deepEqual(r.map(x => /<a:t>(.*?)<\/a:t>/.exec(x.inner)[1]), ['9/29/2026', '7']);
});
test('runs and fields keep document order in one paragraph', () => {
  const r = runElements('<a:r><a:t>Slide </a:t></a:r><a:fld id="{X}" type="slidenum"><a:t>3</a:t></a:fld><a:r><a:t> of 9</a:t></a:r>');
  assert.deepEqual(r.map(x => x.tag), ['r', 'fld', 'r']);
  assert.equal(r.map(x => /<a:t>(.*?)<\/a:t>/.exec(x.inner)[1]).join(''), 'Slide 3 of 9');
});
test('run properties (a:rPr), paragraph properties (a:pPr) and end-of-paragraph runs (a:endParaRPr) are not runs', () => {
  assert.deepEqual(runElements('<a:pPr algn="l"/><a:rPr lang="en-US"/><a:endParaRPr lang="en-US"/>'), []);
  assert.deepEqual(runElements('<a:r><a:rPr b="1"><a:solidFill/></a:rPr><a:t>x</a:t></a:r>').map(x => x.tag), ['r']);
});
test('a self-closed a:fld has no text and does not swallow the next run', () => {
  const r = runElements('<a:fld id="{X}" type="slidenum"/><a:r><a:t>after</a:t></a:r>');
  assert.deepEqual(r.map(x => x.tag), ['r']); assert.match(r[0].inner, /after/);
});
test('a field inside a table cell body and multi-line XML are extracted', () => {
  const r = runElements('<a:fld id="{X}"\n type="slidenum">\n<a:rPr/>\n<a:t>12</a:t>\n</a:fld>');
  assert.equal(r.length, 1); assert.match(r[0].inner, /12/);
});
