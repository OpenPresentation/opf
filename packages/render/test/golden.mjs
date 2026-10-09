import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { examples } from '@openpresentation/opf/examples';
// FA-23: the renderer registers no catalog. The examples embed the records they use; the harness registers the gallery
// snapshot as a host does, which changes nothing for a self-contained deck.
import { defaultCatalog } from '@openpresentation/opf/catalog';
import {toPng, toSvg} from '../dist/index.js';
import { diffManifests, readBaseline } from './golden-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// RR-52: a baseline is a directory with one file per deck (test/golden/<name>/...). A legacy
// `<name>.sha256.json` path still selects `<name>/` and a legacy single-file manifest still loads.
const baselinePath = path.resolve(process.env.OPF_GOLDEN_BASELINE ?? path.join(root, 'test/golden/opf-examples-png.cover-centering.sha256.json'));
const started = performance.now();
const output = path.resolve(process.env.OPF_GOLDEN_OUT ?? path.join(root, 'artifacts/golden'));
const update = process.argv.includes('--update');
const scale = Number(process.env.OPF_GOLDEN_SCALE ?? '0.25');
assert.ok(Number.isFinite(scale) && scale > 0, 'Golden scale must be positive');
// Installed core examples are the default: no sibling checkout or .git state can
// silently skip the visual regression gate. Explicit corpora must match as well.
const corpus = process.env.OPF_EXAMPLES_DIR
  ? readCorpus(path.resolve(process.env.OPF_EXAMPLES_DIR))
  : examples.map(({ file, deck }) => ({ file: file.replace(/^examples\//, ''), deck }));
corpus.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
assert.ok(corpus.length > 0, 'Golden corpus must not be empty');
const sourceDigest = sha256(JSON.stringify(corpus.map(({ file, deck }) => [file, canonical(deck)])));
const next = {
  version: 2,
  source: { repository: 'OpenPresentation/opf', path: 'examples', sha256: sourceDigest, decks: corpus.length },
  format: 'png-sha256', scale, systemFonts: false, entries: {},
};
mkdirSync(output, { recursive: true });
// OPF_GOLDEN_ARTIFACTS=1 keeps every slide for review; OPF_GOLDEN_ARTIFACTS=changed keeps only the slides whose hash
// differs from the selected baseline (the regenerate-goldens workflow), so the review sheets show what moved.
const artifactMode = process.env.OPF_GOLDEN_ARTIFACTS;
const reference = artifactMode === 'changed' ? readBaseline(baselinePath) : undefined;
const slides = [];
for (const { file, deck } of corpus) {
  const svgs = toSvg(deck, { trace: true, catalogs: [defaultCatalog] });
  assert.equal(svgs.length, deck.slides.length, `${file}: slide count`);
  for (const [index, svg] of svgs.entries()) {
    const png = await toPng(svg, { scale });
    const key = `${file}#${index}`;
    next.entries[key] = { sha256: sha256(png), bytes: png.byteLength };
    const keep = reference ? JSON.stringify(reference.entries[key]) !== JSON.stringify(next.entries[key]) : update || artifactMode === '1';
    if (keep) {
      const asset = `${String(slides.length).padStart(4, '0')}.png`;
      writeFileSync(path.join(output, asset), png);
      slides.push({ key, asset, png });
    }
  }
}
writeFileSync(path.join(output, 'candidate.json'), JSON.stringify(next, null, 2) + '\n');
if (slides.length) {
  writeFileSync(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>OPF raster review</title><style>body{font:12px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:white;padding:8px}img{width:100%}figcaption{overflow-wrap:anywhere}</style><h1>${slides.length} slides / ${corpus.length} decks</h1><p>Regression evidence for the current implementation. This is not proof of PowerPoint or browser parity.</p><main>${slides.map(({ key, asset }) => `<figure><img src="${asset}"><figcaption>${escape(key)}</figcaption></figure>`).join('')}</main>`);
  // Overview sheets make every corpus slide reviewable without a giant page.
  for (let offset = 0; offset < slides.length; offset += 48) {
    const sheet = slides.slice(offset, offset + 48);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="840"><rect width="100%" height="100%" fill="#e5e5e5"/>${sheet.map(({ png }, i) => {
      const x = (i % 8) * 180, y = Math.floor(i / 8) * 140;
      return `<image x="${x}" y="${y}" width="178" height="115" href="data:image/png;base64,${Buffer.from(png).toString('base64')}"/><text x="${x + 5}" y="${y + 132}" font-size="12" font-family="Roboto">${offset + i}</text>`;
    }).join('')}</svg>`;
    writeFileSync(path.join(output, `sheet-${offset / 48}.png`), await toPng(svg));
  }
}
if (update) {
  // --update only creates a candidate. Promotion is a separate review step.
  console.log(`Golden candidate: ${Object.keys(next.entries).length} slides, ${corpus.length} decks. Review ${output}/index.html, then promote it into ${baselinePath} with npm run golden:promote (it rewrites only the decks that differ).`);
} else {
  const expected = readBaseline(baselinePath);
  const { changedSlides: changes, changedDecks } = diffManifests(expected, next);
  writeFileSync(path.join(output, 'diff.json'), JSON.stringify({ sourceMatches: JSON.stringify(expected.source) === JSON.stringify(next.source), changedSlides: changes, changedDecks }, null, 2) + '\n');
  assert.deepEqual(next.source, expected.source, 'Golden corpus changed; inspect candidate and review the new corpus.');
  assert.equal(next.version, expected.version, 'Golden manifest version changed');
  assert.equal(next.scale, expected.scale, 'Golden scale changed');
  assert.equal(next.format, expected.format, 'Golden format changed');
  assert.equal(next.systemFonts, expected.systemFonts, 'Golden font policy changed');
  assert.equal(changes.length, 0, `${changes.length} raster baselines changed; see ${output}/diff.json`);
  console.log(`Golden passed: ${Object.keys(next.entries).length} slides, ${corpus.length} decks; no skipped corpus (${((performance.now() - started) / 1000).toFixed(1)} s).`);
}
function readCorpus(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.posix.join(prefix, entry.name), absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return readCorpus(absolute, file);
    return entry.isFile() && entry.name.endsWith('.opf.json') ? [{ file, deck: JSON.parse(readFileSync(absolute, 'utf8')) }] : [];
  });
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function escape(value) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
