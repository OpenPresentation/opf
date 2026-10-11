// Self-test of the probe38 compare WITHOUT Office: draws each probe row as SVG text whose baseline sits at a KNOWN em offset below the
// box top (0.85 for Angsana New, 0.78 for Sakkal Majalla, 0.70 for Arabic Typesetting, 0.80 for every other row), rasterizes it at 2880 px,
// and writes mock read-outs under native/selftest-probe. compare.mjs --only probe38 must recover the offsets within the pixel grid.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const SET = process.argv[2] ?? 'probe38';
const out = path.join(ROOT, 'native', 'selftest-probe', SET);
const truth = {'Angsana New': 0.85, 'Sakkal Majalla': 0.78, 'Arabic Typesetting': 0.70};
for (const [id, d] of Object.entries(manifest.sets[SET].decks)) {
  const dir = path.join(out, id);
  mkdirSync(dir, {recursive: true});
  const slides = [];
  for (const slide of d.layout) {
    const k = 3, texts = slide.rows.map(r => `<text x="${(r.box.x + 4) * k}" y="${(r.box.y + (truth[r.family] ?? 0.8) * slide.size) * k}" font-family="Arial" font-size="${slide.size * k}" fill="#000">Hxmnoa baseline probe gxy</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${960 * k}" height="${540 * k}"><rect width="100%" height="100%" fill="#fff"/>${texts}</svg>`;
    const png = `${id}-slide-${slide.slide}.native.png`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir, png));
    slides.push({index: slide.slide, png, shapes: slide.rows.map(r => ({name: r.name, lineCount: 1, lines: [{boundTop: r.box.y, boundHeight: r.box.h}], paragraphs: []}))});
  }
  writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({stage: 'done', readOnly: -1, deckSha256: d.sha256, slideSize: {widthPt: 960, heightPt: 540, exportWidth: 2880}, slides, presentationFonts: []}));
  writeFileSync(path.join(dir, `${id}.run.json`), JSON.stringify({status: 'completed', exitCode: 0}));
}
console.log('wrote native/selftest-probe (expected: Angsana New ~0.85, Sakkal Majalla ~0.78, Arabic Typesetting ~0.70, others ~0.80; descender-free baseline rows)');
