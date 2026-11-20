// The source-check unit fixture is structured parser output, not a renderer golden.
// Run after building the workspace: node packages/editor/test/support/generate-source-read-text-fixture.mjs --write
// Review the complete diff; --check never changes the fixture.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gallery } from '@openpresentation/gallery';
import { readSource } from '../../dist/source-check.js';
import { corpus } from './source-check-corpus.mjs';

export const fixturePath = new URL('../fixtures/source-read-text.golden.json', import.meta.url);
export function sourceReadTextFixture() {
  return Object.fromEntries(corpus.map(entry => [entry.id, readSource(entry.format, entry.text, entry.catalogs === 'gallery' ? [gallery] : [])]));
}
export const fixtureBytes = () => JSON.stringify(sourceReadTextFixture(), null, 1) + '\n';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...extra] = process.argv.slice(2);
  assert.ok(!extra.length && ['--write', '--check'].includes(mode), 'Use --write or --check');
  const expected = fixtureBytes();
  if (mode === '--write') await writeFile(fixturePath, expected);
  else assert.equal(await readFile(fixturePath, 'utf8'), expected, 'source-read-text fixture must match its reviewed generated output');
  console.log(`source-read-text fixture: ${mode}, ${corpus.length} cases`);
}
