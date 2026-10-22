import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {latinFaceCoverage} from '../scripts/script-corpora.mjs';

// Informational corpus accounting uses actual pinned glyph coverage, without
// loading a runtime font registry or claiming native font fidelity.
const require = createRequire(import.meta.url);
const font = path.join(path.dirname(require.resolve('@expo-google-fonts/roboto/package.json')), '400Regular/Roboto_400Regular.ttf');
const registry = {describeFaces: () => [{family: 'Roboto', weight: 400, italic: false}]};
const measure = text => latinFaceCoverage({registry, files: [font], corpora: {groups: [{script: 'Latn', samples: [{text}]}]}});

for (const text of ['s', 's \t\r\n\u00a0\u2003s\u200b', ' \t\ns\r ']) {
  assert.deepEqual(await measure(text), [{family: 'Roboto', characters: 1, missing: 0, missingCharacters: ''}], 'literal s is retained; whitespace and default-ignorables are not glyph requirements');
}
assert.deepEqual(await measure(' \t\r\n\u00a0\u2003\u200b'), [{family: 'Roboto', characters: 0, missing: 0, missingCharacters: ''}]);
assert.deepEqual(await measure('s\t\u0378s'), [{family: 'Roboto', characters: 2, missing: 1, missingCharacters: '\u0378'}], 'a real missing non-whitespace character remains reported');
console.log('Informational Latin-face coverage retains literal s, excludes mixed whitespace and reports real missing glyphs.');
