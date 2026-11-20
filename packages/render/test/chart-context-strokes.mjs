// A labeled line chart focused on a category draws its context line at core's stroke floor (chartFocusContextColors), not the light
// labeled neutral: on a dark slide the line stays readable.
import assert from 'node:assert/strict';
import { CHART_CONTEXT_MIN_CONTRAST, colorContrast } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const surface = '#0B1F3A';
const deck = { name: 'Context line', design: { background: { type: 'solid', color: surface } }, slides: [{ title: 'Since 2023, delivery stayed above ninety-two percent', chart: { type: 'line', data: { columns: ['Year', 'On time'], rows: [['2021', 93.4], ['2022', 94.1], ['2023', 92.8], ['2024', 95.2], ['2025', 96.1]] } } }] };
const svg = toSvg(deck)[0];
const line = /<polyline fill="none"[^>]*stroke="(#[0-9A-Fa-f]{6})"/.exec(svg)?.[1];
assert.ok(line, svg.slice(0, 400));
assert.ok(colorContrast(line, surface) >= CHART_CONTEXT_MIN_CONTRAST, `the context line ${line} keeps 3:1 against ${surface}`);
console.log(`chart context strokes: the labeled context line is ${line}, ${colorContrast(line, surface).toFixed(2)}:1`);
