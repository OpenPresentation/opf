// The export draws a labeled line chart's context line with core's stroke floor (chartFocusContextColors), as the preview does.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {CHART_CONTEXT_MIN_CONTRAST, colorContrast} from '@openpresentation/opf/composition';
import {toPptx} from '../dist/index.js';

const surface = '#0B1F3A';
const deck = {name: 'Context line', design: {background: {type: 'solid', color: surface}}, slides: [{title: 'Since 2023, delivery stayed above ninety-two percent', chart: {type: 'line', data: {columns: ['Year', 'On time'], rows: [['2021', 93.4], ['2022', 94.1], ['2023', 92.8], ['2024', 95.2], ['2025', 96.1]]}}}]};
const out = await toPptx(deck);
const files = unzipSync(out.bytes ?? out);
const xml = Object.keys(files).filter(name => /charts\/chart\d+\.xml$/.test(name)).map(name => strFromU8(files[name])).join('');
const series = /<c:ser>[\s\S]*?<\/c:ser>/.exec(xml)?.[0] ?? '';
// The series line (the first a:ln of the series' own spPr, before its marker).
const line = /<a:ln w="\d+"[^>]*><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/.exec(series)?.[1];
assert.ok(line, series.slice(0, 600));
assert.ok(colorContrast(`#${line}`, surface) >= CHART_CONTEXT_MIN_CONTRAST, `the exported context line #${line} keeps 3:1 against ${surface}`);
console.log(`chart context strokes (pptx): #${line}, ${colorContrast(`#${line}`, surface).toFixed(2)}:1`);
