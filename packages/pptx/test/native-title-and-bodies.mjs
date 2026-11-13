// RR-88: under bodyText 'native' a wrapped plain-string title is one Title placeholder (native wrap, no autofit), a slide with more
// than one text region has one native body per region (the first is the Body placeholder), and a list with one numbered sequence is
// native auto-numbered. Archive controls; the Keynote check (title showing on every slide, a lengthened bullet reflowing) is in the PR.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const options = {seed: 988, timestamp: '2026-10-17T00:00:00Z', zipDate: '2026-10-17T00:00:00Z'};
const decode = (entries, path) => strFromU8(entries[path]);
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const named = (entries, prefix, slide = 1) => shapes(decode(entries, `ppt/slides/slide${slide}.xml`)).filter(shape => shape.includes(`name="${prefix}`));
const longTitle = 'A title that is long enough to wrap over two lines of the slide because it carries a great many words';
async function exported(deck, extra = {}) {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(deck, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics};
}
const imported = async bytes => { const diagnostics = [], value = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)}); return {value, diagnostics}; };
const plain = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(plain).join('') : value?.text !== undefined ? plain(value.text) : '';

// 1. A wrapped title: one bound Title in both modes (RR-105, opf#1291: before it, the default wrote one box per measured line).
{
  const deck = {design: {fontScheme: 'roboto'}, slides: [{title: longTitle, items: ['One', 'Two']}]};
  const measured = await exported(deck);
  assert.equal(named(measured.entries, 'OPF heading slides.0.title line ').length, 1, 'default: the whole title is one shape');
  assert.match(decode(measured.entries, 'ppt/slides/slide1.xml'), /<p:ph type="title"\/>/, 'default: a wrapped title is the Title placeholder');
  const frame = shape => [shape.match(/<a:xfrm>[\s\S]*?<\/a:xfrm>/)[0], shape.match(/<p:txBody>[\s\S]*?<\/p:txBody>/)[0]];
  assert.deepEqual(frame(named(measured.entries, 'OPF heading slides.0.title line ')[0]), frame(named((await exported(deck, {bodyText: 'native'})).entries, 'OPF heading slides.0.title line ')[0]), 'default: the same title as native');
  const native = await exported(deck, {bodyText: 'native'});
  const titles = named(native.entries, 'OPF heading slides.0.title line ');
  assert.equal(titles.length, 1, 'native: the whole title is one shape');
  const [title] = titles;
  assert.match(title, /<p:ph type="title"\/>/);
  assert.match(title, /<a:bodyPr[^>]*wrap="square"[^>]*><a:noAutofit\/><\/a:bodyPr>/);
  assert.ok(!/normAutofit|spAutoFit/.test(title));
  assert.equal([...title.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''), longTitle);
  assert.equal((title.match(/<a:p>/g) ?? []).length, 1);
  // RR-105 (PowerPoint 2026-11-12): exact spacing drew the first line above the measured line's; single spacing scaled to the pitch does not.
  assert.match(title, /<a:lnSpc><a:spcPct val="10166[67]"\/><\/a:lnSpc>/, 'the measured line pitch is kept as scaled single spacing');
  assert.deepEqual(native.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  const {value, diagnostics} = await imported(native.bytes);
  assert.equal(value.slides[0].title, longTitle);
  assert.equal(diagnostics.filter(item => /^invalid-/.test(item.code)).length, 0);
  // A title edited longer in the application still imports as the one title.
  const edited = {...native.entries, 'ppt/slides/slide1.xml': new TextEncoder().encode(decode(native.entries, 'ppt/slides/slide1.xml').replace(longTitle, longTitle + ' and then some more words'))};
  const {zipSync} = await import('fflate');
  assert.equal((await imported(zipSync(edited))).value.slides[0].title, longTitle + ' and then some more words');
}

// 2. A hard line break: one Title holding the measured lines (RR-105: the break a paragraph, each wrap a line break; it was one box per line).
{
  const hard = await exported({slides: [{title: 'First line\nSecond line that is long enough to wrap onto yet another line of this title box'}]}, {bodyText: 'native'});
  const [shape, ...rest] = named(hard.entries, 'OPF heading slides.0.title line ');
  assert.equal(rest.length, 0, 'a hard break keeps the measured lines in one title');
  assert.match(shape, /<p:ph type="title"\/>/);
  assert.equal((shape.match(/<a:p>/g) ?? []).length, 2, 'the hard break is a paragraph');
  assert.equal((await imported(hard.bytes)).value.slides[0].title, 'First line\nSecond line that is long enough to wrap onto yet another line of this title box');
}

// 3. More than one text region: one native body each; the first binds to Body, the others are ordinary native text boxes.
{
  const deck = {design: {fontScheme: 'roboto'}, slides: [{title: 'Two regions', start: {text: 'Left column paragraph that is long enough to wrap over a couple of visual lines in its column.'},
    'center+end': {text: 'Right column paragraph with enough words to wrap onto a second visual line in its own region.'}}]};
  const native = await exported(deck, {bodyText: 'native'});
  const bodies = named(native.entries, 'OPF native body ');
  assert.equal(bodies.length, 2);
  assert.equal(bodies.filter(shape => /<p:ph type="body" idx="300"\/>/.test(shape)).length, 1, 'only the first is the Body placeholder');
  for (const body of bodies) { assert.match(body, /<a:noAutofit\/>/); assert.match(body, /wrap="square"/); assert.equal((body.match(/<a:p>/g) ?? []).length, 1); }
  assert.deepEqual(native.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  assert.equal(named(native.entries, 'OPF text ').length + named(native.entries, 'OPF heading slides.0.start').length, 0, 'no measured per-line boxes for either region');
  const {value} = await imported(native.bytes);
  assert.equal(plain(value.slides[0].start.text), deck.slides[0].start.text);
  assert.equal(plain(value.slides[0]['center+end'].text), deck.slides[0]['center+end'].text);
}

// 4. A numbered list: one native auto-numbered sequence. Entries that do not count up from one start stay measured.
{
  const items = ['Confirm owners for open exceptions', 'Review aging thresholds with operations leads', 'Schedule the next readout'];
  const native = await exported({design: {fontScheme: 'roboto'}, slides: [{title: 'Steps', items, numbering: 'arabic'}]}, {bodyText: 'native'});
  const [body] = named(native.entries, 'OPF native body ');
  const paragraphsOf = shape => (shape.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []);
  assert.equal(paragraphsOf(body).length, 3);
  assert.ok(paragraphsOf(body).every(paragraph => /<a:buAutoNum type="arabicPeriod" startAt="1"\/>/.test(paragraph)), 'every paragraph is numbered, PowerPoint counts them');
  assert.equal(native.diagnostics.filter(item => item.code === 'native-body-fallback').length, 0);
  assert.equal((await imported(native.bytes)).value.slides[0].numbering, 'arabic');
  const lettered = await exported({design: {fontScheme: 'roboto'}, slides: [{title: 'Steps', items, numbering: {style: 'alpha-upper', start: 3, suffix: 'paren'}}]}, {bodyText: 'native'});
  assert.ok(paragraphsOf(named(lettered.entries, 'OPF native body ')[0]).every(paragraph => /<a:buAutoNum type="alphaUcParenR" startAt="3"\/>/.test(paragraph)));
  assert.deepEqual((await imported(lettered.bytes)).value.slides[0].numbering, {style: 'alpha-upper', start: 3, suffix: 'paren'});
  const restarted = await exported({design: {fontScheme: 'roboto'}, slides: [{title: 'Steps', items: [{text: items[0]}, {text: items[1], start: 7}, {text: items[2]}], numbering: 'arabic'}]}, {bodyText: 'native'});
  assert.equal(named(restarted.entries, 'OPF native body ').length, 0, 'a restarted entry is not one native sequence');
  assert.ok(restarted.diagnostics.some(item => item.code === 'native-body-fallback' && item.reason === 'unsupported-list'));
}
console.log('Native title and bodies passed: wrapped title bound with native wrap, hard-break fallback, two native bodies, numbered lists and fallbacks.');
