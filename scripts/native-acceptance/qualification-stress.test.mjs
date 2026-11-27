// NT-10: the stress decks of the 0.36.0 Keynote round in the qualification corpus. The sources gallery-layouts and languages
// are manifest decks the runner builds, and each moved or committed deck builds with the slides the records and the 0.36.0
// baseline (runs/0.36.0/keynote.json, the round that graded them; later summaries need not have them) name. That every known place is in the release tier is NT-12's rule (a)
// (core/coverage/, pnpm check:native-coverage).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { fileId } from './core/result/result.mjs';
import { selectFiles } from './native.mjs';
import { loadManifest, pptxName } from './qualification/build.mjs';
import { decksForTier, sourceDecks, sourcesForTier } from './qualification/tiers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const manifest = loadManifest();
const known = readJson('scripts/native-acceptance/known/keynote.json');
const baseline = readJson('scripts/native-acceptance/runs/0.36.0/keynote.json');
const byId = new Map(manifest.decks.map((deck) => [deck.id, deck]));
const variantsOf = (deck) => (deck.variants ?? [{ name: 'default', flags: [] }]);
/** The decks NT-10 moved in (hand-written, m-*) or committed (the groups of the sources gallery-layouts and languages). */
const STRESS = manifest.decks.filter((deck) => deck.group || deck.id.startsWith('m-'));

test('stress decks: the sources gallery-layouts and languages are groups of manifest decks, all of them in the full tier', () => {
  for (const source of ['gallery-layouts', 'languages']) {
    assert.ok(sourceDecks(manifest, source).length >= 3, `${source} resolves to decks`);
    assert.ok(sourcesForTier(manifest, 'full').includes(source));
  }
  for (const deck of manifest.decks.filter((item) => item.group)) assert.ok(deck.group in manifest.sources, `${deck.id}: group ${deck.group} is a source`);
  const full = new Map(decksForTier(manifest, 'full').map((entry) => [entry.deck, entry.variants]));
  for (const deck of manifest.decks) assert.deepEqual(full.get(deck.id), variantsOf(deck).map((variant) => variant.name), `full: ${deck.id} in every variant`);
  const release = new Set(decksForTier(manifest, 'release').map((entry) => entry.deck));
  assert.ok(!release.has('layouts-little') && release.has('layouts-lots') && release.has('lang-rtl'), 'release takes only the group decks a record needs');
});

test('stress decks: each has a one-line description and the slides of the 0.36.0 baseline and of every record place', () => {
  const baseFiles = new Map(baseline.files.map((file) => [file.id, file.slideCount]));
  assert.ok(STRESS.length >= 17, `${STRESS.length} stress decks`);
  for (const deck of STRESS) {
    assert.ok(typeof deck.description === 'string' && deck.description.length > 40 && !deck.description.includes('\n'), `${deck.id}: description`);
    const slides = readJson(deck.source).slides.length;
    for (const variant of variantsOf(deck)) {
      // The round called the native-body export "native"; the baseline names a moved deck's file as the runner does.
      const id = fileId(deck.id, variant.name);
      assert.ok(baseFiles.has(id), `${id} is in the 0.36.0 baseline`);
      assert.equal(slides, baseFiles.get(id), `${id}: slide count`);
    }
    for (const record of known.records) for (const place of record.where.filter((item) => item.deck === deck.id)) assert.ok(place.slide <= slides, `${record.id}: ${deck.id} has slide ${place.slide}`);
  }
});

const temp = mkdtempSync(path.join(tmpdir(), 'opf-nt10-'));
after(() => rmSync(temp, { recursive: true, force: true }));
const cli = path.join(root, 'packages/cli/dist/index.js');
const slidesInPptx = (file) => new Set([...readFileSync(file).toString('latin1').matchAll(/ppt\/slides\/slide(\d+)\.xml/gu)].map((match) => match[1])).size;

test('stress decks: the decks the release tier takes from them export to PPTX with the slides the records name', async () => {
  const release = decksForTier(manifest, 'release').filter((entry) => STRESS.some((deck) => deck.id === entry.deck));
  assert.ok(release.length >= 8, `${release.length} stress decks in the release tier`);
  const run = promisify(execFile);
  const exports = release.flatMap((entry) => {
    const deck = byId.get(entry.deck);
    return variantsOf(deck)
      .filter((variant) => entry.variants.includes(variant.name))
      .map((variant) => ({ deck, variant, out: path.join(temp, pptxName(deck, variant)) }));
  });
  // One process per file, all at once: the exports are independent and each is mostly the engine's start-up.
  await Promise.all(
    exports.map(({ deck, variant, out }) => {
      const source = path.join(root, deck.source);
      return run(process.execPath, [cli, 'convert', source, out, '--asset-dir', path.dirname(source), '--force', ...(variant.flags ?? [])], { cwd: root, maxBuffer: 64 << 20 });
    }),
  );
  for (const { deck, variant, out } of exports) assert.equal(slidesInPptx(out), readJson(deck.source).slides.length, `${deck.id}~${variant.name}: slides in the PPTX`);
});

test('stress decks: pnpm native selects the group decks of a tier and reports only the sources it cannot build', () => {
  const full = selectFiles({ manifest, tier: 'full' });
  for (const deck of manifest.decks) for (const variant of variantsOf(deck)) assert.ok(full.files.some((file) => file.id === fileId(deck.id, variant.name)), `full: ${deck.id}~${variant.name}`);
  assert.deepEqual(full.notRun.map((item) => item.what), ['source examples']);
  const release = selectFiles({ manifest, tier: 'release' });
  assert.deepEqual(release.notRun, []);
  assert.ok(release.files.some((file) => file.id === 'lang-cjk~native-body') && !release.files.some((file) => file.id === 'lang-cjk~default'));
  assert.equal(release.files.filter((file) => byId.get(file.deck).group).length, 3, 'release: layouts-lots, lang-rtl, lang-cjk~native-body');
});
