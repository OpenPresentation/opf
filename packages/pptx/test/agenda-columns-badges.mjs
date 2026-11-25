// opf#1429: an agenda of more than six entries flows into columns, and core composes one sequence of step badges per column, all with the
// list's path. The export named each badge by that path, so the second column repeated the first one's names and the duplicate-name guard
// stopped the export ("Duplicate generated step badge shape."). Every column keeps its badges now, under unique names; a single column
// (three and five entries) keeps the names it always had.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false}), list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const words = ['Welcome', 'Problem', 'Pilot design', 'Evidence', 'Team B', 'Options', 'Decision', 'Risks', 'Budget', 'Timeline', 'Hiring', 'Support', 'Legal', 'Security', 'Metrics', 'Roadmap', 'Q and A', 'Next steps', 'Owners', 'Close'];
const counts = [3, 5, 7, 8, 10, 12, 20];

for (const bodyText of [undefined, 'native']) {
  const deck = {slides: counts.map(count => ({layout: 'agenda', title: 'Agenda', blocks: [{items: words.slice(0, count)}]}))};
  const before = structuredClone(deck), geometry = resolvePresentation(deck).slides.map(slide => slide.geometry);
  const bytes = await toPptx(deck, bodyText ? {bodyText} : {}), zip = unzipSync(bytes);
  assert.deepEqual(deck, before, 'export leaves the deck unchanged');
  let columned = 0;
  for (const [index, count] of counts.entries()) {
    const label = `${count} entries${bodyText ? ' (native body text)' : ''}`;
    const steps = geometry[index].steps ?? [], badges = steps.flatMap(entry => entry.badges);
    // Twenty entries are too many for badges: the preview draws the plain list, and so does the export.
    const expected = count === 20 ? 0 : count;
    assert.equal(badges.length, expected, `${label}: the preview draws one badge per entry`);
    if (steps.length > 1) columned++;
    const xml = new TextDecoder().decode(zip[`ppt/slides/slide${index + 1}.xml`]), shapes = list(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
    const names = shapes.map(shape => shape['p:nvSpPr']['p:cNvPr'].name), drawn = shapes.filter(shape => /^OPF steps .* badge \d+$/.test(shape['p:nvSpPr']['p:cNvPr'].name));
    assert.equal(new Set(names).size, names.length, `${label}: shape names are unique`);
    assert.equal(drawn.length, expected, `${label}: one numbered badge per entry`);
    assert.deepEqual(drawn.map(shape => list(list(shape['p:txBody']['a:p'])[0]['a:r'])[0]['a:t']).sort((a, b) => a - b), badges.map(badge => badge.label).sort((a, b) => a - b), `${label}: the badges number the entries as the preview does`);
    // A single column keeps the names it always had (the exported bytes of such a deck do not change).
    if (steps.length === 1) assert.ok(drawn.every(shape => !shape['p:nvSpPr']['p:cNvPr'].name.includes(' part ')), `${label}: single-column names unchanged`);
  }
  assert.ok(columned >= 3, 'agendas of more than six entries compose one sequence per column');
  // Import: the badges are the layout's drawing, and each agenda comes back with the entries it was exported with.
  const imported = await fromPptx(bytes);
  assert.ok(!JSON.stringify(imported).includes('OPF steps'), 'no sequence shape imports as content');
  for (const [index, count] of counts.entries()) assert.deepEqual(imported.slides[index].blocks.flatMap(block => block.items), words.slice(0, count), `${count} entries import as exported`);
}
console.log('agenda column badges ok');
