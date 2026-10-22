// FA-07: TextRun.link allows http(s), mailto and tel; the export writes a native hyperlink for all three and
// import returns the same target. A single inline Audience object (root audience) round-trips through the
// document provenance like purpose and tone.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';

const dec = new TextDecoder();
const links = ['https://acme.com/a?b=c', 'mailto:hello@acme.com', 'tel:+15551234567'];
const source = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Links and audience',
  audience: {id: 'executive', attentionBudgetMinutes: 20},
  slides: [{title: 'Contact', text: links.flatMap((link, index) => [{text: `link ${index}`, link}, ' '])}]
};
assert.equal(validate(source, {only: ['format']}).valid, true);

const bytes = await toPptx(structuredClone(source));
const entries = unzipSync(bytes);
const rels = dec.decode(entries['ppt/slides/_rels/slide1.xml.rels']);
for (const link of links) assert.ok(rels.includes(`Target="${link.replaceAll('&', '&amp;')}"`), `${link} is a native hyperlink relationship`);
const slideXml = dec.decode(entries['ppt/slides/slide1.xml']);
assert.equal((slideXml.match(/<a:hlinkClick /g) ?? []).length >= links.length, true, 'one hlinkClick per linked run');

const imported = await fromPptx(bytes);
assert.equal(validate(imported, {only: ['format']}).valid, true);
const runs = JSON.stringify(imported.slides[0]);
for (const link of links) assert.ok(runs.includes(JSON.stringify(link)), `${link} survives import`);
assert.deepEqual(imported.audience, source.audience, 'a single audience object returns');

// references-only stores catalog references only: an inline Audience object is authored content, like an inline purpose.
const refs = await fromPptx(await toPptx(structuredClone(source), {provenance: 'references-only'}));
assert.equal(refs.audience, undefined);
// A catalog id as a string still returns in that mode.
const named = await fromPptx(await toPptx({...structuredClone(source), audience: 'executive'}, {provenance: 'references-only'}));
assert.equal(named.audience, 'executive');
console.log('FA-07 links and audience passed: http(s), mailto and tel link natively and import; a single audience object round-trips.');
