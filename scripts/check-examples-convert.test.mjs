// RR-97: the in-process check of scripts/check-examples-convert.mjs passes a deck that converts, fails a deck that does not, and
// agrees with `opf convert` (the built workspace CLI) on both.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDecks, cliSample, convertInProcess, convertWithCli, ensureBuilt, exampleDecks, pngSample } from './check-examples-convert.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWMwTpsJRwzEcQDrIxMhLoLCbgAAAABJRU5ErkJggg==', 'base64');
let temp;
const write = async (name, content) => {
  const file = path.join(temp, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content));
  return file;
};
// opf-pptx 0.24.1 and later turn an unreadable image into a pptx/unresolved-asset warning; before it was the pptx/asset-unresolved error.
const unreadableImageIsAnError = async () => {
  const [major, minor, patch] = JSON.parse(await readFile(path.join(root, 'packages', 'cli', 'node_modules', '@openpresentation', 'opf-pptx', 'package.json'), 'utf8')).version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return major === 0 && (minor < 24 || (minor === 24 && patch < 1));
};
const legs = (failures) => failures.map(({ format, reason }) => `${format}${/asset-unresolved/.test(reason) ? ' asset-unresolved' : ''}`).sort();
const both = (deck, previews = ['svg']) => [...previews, 'pptx'].map((format) => ({ deck, format }));

before(async () => {
  ensureBuilt();
  temp = await mkdtemp(path.join(tmpdir(), 'opf-examples-convert-test-'));
});
after(async () => {
  if (temp) await rm(temp, { recursive: true, force: true });
});

test('the example decks are listed and the samples are fixed, small and inside the list', () => {
  const decks = exampleDecks();
  assert.ok(decks.length > 100);
  assert.ok(decks.includes('examples/markdown/outline.md'), 'a plain .md outline is a deck');
  for (const sample of [cliSample(decks), pngSample(decks)]) {
    assert.ok(sample.length >= 2 && sample.length <= 12);
    for (const deck of sample) assert.ok(decks.includes(deck));
  }
  assert.ok(cliSample(decks).some((deck) => !deck.endsWith('.json')), 'the CLI sample reads a Markdown deck');
});

test('a deck that converts passes, as SVG, PNG and PPTX, in-process and through the CLI', async () => {
  const deck = await write('good/good.opf.json', { name: 'Good', slides: [{ title: 'Hello', image: 'assets/pixel.png' }] });
  await write('good/assets/pixel.png', PIXEL);
  assert.deepEqual(await convertInProcess(both(deck, ['svg', 'png']), 2), []);
  assert.deepEqual(await convertWithCli(both(deck, ['png'])), []);
  const result = await checkDecks([deck], { jobs: 1, png: [deck], sample: [deck] });
  assert.deepEqual(result.failures, []);
  assert.equal(result.conversions, 4, 'png and pptx in-process, png and pptx through the CLI');
  assert.equal((await checkDecks([deck], { jobs: 1, png: [], sample: [] })).conversions, 2, 'svg and pptx');
});

test('a deck with an unresolved image fails under the rules the CLI has, and the CLI agrees', async () => {
  const deck = await write('missing/missing.opf.json', { name: 'Missing', slides: [{ title: 'Inside', image: 'assets/pixel.png' }, { title: 'Missing', image: 'assets/none.png' }] });
  await write('missing/assets/pixel.png', PIXEL);
  const inProcess = await convertInProcess(both(deck, ['svg', 'png']), 2);
  const throughCli = await convertWithCli(both(deck, ['png']));
  // The previews only warn (render/unresolved-asset); the PPTX leg is the one that stops, before opf-pptx 0.24.1.
  const expected = (await unreadableImageIsAnError()) ? ['pptx asset-unresolved'] : [];
  assert.deepEqual(legs(inProcess), expected);
  assert.deepEqual(legs(throughCli), expected, 'the CLI gives the same verdict');
  const checked = await checkDecks([deck], { jobs: 1, png: [], sample: [deck] });
  assert.equal(checked.failures.length > 0, expected.length > 0, 'the check fails exactly when the conversion does');
  if (expected.length) assert.ok(checked.failures.every((failure) => failure.deck === deck && /asset-unresolved/.test(failure.reason)));
});

test('a deck that is not valid OPF, and a deck that is not there, fail every leg, in-process and through the CLI', async () => {
  const invalid = await write('invalid/invalid.opf.json', { name: 'Invalid', slides: 'not a list' });
  const absent = path.join(temp, 'absent', 'absent.opf.json');
  for (const deck of [invalid, absent]) {
    const inProcess = await convertInProcess(both(deck, ['svg', 'png']), 2);
    assert.deepEqual(inProcess.map((failure) => failure.format).sort(), ['png', 'pptx', 'svg'], `${deck}: every leg fails`);
    assert.ok(inProcess.every((failure) => failure.deck === deck && failure.reason.length > 0));
    assert.deepEqual((await convertWithCli(both(deck, ['png']))).map((failure) => failure.format).sort(), ['png', 'pptx'], `${deck}: the CLI fails the same legs`);
  }
  assert.match((await convertInProcess([{ deck: invalid, format: 'svg' }], 1))[0].reason, /not valid OPF/);
});

test('one failing deck among passing ones is named, and the others still pass', async () => {
  const good = await write('mixed/good.opf.json', { name: 'Good', slides: [{ title: 'Hello' }] });
  const bad = await write('mixed/bad.opf.json', { name: 'Bad', slides: 'not a list' });
  const result = await checkDecks([good, bad], { jobs: 2, png: [], sample: [] });
  assert.deepEqual([...new Set(result.failures.map((failure) => failure.deck))], [bad]);
  assert.equal(result.conversions, 4);
});
