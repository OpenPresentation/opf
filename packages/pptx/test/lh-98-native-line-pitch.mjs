// LH-98: a native body (bodyText 'native') writes core's measured line pitch as exact point spacing (as native titles do) and core's gap
// between list entries as space before each later entry, so PowerPoint ends the list where core's body box ends. A 122% multiple
// applied to the face's own line height drew lines about 20% taller than core measured. The PowerPoint check (a 6-entry list within
// about 2 px per line of the preview) is in the PR.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {composeSlide} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const options = {seed: 98, timestamp: '2026-11-02T00:00:00Z', zipDate: '2026-11-02T00:00:00Z'};
const items = ['Agree the owner of each workstream before the first readout', 'Publish the reporting cadence', 'Set the budget guardrails for the next two quarters and share them with every lead',
  'Name the first three milestones', 'Book the steering reviews', 'Close the open risks from the last cycle before kickoff'];
const deck = {design: {fontScheme: 'roboto'}, slides: [{title: 'Six steps before the budget cycle', items}, {title: 'One paragraph', text: 'A paragraph long enough to wrap onto a second line of its box, so its line pitch matters as much as a list does when the deck opens in PowerPoint.'}]};
const bytes = new Uint8Array(await toPptx(deck, {...options, bodyText: 'native'}));
const entries = unzipSync(bytes);
for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
const body = slide => [...strFromU8(entries[`ppt/slides/slide${slide}.xml`]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).find(shape => shape.includes('name="OPF native body '));
const points = (pPr, tag) => Number(new RegExp(`<a:${tag}><a:spcPts val="(\\d+)"/></a:${tag}>`).exec(pPr)?.[1]) / 100;

// 1. The list: every paragraph's exact line spacing is its entry's measured pitch, and the space before an entry is core's gap.
{
  const item = composeSlide(deck.slides[0], {}).items.find(entry => entry.field === 'items');
  const list = item.text.listEntries;
  const paragraphs = [...body(1).matchAll(/<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g)].map(([pPr]) => pPr);
  assert.equal(paragraphs.length, items.length);
  assert.ok(!/spcPct/.test(body(1)), 'no percentage line spacing');
  let end = 0;
  paragraphs.forEach((pPr, index) => {
    const pitch = points(pPr, 'lnSpc'), before = points(pPr, 'spcBef');
    assert.ok(Math.abs(pitch - list[index].text.lineHeight * .75) <= .01, `entry ${index}: ${pitch} pt for ${list[index].text.lineHeight} px`);
    const gap = index ? list[index].textBox.y - (list[index - 1].textBox.y + list[index - 1].textBox.height) : 0;
    assert.ok(Math.abs(before - gap * .75) <= .01, `entry ${index}: ${before} pt before for a ${gap} px gap`);
    assert.equal(points(pPr, 'spcAft'), 0);
    end += before + list[index].text.lines.length * pitch;
  });
  // PowerPoint's list ends where core's ends: the lines at their pitch plus the gaps are core's list height.
  assert.ok(Math.abs(end - item.text.height * .75) < .1, `${end} pt vs ${item.text.height * .75} pt`);
}

// 2. A paragraph: one exact pitch, no space before.
{
  const item = composeSlide(deck.slides[1], {}).items.find(entry => entry.field === 'text');
  const pPr = /<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/.exec(body(2))[0];
  assert.ok(Math.abs(points(pPr, 'lnSpc') - item.text.lineHeight * .75) <= .01);
  assert.equal(points(pPr, 'spcBef'), 0);
}

// 3. Import still reads the native list back whole.
{
  const back = await fromPptx(bytes, {});
  const plain = value => typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');
  assert.deepEqual(back.slides[0].items.map(plain), items);
}

console.log('LH-98: native bodies write core\'s line pitch and entry gap, so a native list ends where core measured it.');
