// NT-04a: compare a run directory with OPF's previews, and draw a slide's sheet, on a run made from the slide-links fixture
// (4 slides, slide 4 hidden) with synthetic pictures written to a temporary folder.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateResult, validateRun } from '../result/result.mjs';
import { compareRun, parseArgs, previewPictures } from './compare-run.mjs';
import { sharp } from './picture.mjs';
import { slideSheet } from './sheet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '../result/fixtures/keynote-0.36.0');
const scratch = mkdtempSync(path.join(tmpdir(), 'nt-04a-compare-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function picture(width, height, block) {
  const layers = block ? [{ input: await sharp()({ create: { width: block[2], height: block[3], channels: 3, background: '#203040' } }).png().toBuffer(), left: block[0], top: block[1] }] : [];
  return sharp()({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

/** A run directory with the slide-links result, Keynote-sized pictures (960 x 540) and OPF-sized previews (1280 x 720). */
async function makeRun() {
  const run = path.join(scratch, 'run');
  const id = 'slide-links~default';
  const fileDir = path.join(run, 'files', id);
  mkdirSync(path.join(fileDir, 'slides'), { recursive: true });
  const result = readJson(path.join(fixtures, id, 'result.json'));
  writeFileSync(path.join(fileDir, 'result.json'), JSON.stringify(result));
  writeFileSync(
    path.join(run, 'run.json'),
    JSON.stringify({ ...readJson(path.join(fixtures, 'run.json')), files: readJson(path.join(fixtures, 'run.json')).files.filter((file) => file.id === id) }),
  );
  // Slide 1 the same, slide 2 a block moved, slide 3 the same; slide 4 is hidden (no picture, no preview).
  writeFileSync(path.join(fileDir, 'slides/slide-001.png'), await picture(960, 540, [60, 60, 300, 90]));
  writeFileSync(path.join(fileDir, 'slides/slide-002.png'), await picture(960, 540, [600, 360, 240, 120]));
  writeFileSync(path.join(fileDir, 'slides/slide-003.png'), await picture(960, 540));
  const previews = path.join(scratch, 'build/preview/slide-links');
  mkdirSync(previews, { recursive: true });
  writeFileSync(path.join(previews, 'slide-1.png'), await picture(1280, 720, [80, 80, 400, 120]));
  writeFileSync(path.join(previews, 'slide-2.png'), await picture(1280, 720, [80, 80, 320, 160]));
  writeFileSync(path.join(previews, 'slide-3.png'), await picture(1280, 720));
  return { run, id, fileDir };
}

const made = makeRun();

test('every slide gets compare; the hidden slide has no pair and says why', async () => {
  const { run, id, fileDir } = await made;
  const summary = await compareRun(run, { preview: path.join(scratch, 'build/preview') });
  assert.deepEqual([summary.files, summary.compared, summary.unpaired], [1, 3, 1]);
  const result = readJson(path.join(fileDir, 'result.json'));
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.deepEqual(validateRun(readJson(path.join(run, 'run.json'))), { ok: true, errors: [] });
  const [one, two, three, four] = result.slides.map((slide) => slide.compare);
  assert.equal(one.score, 0);
  assert.equal(three.score, 0);
  assert.ok(two.score > 0.02, `slide 2 score ${two.score}`);
  assert.ok(two.regions.length >= 2, 'the block where it was and where it went');
  assert.equal(two.aspectDiffers, false);
  assert.deepEqual(four, { preview: null, score: null, note: 'hidden slide: the application exported no picture' });
  assert.deepEqual(
    result.slides.slice(0, 3).map((slide) => slide.compare.preview),
    ['preview/slide-links/slide-1.png', 'preview/slide-links/slide-2.png', 'preview/slide-links/slide-3.png'],
  );
  for (const n of [1, 2, 3]) assert.ok(existsSync(path.join(run, `preview/slide-links/slide-${n}.png`)), 'the preview is copied into the run');
  assert.deepEqual(summary.scores[id], [0, two.score, 0, null]);
});

test('a sheet is drawn for a compared slide, only inside the run directory', async () => {
  const { run, id } = await made;
  await compareRun(run, { preview: path.join(scratch, 'build/preview') });
  const written = await slideSheet(run, id, 2, { caption: 'the block moved down and to the right' });
  assert.equal(written, path.join(run, 'sheets', id, 'slide-002.jpg'));
  const meta = await sharp()(written).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 2400);
  await assert.rejects(slideSheet(run, id, 2, { out: path.join(scratch, 'elsewhere.jpg') }), /only inside the run directory/u);
  await assert.rejects(slideSheet(run, id, 4), /no compared pair/u);
});

test('compareRun needs a preview root', async () => {
  const { run } = await made;
  await assert.rejects(compareRun(run, {}), /preview root/u);
});

test('previews are listed in slide order, with or without leading zeros and with a gap', () => {
  const dir = path.join(scratch, 'padded/deck');
  mkdirSync(dir, { recursive: true });
  for (const name of ['slide-10.png', 'slide-02.png', 'slide-01.png', 'notes.png']) writeFileSync(path.join(dir, name), '');
  assert.deepEqual(
    previewPictures(path.join(scratch, 'padded'), 'deck').map((file) => path.basename(file)),
    ['slide-01.png', 'slide-02.png', 'slide-10.png'],
  );
  assert.deepEqual(previewPictures(path.join(scratch, 'padded'), 'missing'), []);
  assert.deepEqual(parseArgs(['--run', 'r', '--preview', 'p', '--pattern', '{deck}/preview/slide-{n}.png', '--tolerance', '30']), {
    run: 'r',
    preview: 'p',
    pattern: '{deck}/preview/slide-{n}.png',
    compare: { tolerance: 30 },
  });
});
