import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';

// LH-40 (layout harvest): the code layout with five blocks (LH-27 corpus, batch-13 s29) left its middle panel's body no room after the
// filename and language, and the export threw `layout-overflow`. Non-strict, the body is exported at the readability floor (12 pt) with
// the finding; a strict composition still fails.
const lines = (count, name) => Array.from({length: count}, (_, index) => `${name}(${index});`).join('\n');
const slide = {layout: 'code', title: 'Signal Trend', blocks: [
  {code: {source: lines(6, 'routeToSponsor'), language: 'ts', filename: 'video-demo-sales-narrative-rule.ts'}},
  {text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs while making the operating tradeoffs clear to k-12 education stakeholders.'},
  {code: {source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts'}},
  {text: 'Keep the recommendation and its evidence together.'},
  {code: {source: lines(6, 'keepInWeeklyReview'), language: 'ts', filename: 'revenue-forecast-inspection-rule.ts'}},
]};
const diagnostics = [];
const bytes = await toPptx({slides: [slide]}, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
assert.ok(diagnostics.some(entry => entry.code === 'text-overflow' && entry.path === 'slides.0.blocks.2.code.source'), 'the body without room is reported');
const xml = new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
const shape = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).find(entry => /name="OPF code \d+ body line 1"/.test(entry) && entry.includes('result.errors.length'));
assert.ok(shape, 'the body line is a native text box with its text');
assert.match(shape, /sz="1200"/, 'at the readability floor');
await assert.rejects(toPptx({slides: [{...slide, composition: {overflow: 'error'}}]}), error => error.code === 'layout-overflow');
console.log('overflow integrity: the code layout with five blocks exports with its finding; strict fails');
