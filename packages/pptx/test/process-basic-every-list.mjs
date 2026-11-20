// OPF 0.35 (the owner's decision: a process list is drawn as Basic Process): every unnumbered list of the process layout exports as its
// Basic Process. A short one is live SmartArt (PowerPoint's process1 in a data model); one outside the domain PowerPoint's comparison passed
// is native shapes with pptx/smartart-unavailable and its reason; a box that holds an entry's description or nested entries is native
// shapes (OPF writes one paragraph per SmartArt node), and every word of the list is on the slide.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const decoder = new TextDecoder();
const lists = {
  short: ['Queue', 'Route', 'Resolve', 'Follow up'],
  long: ['Agree scope and owners', 'Run two teams for six weeks', 'Measure completion and task time', 'Scale to every regional team'],
  nine: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'],
  described: [{text: 'Baseline', description: 'Measure completion rate and task time.'}, {text: 'Pilot', description: 'Two teams for six weeks, weekly review.'}, 'Decide'],
  nested: ['Prepare', {text: 'Collect data', level: 1}, {text: 'Book rooms', level: 1}, 'Run', {text: 'Workshops', level: 1}, 'Report'],
};
const deck = {name: 'Process lists', slides: Object.values(lists).map(items => ({layout: 'process', title: 'How the work moves', blocks: [{items}]}))};
const slides = resolvePresentation(deck).slides;
for (const [index, name] of Object.keys(lists).entries()) assert.equal(slides[index].geometry.arrangements?.[0]?.kind, 'process', `${name}: drawn as Basic Process`);
const findings = [];
const files = unzipSync(await toPptx(deck, {onDiagnostic: finding => findings.push(finding)}));
const reason = index => findings.find(finding => finding.code === 'smartart-unavailable' && finding.path === `slides.${index}.blocks.0.items`)?.reason;
for (const [index, [name, items]] of Object.entries(lists).entries()) {
  const xml = decoder.decode(files[`ppt/slides/slide${index + 1}.xml`]), rels = decoder.decode(files[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
  const live = /drawingml\/2006\/diagram/.test(xml);
  const data = [...rels.matchAll(/Target="\.\.\/diagrams\/(data\d+\.xml)"/g)].map(match => decoder.decode(files[`ppt/diagrams/${match[1]}`])).join('');
  // Every word of the list is in the slide (one shape per visual line) or the SmartArt's data model.
  const words = [...(xml + data).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(' ').split(/\s+/);
  for (const part of items.flatMap(item => typeof item === 'string' ? [item] : [item.text, item.description].filter(Boolean))) for (const word of part.split(/\s+/)) assert.ok(words.includes(word), `${name}: "${word}" is on the slide`);
  if (name === 'short') { assert.ok(live, 'a short list is live SmartArt'); assert.equal(reason(index), undefined); continue; }
  assert.ok(!live, `${name}: native shapes`);
  assert.ok(reason(index), `${name}: smartart-unavailable says why`);
  if (name === 'described' || name === 'nested') assert.match(reason(index), /description or nested entries/);
}
console.log('0.35: every process list exports as its Basic Process (live SmartArt where PowerPoint draws it as the preview, native shapes with the reason elsewhere)');
