// opf#1103: a PPTX that LibreOffice re-saved keeps OPF's shape names and the connectors' glue but none of OPF's stored tags, so the
// importer generates the ids of connected blocks itself. They must be unique in the whole presentation (the schema's rule), not only
// on their slide: before the fix two slides both got `blocks-0-shape` and import threw invalid-import-opf.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fromPptx} from '../src/index.js';

const bytes = await readFile(new URL('./fixtures/libreoffice/shape-overlays-libreoffice-26.8.pptx', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), '86ec2114ff55a0269d2da875c1cd476289a217c48a1cf7ec9878a8af62dce1ba', 'the retained LibreOffice file is unchanged');

const diagnostics = [];
const deck = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
assert.equal(deck.slides.length, 6);

// Every slide, block and shape id once in the presentation.
const seen = new Map();
const collect = (node, path) => {
  if (Array.isArray(node)) return node.forEach((value, index) => collect(value, `${path}/${index}`));
  if (!node || typeof node !== 'object') return;
  if (typeof node.id === 'string' && path.startsWith('/slides')) seen.set(node.id, [...(seen.get(node.id) ?? []), path]);
  for (const [key, value] of Object.entries(node)) if (key !== 'extensions') collect(value, `${path}/${key}`);
};
collect(deck.slides, '/slides');
assert.deepEqual([...seen].filter(([, paths]) => paths.length > 1), [], 'no id is used twice');

// Each connector is bound to ids of its own slide, and the routes LibreOffice kept are all back as connectors.
const idsOn = slide => {
  const ids = new Set();
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'string') ids.add(node.id);
    for (const value of Object.values(node)) walk(value);
  };
  walk(slide);
  return ids;
};
const connectors = deck.slides.map(slide => (slide.shapes ?? []).filter(entry => entry.connector));
assert.deepEqual(connectors.map(list => list.length), [0, 1, 4, 3, 11, 0]);
deck.slides.forEach((slide, index) => {
  const ids = idsOn(slide);
  for (const {connector} of connectors[index]) assert.ok(ids.has(connector.from) && ids.has(connector.to), `slide ${index + 1}: ${connector.from} -> ${connector.to} resolves`);
});
// Slide 4, the one that collided: its three blocks keep their text and are bound by the three routes.
const slide4 = JSON.stringify(deck.slides[3]);
for (const word of ['Source', 'Upper', 'Lower']) assert.ok(slide4.includes(`"${word}"`), `slide 4 keeps ${word}`);
assert.deepEqual(connectors[3].map(entry => entry.connector.route ?? 'straight'), ['elbow', 'curved', 'elbow']);
assert.ok(!diagnostics.some(diagnostic => diagnostic.code === 'invalid-import-opf'));
