import assert from 'node:assert/strict';
import { validate } from '@openpresentation/opf';
import {toSvg} from '../dist/svg.js';

// Public-API axis invariants for ordinary values. The pinned core packed-ecosystem
// harness (scripts/test-packed-ecosystem.mjs) runs this file by name against the
// installed renderer, so it keeps the historical name while asserting the
// chart-type renderer's Office-like scale (test/chart-scale.mjs covers extremes).

const elements = (svg) => [...svg.matchAll(/<(rect|circle|line|polyline|path)\b([^>]*)\/?\s*>/g)].map(([, tag, attributes]) => ({
  tag, ...Object.fromEntries([...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
}));

// Ordinary-range invariants ported from the retired legacy five-tick axis test:
// every authored value lands where the drawn value axis says it does, bars
// begin at the zero baseline, the axis includes zero for data that do not sit
// in the top sixth of the range, marks stay in the plot, rendering is byte
// deterministic and never mutates the authored document.
const ordinary = [
  ["positive", [1, 3, 2]],
  ["negative", [-1, -3, -2]],
  ["mixed-sign", [-2, 0, 3]],
  ["fractional", [0.25, 0.75, 0.5]],
  ["large", [1200, 3400, 2300]]
];
const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.01, `${message}: ${actual} != ${expected}`);
let ordinaryChecked = 0;
for (const [name, values] of ordinary) {
  for (const type of ["column", "bar", "line-with-markers"]) {
    const label = `${name}/${type}`;
    const horizontal = type === "bar";
    const input = { slides: [{ title: name, chart: { type, data: { columns: ["Category", "Value"], rows: values.map((v, i) => [`Item ${i + 1}`, v]) } } }] };
    const before = JSON.stringify(input);
    assert.equal(validate(input, { only: ['format'] }).valid, true, `${label}: valid source`);
    const svg = toSvg(input, 1, { trace: true });
    assert.equal(toSvg(input, 1, { trace: true }), svg, `${label}: deterministic bytes`);
    assert.equal(JSON.stringify(input), before, `${label}: unchanged authored source`);
    assert.doesNotMatch(svg, /NaN|Infinity/, `${label}: finite output`);
    const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a));
    const grids = lines.filter((l) => l["stroke-opacity"] === "0.7");
    const axes = lines.filter((l) => l.stroke === "#888888");
    // Value-axis tick labels are the chart-path text groups, one per gridline, in gridline order.
    const labels = [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
      .filter(([, a]) => attributesOf(a)["data-opf-path"] === "slides.0.chart")
      .map(([, , body]) => [...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, text]) => text).join(""));
    assert.ok(labels.length >= 2, `${label}: value axis has ticks`);
    const ticks = labels.map(Number);
    assert.ok(ticks.every(Number.isFinite), `${label}: numeric tick labels`);
    const grid = grids.filter((g) => horizontal ? g.x1 === g.x2 : g.y1 === g.y2);
    assert.equal(grid.length, ticks.length, `${label}: one gridline per tick label`);
    const position = (g) => Number(g[horizontal ? "x1" : "y1"]);
    const at = grid.map(position);
    const scale = (value) => at[0] + (value - ticks[0]) * (at.at(-1) - at[0]) / (ticks.at(-1) - ticks[0]);
    ticks.forEach((tick, i) => near(scale(tick), at[i], `${label}: evenly spaced ticks`));
    assert.ok(ticks[0] <= Math.min(...values) && ticks.at(-1) >= Math.max(...values), `${label}: axis covers every value`);
    assert.ok(ticks[0] <= 0 && ticks.at(-1) >= 0, `${label}: axis includes zero`);
    const zeroAxis = axes.find((l) => horizontal ? l.x1 === l.x2 : l.y1 === l.y2);
    assert.ok(zeroAxis, `${label}: zero baseline is drawn`);
    near(position(zeroAxis), scale(0), `${label}: zero baseline sits at value 0`);
    const marks = elements(svg).filter((s) => /^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(s["data-opf-path"] ?? ""));
    assert.equal(marks.length, values.length, `${label}: every authored point is drawn`);
    marks.forEach((mark, i) => {
      assert.equal(mark["data-opf-path"], `slides.0.chart.data.rows.${i}.1`, `${label}: source row identity`);
      const v = values[i];
      if (type === "line-with-markers") {
        near(Number(mark.cy), scale(v), `${label}: marker ${i} at authored value`);
        assert.ok(Number(mark.cy) >= Math.min(at[0], at.at(-1)) - 0.01 && Number(mark.cy) <= Math.max(at[0], at.at(-1)) + 0.01, `${label}: marker in plot`);
      } else if (horizontal) {
        near(Number(mark.x) + (v < 0 ? 0 : Number(mark.width)), scale(v), `${label}: bar ${i} ends at authored value`);
        near(Number(mark.x) + (v < 0 ? Number(mark.width) : 0), scale(0), `${label}: bar ${i} begins at zero`);
      } else {
        near(Number(mark.y) + (v < 0 ? Number(mark.height) : 0), scale(v), `${label}: bar ${i} ends at authored value`);
        near(Number(mark.y) + (v < 0 ? 0 : Number(mark.height)), scale(0), `${label}: bar ${i} begins at zero`);
      }
    });
    ordinaryChecked++;
  }
}
// Automatic minimum: zero stays on the axis unless every value is positive and
// the range is under a sixth of the maximum (mirrored for negative data), and it
// does so identically for line, column, bar and area. When zero is off the axis,
// bars and area fills start at the drawn axis edge, never at an off-plot zero.
const autoZero = [
  // name, values, whether the axis should drop zero, which edge bars/fills start from
  ["tight-high", [100, 110, 105], true, "min"],
  ["tight-fractional", [10.2, 10.6, 10.4], true, "min"],
  ["tight-negative", [-110, -100, -105], true, "max"],
  ["just-inside-sixth", [90, 110, 100], false, "zero"],
  ["wide-positive", [50, 100, 80], false, "zero"],
  ["wide-negative", [-100, -50, -80], false, "zero"],
  ["all-equal", [5, 5, 5], false, "zero"],
  ["all-equal-negative", [-5, -5, -5], false, "zero"],
  ["mixed-sign-tight-magnitude", [-100, 100, 105], false, "zero"]
];
let autoZeroChecked = 0;
for (const [name, values, dropsZero, edge] of autoZero) {
  for (const type of ["column", "bar", "line", "line-with-markers", "area"]) {
    const label = `${name}/${type}`;
    const horizontal = type === "bar";
    const input = { slides: [{ title: name, chart: { type, data: { columns: ["Category", "Value"], rows: values.map((v, i) => [`Item ${i + 1}`, v]) } } }] };
    const svg = toSvg(input, 1, { trace: true });
    assert.equal(toSvg(input, 1, { trace: true }), svg, `${label}: deterministic bytes`);
    const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a));
    const labels = [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
      .filter(([, a]) => attributesOf(a)["data-opf-path"] === "slides.0.chart")
      .map(([, , body]) => Number([...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, text]) => text).join("")));
    const grid = lines.filter((l) => l["stroke-opacity"] === "0.7" && (horizontal ? l.x1 === l.x2 : l.y1 === l.y2));
    assert.equal(grid.length, labels.length, `${label}: one gridline per tick label`);
    const at = grid.map((g) => Number(g[horizontal ? "x1" : "y1"]));
    const scale = (value) => at[0] + (value - labels[0]) * (at.at(-1) - at[0]) / (labels.at(-1) - labels[0]);
    const lo = Math.min(...values), hi = Math.max(...values);
    assert.ok(labels[0] <= lo && labels.at(-1) >= hi, `${label}: axis covers every value`);
    const zeroOnAxis = labels[0] <= 0 && labels.at(-1) >= 0;
    assert.equal(!zeroOnAxis, dropsZero, `${label}: zero ${dropsZero ? "dropped" : "kept"} by the top-sixth rule`);
    if (dropsZero) {
      // No big empty band: the data span fills most of the axis.
      const span = labels.at(-1) - labels[0];
      assert.ok((hi - lo) / span > 0.3, `${label}: data fills the tight axis (${hi - lo} of ${span})`);
    }
    // Where the baseline sits: zero if it is on the axis, otherwise the near axis edge.
    const baseline = zeroOnAxis ? scale(0) : edge === "min" ? at[0] : at.at(-1);
    const baselineValue = zeroOnAxis ? 0 : edge === "min" ? labels[0] : labels.at(-1);
    const axisLine = lines.find((l) => l.stroke === "#888888" && (horizontal ? l.x1 === l.x2 : l.y1 === l.y2));
    near(Number(axisLine[horizontal ? "x1" : "y1"]), baseline, `${label}: category axis crosses at the baseline`);
    const marks = elements(svg).filter((s) => /^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(s["data-opf-path"] ?? ""));
    if (type === "line-with-markers") {
      assert.equal(marks.length, values.length, `${label}: every marker`);
      marks.forEach((mark, i) => near(Number(mark.cy), scale(values[i]), `${label}: marker ${i} at authored value`));
    } else if (type === "line") {
      const points = elements(svg).find((s) => s.tag === "polyline")?.points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
      assert.equal(points.length, values.length, `${label}: every vertex`);
      points.forEach(([, y], i) => near(y, scale(values[i]), `${label}: vertex ${i} at authored value`));
    } else if (type === "area") {
      const area = elements(svg).find((s) => s.tag === "path" && s["data-opf-path"] === "slides.0.chart.data.columns.1");
      const numbers = area.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const ys = numbers.filter((_, i) => i % 2 === 1);
      const top = ys.slice(0, values.length), bottom = ys.slice(values.length);
      top.forEach((y, i) => near(y, scale(values[i]), `${label}: area vertex ${i} at authored value`));
      bottom.forEach((y) => near(y, baseline, `${label}: area fills to the baseline, not an off-plot zero`));
      ys.forEach((y) => assert.ok(y >= Math.min(at[0], at.at(-1)) - 0.01 && y <= Math.max(at[0], at.at(-1)) + 0.01, `${label}: area stays inside the plot`));
    } else {
      assert.equal(marks.length, values.length, `${label}: every bar`);
      const plotEdges = [Math.min(at[0], at.at(-1)), Math.max(at[0], at.at(-1))];
      marks.forEach((mark, i) => {
        const near0 = horizontal ? Number(mark.x) : Number(mark.y), far0 = near0 + Number(horizontal ? mark.width : mark.height);
        const [start, end] = [near0, far0];
        const value = scale(values[i]);
        // One end is the baseline, the other the authored value.
        const atBaseline = Math.abs(start - baseline) < 0.01 ? end : Math.abs(end - baseline) < 0.01 ? start : NaN;
        assert.ok(Number.isFinite(atBaseline), `${label}: bar ${i} starts at the baseline ${baselineValue}`);
        near(atBaseline, value, `${label}: bar ${i} ends at authored value`);
        assert.ok(start >= plotEdges[0] - 0.01 && end <= plotEdges[1] + 0.01, `${label}: bar ${i} inside the plot`);
      });
    }
    autoZeroChecked++;
  }
}
// Stacked and percentage groupings plot from a base, so their totals keep zero on the axis.
for (const type of ["stacked-column", "stacked-area"]) {
  const input = { slides: [{ chart: { type, data: { columns: ["Category", "A", "B"], rows: [["x", 100, 5], ["y", 104, 6], ["z", 102, 7]] } } }] };
  const svg = toSvg(input, 1, { trace: true });
  const first = [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
    .filter(([, a]) => attributesOf(a)["data-opf-path"] === "slides.0.chart")
    .map(([, , body]) => Number([...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, text]) => text).join("")));
  assert.equal(Math.min(...first), 0, `${type}: stacked totals keep zero on the axis`);
  autoZeroChecked++;
}
console.log(`Chart axis passed: ${ordinaryChecked} public ordinary-range cases and ${autoZeroChecked} automatic-minimum cases; authored fractions, zero baselines, evenly spaced ticks, top-sixth zero rule for line/column/bar/area, source preservation and deterministic bytes.`);
