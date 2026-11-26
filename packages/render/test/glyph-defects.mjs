// opf#1472: the Intos sans faces draw U+0111 "đ" wrongly (a mirrored d with a bar, or a d whose stem is cut open by the bar). The vendored
// font files stay byte for byte, so GLYPH_DEFECTS (font-compatibility.js) names each bad glyph by the file's SHA-256 and the preview
// draws that one character from Arimo at the advance the bad glyph had. This test
//   1. audits the outlines of every bundled face (stroke letters against their base letters) and requires the audit and the table to
//      agree exactly: a new bundled font with the same defect fails, and a fixed upstream release makes its row stale and fails;
//   2. proves the replacement leaves layout alone: the same measured width, the same wrapping, and a raster that differs from the
//      unreplaced one only at the replaced glyphs;
//   3. pins what the Intos Serif faces draw for U+0180 (they have no glyph for it).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {create} from 'fontkit';
import * as core from '@openpresentation/opf/composition';
import {loadFonts} from '../dist/fonts-node.js';
import {GLYPH_DEFECTS, createScriptTextMeasurement, glyphDefectsFor} from '../dist/fonts.js';
import {toPng} from '../dist/index.js';
import {catalogs, toSvg} from './catalog-harness.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'metric'});
const raw = fonts.registry.textMeasurement;

// ---------------------------------------------------------------------------------------------------------------- 1. the outline audit
const N = 96, X0 = -0.1, X1 = 1.3, Y0 = -0.35, Y1 = 1.05;
/** The glyph's ink on an N x N grid over [X0, X1] x [Y0, Y1] em (nonzero winding, curves flattened). */
function raster(font, glyph) {
  const upem = font.unitsPerEm, edges = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const point = (x, y) => [x / upem, y / upem];
  const line = (x0, y0, x1, y1) => { if (y0 !== y1) edges.push([x0, y0, x1, y1]); };
  for (const {command, args: a} of glyph.path.commands) {
    if (command === 'moveTo') { [cx, cy] = point(a[0], a[1]); sx = cx; sy = cy; }
    else if (command === 'lineTo') { const [x, y] = point(a[0], a[1]); line(cx, cy, x, y); cx = x; cy = y; }
    else if (command === 'quadraticCurveTo') {
      const [qx, qy] = point(a[0], a[1]), [x, y] = point(a[2], a[3]);
      let px = cx, py = cy;
      for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t, nx = u * u * cx + 2 * u * t * qx + t * t * x, ny = u * u * cy + 2 * u * t * qy + t * t * y; line(px, py, nx, ny); px = nx; py = ny; }
      cx = x; cy = y;
    } else if (command === 'bezierCurveTo') {
      const [x1, y1] = point(a[0], a[1]), [x2, y2] = point(a[2], a[3]), [x, y] = point(a[4], a[5]);
      let px = cx, py = cy;
      for (let i = 1; i <= 12; i++) { const t = i / 12, u = 1 - t, nx = u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, ny = u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y; line(px, py, nx, ny); px = nx; py = ny; }
      cx = x; cy = y;
    } else if (command === 'closePath') { line(cx, cy, sx, sy); cx = sx; cy = sy; }
  }
  const grid = new Uint8Array(N * N);
  for (let row = 0; row < N; row++) {
    const y = Y1 - (row + 0.5) * (Y1 - Y0) / N, crossings = [];
    for (const [x0, y0, x1, y1] of edges) if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) crossings.push([x0 + (y - y0) * (x1 - x0) / (y1 - y0), y1 > y0 ? 1 : -1]);
    crossings.sort((p, q) => p[0] - q[0]);
    let winding = 0;
    for (let i = 0; i < crossings.length - 1; i++) {
      winding += crossings[i][1];
      if (winding === 0) continue;
      const from = Math.ceil((crossings[i][0] - X0) / (X1 - X0) * N - 0.5), to = Math.floor((crossings[i + 1][0] - X0) / (X1 - X0) * N - 0.5);
      for (let column = Math.max(0, from); column <= Math.min(N - 1, to); column++) grid[row * N + column] = 1;
    }
  }
  return grid;
}
const inkColumns = grid => { let low = N, high = -1; for (let row = 0; row < N; row++) for (let column = 0; column < N; column++) if (grid[row * N + column]) { low = Math.min(low, column); high = Math.max(high, column); } return [low, high]; };
const mirrored = grid => { const [low, high] = inkColumns(grid), out = new Uint8Array(N * N); for (let row = 0; row < N; row++) for (let column = low; column <= high; column++) out[row * N + low + high - column] = grid[row * N + column]; return out; };
const overlap = (a, b) => { let both = 0, either = 0; for (let k = 0; k < N * N; k++) { if (a[k] && b[k]) both++; if (a[k] || b[k]) either++; } return either ? both / either : 0; };
/** Background regions of `grid` that touch no edge of it: the counters of a letter, and any gap the outline cuts into its ink. */
function enclosedGaps(grid) {
  const seen = new Uint8Array(N * N), gaps = [];
  for (let start = 0; start < N * N; start++) {
    if (grid[start] || seen[start]) continue;
    const cells = [], stack = [start];
    let open = false;
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop(), row = (k / N) | 0, column = k % N;
      cells.push(k);
      if (row === 0 || column === 0 || row === N - 1 || column === N - 1) open = true;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = row + dr, c = column + dc;
        if (r < 0 || c < 0 || r >= N || c >= N) continue;
        const j = r * N + c;
        if (!grid[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (!open) gaps.push(cells);
  }
  return gaps;
}
// A stroke letter is its base letter with a bar through it. The pairs are the ones where that holds in every design (the bar of Ħ and
// Đ moves letters in some designs, so those are only checked for a cut-open stem): [stroke letter, base letter, mirror test applies].
const PAIRS = [[0x111, 0x64, true], [0x180, 0x62, true], [0x127, 0x68, false], [0x167, 0x74, false], [0x110, 0x44, false], [0x166, 0x54, false]];
/** The code points whose stroke letter is drawn wrongly in `font`: `{codePoint, defect}`, defect "mirrored" or "cut-open". */
function audit(font) {
  const found = [];
  for (const [codePoint, base, mirrorTest] of PAIRS) {
    if (!font.hasGlyphForCodePoint(codePoint) || !font.hasGlyphForCodePoint(base)) continue;
    const letter = raster(font, font.glyphForCodePoint(codePoint)), plain = raster(font, font.glyphForCodePoint(base));
    // A mirrored d is a b: the stroke letter looks more like the base letter turned around than like the base letter itself.
    if (mirrorTest && overlap(letter, mirrored(plain)) > overlap(letter, plain)) { found.push({codePoint, defect: 'mirrored'}); continue; }
    // A bar drawn against the winding of the stem leaves a hole in it: a gap the letter encloses whose cells are mostly the base's ink.
    if (enclosedGaps(letter).some(cells => cells.length >= 8 && cells.filter(k => plain[k]).length / cells.length > 0.5)) found.push({codePoint, defect: 'cut-open'});
  }
  return found;
}
const sha256 = data => createHash('sha256').update(data).digest('hex');
const label = face => `${face.family} ${face.weight}${face.italic ? ' italic' : ''}`;
const described = fonts.registry.describeFaces(), exported = fonts.registry.exportFaces();
assert.ok(described.length >= 100 && described.length === exported.length, `the office, open and base packs load: ${described.length} faces`);
const audited = described.map((face, index) => {
  const data = new Uint8Array(exported[index].data);
  return {face, hash: sha256(data), findings: audit(create(data))};
});

// Every defect the audit finds is listed, with the exact file it was found in.
for (const {face, hash, findings} of audited) for (const {codePoint, defect} of findings) {
  const row = GLYPH_DEFECTS.find(item => item.sha256 === hash);
  assert.ok(row?.codePoints.includes(codePoint), `${label(face)} (sha256 ${hash}) draws U+${codePoint.toString(16).toUpperCase().padStart(4, '0')} wrongly (${defect}): add it to GLYPH_DEFECTS (font-compatibility.js) with its replacement, or fix the face`);
  assert.equal(glyphDefectsFor(face.family, face.weight, face.italic)?.sha256, hash, `${label(face)}: glyphDefectsFor finds the row by family, weight and style`);
}
// Every row is still true: its file is bundled and the audit still finds its defect (a fixed upstream release changes the hash or the outline).
for (const row of GLYPH_DEFECTS) {
  const match = audited.filter(({hash}) => hash === row.sha256);
  assert.equal(match.length, 1, `${row.file}: no bundled face has sha256 ${row.sha256}; the file changed, so the row is stale: remove it or update its hash`);
  for (const codePoint of row.codePoints) assert.ok(match[0].findings.some(item => item.codePoint === codePoint), `${row.file}: the audit no longer finds a defect for U+${codePoint.toString(16).toUpperCase()}; the row is stale: remove it`);
  assert.equal(match[0].face.family, row.family, `${row.file}: family`);
  assert.equal(match[0].face.weight, row.weight, `${row.file}: weight`);
  assert.equal(match[0].face.italic, row.italic, `${row.file}: italic`);
}
// The rows agree with the face's provenance record, and the audit does find the six faces the issue names.
const provenance = JSON.parse(readFileSync(new URL('../fonts/intos/PROVENANCE.json', import.meta.url), 'utf8'));
for (const row of GLYPH_DEFECTS) {
  const record = provenance.faces.find(face => face.file === row.file);
  assert.equal(record?.sha256, row.sha256, `${row.file}: the row names the file PROVENANCE.json records`);
  assert.equal(row.commit, provenance.upstream.commit, `${row.file}: the row names the upstream commit the file was vendored at`);
  assert.match(row.defect, /U\+0111/);
  assert.deepEqual([...row.replacement], ['Arimo', 'Noto Sans', 'Roboto']);
}
assert.deepEqual(GLYPH_DEFECTS.map(row => row.file).sort(), ['Intos-Bold.ttf', 'Intos-Regular.ttf', 'IntosDisplay-Bold.ttf', 'IntosDisplay-Regular.ttf', 'IntosNarrow-Bold.ttf', 'IntosNarrow-Regular.ttf']);
assert.deepEqual(audited.filter(({findings}) => findings.length).map(({face}) => label(face)).sort(), ['Intos 400', 'Intos 700', 'Intos Display 400', 'Intos Display 700', 'Intos Narrow 400', 'Intos Narrow 700']);
assert.deepEqual(audited.filter(({face, findings}) => findings.length && glyphDefectsFor(face.family, face.weight, true)).length, 0, 'the italic faces are correct and have no row');
assert.equal(glyphDefectsFor('Intos Serif', 400, false), undefined, 'the serif faces are correct and have no row');
assert.equal(glyphDefectsFor('intos', 400, false)?.file, 'Intos-Regular.ttf', 'family names compare without case');

// --------------------------------------------------------------------------------------------------------------- 2. layout does not move
const deck = (title, text) => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'dstroke', language: 'hr',
  design: {fontScheme: {heading: 'Aptos', body: 'Aptos'}},
  slides: [{title, blocks: [{text}]}]
});
const profileOf = document => core.resolveScriptFonts(document, {catalogs});
/** The planner as it was before the fix (glyphFallback "none" plans the chosen face), and as it is. */
const measurementsFor = document => ({
  before: createScriptTextMeasurement(raw, profileOf(document), {glyphFallback: 'none'}),
  after: createScriptTextMeasurement(raw, profileOf(document))
});
const SAMPLES = ['đ', 'Đ', 'rađaju', 'Đurđevdan je u đačkom đonu', 'a đ', 'đa', 'đ ð d b ƀ Đ Ð D', 'Vietnamese: đường, Đà Nẵng, hỗn độn', 'ra', 'ƀ ħ ŧ'];
const sampleDocument = deck('Đurđevdan', 'rađaju');
const {before, after} = measurementsFor(sampleDocument);
const VISIBLE = 16;
let compared = 0;
for (const family of ['Aptos', 'Aptos Display', 'Aptos Narrow']) for (const fontWeight of [400, 700]) for (const size of [8, 17.5, 24, 56.25]) for (const text of SAMPLES) {
  const style = {fontFamily: family, fontWeight, path: 'slides.0.text'};
  const widths = [before, after].map(measurement => measurement.measure(text, size, style));
  assert.ok(Math.abs(widths[0] - widths[1]) <= 1e-9, `${family} ${fontWeight} ${size}px ${JSON.stringify(text)}: measured ${widths[1]} after, ${widths[0]} before`);
  const boxes = [before, after].map(measurement => measurement.outlineBounds(text, size, style));
  assert.ok(boxes[0] && boxes[1] && Math.abs(boxes[0].x - boxes[1].x) < size && Math.abs(boxes[0].y - boxes[1].y) < size, 'the ink box stays where it was, to within the glyph');
  compared++;
}
assert.equal(compared, 3 * 2 * 4 * SAMPLES.length);
// The planned runs: only the bad glyph moves to Arimo, at the Intos advance of "đ"; other styles and faces plan as before.
{
  const planner = after;
  const plain = [{fontFamily: 'Aptos', fontWeight: 400}, {fontFamily: 'Aptos', fontWeight: 700}, {fontFamily: 'Aptos Display', fontWeight: 400}, {fontFamily: 'Aptos Narrow', fontWeight: 700}];
  const scripts = (await import('../dist/fonts.js')).createScriptFonts(profileOf(sampleDocument), raw);
  for (const style of plain) {
    const runs = scripts.plan('rađaju', style);
    assert.deepEqual(runs.map(run => run.text), ['ra', 'đ', 'aju'], `${style.fontFamily} ${style.fontWeight}: the glyph is its own run`);
    assert.deepEqual(runs.map(run => run.own), [true, false, true]);
    assert.equal(runs[1].family, 'Arimo');
    const face = raw.resolveStyle(style);
    // Every run carries its share of the unsplit line: together exactly the width the line had, kerning with the neighbors included.
    assert.ok(runs.every(run => run.advance !== undefined), 'every run has its advance');
    assert.ok(Math.abs(runs.reduce((total, run) => total + run.advance, 0) - raw.measure('rađaju', 1, face)) <= 1e-12, `${style.fontFamily} ${style.fontWeight}: the runs add up to the unsplit width`);
    // The size at which Arimo's own advance is the bad glyph's advance (the SVG draws the run at it).
    const natural = raw.measure('đ', 1, {fontFamily: 'Arimo', fontWeight: face.fontWeight});
    assert.ok(Math.abs(natural * (runs[1].fontScale ?? 1) - raw.measure('đ', 1, face)) <= 1e-9, `${style.fontFamily} ${style.fontWeight}: the drawn glyph's advance is the bad glyph's`);
    assert.ok(Math.abs((runs[1].fontScale ?? 1) - 1) < 0.15, 'the replacement is drawn within 15% of the size of its neighbors');
    assert.equal(scripts.plan('rajaju', style).length, 1, 'text without the glyph is one run');
  }
  for (const style of [{fontFamily: 'Aptos', fontWeight: 400, italic: true}, {fontFamily: 'Aptos', fontWeight: 700, italic: true}, {fontFamily: 'Intos Serif', fontWeight: 400}, {fontFamily: 'Intos Serif', fontWeight: 700}]) {
    const runs = scripts.plan('rađaju', style);
    assert.equal(runs.length, 1, `${style.fontFamily} ${style.fontWeight}${style.italic ? ' italic' : ''}: the face draws it correctly`);
    assert.equal(runs[0].own, true);
  }
  assert.equal(planner.measure('x', 10, {fontFamily: 'Aptos'}) > 0, true);
  // Strict faces (glyphFallback "none") and an unmeasured planner draw the chosen face, as before.
  assert.equal(measurementsFor(sampleDocument).before.measure('đ', 10, {fontFamily: 'Aptos'}), raw.measure('đ', 10, {fontFamily: 'Aptos'}));
  assert.equal((await import('../dist/fonts.js')).createScriptFonts(profileOf(sampleDocument), undefined).plan('rađaju', {fontFamily: 'Aptos'}).length, 1);
  // Each of the four bold and regular sans faces: the replacement is one fixed family per row, in the order the row lists.
  const noArimo = (await import('../dist/fonts.js')).createScriptFonts(profileOf(sampleDocument), {...raw, resolveStyle: style => raw.resolveStyle(style.fontFamily === 'Arimo' ? {...style, fontFamily: 'Not Installed'} : style)});
  assert.equal(noArimo.plan('đ', {fontFamily: 'Aptos', fontWeight: 400})[0].family, 'Noto Sans', 'without Arimo the next family of the row draws it');
}
// The drawn deck: the same lines, the same baselines, and a raster that differs only at the replaced glyphs.
const WRAP = 'Djeca rađaju đavolje đakone, a đurđevak raste kraj đerma, dok se đubre đuska uz đavolski đir i đuvegiju u đumbiru svakog đurđevdana.';
const documents = [deck('đ Đurđevdan đ', 'rađaju · đ · Đ'), deck('Đ', WRAP), deck('x', 'Vietnamese: đường, Đà Nẵng, hỗn độn, đẹp đẽ')];
const render = (document, which) => {
  const wrapped = measurementsFor(document)[which], options = {fonts: {...fonts, textMeasurement: wrapped}, ...(which === 'before' ? {glyphFallback: 'none'} : {})};
  return {svg: toSvg(document, 1, options), options};
};
const textOf = svg => [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].map(([, attributes, content]) => ({y: /\by="([^"]+)"/.exec(attributes)?.[1], size: Number(/\bfont-size="([^"]+)"/.exec(attributes)?.[1]), text: content.replace(/<[^>]+>/g, '')}));
/** Decode a PNG (8 bit, no interlace) to {width, height, rgba}. */
function decode(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8, width, height, depth, type;
  const data = [];
  while (offset < png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset).getUint32(0), name = String.fromCharCode(...png.subarray(offset + 4, offset + 8)), body = png.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { const view = new DataView(body.buffer, body.byteOffset); width = view.getUint32(0); height = view.getUint32(4); depth = body[8]; type = body[9]; assert.equal(body[12], 0, 'not interlaced'); }
    if (name === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  assert.equal(depth, 8);
  const channels = type === 6 ? 4 : type === 2 ? 3 : 0;
  assert.ok(channels, `PNG color type ${type}`);
  const inflated = inflateSync(Buffer.concat(data)), stride = width * channels, pixels = new Uint8Array(height * stride);
  for (let row = 0; row < height; row++) {
    const filter = inflated[row * (stride + 1)], source = row * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[row * stride + i - channels] : 0, up = row ? pixels[(row - 1) * stride + i] : 0, corner = row && i >= channels ? pixels[(row - 1) * stride + i - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : (() => { const p = left + up - corner, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - corner); return pa <= pb && pa <= pc ? left : pb <= pc ? up : corner; })();
      pixels[row * stride + i] = (inflated[source + i] + predictor) & 255;
    }
  }
  return {width, height, channels, pixels};
}
for (const document of documents) {
  const [old, now] = [render(document, 'before'), render(document, 'after')];
  assert.notEqual(old.svg, now.svg, 'the replacement changes the drawing');
  assert.deepEqual(textOf(now.svg), textOf(old.svg), 'the same lines (the text wraps at the same places) on the same baselines');
  assert.equal((now.svg.match(/font-family="Arimo/g) ?? []).length > 0, true, 'the glyph is drawn with Arimo');
  const pictures = await Promise.all([old, now].map(({svg, options}) => toPng(svg, {...options, scale: 1}).then(decode)));
  assert.equal(pictures[0].width, pictures[1].width);
  const {width, height, channels} = pictures[0];
  const scale = width / Number(/viewBox="0 0 (\d+(?:\.\d+)?)/.exec(now.svg)[1]);
  // One drawn line can be several <text> elements on one baseline.
  const lines = [];
  for (const item of textOf(now.svg)) if (item.text.trim()) { const same = lines.find(line => line.y === item.y); if (same) same.text += item.text; else lines.push({...item}); }
  // Pixels that differ, line by line (a band around the baseline): none on a line without the glyph, and on a line with it only
  // groups of changed columns (closer than 6 px), one per replaced glyph, no wider than a glyph. A letter after a glyph of a letter-spaced
  // line can sit a fraction of a pixel away from where the unsplit line drew it (its kerning with the glyph); that changes anti-aliased edge
  // pixels by a few levels, so a difference counts from VISIBLE levels (of 255) up.
  let replaced = 0;
  for (const line of lines) {
    const baseline = Number(line.y) * scale, size = line.size * scale, columns = new Uint8Array(width);
    for (let y = Math.max(0, Math.floor(baseline - size * 0.78)); y < Math.min(height, Math.ceil(baseline + size * 0.22)); y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (Math.max(Math.abs(pictures[0].pixels[i] - pictures[1].pixels[i]), Math.abs(pictures[0].pixels[i + 1] - pictures[1].pixels[i + 1]), Math.abs(pictures[0].pixels[i + 2] - pictures[1].pixels[i + 2])) > VISIBLE) columns[x] = 1;
    }
    const groups = [];
    for (let x = 0; x < width; x++) if (columns[x]) { if (groups.length && x - groups.at(-1).end <= 6) groups.at(-1).end = x; else groups.push({start: x, end: x}); }
    // A single changed column is the edge of a letter that sits a fraction of a pixel off (see above), not a replaced glyph.
    for (let index = groups.length - 1; index >= 0; index--) if (groups[index].end - groups[index].start < 2) groups.splice(index, 1);
    const glyphs = [...line.text].filter(character => character === 'đ').length;
    replaced += glyphs;
    assert.ok(groups.length <= glyphs, `${JSON.stringify(line.text)}: ${groups.length} changed groups for ${glyphs} replaced glyphs`);
    assert.ok(groups.every(group => group.end - group.start < size * 0.9), `${JSON.stringify(line.text)}: changed pixels stay inside glyph-sized groups: ${JSON.stringify(groups)}`);
  }
  assert.ok(replaced > 0);
  // A replaced "Đ" (U+0110) is drawn by Intos itself: the unchanged capital never changes a pixel when only it is drawn.
}
{
  const capital = deck('Đ', 'Đ Ð');
  const pictures = await Promise.all(['before', 'after'].map(which => { const {svg, options} = render(capital, which); return toPng(svg, {...options, scale: 1}); }));
  assert.deepEqual(pictures[0], pictures[1], 'U+0110 and U+00D0 are correct in every face and draw exactly as before');
}

// ------------------------------------------------------------------------------------------------------- 3. U+0180 in the serif faces
{
  const scripts = (await import('../dist/fonts.js')).createScriptFonts(profileOf(sampleDocument), raw);
  for (const fontWeight of [400, 700]) {
    const runs = scripts.plan('ƀ', {fontFamily: 'Intos Serif', fontWeight});
    assert.deepEqual(runs.map(run => [run.text, run.family, run.own]), [['ƀ', 'Noto Sans', false]], `Intos Serif ${fontWeight}: the existing glyph fallback draws U+0180 with Noto Sans (the face has no glyph for it)`);
  }
}
console.log(`glyph-defects: ${audited.length} faces audited, ${GLYPH_DEFECTS.length} known bad glyph rows, ${compared} width comparisons, ${documents.length} decks compared`);
