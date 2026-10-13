import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPng, toSvg } from '../dist/index.js';
import { featureDecks, fixture, layouts, paginatedDecks, templateDeck } from './layout-template-fixture.mjs';

// OPF 0.19 (RR-81): SVG and PNG goldens of the 28 built-in layout templates, each with 1 to 6 blocks of short and of long
// content (test/layout-template-fixture.mjs, the slides core's composition goldens compose) and the feature slides (lists
// in columns, bled regions beside cards, mirrored templates) and the pages core's paginate makes of every sample slide
// that overflows (the paginated group), at 1280 x 720 with bundled
// fonts and core's estimated measurement. The SVG hash is of the traced SVG (trace: true), so it also pins the region
// tags and list-column groups; the PNG hash is resvg's raster at the golden scale. Exact hashes, no tolerance.
//
// The 0.18 example corpus stays in test/golden.mjs and does not move: templates are additive until RR-80/RR-83 swap the
// default catalog. A change to these hashes is a change to how every 0.19 template slide draws:
//   node test/layout-template-goldens.mjs --update    writes a candidate, the changed slides and review sheets under
//                                                     artifacts/template-goldens/ (never the baseline)
//   node test/layout-template-goldens.mjs --promote   rewrites the baseline after the candidate was reviewed
// and explain the change in test/golden/notes/<ID>.md.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'test/golden/layout-templates-rr20-array-areas.json');
const output = path.resolve(process.env.OPF_TEMPLATE_GOLDEN_OUT ?? path.join(root, 'artifacts/template-goldens'));
const update = process.argv.includes('--update'), promote = process.argv.includes('--promote');
const scale = 0.25;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const started = performance.now();

const ids = Object.keys(layouts);
assert.equal(ids.length, 28, 'the 0.19 built-in set has 28 layouts');
const next = {
  version: 1,
  source: { fixture: '@openpresentation/gallery layouts (see layout-template-fixture.mjs)', sha256: sha256(JSON.stringify(fixture)), templates: ids.length },
  format: 'svg-png-sha256', scale, systemFonts: false, trace: true, entries: {},
};
const previous = (() => { try { return JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { return undefined; } })();
const changed = [];
const features = featureDecks(), paginated = paginatedDecks();
for (const { keys, deck } of [...ids.map(templateDeck), ...features, ...paginated]) {
  const svgs = toSvg(deck, { trace: true });
  assert.equal(svgs.length, keys.length, `${keys[0]}: slide count`);
  for (const [index, svg] of svgs.entries()) {
    const png = await toPng(svg, { scale });
    const entry = { svg: sha256(svg), png: sha256(png), bytes: png.byteLength };
    next.entries[keys[index]] = entry;
    if (JSON.stringify(previous?.entries?.[keys[index]]) !== JSON.stringify(entry)) changed.push({ key: keys[index], png });
  }
}
assert.equal(Object.keys(next.entries).length, 28 * 6 * 2 + [...features, ...paginated].reduce((sum, { keys }) => sum + keys.length, 0));

if (update || promote) {
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'candidate.json'), `${JSON.stringify(next, null, 1)}\n`);
  writeFileSync(path.join(output, 'diff.json'), `${JSON.stringify({ sourceMatches: JSON.stringify(previous?.source) === JSON.stringify(next.source), changedSlides: changed.map(({ key }) => key) }, null, 2)}\n`);
  for (const [index, { png }] of changed.entries()) writeFileSync(path.join(output, `${String(index).padStart(4, '0')}.png`), png);
  // Review sheets of the changed slides, 24 to a sheet, labelled with their key.
  for (let offset = 0; offset < changed.length; offset += 24) {
    const sheet = changed.slice(offset, offset + 24);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="${Math.ceil(sheet.length / 4) * 230}"><rect width="100%" height="100%" fill="#e5e5e5"/>${sheet.map(({ key, png }, i) => {
      const x = (i % 4) * 360, y = Math.floor(i / 4) * 230;
      return `<image x="${x + 4}" y="${y + 4}" width="352" height="198" href="data:image/png;base64,${Buffer.from(png).toString('base64')}"/><text x="${x + 6}" y="${y + 222}" font-size="14" font-family="Roboto">${key}</text>`;
    }).join('')}</svg>`;
    writeFileSync(path.join(output, `sheet-${offset / 24}.png`), await toPng(svg));
  }
  if (promote) writeFileSync(baselinePath, `${JSON.stringify(next, null, 1)}\n`);
  console.log(`Template goldens ${promote ? 'promoted' : 'candidate'}: ${Object.keys(next.entries).length} slides, ${changed.length} changed against the baseline. Review ${output}.`);
} else {
  assert.ok(previous, `Missing ${path.relative(root, baselinePath)}; run node test/layout-template-goldens.mjs --update, review, then --promote.`);
  assert.deepEqual(next.source, previous.source, 'Template fixture changed; review the candidate (--update) and promote it.');
  for (const key of ['version', 'format', 'scale', 'systemFonts', 'trace']) assert.equal(next[key], previous[key], `Template golden ${key} changed`);
  assert.deepEqual(Object.keys(next.entries), Object.keys(previous.entries), 'Template golden keys changed');
  assert.deepEqual(changed.map(({ key }) => key), [], `Template goldens moved (${changed.length} slides); run --update and review artifacts/template-goldens.`);
  console.log(`Template goldens passed: ${Object.keys(next.entries).length} slides, 28 templates (${((performance.now() - started) / 1000).toFixed(1)} s).`);
}
