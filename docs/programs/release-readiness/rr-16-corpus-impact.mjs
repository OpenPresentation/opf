// RR-16: how many example-corpus slides, text elements and boxes move when composed font sizes snap to
// PowerPoint's 0.01 pt grid. Renders the example corpus (`renderSvgDeck`, no trace) against two core builds and
// compares the SVGs element by element.
//
//   node docs/programs/release-readiness/rr-16-corpus-impact.mjs --render <opf-render checkout> \
//     --before <core dist before the change> --after <core dist with the change> [--out summary.json]
//
// Each dist directory is `packages/javascript/dist` of a built core checkout (the base commit in its own
// worktree, so its dependencies resolve). The renderer must be built (`dist/index.js`). Read-only: nothing is
// written except the optional summary.
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));

if (args.dump) {
  // Child mode: render the corpus with the core named by OPF_CORE_DIST (see scripts/local-opf-loader.mjs).
  const {examples} = await import('@openpresentation/opf/examples');
  const {renderSvgDeck} = await import(pathToFileURL(path.resolve(args.render, 'dist/index.js')).href);
  const out = {};
  for (const {file, deck} of examples) out[file] = renderSvgDeck(deck, {trace: false});
  writeFileSync(args.dump, JSON.stringify(out));
  process.exit(0);
}

for (const key of ['render', 'before', 'after']) if (!args[key]) { console.error('Usage: rr-16-corpus-impact.mjs --render <opf-render> --before <core dist> --after <core dist> [--out file]'); process.exit(2); }
const temp = mkdtempSync(path.join(tmpdir(), 'opf-rr16-'));
const dumps = {};
try {
  for (const side of ['before', 'after']) {
    dumps[side] = path.join(temp, `${side}.json`);
    const run = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.resolve(here, '../../../scripts/register-local-opf.mjs')).href, fileURLToPath(import.meta.url), '--render', args.render, '--dump', dumps[side]],
      {encoding: 'utf8', env: {...process.env, OPF_CORE_DIST: path.resolve(args[side])}, maxBuffer: 1 << 28});
    if (run.status !== 0) { console.error(run.stderr || run.stdout); process.exit(1); }
  }
  const A = JSON.parse(readFileSync(dumps.before, 'utf8')), B = JSON.parse(readFileSync(dumps.after, 'utf8'));
  const tagRe = /<(\w+)\b([^>]*?)\/?>/g, attrRe = /([\w:-]+)="([^"]*)"/g;
  const parse = svg => [...svg.matchAll(tagRe)].map(m => ({tag: m[1], attrs: Object.fromEntries([...m[2].matchAll(attrRe)].map(x => [x[1], x[2]]))}));
  const numbers = value => String(value ?? '').match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)?.map(Number) ?? [];
  // Path data and transforms: the largest delta between corresponding numbers; Infinity when not comparable (href, ids, text).
  const numericDelta = (a, b) => {
    if (/^data:|^#/.test(String(a)) || String(a).length > 400) return Infinity;
    const x = numbers(a), y = numbers(b);
    return !x.length || x.length !== y.length ? Infinity : Math.max(...x.map((value, index) => Math.abs(value - y[index])));
  };
  const EPS = 0.0011; // the preview prints coordinates to 0.001 px
  const stats = {slides: 0, slidesChanged: 0, slidesStructural: 0, textElementsInChangedSlides: 0, textFontSizeChanged: 0, textPositionChanged: 0, otherElementsMoved: 0};
  const sizeDeltas = [], boxDeltas = [], slideMax = [];
  for (const file of Object.keys(A)) {
    for (const [index, before] of A[file].entries()) {
      stats.slides++;
      const after = B[file][index];
      if (before === after) continue;
      stats.slidesChanged++;
      const pa = parse(before), pb = parse(after);
      if (pa.length !== pb.length) { stats.slidesStructural++; continue; }
      let maxSize = 0, maxMove = 0;
      for (const [k, ea] of pa.entries()) {
        const eb = pb[k];
        if (ea.tag === 'text') stats.textElementsInChangedSlides++;
        let moved = false;
        for (const key of new Set([...Object.keys(ea.attrs), ...Object.keys(eb.attrs)])) {
          const va = ea.attrs[key], vb = eb.attrs[key];
          if (va === vb) continue;
          const delta = Number.isFinite(+va) && Number.isFinite(+vb) ? Math.abs(va - vb) : numericDelta(va, vb);
          if (ea.tag === 'text' && key === 'font-size') { stats.textFontSizeChanged++; sizeDeltas.push(delta); maxSize = Math.max(maxSize, delta); }
          else if (delta > EPS) {
            if (ea.tag === 'text') { if (key === 'x' || key === 'y') { stats.textPositionChanged++; maxMove = Math.max(maxMove, delta); } }
            else { moved = true; boxDeltas.push(delta); maxMove = Math.max(maxMove, delta); }
          }
        }
        if (moved) stats.otherElementsMoved++;
      }
      slideMax.push({maxSize, maxMove});
    }
  }
  const quantile = (values, p) => values.length ? [...values].sort((x, y) => x - y)[Math.min(values.length - 1, Math.floor(p * values.length))] : 0;
  const bucket = (key, limits) => Object.fromEntries(limits.map((limit, i) => [i ? `${limits[i - 1]}-${limit}` : `<=${limit}`, slideMax.filter(s => s[key] <= limit && (!i || s[key] > limits[i - 1])).length]).concat([[`>${limits.at(-1)}`, slideMax.filter(s => s[key] > limits.at(-1)).length]]));
  const summary = {...stats,
    fontSizeDeltaPx: {median: quantile(sizeDeltas, .5), p95: quantile(sizeDeltas, .95), max: Math.max(0, ...sizeDeltas)},
    boxDeltaPx: {median: quantile(boxDeltas, .5), p95: quantile(boxDeltas, .95), max: Math.max(0, ...boxDeltas)},
    slidesByMaxFontSizeDeltaPx: bucket('maxSize', [0.0105, 0.05, 0.5]),
    slidesByLargestMovePx: bucket('maxMove', [0.0105, 0.05, 0.5])};
  console.log(JSON.stringify(summary, null, 2));
  if (args.out) writeFileSync(args.out, JSON.stringify(summary, null, 2) + '\n');
} finally { rmSync(temp, {recursive: true, force: true}); }
