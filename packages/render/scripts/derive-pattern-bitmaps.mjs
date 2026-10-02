#!/usr/bin/env node
// Derive 8x8 pattern tiles from images of a DrawingML pattern fill and compare them with core's table.
//
// PowerPoint draws each `a:pattFill prst` as an 8x8 one-bit tile. ECMA-376 names the presets but does not define
// the pixels, so core (`patternBitmap`) authors them; this tool measures the real thing. Export a deck whose slides
// are full-slide pattern backgrounds (opf-pptx `scripts/rr07-native-set.mjs` builds it, one slide per preset, black on
// white) to PNG at 1280 x 720 (Slide.Export, or File > Export > PNG at that width), name the files
// `pattern-<nn>-<preset>.png`, then:
//
//   node scripts/derive-pattern-bitmaps.mjs <dir-or-png...> [--cell N] [--fg RRGGBB] [--bg RRGGBB] [--json out.json]
//
// For each image it votes every pixel into its (x mod 8N, y mod 8N) cell (N = image pixels per pattern pixel, default 1),
// thresholds each tile pixel at half foreground, and reports the tile as ASCII, its confidence (how uniformly the
// repeats agree), whether it equals core's tile, and the cyclic shift that matches best (a nonzero shift means PowerPoint
// anchors the pattern at another phase than the slide's top-left corner). It never edits core: copy a confirmed tile into
// opf/packages/javascript/src/pattern-fills.ts by hand and rerun the pattern tests.
import {readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {patternBitmap} from '@openpresentation/opf';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index < 0 ? fallback : args.splice(index, 2)[1]; };
const cell = Number(option('cell', '1')), jsonPath = option('json'), fgOption = option('fg'), bgOption = option('bg');
if (!Number.isInteger(cell) || cell < 1) throw new Error('--cell must be a positive integer (image pixels per pattern pixel).');
const files = args.flatMap(entry => statSync(entry).isDirectory()
  ? readdirSync(entry).filter(name => /^pattern-\d+-\w+\.png$/.test(name)).sort().map(name => path.join(entry, name)) : [entry]);
if (!files.length) throw new Error('Pass PNG files or a directory of pattern-<nn>-<preset>.png images.');

const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const ascii = rows => rows.map(row => [...Array(8)].map((_, x) => row & (0x80 >> x) ? '#' : '.').join(''));
const distance = (a, b) => a.reduce((sum, row, y) => sum + (row ^ b[y]).toString(2).replace(/0/g, '').length, 0);
const shift = (rows, dx, dy) => rows.map((_, y) => { const source = rows[(y - dy + 8) % 8]; return ((source >> dx) | (source << (8 - dx))) & 0xFF; });
const parse = value => value && [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));

const report = [];
for (const file of files) {
  const preset = /pattern-\d+-(\w+)\.png$/.exec(path.basename(file))?.[1] ?? path.basename(file, '.png');
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const period = 8 * cell;
  // Foreground and background: the explicit colours, else the darkest and lightest pixel.
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < data.length; i += 3) { const value = luminance(data[i], data[i + 1], data[i + 2]); low = Math.min(low, value); high = Math.max(high, value); }
  const fg = parse(fgOption), bg = parse(bgOption);
  const dark = fg && bg ? luminance(...fg) < luminance(...bg) : true;
  const mid = fg && bg ? (luminance(...fg) + luminance(...bg)) / 2 : (low + high) / 2;
  const votes = new Float64Array(period * period), totals = new Float64Array(period * period);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * 3, ink = (luminance(data[offset], data[offset + 1], data[offset + 2]) < mid) === dark;
    const slot = (y % period) * period + (x % period);
    totals[slot]++; if (ink) votes[slot]++;
  }
  const rows = [], agreement = [];
  for (let ty = 0; ty < 8; ty++) {
    let bits = 0;
    for (let tx = 0; tx < 8; tx++) {
      // The centre sample of each pattern pixel (cell x cell block): average its votes.
      let on = 0, all = 0;
      for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) { const slot = (ty * cell + dy) * period + tx * cell + dx; on += votes[slot]; all += totals[slot]; }
      const ratio = all ? on / all : 0;
      agreement.push(Math.abs(ratio - .5) * 2);
      if (ratio > .5) bits |= 0x80 >> tx;
    }
    rows.push(bits);
  }
  const core = patternBitmap(preset);
  const best = core ? [...Array(64)].map((_, n) => ({dx: n % 8, dy: n >> 3, differences: distance(shift(rows, n % 8, n >> 3), core)})).sort((a, b) => a.differences - b.differences || a.dx + a.dy - b.dx - b.dy)[0] : undefined;
  const entry = {file: path.basename(file), preset, width: info.width, height: info.height, tile: rows, ascii: ascii(rows),
    confidence: Number((agreement.reduce((sum, value) => sum + value, 0) / 64).toFixed(3)),
    core: core ? [...core] : null, matchesCore: core ? distance(rows, core) === 0 : null, differences: core ? distance(rows, core) : null, bestShift: best};
  report.push(entry);
  console.log(`${preset.padEnd(11)} confidence ${entry.confidence.toFixed(2)} ${entry.matchesCore === null ? 'no core tile' : entry.matchesCore ? 'matches core' : `${entry.differences} px differ from core${best && best.differences < entry.differences ? ` (best shift dx=${best.dx} dy=${best.dy}: ${best.differences} differ)` : ''}`}`);
  if (entry.matchesCore === false) console.log(entry.ascii.map(line => `    ${line}`).join('\n'));
}
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
const bad = report.filter(entry => entry.matchesCore === false).length;
console.log(`${report.length} pattern images, ${report.length - bad} match core${bad ? `, ${bad} differ` : ''}.`);
