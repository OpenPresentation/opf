// RR-102: decks changed through PowerPoint's Insert > Header & Footer and saved by PowerPoint (test/fixtures/header-footer-dialog,
// README there) import the change into the deck's footer or a slide's own, with full provenance and without (provenance: false).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '@openpresentation/opf';
import {unzipSync, zipSync} from 'fflate';
import {fromPptx} from '../dist/index.js';

const enc = new TextEncoder(), dec = new TextDecoder();

const fixture = name => readFile(new URL(`./fixtures/header-footer-dialog/${name}.pptx`, import.meta.url));
const source = JSON.parse(await readFile(new URL('./fixtures/header-footer-dialog/source.opf.json', import.meta.url), 'utf8'));
const read = async name => {
  const issues = [], document = await fromPptx(await fixture(name), {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validate(document, {only: ['format']}).valid, true, `${name} imports a valid document`);
  return {document, issues, footers: document.slides.map(slide => slide.design?.footer)};
};
const deckFooter = source.design.footer;

for (const name of ['edits', 'edits-bare']) {
  // Apply to All: Date and time on (Update automatically); slide 2: Footer retyped; slide 3: Slide number off; slide 6 (its footer
  // hidden in OPF): Footer and Slide number on.
  const {document, issues, footers} = await read(name);
  const dated = {...deckFooter, left: {...deckFooter.left, date: true}};
  assert.deepEqual(document.design.footer, dated, `${name}: the date added to every slide is the deck's, in the zone of the footer text`);
  assert.deepEqual(footers.slice(0, 5), [undefined, {...dated, left: {text: 'Acme Labs', date: true}}, {left: dated.left, center: dated.center}, undefined, undefined], `${name}: slides 2 and 3 keep their own change`);
  assert.deepEqual(footers[5], {left: {date: true, text: 'Added in PowerPoint'}, right: {text: '{{slide.number}}'}}, `${name}: the footer turned on where OPF hid it`);
  assert.deepEqual(issues.filter(issue => issue.code === 'invalid-furniture-provenance'), [], `${name}: no furniture provenance is damaged`);
}

for (const name of ['apply-all', 'apply-all-bare']) {
  // Apply to All: Date and time Fixed "Q4 2026", Footer retyped "Acme Group", Slide number off.
  const {document, footers} = await read(name);
  assert.deepEqual(document.design.footer, {left: {text: 'Acme Group', date: 'Q4 2026'}, center: deckFooter.center}, `${name}: the deck's footer changed`);
  assert.deepEqual(footers, [undefined, undefined, undefined, undefined, undefined, {left: {date: 'Q4 2026', text: 'Acme Group'}}], `${name}: the slide OPF drew without a footer shows only the dialog's parts`);
}

{
  // Apply to All: Date and time on, Update automatically, the fourth format (November 6, 2026).
  const {document, footers} = await read('date-format');
  assert.deepEqual(document.design.footer, {...deckFooter, left: {...deckFooter.left, date: true, dateFormat: 'MMMM d, yyyy'}});
  assert.deepEqual(footers.slice(0, 5), [undefined, undefined, undefined, undefined, undefined]);
  assert.deepEqual(footers[5], {left: {date: true, dateFormat: 'MMMM d, yyyy'}});
}

{
  // Without any OPF tag (another tool stripped them): only PowerPoint's own placeholders say what the footer is.
  const entries = unzipSync(await fixture('edits'));
  for (const path of Object.keys(entries)) {
    if (/^ppt\/tags\//.test(path)) delete entries[path];
    else if (/^ppt\/(slides\/slide\d+|slideLayouts\/slideLayout\d+|slideMasters\/slideMaster\d+|presentation)\.xml$/.test(path)) entries[path] = enc.encode(dec.decode(entries[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
    else if (/_rels\/[^/]+\.rels$/.test(path)) entries[path] = enc.encode(dec.decode(entries[path]).replace(/<Relationship\b[^>]*relationships\/tags"[^>]*\/>/g, ''));
  }
  const document = await fromPptx(zipSync(entries));
  assert.equal(validate(document, {only: ['format']}).valid, true);
  assert.deepEqual(document.design.footer, {left: {text: 'Acme Corp', date: true}, right: {text: 'Page {{slide.number}} of 6'}}, 'stripped: the placeholders are the deck footer');
  assert.deepEqual(document.slides.map(slide => slide.design?.footer), [undefined, {left: {text: 'Acme Labs', date: true}, right: {text: 'Page {{slide.number}} of 6'}}, {left: {text: 'Acme Corp', date: true}}, undefined, undefined, {left: {date: true, text: 'Added in PowerPoint'}, right: {text: '{{slide.number}}'}}]);
}

console.log('Header & Footer dialog: 5 PowerPoint-saved decks (per-slide edits and Apply to All, full provenance, provenance: false and stripped tags, a date format) import their changes.');
