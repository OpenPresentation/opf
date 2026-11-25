// FR-03: a `slide:<id>` link leaves as PowerPoint's own slide jump (a:hlinkClick action="ppaction://hlinksldjump" with a relationship to the
// target slide part) on a text run, a shape and a table cell, and import returns `slide:<id>`: the stored id of the target slide, or
// `slide-<number>` for a slide a PowerPoint author linked to.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';

const dec = new TextDecoder(), enc = new TextEncoder();
const source = () => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Agenda',
  slides: [
    {id: 'agenda', title: 'Agenda', blocks: [
      {text: [{text: 'Pricing', link: 'slide:pricing'}, ' and the ', {text: 'appendix', link: 'slide:appendix'}, ' or the ', {text: 'site', link: 'https://acme.com'}]},
      {shape: 'roundRect', text: 'Jump to pricing', link: 'slide:pricing'},
    ]},
    {id: 'pricing', title: 'Pricing', table: {columns: ['Plan', 'Where'], rows: [['Pro', [{text: 'Back to the agenda', link: 'slide:agenda'}]]]}},
    {id: 'appendix', title: 'Appendix', hidden: true, text: 'Details'},
  ],
});
assert.equal(validate(source(), {only: ['format']}).valid, true);

const bytes = await toPptx(source());
const entries = unzipSync(bytes);
const part = path => dec.decode(entries[path]);

// The agenda slide: two run jumps (pricing, appendix), the web link stays external, and the shape click jumps to pricing.
const agendaRels = part('ppt/slides/_rels/slide1.xml.rels'), agendaXml = part('ppt/slides/slide1.xml');
const slideRels = [...agendaRels.matchAll(/<Relationship\b[^>]*relationships\/slide"[^>]*>/g)].map(match => match[0]);
assert.ok(slideRels.some(rel => /Target="slide2\.xml"/.test(rel)), 'a relationship to the pricing slide part');
assert.ok(slideRels.some(rel => /Target="slide3\.xml"/.test(rel)), 'a relationship to the hidden appendix slide part (PowerPoint jumps to hidden slides)');
assert.ok(!slideRels.some(rel => /TargetMode="External"/.test(rel)), 'a slide relationship is internal');
assert.ok(agendaRels.includes('Target="https://acme.com"'), 'the web link stays an external hyperlink');
assert.equal((agendaXml.match(/action="ppaction:\/\/hlinksldjump"/g) ?? []).length, 3, 'two run jumps and the shape jump');
assert.match(agendaXml, /<p:cNvPr\b[^>]*name="[^"]*"[^>]*><a:hlinkClick r:id="rId\d+" action="ppaction:\/\/hlinksldjump"\/>/, 'the shape click jump sits in p:cNvPr');
// The table cell on the pricing slide jumps back to slide 1.
const pricingRels = part('ppt/slides/_rels/slide2.xml.rels');
assert.match(pricingRels, /relationships\/slide"[^>]*Target="slide1\.xml"|Target="slide1\.xml"[^>]*relationships\/slide"/);
assert.match(part('ppt/slides/slide2.xml'), /action="ppaction:\/\/hlinksldjump"/);
assert.match(part('ppt/slides/slide3.xml').slice(0, 2000), /show="0"/, 'the hidden slide stays hidden');

// A link to a slide no slide has is a validation error and the export refuses it.
const broken = source();
broken.slides[0].blocks[0].text[0].link = 'slide:nowhere';
await assert.rejects(() => toPptx(broken), error => error.code === 'invalid-opf');

// Import: the stored ids come back, so every link is the same as authored.
const imported = await fromPptx(bytes);
assert.equal(validate(imported, {only: ['format']}).valid, true, JSON.stringify(validate(imported, {only: ['format']}).findings.filter(f => f.severity === 'error')));
assert.deepEqual(imported.slides.map(slide => slide.id), ['agenda', 'pricing', 'appendix']);
const links = JSON.stringify(imported.slides.map(slide => slide));
assert.equal((links.match(/"link":"slide:pricing"/g) ?? []).length, 2, 'the run and the shape link to pricing');
assert.equal((links.match(/"link":"slide:appendix"/g) ?? []).length, 1);
assert.equal((links.match(/"link":"slide:agenda"/g) ?? []).length, 1, 'the table cell link');
assert.ok(links.includes('"link":"https://acme.com"'));

// A deck PowerPoint wrote has no OPF ids: the slides a jump names get slide-<number>, and no other slide gets an id.
const withoutTags = Object.fromEntries(Object.entries(entries).filter(([path]) => !/^ppt\/tags\//.test(path)));
for (const path of Object.keys(withoutTags)) {
  if (/^ppt\/slides\/slide\d+\.xml$/.test(path) || path === 'ppt/presentation.xml' || /_rels\/.*\.rels$/.test(path) || path === '[Content_Types].xml') {
    withoutTags[path] = enc.encode(dec.decode(withoutTags[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '').replace(/<Relationship\b[^>]*relationships\/tags"[^>]*\/>/g, '').replace(/<Override\b[^>]*\/ppt\/tags\/[^>]*\/>/g, ''));
  }
}
const foreign = await fromPptx(zipSync(withoutTags));
const ids = foreign.slides.map(slide => slide.id);
assert.deepEqual(ids, ['slide-1', 'slide-2', 'slide-3'], 'every slide here is linked to, so each got slide-<number>');
const foreignLinks = JSON.stringify(foreign.slides);
assert.ok(foreignLinks.includes('"link":"slide:slide-2"') && foreignLinks.includes('"link":"slide:slide-3"') && foreignLinks.includes('"link":"slide:slide-1"'));
assert.equal(validate(foreign, {only: ['format']}).valid, true);
console.log('ok');
