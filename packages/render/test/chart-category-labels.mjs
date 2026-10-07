import assert from 'node:assert/strict';
import { resolveTextStyle, textWidthMeasurer } from '@openpresentation/opf/composition';
import { renderSvg } from '../dist/svg.js';

// Category-axis labels (src/charts.js) follow PowerPoint's automatic labelling:
// never broken inside a word, rotated (-45 then -90 degrees) when they do not
// fit horizontally, then thinned with an automatic skip interval (first label
// kept), and never a text-overflow diagnostic. Horizontal bar and funnel labels
// skip rows or ellipsize (with one chart-label-truncated diagnostic).

const PATH = 'slides.0.chart';
const attributes = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const unescape = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
let measurer;
const widthOf = (text, size) => (measurer ??= textWidthMeasurer(resolveTextStyle({ fontFamily: 'Aptos', fontWeight: 400, italic: false }, undefined), undefined))(text, size);

function render(type, rows, { columns = ['Category', 'Value'], onlyPath = true } = {}) {
  const input = { slides: [{ title: 't', chart: { type, data: { columns, rows } } }] };
  const before = JSON.stringify(input);
  const diagnostics = [];
  const svg = renderSvg(input, { trace: true, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  assert.equal(renderSvg(input, { trace: true }), svg, `${type}: deterministic bytes`);
  assert.equal(JSON.stringify(input), before, `${type}: unchanged authored source`);
  assert.doesNotMatch(svg, /NaN|Infinity/, `${type}: finite output`);
  return { svg, diagnostics, ...labelsOf(svg) };
}

// Every drawn category label: its lines, position and rotation (from the
// enclosing rotate transform), keyed by the source row it labels.
function labelsOf(svg) {
  const labels = [];
  const pattern = /(?:<g transform="rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)">)?<g ([^>]*data-opf-path="slides\.0\.chart\.data\.rows\.(\d+)\.0"[^>]*)>([\s\S]*?)<\/g>/g;
  for (const [, angle, pivotX, pivotY, groupAttributes, row, body] of svg.matchAll(pattern)) {
    const texts = [...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, content]) => ({ ...attributes(a), content: unescape(content.replace(/<[^>]+>/g, '')) }));
    if (!texts.length) continue;
    const size = Number(texts[0]['font-size']);
    labels.push({
      row: Number(row), angle: angle === undefined ? 0 : Number(angle), pivot: angle === undefined ? null : [Number(pivotX), Number(pivotY)],
      lines: texts.map((t) => t.content), text: texts.map((t) => t.content).join(' '), size,
      x: Number(texts[0].x), y: Number(texts[0].y), anchor: texts[0]['text-anchor'], overflow: /data-opf-overflow/.test(groupAttributes),
      width: Math.max(...texts.map((t) => widthOf(t.content, size)))
    });
  }
  const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributes(a));
  const grids = lines.filter((line) => line['stroke-opacity'] === '0.7');
  return { labels, grids };
}

// The ink box of a label as a convex polygon (rotated labels turn about their pivot).
function polygon(label) {
  const size = label.size, ascent = size * 0.8, descent = size * 0.25;
  const rows = label.lines.length, height = rows * size * 1.22;
  const left = label.anchor === 'end' ? label.x - label.width : label.anchor === 'middle' ? label.x - label.width / 2 : label.x;
  const corners = [[left, label.y - ascent], [left + label.width, label.y - ascent], [left + label.width, label.y - ascent + height - size * 1.22 + ascent + descent], [left, label.y - ascent + height - size * 1.22 + ascent + descent]];
  if (!label.angle) return corners;
  const [px, py] = label.pivot, radians = label.angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  return corners.map(([x, y]) => [px + (x - px) * cos - (y - py) * sin, py + (x - px) * sin + (y - py) * cos]);
}
function overlaps(a, b, epsilon = 0.5) {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const [x1, y1] = shape[i], [x2, y2] = shape[(i + 1) % shape.length];
      const axis = [y1 - y2, x2 - x1];
      const project = (points) => points.map(([x, y]) => x * axis[0] + y * axis[1]);
      const p = project(a), q = project(b), scale = Math.hypot(...axis);
      if (Math.max(...p) - Math.min(...q) <= epsilon * scale || Math.max(...q) - Math.min(...p) <= epsilon * scale) return false;
    }
  }
  return true;
}

// The invariants every case must hold. `names` are the authored category labels
// by source row.
function check(label, { diagnostics, labels }, names, { valueLabels = false } = {}) {
  // Funnel value labels sit inside their bars; a bar too thin for its number is genuinely unrenderable text and keeps its diagnostic.
  const overflow = diagnostics.filter((d) => d.code === 'text-overflow' && !(valueLabels && /\.data\.rows\.\d+\.1$/.test(d.path)));
  assert.equal(overflow.length, 0, `${label}: no text-overflow diagnostics`);
  assert.ok(labels.every((entry) => !entry.overflow), `${label}: no overflow flag on a label`);
  assert.ok(labels.length >= 1, `${label}: labels drawn`);
  const truncated = diagnostics.filter((d) => d.code === 'chart-label-truncated');
  assert.ok(truncated.length <= 1, `${label}: at most one truncation diagnostic per chart`);
  const shortened = new Set(truncated.flatMap((d) => d.labels));
  assert.equal(new Set(labels.map((entry) => entry.row)).size, labels.length, `${label}: each label drawn once`);
  for (const entry of labels) {
    const full = names[entry.row];
    assert.notEqual(full, undefined, `${label}: label belongs to a category`);
    if (entry.text === full) continue;
    // Two-line labels keep every word whole; otherwise the label is ellipsized and reported.
    assert.ok(entry.text.endsWith('…') && full.startsWith(entry.text.slice(0, -1).trimEnd()), `${label}: "${entry.text}" is neither "${full}" nor an ellipsized prefix (mid-word break)`);
    assert.ok(shortened.has(`${PATH}.data.rows.${entry.row}.0`), `${label}: ellipsized label "${entry.text}" is reported`);
  }
  for (const entry of labels) if (entry.lines.length > 1) assert.ok(entry.lines.every((line) => !/^\s|\s$/.test(line)) && entry.lines.length === 2 && entry.text === names[entry.row], `${label}: two-line labels split at spaces`);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    assert.ok(!overlaps(polygon(labels[i]), polygon(labels[j])), `${label}: labels "${labels[i].text}" and "${labels[j].text}" overlap`);
  }
  return { truncated: shortened };
}

// Position of each drawn label along the category axis (0-based band index),
// from the plot's own gridlines.
function positions(rendered, count, { vertical = false, reversed = false } = {}) {
  const grid = rendered.grids.filter((line) => vertical ? line.x1 === line.x2 : line.y1 === line.y2);
  assert.ok(grid.length >= 2, 'value gridlines locate the plot');
  const [start, end] = vertical ? [Number(grid[0].y1), Number(grid[0].y2)] : [Number(grid[0].x1), Number(grid[0].x2)];
  const band = Math.abs(end - start) / count, low = Math.min(start, end);
  const along = (entry) => {
    const centre = vertical ? entry.y - entry.size * 0.35 - (entry.lines.length - 1) * entry.size * 0.61 : entry.pivot ? entry.pivot[0] : entry.x;
    const index = Math.floor((centre - low) / band + 1e-9);
    return vertical && !reversed ? index : vertical ? count - 1 - index : index;
  };
  return { band, positions: rendered.labels.map(along) };
}

const labelKinds = {
  short: (i) => `Category ${i + 1}`,
  long: (i) => `Category name number ${i + 1}`,
  digits: (i) => String(i + 1)
};
const wide = 'Extraordinarily long single unbroken category label without any spaces at all to force truncation ';
let cases = 0;

// 3, 12, 49 and 120 categories, short and long labels, across the category-axis chart types.
for (const count of [3, 12, 49, 120]) {
  for (const [kind, make] of Object.entries(labelKinds)) {
    const names = Array.from({ length: count }, (_, i) => make(i));
    const rows = names.map((name, i) => [name, 10 + (i * 7) % 23]);
    for (const type of ['column', 'line', 'histogram']) {
      const label = `${type}/${count}/${kind}`;
      const rendered = render(type, rows);
      check(label, rendered, names);
      const { band, positions: at } = positions(rendered, count);
      const drawn = at.slice().sort((a, b) => a - b);
      assert.equal(drawn[0], 0, `${label}: first label drawn`);
      const step = drawn.length > 1 ? drawn[1] - drawn[0] : count;
      drawn.forEach((position, k) => assert.equal(position, k * step, `${label}: labels at a fixed skip interval`));
      assert.equal(drawn.length, Math.ceil(count / step), `${label}: skip covers the axis`);
      const angles = new Set(rendered.labels.map((entry) => entry.angle));
      assert.equal(angles.size, 1, `${label}: one rotation per axis`);
      const [angle] = angles;
      assert.ok([0, -45, -90].includes(angle), `${label}: rotation ${angle}`);
      const textHeight = rendered.labels[0].size * 1.22;
      if (angle) {
        const sin = angle === -90 ? 1 : Math.SQRT1_2;
        assert.equal(step, Math.max(1, Math.ceil(textHeight / sin / band - 1e-9)), `${label}: rotated skip interval is the smallest that avoids overlap`);
      } else if (step > 1) {
        // One label fewer per skip would collide: the interval is minimal.
        const smaller = drawn.length ? Array.from({ length: Math.ceil(count / (step - 1)) }, (_, k) => k * (step - 1)) : [];
        const gap = rendered.labels[0].size * 0.1;
        const collides = smaller.some((position, k) => k && ((widthOf(names[position], rendered.labels[0].size) + widthOf(names[smaller[k - 1]], rendered.labels[0].size)) / 2 + gap > (position - smaller[k - 1]) * band + 1e-6));
        assert.ok(collides, `${label}: horizontal skip ${step} is minimal`);
      }
      cases++;
    }
    // Pareto sorts the categories by value: the drawing order follows the sort, so check invariants only.
    const pareto = render('pareto', rows);
    check(`pareto/${count}/${kind}`, pareto, names);
    const leftmost = pareto.labels.reduce((best, entry) => (entry.pivot ? entry.pivot[0] : entry.x) < (best.pivot ? best.pivot[0] : best.x) ? entry : best);
    const top = rows.reduce((best, row, i) => row[1] > rows[best][1] ? i : best, 0);
    assert.equal(leftmost.row, top, `pareto/${count}/${kind}: first (tallest) label drawn`);
    cases++;
    // Horizontal bars: rows skip when shorter than a text line; the first category is nearest the origin.
    const bar = render('bar', rows);
    check(`bar/${count}/${kind}`, bar, names);
    const { band: rowBand, positions: rowAt } = positions(bar, count, { vertical: true, reversed: true });
    const drawnRows = rowAt.slice().sort((a, b) => a - b);
    assert.equal(drawnRows[0], 0, `bar/${count}/${kind}: first category drawn`);
    const rowStep = Math.max(1, Math.ceil(bar.labels[0].size * 1.22 / rowBand - 1e-9));
    drawnRows.forEach((position, k) => assert.equal(position, k * rowStep, `bar/${count}/${kind}: rows at the smallest skip that avoids overlap`));
    cases++;
  }
}

// Documented decisions on the default canvas.
{
  const at = (type, count, kind, expected) => {
    const names = Array.from({ length: count }, (_, i) => labelKinds[kind](i));
    const rendered = render(type, names.map((name, i) => [name, i + 1]));
    const { positions: at } = positions(rendered, count);
    const drawn = at.slice().sort((a, b) => a - b), step = drawn.length > 1 ? drawn[1] - drawn[0] : count;
    assert.deepEqual({ angle: rendered.labels[0].angle, step }, expected, `${type}/${count}/${kind}: arrangement`);
    return rendered;
  };
  const short3 = at('column', 3, 'short', { angle: 0, step: 1 });
  assert.equal(short3.labels.length, 3, 'three categories: every label horizontal');
  const horizontal12 = at('column', 12, 'short', { angle: 0, step: 1 });
  assert.equal(horizontal12.labels.length, 12, 'twelve short labels stay horizontal');
  const long12 = at('column', 12, 'long', { angle: -90, step: 1 });
  assert.equal(long12.labels.length, 12, 'twelve long labels rotate instead of wrapping');
  at('column', 49, 'short', { angle: -90, step: 1 });
  at('column', 49, 'long', { angle: -90, step: 1 });
  at('column', 120, 'short', { angle: -90, step: 3 });
  at('column', 120, 'long', { angle: -90, step: 3 });
  // Rotated labels shrink the plot to make room, as Office does.
  const plotHeight = (rendered) => { const g = rendered.grids.filter((line) => line.y1 === line.y2).map((line) => Number(line.y1)); return Math.max(...g) - Math.min(...g); };
  assert.ok(plotHeight(long12) < plotHeight(short3) - 20, 'rotated labels shorten the plot');
}

// -45 degree labels: bands too narrow for the words but wide enough for slanted text.
{
  const names = Array.from({ length: 30 }, (_, i) => `Team ${i + 1}`);
  const rendered = render('column', names.map((name, i) => [name, i + 1]));
  check('column/30/team', rendered, names);
  assert.deepEqual([...new Set(rendered.labels.map((entry) => entry.angle))], [-45], 'thirty short team names slant at -45 degrees');
  assert.equal(rendered.labels.length, 30, 'slanted labels show every category');
}

// Two-line labels: spaces let a label use two lines in its band, never a mid-word break.
{
  const names = Array.from({ length: 10 }, (_, i) => `Regional sales ${i + 1}`);
  const rendered = render('column', names.map((name, i) => [name, i + 1]));
  check('column/two-line', rendered, names);
  assert.ok(rendered.labels.some((entry) => entry.lines.length === 2), 'labels wrap at spaces onto two lines');
  assert.ok(rendered.labels.every((entry) => entry.angle === 0), 'two-line labels stay horizontal');
  assert.ok(rendered.labels.every((entry) => entry.lines.join(' ') === names[entry.row]), 'two lines rejoin to the whole label');
}

// A label wider than the chart is ellipsized and reported once.
{
  const names = Array.from({ length: 4 }, (_, i) => `${wide.repeat(4)}${i + 1}`);
  const rendered = render('column', names.map((name, i) => [name, i + 1]));
  const outcome = check('column/too-wide', rendered, names);
  assert.ok(outcome.truncated.size >= 1 || rendered.labels.every((entry) => entry.text === names[entry.row]), 'wide labels: ellipsized with a diagnostic or shown whole');
  const bar = render('bar', names.map((name, i) => [name, i + 1]));
  const barOutcome = check('bar/too-wide', bar, names);
  assert.equal(barOutcome.truncated.size, 4, 'bar gutter: four ellipsized labels reported once');
  assert.equal(bar.diagnostics.filter((d) => d.code === 'chart-label-truncated').length, 1, 'bar gutter: a single diagnostic');
  assert.ok(bar.labels.every((entry) => entry.text.endsWith('…')), 'bar gutter: labels end with an ellipsis');
  const gutter = Math.max(...bar.labels.map((entry) => entry.width));
  assert.ok(gutter <= 1280 * 0.3, 'bar gutter is capped at 30% of the chart');
  cases += 3;
}

// Every other category-axis construct: no overflow diagnostics, whole words, no overlap.
for (const count of [12, 49]) {
  for (const kind of ['short', 'long']) {
    const names = Array.from({ length: count }, (_, i) => labelKinds[kind](i));
    const rows = names.map((name, i) => [name, 10 + (i * 5) % 17]);
    for (const type of ['stacked-column', '100pct-stacked-column', 'area', 'stacked-area', 'line-with-markers', 'stacked-bar', 'waterfall', 'funnel', 'box-and-whisker']) {
      const label = `${type}/${count}/${kind}`;
      const data = type.includes('stacked') ? rows.map((row) => [...row, row[1] + 3]) : rows;
      const rendered = render(type, data, { columns: type.includes('stacked') ? ['Category', 'A', 'B'] : ['Category', 'Value'] });
      check(label, rendered, names, { valueLabels: type === 'funnel' });
      cases++;
    }
    const radar = render('radar-with-markers', rows);
    assert.equal(radar.diagnostics.filter((d) => d.code === 'text-overflow').length, 0, `radar/${count}/${kind}: no text-overflow diagnostics`);
    assert.ok(radar.labels.some((entry) => entry.row === 0), `radar/${count}/${kind}: first spoke labelled`);
    for (const entry of radar.labels) assert.ok(entry.text === names[entry.row] || entry.text.endsWith('…') || entry.lines.join(' ') === names[entry.row], `radar/${count}/${kind}: whole words`);
    cases++;
  }
}

// Radar spokes: two-line labels wrap at spaces and, with the extra line, stay inside the chart at the top and bottom.
{
  const names = Array.from({ length: 6 }, (_, i) => `Regional sales region number ${i + 1}`);
  const rendered = render('radar', names.map((name, i) => [name, 5 + i]));
  assert.equal(rendered.diagnostics.filter((d) => d.code === 'text-overflow').length, 0, 'radar two-line: no text-overflow diagnostics');
  assert.ok(rendered.labels.some((entry) => entry.lines.length === 2), 'radar spoke labels wrap at spaces onto two lines');
  assert.ok(rendered.labels.every((entry) => entry.lines.join(' ') === names[entry.row]), 'radar two-line labels keep whole words');
  const frame = /<rect\b([^>]*data-opf-path="slides\.0\.chart"[^>]*)\/>/.exec(rendered.svg);
  const { x, y, width, height } = attributes(frame[1]);
  for (const entry of rendered.labels) for (const [px, py] of polygon(entry)) {
    assert.ok(px >= Number(x) && px <= Number(x) + Number(width) && py >= Number(y) && py <= Number(y) + Number(height), `radar: label ${entry.row} lies inside the chart`);
  }
  cases++;
}

console.log(`Category-axis labels passed: ${cases} cases (3/12/49/120 categories, short/long/numeric labels; column, line, histogram, pareto, bar and the other axis constructs) with no text-overflow, whole-word labels, rotation/skip as specified and byte determinism.`);
