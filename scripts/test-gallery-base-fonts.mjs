// FF-41: the gallery editor's eager faces split into a startup set and on-demand files (scripts/gallery-base-fonts.mjs).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exampleUsesBaseFonts, isStartupFace, splitBaseFonts, verifyBaseFonts } from './gallery-base-fonts.mjs';

const face = (family, weight, italic, text) => ({ family, weight, italic, license: 'OFL-1.1', dataUrl: `data:font/ttf;base64,${Buffer.from(text).toString('base64')}` });
const eager = [face('Roboto', 400, false, 'r400'), face('Roboto', 700, false, 'r700'), face('Roboto', 400, true, 'r400i'), face('Roboto Mono', 400, false, 'm400'), face('Carlito', 700, false, 'c700')];

assert.equal(exampleUsesBaseFonts('fetch("./base-fonts.json")'), true);
assert.equal(exampleUsesBaseFonts('fetch("./fonts.json")'), false, 'an older example reads fonts.json only');

const { startup, base, files } = splitBaseFonts(eager);
assert.deepEqual(startup.map(item => `${item.family} ${item.weight}`), ['Roboto 400'], 'Roboto Regular starts the editor');
assert.ok(eager.filter(isStartupFace).length === 1);
assert.equal(base.length, 4);
assert.equal(files.length, 4);
for (const entry of base) {
  assert.match(entry.file, /^[A-Za-z0-9.-]+-[0-9a-f]{12}\.ttf$/);
  assert.equal(entry.license, 'OFL-1.1');
  const bytes = files.find(item => item.file === entry.file).bytes;
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
}
assert.deepEqual(base.map(entry => entry.file.replace(/-[0-9a-f]{12}\.ttf$/, '')), ['Roboto-700-normal', 'Roboto-400-italic', 'Roboto-Mono-400-normal', 'Carlito-700-normal']);
assert.equal(verifyBaseFonts(base, file => files.find(item => item.file === file).bytes), base);
assert.throws(() => verifyBaseFonts(base, () => Buffer.from('tampered')), /differs from its SHA-256/);
assert.throws(() => verifyBaseFonts([{ ...base[0], file: '../escape.ttf' }], () => Buffer.alloc(0)), /unique flat font file name/);
assert.throws(() => verifyBaseFonts([{ ...base[0], sha256: 'a'.repeat(64) }], () => Buffer.alloc(0)), /SHA-256 that names it/);
assert.throws(() => splitBaseFonts([face('Roboto', 700, false, 'x')]), /exactly one Roboto Regular/);
assert.throws(() => splitBaseFonts([...eager.slice(0, 1), { family: 'X', weight: 400 }]), /no font data URL/);
console.log('Gallery base fonts: startup set, hash-named files and verification pass.');
