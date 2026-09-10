import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { examples } from '@openpresentation/opf/examples';
import { renderSvgDeck, svgToPng } from '../dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.resolve(process.env.OPF_GOLDEN_BASELINE ?? path.join(root, 'test/golden/opf-examples-png.rich-flow.sha256.json'));
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
const slides = [];
for (const { file, deck } of corpus) {
  const svgs = renderSvgDeck(deck, { trace: true });
  assert.equal(svgs.length, deck.slides.length, `${file}: slide count`);
  for (const [index, svg] of svgs.entries()) {
    const png = await svgToPng(svg, { scale, loadSystemFonts: false });
    const key = `${file}#${index}`;
    next.entries[key] = { sha256: sha256(png), bytes: png.byteLength };
    if (update || process.env.OPF_GOLDEN_ARTIFACTS === '1') {
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
    writeFileSync(path.join(output, `sheet-${offset / 48}.png`), await svgToPng(svg));
  }
}
if (update) {
  // --update only creates a candidate. Promotion is a separate review step.
  console.log(`Golden candidate: ${Object.keys(next.entries).length} slides, ${corpus.length} decks. Review ${output}/index.html, then copy candidate.json to ${baselinePath}.`);
} else {
  const expected = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const changes = [...new Set([...Object.keys(expected.entries), ...Object.keys(next.entries)])]
    .filter(key => JSON.stringify(expected.entries[key]) !== JSON.stringify(next.entries[key]));
  writeFileSync(path.join(output, 'diff.json'), JSON.stringify({ sourceMatches: JSON.stringify(expected.source) === JSON.stringify(next.source), changedSlides: changes }, null, 2) + '\n');
  assert.deepEqual(next.source, expected.source, 'Golden corpus changed; inspect candidate and review the new corpus.');
  assert.equal(next.version, expected.version, 'Golden manifest version changed');
  assert.equal(next.scale, expected.scale, 'Golden scale changed');
  assert.equal(next.format, expected.format, 'Golden format changed');
  assert.equal(next.systemFonts, expected.systemFonts, 'Golden font policy changed');
  assert.equal(changes.length, 0, `${changes.length} raster baselines changed; see ${output}/diff.json`);
  console.log(`Golden passed: ${Object.keys(next.entries).length} slides, ${corpus.length} decks; no skipped corpus.`);
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
