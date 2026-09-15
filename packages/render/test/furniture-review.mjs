// Reproduce the furniture predecessor and candidate without changing a baseline.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = path.resolve(root, '../opf');
const out = path.resolve(process.env.OPF_FURNITURE_REVIEW_OUT ?? path.join(root, 'artifacts/furniture-review-20260914'));
const runtime = path.join(out, 'before-runtime');
const beforeCore = path.join(runtime, 'core');
const coreRef = 'a3ab4784ed22caffdad8c4e306f9a51b1e954ae9';
const rendererRef = 'f2f2d51caddddc912588dd4f0f7a9586d3330475';
const baseline = path.join(root, 'test/golden/opf-examples-png.timeline.sha256.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024 });
const save = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
assert.equal(process.versions.node.split('.')[0], '24', 'Use Node 24 for this review');
mkdirSync(out, { recursive: true });

function archive(cwd, ref, destination, files) {
  assert.ok(!existsSync(destination), `Use a new output directory: ${destination}`);
  mkdirSync(destination, { recursive: true });
  const bytes = git(cwd, 'archive', '--format=tar', ref, ...files);
  execFileSync('tar', ['-xf', '-', '-C', destination], { input: bytes });
  return hash(bytes);
}

function run(label, cwd, executable, args, env = {}) {
  const result = spawnSync(executable, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(path.join(out, `${label}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error) throw result.error;
  console.log(`${label}: exit ${result.status}`);
  return result.status;
}

const command = process.argv[2] ?? 'prepare';
if (command === 'prepare') {
  const coreFiles = git(core, 'ls-tree', '-r', '--name-only', coreRef).toString().trim().split('\n')
    .filter(file => /^(packages\/javascript\/|spec\/|examples\/|scripts\/|skills\/)/.test(file)
      || /^docs\/[^/]+\.md$/.test(file)
      || /^(README\.md|LICENSE|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/.test(file));
  const rendererArchiveSha256 = archive(root, rendererRef, runtime, ['dist', 'test/golden.mjs', 'package.json', 'package-lock.json']);
  const coreArchiveSha256 = archive(core, coreRef, beforeCore, coreFiles);
  symlinkSync(path.join(core, 'node_modules'), path.join(beforeCore, 'node_modules'), 'dir');
  symlinkSync(path.join(core, 'packages/javascript/node_modules'), path.join(beforeCore, 'packages/javascript/node_modules'), 'dir');
  mkdirSync(path.join(runtime, 'node_modules/@openpresentation'), { recursive: true });
  symlinkSync(path.join(beforeCore, 'packages/javascript'), path.join(runtime, 'node_modules/@openpresentation/opf'), 'dir');
  const binding = { node: process.version, before: { core: coreRef, renderer: rendererRef, coreArchiveSha256, rendererArchiveSha256 },
    after: { core: git(core, 'rev-parse', 'HEAD').toString().trim(), renderer: git(root, 'rev-parse', 'HEAD').toString().trim() },
    acceptedBaseline: path.relative(root, baseline), acceptedBaselineSha256: hash(readFileSync(baseline)),
    coreLockSha256: hash(readFileSync(path.join(core, 'pnpm-lock.yaml'))), rendererLockSha256: hash(readFileSync(path.join(root, 'package-lock.json'))),
    verifierSha256: hash(readFileSync(fileURLToPath(import.meta.url))) };
  save('binding.json', binding);
  assert.equal(run('before-build', path.join(beforeCore, 'packages/javascript'), 'pnpm', ['build']), 0);
  assert.equal(run('before-golden', runtime, process.execPath, ['test/golden.mjs'], {
    OPF_GOLDEN_OUT: path.join(out, 'before'), OPF_GOLDEN_ARTIFACTS: '1', OPF_GOLDEN_BASELINE: baseline,
  }), 0, 'Predecessor must reproduce the accepted baseline before comparing');
  const status = run('after-golden', root, process.execPath, ['test/golden.mjs'], {
    OPF_GOLDEN_OUT: path.join(out, 'after'), OPF_GOLDEN_ARTIFACTS: '1', OPF_GOLDEN_BASELINE: baseline,
  });
  const before = json(path.join(out, 'before/candidate.json')), after = json(path.join(out, 'after/candidate.json'));
  const diff = json(path.join(out, 'after/diff.json'));
  assert.deepEqual(before.source, after.source);
  assert.deepEqual(before, json(baseline));
  assert.equal(status, diff.changedSlides.length ? 1 : 0);
  assert.equal(hash(readFileSync(baseline)), binding.acceptedBaselineSha256);
  console.log(`Reproduced ${Object.keys(after.entries).length} slides; ${diff.changedSlides.length} changed. Baseline unchanged.`);
} else if (command === 'sheets') {
  const sharp = (await import('sharp')).default;
  const before = json(path.join(out, 'before/candidate.json')), after = json(path.join(out, 'after/candidate.json'));
  assert.deepEqual(before.source, after.source);
  const keys = Object.keys(after.entries);
  assert.deepEqual(Object.keys(before.entries), keys);
  const changed = keys.filter(key => before.entries[key].sha256 !== after.entries[key].sha256);
  const sheets = [];
  const sheetDirectory = path.join(out, 'sheets');
  mkdirSync(sheetDirectory, { recursive: true });
  for (let offset = 0; offset < changed.length; offset += 8) {
    const slides = changed.slice(offset, offset + 8), layers = [];
    for (const [index, key] of slides.entries()) for (const [side, manifest] of [before, after].entries()) {
      const left = (index % 2) * 660 + side * 325, top = Math.floor(index / 2) * 215;
      const png = readFileSync(path.join(out, side ? 'after' : 'before', `${String(keys.indexOf(key)).padStart(4, '0')}.png`));
      assert.equal(hash(png), manifest.entries[key].sha256);
      layers.push({ input: await sharp(png).resize({ width: 320, height: 180, fit: 'contain', background: '#fff' }).png().toBuffer(), left, top: top + 30 });
      const label = `${offset + index} ${side ? 'AFTER' : 'BEFORE'} ${key.split('/').at(-1)}`.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
      layers.push({ input: Buffer.from(`<svg width="320" height="28"><text x="4" y="18" font-size="10">${label}</text></svg>`), left, top });
    }
    const name = `sheet-${String(sheets.length).padStart(3, '0')}.png`;
    const png = await sharp({ create: { width: 1320, height: 860, channels: 4, background: '#e5e5e5' } }).composite(layers).png().toBuffer();
    writeFileSync(path.join(sheetDirectory, name), png);
    sheets.push({ file: `sheets/${name}`, sha256: hash(png), slides });
  }
  save('review-index.json', { source: after.source, total: keys.length, changed: changed.length, unchanged: keys.length - changed.length, sheets });
  console.log(`${sheets.length} paired review sheets; generation is not visual approval.`);
} else if (command === 'full') {
  const key = process.argv[3];
  assert.ok(key, 'Pass the exact file#slide key from review-index.json');
  const { examples } = await import('@openpresentation/opf/examples');
  const { renderSvgDeck, svgToPng } = await import('../dist/index.js');
  const { renderSvgDeck: renderBefore } = await import(pathToFileURL(path.join(runtime, 'dist/index.js')).href);
  const split = key.lastIndexOf('#'), file = key.slice(0, split), index = Number(key.slice(split + 1));
  const example = examples.find(example => example.file.replace(/^examples\//, '') === file);
  assert.ok(example && Number.isInteger(index) && example.deck.slides[index], 'Unknown slide key');
  const directory = path.join(out, 'full', `${file.replace(/[^a-zA-Z0-9_.-]/g, '_')}-${index}`);
  mkdirSync(directory, { recursive: true });
  const records = [];
  for (const [side, render] of [['before', renderBefore], ['after', renderSvgDeck]]) {
    const svg = render(example.deck, { trace: true })[index];
    const png = await svgToPng(svg, { loadSystemFonts: false });
    writeFileSync(path.join(directory, `${side}.svg`), svg);
    writeFileSync(path.join(directory, `${side}.png`), png);
    records.push({ side, svgSha256: hash(svg), pngSha256: hash(png) });
  }
  writeFileSync(path.join(directory, 'binding.json'), JSON.stringify({ key, records }, null, 2) + '\n');
  console.log(directory);
} else {
  throw new Error(`Unknown command: ${command}`);
}
