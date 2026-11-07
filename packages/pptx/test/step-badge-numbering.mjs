// LH-168: a process slide whose numbered steps draw as a stepper carries its numbers on the badges. The export writes those numerals
// and must not report `numbering-unsupported-core` (found by the v0.33 PowerPoint qualification), while a plain numbered list still
// writes native auto-numbers.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';

const steps = [
  ['Pick the hubs', 'Choose four sites near our largest customers.'],
  ['Move the stock', 'Move the 400 fastest items into the hubs.'],
  ['Switch the carriers', 'Contract two carriers per region on scorecards.'],
  ['Review every week', 'Read the scorecards and adjust the plan.'],
];
const deck = {
  name: 'Step badges',
  language: 'en-US',
  slides: [
    {layout: 'process', title: 'Four steps to the new network', blocks: steps.map(([text, description], index) => ({region: 'steps', items: [{text, description}], numbering: {style: 'arabic', start: index + 1}}))},
    {title: 'A numbered list', items: ['First', 'Second', 'Third'], numbering: 'arabic'},
  ],
};
const diagnostics = [];
const files = unzipSync(await toPptx(deck, {seed: 1, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
const xml = name => new TextDecoder().decode(files[name]);
assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code === 'numbering-unsupported-core'), [], 'no false numbering warning for a stepper');
const stepper = xml('ppt/slides/slide1.xml');
for (const number of ['1', '2', '3', '4']) assert.ok(stepper.includes(`<a:t>${number}</a:t>`), `badge ${number} is written`);
assert.ok(xml('ppt/slides/slide2.xml').includes('buAutoNum'), 'a plain numbered list keeps its native numbers');
console.log('step badge numbering: ok');
