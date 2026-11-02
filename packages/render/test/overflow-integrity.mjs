import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs';

// LH-40 (layout harvest): the code layout with five blocks (LH-27 corpus, batch-13 s29) left its middle panel's body no room after the
// filename and language, and the preview threw `layout-overflow`. Non-strict, the body is drawn at the readability floor and the finding
// is reported; a strict composition still fails.
const lines = (count, name) => Array.from({length: count}, (_, index) => `${name}(${index});`).join('\n');
const slide = {layout: 'code', title: 'Signal Trend', blocks: [
  {code: {source: lines(6, 'routeToSponsor'), language: 'ts', filename: 'video-demo-sales-narrative-rule.ts'}},
  {text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs while making the operating tradeoffs clear to k-12 education stakeholders.'},
  {code: {source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts'}},
  {text: 'Keep the recommendation and its evidence together.'},
  {code: {source: lines(6, 'keepInWeeklyReview'), language: 'ts', filename: 'revenue-forecast-inspection-rule.ts'}},
]};
const diagnostics = [];
const [svg] = toSvg({slides: [slide]}, {trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
assert.ok(diagnostics.some(entry => entry.code === 'text-overflow' && entry.path === 'slides.0.blocks.2.code.source'), 'the body without room is reported');
const groups = [...svg.matchAll(/<g\b[^>]*>/g)].map(([tag]) => tag);
assert.ok(groups.some(tag => tag.includes('data-opf-path="slides.0.blocks.2.code.source"') && tag.includes('data-opf-overflow="true"')), 'the body is drawn, marked as overflowing');
assert.ok(svg.includes('result.errors.length'), 'its text is drawn');
assert.throws(() => toSvg({slides: [{...slide, composition: {overflow: 'error'}}]}), error => error.code === 'layout-overflow');
console.log('overflow integrity: the code layout with five blocks draws with its finding; strict fails');
