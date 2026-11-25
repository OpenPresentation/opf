// NT-09: `reader` names the application a PPTX is written for and stands for a set of toPptx's own options (src/reader-options.js).
// "keynote" gives the same bytes as its option set written out, "powerpoint" and no reader give the default export, an option set
// beside the reader wins, and an unknown reader or a reader with `as: 'images'` is an error.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from './helpers/default-catalog.mjs';
import {OPFPptxError, READERS, readerOptions} from '../dist/index.js';

let checks = 0;
const KEYNOTE = {typefaces: 'safe', slideNumberFields: 'static', smartArt: 'shapes', bodyText: 'native'};

// The documented sets, each a new object.
{
  assert.deepEqual([...READERS], ['powerpoint', 'keynote']);
  assert.deepEqual(readerOptions('powerpoint'), {});
  assert.deepEqual(readerOptions('keynote'), KEYNOTE);
  const set = readerOptions('keynote');
  set.typefaces = 'selected';
  assert.equal(readerOptions('keynote').typefaces, 'safe', 'a caller cannot change the set');
  for (const reader of ['impress', 'Keynote', '', null, 1]) assert.throws(() => readerOptions(reader), error => error instanceof OPFPptxError && error.code === 'invalid-reader-option', String(reader));
  checks++;
}

// An unknown reader and a reader of a pictures-only PPTX throw before anything is drawn.
{
  const deck = {name: 'Reader', slides: [{title: 'One'}]};
  await assert.rejects(toPptx(deck, {reader: 'impress'}), error => error instanceof OPFPptxError && error.code === 'invalid-reader-option' && /reader must be 'powerpoint' or 'keynote'/.test(error.message));
  for (const reader of READERS) await assert.rejects(toPptx(deck, {reader, as: 'images'}), error => error instanceof OPFPptxError && error.code === 'invalid-reader-option' && /as: 'images'/.test(error.message), reader);
  checks++;
}

// Three example decks: live slide numbers with words around them in a footer, a pyramid, matrix and cycle, and body text.
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const read = async file => JSON.parse(await readFile(new URL(`../../../examples/${file}`, import.meta.url), 'utf8'));
const decks = [
  'gallery/design-and-media/data-story-academy-corporate-programs.opf.json',
  'technical/icons-and-arrangements.opf.json',
  'technical/minimal.opf.json',
];
const same = (a, b, message) => assert.ok(Buffer.from(a).equals(Buffer.from(b)), message);
for (const file of decks) {
  const deck = await read(file);
  const exported = options => toPptx(structuredClone(deck), {fonts, date: '2026-11-25', ...options});
  const plain = await exported({});
  same(await exported({}), plain, `${file}: the default export is deterministic`);
  same(await exported({reader: 'powerpoint'}), plain, `${file}: reader powerpoint is the default export`);
  same(await exported({reader: undefined}), plain, `${file}: an undefined reader is the default export`);
  const keynote = await exported({reader: 'keynote'});
  same(keynote, await exported(KEYNOTE), `${file}: reader keynote is its option set`);
  assert.ok(!Buffer.from(keynote).equals(Buffer.from(plain)), `${file}: reader keynote changes the file`);
  // An option set beside the reader wins over the reader's set.
  same(await exported({reader: 'keynote', typefaces: 'selected'}), await exported({...KEYNOTE, typefaces: 'selected'}), `${file}: typefaces selected wins`);
  checks++;
}
// Each option of the set is one the reader's file takes from it: the smart-art deck with live SmartArt over the reader.
{
  const deck = await read('technical/icons-and-arrangements.opf.json');
  const exported = options => toPptx(structuredClone(deck), {fonts, ...options});
  same(await exported({reader: 'keynote', smartArt: 'live', bodyText: 'measured'}), await exported({...KEYNOTE, smartArt: 'live', bodyText: 'measured'}), 'smartArt and bodyText set beside the reader win');
  checks++;
}

console.log(`reader options: ${checks} checks passed`);
