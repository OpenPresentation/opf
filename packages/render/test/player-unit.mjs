// RR-28: unit checks for the slideshow player and the <opf-deck> element that need no browser: the deck helpers (hidden slides,
// labels, cursor, timer), cross-window sync over a real BroadcastChannel, the static server-side markup, the published entry
// points (import-safe on a server, one side-effect file), the font-root layout and its copy tool.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCursor, createDeckStore, createSync, createTimer, stateWins, deckChannelName, formatDuration, parseDeckDocument, parseSlideNumber, plainText, presentableIndexes, prepareSlideSvg, slideInfo, slideLabel, svgDimensions, DeckError} from '../dist/deck-runtime.js';
import {defineOpfDeck, getOpfDeckElement, renderDeckHtml} from '../dist/element.js';
import {present} from '../dist/player.js';
import {copyPreviewFonts} from '../dist/preview-fonts-node.js';
import {previewBaseFaces, previewFontLayout} from '../dist/preview-fonts.js';
import {BUNDLED_FONT_MANIFEST} from '../dist/fonts-node.js';
import {renderSlideSvg} from '../dist/svg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deck = JSON.parse(await readFile(path.join(root, 'test/fixtures/player-deck.opf.json'), 'utf8'));

// --- slides that play ---------------------------------------------------------------------------------------------
assert.deepEqual(presentableIndexes(deck), [0, 1, 3, 4, 5], 'the hidden slide is skipped');
assert.deepEqual(presentableIndexes(deck, {includeHidden: true}), [0, 1, 2, 3, 4, 5]);
assert.deepEqual(presentableIndexes({slides: [{hidden: true}]}), [], 'a deck whose slides are all hidden plays nothing');
assert.deepEqual(presentableIndexes({}), []);

assert.deepEqual(slideInfo(deck, 0), {index: 0, id: 'cover', title: 'Quarterly review', hasTitle: true, notes: 'Welcome everyone.\nThank the team before starting.', section: 'Opening', hidden: false});
assert.equal(slideInfo(deck, 2).hidden, true);
assert.equal(slideInfo({slides: [{text: 'x'}]}, 0).title, 'Slide 1', 'a slide without a title is named by its number');
assert.equal(slideInfo({slides: [{title: [{text: 'Rich '}, 'title']}]}, 0).title, 'Rich title', 'run titles read as plain text');
assert.equal(slideInfo({slides: [{notes: '<img src=x onerror=alert(1)>'}]}, 0).notes, '<img src=x onerror=alert(1)>', 'notes are plain text and are never altered');
assert.equal(slideLabel(slideInfo(deck, 3), 3, 5), 'Slide 3 of 5: Revenue grew 18 percent');
assert.equal(slideLabel(slideInfo({slides: [{text: 'x'}]}, 0), 1, 1), 'Slide 1 of 1');
assert.equal(plainText({text: 'a'}), 'a');
assert.equal(plainText(['a', {text: 'b'}, 3]), 'ab3');

assert.throws(() => parseDeckDocument('{'), (error) => error instanceof DeckError && error.code === 'invalid-document');
assert.throws(() => parseDeckDocument({name: 'no slides'}), (error) => error.code === 'invalid-document');
assert.equal(parseDeckDocument(JSON.stringify(deck)).name, 'Quarterly review');

assert.equal(parseSlideNumber('3'), 3);
assert.equal(parseSlideNumber(' 12 '), 12);
assert.equal(parseSlideNumber(4), 4);
for (const bad of ['', '3.5', 'x', '-1', null, undefined, 2.5]) assert.equal(parseSlideNumber(bad), undefined, String(bad));

// --- the cursor ---------------------------------------------------------------------------------------------------
{
  const cursor = createCursor([0, 1, 3, 4, 5]);
  assert.equal(cursor.number, 1);
  assert.equal(cursor.total, 5);
  assert.equal(cursor.previous(), false, 'cannot go before the first slide');
  assert.equal(cursor.next(), true);
  assert.equal(cursor.index, 1);
  assert.equal(cursor.goto(3), true);
  assert.equal(cursor.index, 3, 'slide number 3 of the sequence is document slide 3 (index), the hidden one skipped');
  assert.equal(cursor.goto(99), true);
  assert.equal(cursor.number, 5, 'a number past the end clamps to the last slide');
  assert.equal(cursor.next(), false);
  assert.equal(cursor.first(), true);
  assert.equal(cursor.gotoIndex(2), true, 'a hidden slide index lands on the next one that plays');
  assert.equal(cursor.index, 3);
  assert.equal(cursor.gotoIndex(99), true);
  assert.equal(cursor.index, 5);
  assert.equal(createCursor([]).number, 0);
  const sequence = cursor.sequence; sequence.push(99);
  assert.equal(cursor.total, 5, 'the sequence is copied out');
}

// --- time ---------------------------------------------------------------------------------------------------------
assert.equal(formatDuration(0), '0:00');
assert.equal(formatDuration(65000), '1:05');
assert.equal(formatDuration(3723000), '1:02:03');
assert.equal(formatDuration(-5000), '-0:05');
{
  let now = 1000;
  const timer = createTimer(() => now);
  assert.equal(timer.elapsed(), 0);
  timer.start(); now += 4000;
  assert.equal(timer.elapsed(), 4000);
  timer.pause(); now += 9000;
  assert.equal(timer.elapsed(), 4000, 'a paused timer does not run');
  timer.toggle(); now += 1000;
  assert.equal(timer.elapsed(), 5000);
  timer.reset();
  assert.equal(timer.elapsed(), 0);
  now += 2000;
  assert.equal(timer.elapsed(), 2000, 'reset keeps a running timer running');
}

// --- svg preparation ---------------------------------------------------------------------------------------------
{
  const svg = renderSlideSvg(deck, 0);
  assert.match(svg, /^<svg aria-label="Quarterly review" height="720" [^>]*role="img"/);
  const prepared = prepareSlideSvg(svg);
  const rootTag = /^<svg\b[^>]*>/.exec(prepared)[0];
  assert.ok(!/\s(width|height|role|aria-label)=/.test(rootTag), 'the fixed size and the img role go, so the slide text reaches a screen reader');
  assert.match(rootTag, /viewBox="0 0 1280 720"/);
  assert.deepEqual(svgDimensions(svg), {width: 1280, height: 720});
  assert.ok(prepared.includes('>Quarterly review</text>'), 'the slide text is still there');
  const gradient = '<svg viewBox="0 0 10 10"><defs><linearGradient id="opf-s1-background"/></defs><rect fill="url(#opf-s1-background)"/></svg>';
  const renamed = prepareSlideSvg(gradient, {idPrefix: 't-'});
  assert.ok(renamed.includes('id="t-opf-s1-background"') && renamed.includes('url(#t-opf-s1-background)'), 'thumbnail ids never collide with the slide ids');
  assert.equal(prepareSlideSvg('not svg'), 'not svg');
}

// --- sync over a real BroadcastChannel ---------------------------------------------------------------------------
{
  assert.equal(typeof BroadcastChannel, 'function');
  const name = `opf-deck-unit-${crypto.randomUUID()}`;
  const received = [];
  const a = createSync({name, id: 'a', onState: state => received.push(['a', state]), getState: () => ({index: 3, blank: 'none', rev: 5})});
  const b = createSync({name, id: 'b', onState: state => received.push(['b', state]), getState: () => ({index: 0, blank: 'black', rev: 0})});
  assert.equal(a.active, true);
  const wait = () => new Promise(resolve => setTimeout(resolve, 60));
  a.post({index: 4, blank: 'white', rev: 6}); await wait();
  assert.deepEqual(received, [['b', {index: 4, blank: 'white', rev: 6, from: 'a', reply: false}]], 'the other window hears the state; a window never hears itself');
  received.length = 0;
  b.hello(); await wait();
  assert.deepEqual(received, [['b', {index: 3, blank: 'none', rev: 5, from: 'a', reply: true}]], 'a new window says hello and the others answer with their state, marked as an answer');
  received.length = 0;
  const stranger = new BroadcastChannel(name);
  stranger.postMessage({v: 99, type: 'state', from: 'x', rev: 1, index: 1, blank: 'none'});
  stranger.postMessage({v: 1, type: 'state', from: 'x', rev: 1, index: 'one', blank: 'none'});
  stranger.postMessage({v: 1, type: 'state', from: 'x', rev: 'one', index: 1, blank: 'none'});
  stranger.postMessage({v: 1, type: 'state', from: 'x', rev: 1, index: 1, blank: 'purple'});
  stranger.postMessage('junk');
  await wait();
  assert.deepEqual(received, [], 'malformed or foreign messages are ignored');
  stranger.close(); a.close(); b.close();
  // Two windows that change the show at the same moment settle on one state.
  assert.equal(stateWins({rev: 4, from: 'a'}, {rev: 3, from: 'z'}), true, 'a newer revision wins');
  assert.equal(stateWins({rev: 3, from: 'a'}, {rev: 4, from: 'z'}), false, 'an older revision loses');
  assert.equal(stateWins({rev: 3, from: 'b'}, {rev: 3, from: 'a'}), true, 'a tie goes to the greater window id');
  assert.equal(stateWins({rev: 3, from: 'a'}, {rev: 3, from: 'b'}), false);
  assert.equal(stateWins({rev: 3, from: 'a'}, {rev: 3, from: 'a'}), false, 'a state never beats itself');
  {
    // a goes to slide 2 while b goes to slide 3: both messages cross in flight, and both windows end on the same slide.
    const windows = ['a', 'b'].map(id => ({id, rev: 0, index: 0}));
    const adopt = (window, state) => { if (stateWins(state, {rev: window.rev, from: window.id})) { window.rev = state.rev; window.index = state.index; } };
    const [first, second] = windows;
    first.rev += 1; first.index = 2; second.rev += 1; second.index = 3;
    const fromFirst = {rev: first.rev, from: 'a', index: first.index}, fromSecond = {rev: second.rev, from: 'b', index: second.index};
    adopt(first, fromSecond); adopt(second, fromFirst);
    assert.equal(first.index, second.index, 'crossing changes converge');
    assert.equal(first.rev, second.rev);
  }
  const none = createSync({name: '', id: 'z', onState() {}});
  assert.equal(none.active, false, 'without a channel name there is no sync');
  none.post({index: 0, blank: 'none'}); none.hello(); none.close();
  const stable = deckChannelName(deck);
  assert.equal(stable, deckChannelName(JSON.parse(JSON.stringify(deck))), 'the channel name is stable for the same deck, wherever it was loaded from');
  assert.notEqual(stable, deckChannelName({...deck, name: 'Other'}));
  assert.match(stable, /^opf-deck:[0-9a-f]{8}$/);
}

// --- the static markup --------------------------------------------------------------------------------------------
{
  const html = renderDeckHtml(deck, {src: '/d.json', fonts: '/opf-fonts/', embed: true});
  assert.match(html, /^<opf-deck src="\/d\.json" fonts="\/opf-fonts\/">/);
  assert.equal((html.match(/<figure /g) ?? []).length, 1, 'by default the first slide');
  assert.match(html, /aria-label="Slide 1 of 5: Quarterly review"/);
  assert.match(html, /<nav aria-label="Slides"><ol><li>Quarterly review<\/li><li>Agenda<\/li><li>Revenue grew 18 percent<\/li><li>What customers say<\/li><li>Decisions needed<\/li><\/ol><\/nav>/, 'the titles of the slides that play (not the hidden one)');
  assert.ok(!renderDeckHtml(deck, {slides: 'all'}).includes('Internal numbers'), 'a hidden slide is never drawn into the markup (an embedded document is the whole document, as the src file is)');
  assert.match(html, /<script type="application\/opf\+json">/);
  assert.ok(!/<\/script>[^]*<script/.test(html));
  const all = renderDeckHtml(deck, {slides: 'all'});
  assert.equal((all.match(/<figure /g) ?? []).length, 5);
  assert.equal((renderDeckHtml(deck, {slides: [2, 4]}).match(/<figure /g) ?? []).length, 2);
  assert.match(renderDeckHtml(deck, {slides: [2]}), /Slide 2 of 5: Agenda/);
  const hostile = renderDeckHtml({name: '</script><script>alert(1)</script>', slides: [{title: '</script><b onmouseover=1>x'}]}, {embed: true, label: 'a"b', src: '/x"y.json'});
  assert.ok(!hostile.includes('</script><script>'), 'a deck cannot close the embedded script');
  assert.ok(!hostile.includes('<b onmouseover'), 'text is escaped');
  assert.match(hostile, /label="a&quot;b"/);
  assert.match(hostile, /src="\/x&quot;y\.json"/);
  assert.match(renderDeckHtml(deck, {tagName: 'my-deck', thumbnails: true, present: true, includeHidden: true, slides: 'all'}).slice(0, 80), /^<my-deck thumbnails present include-hidden>/);
  assert.equal((renderDeckHtml(deck, {includeHidden: true, slides: 'all'}).match(/<figure /g) ?? []).length, 6);
  assert.throws(() => renderDeckHtml({}), (error) => error.code === 'invalid-document');
}

// --- entry points on a server ---------------------------------------------------------------------------------------
assert.equal(typeof globalThis.HTMLElement, 'undefined', 'this test runs where there is no DOM');
assert.equal(defineOpfDeck(), undefined, 'defining the tag on a server does nothing');
assert.throws(() => getOpfDeckElement(), (error) => error.code === 'no-dom');
await assert.rejects(present(deck), (error) => error.code === 'no-dom');
for (const entry of ['@openpresentation/opf-render/element', '@openpresentation/opf-render/player', '@openpresentation/opf-render/element/define', '@openpresentation/opf-render/preview-fonts', '@openpresentation/opf-render/preview-fonts-node']) {
  const module = await import(entry);
  assert.ok(Object.keys(module).length >= 0, entry);
}
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.deepEqual(manifest.sideEffects, ['./dist/element-define.js'], 'only the registration file has a side effect, so everything else tree-shakes');
for (const key of ['./player', './element', './element/define', './preview-fonts', './preview-fonts-node']) assert.ok(manifest.exports[key], `${key} is exported`);
assert.equal(manifest.bin['opf-preview-fonts'], './dist/preview-fonts-cli.js');
assert.ok((await readFile(path.join(root, 'dist/preview-fonts-cli.js'), 'utf8')).startsWith('#!/usr/bin/env node'));

// --- the font root --------------------------------------------------------------------------------------------------
{
  const layout = previewFontLayout();
  const kinds = layout.reduce((counts, entry) => ({...counts, [entry.kind]: (counts[entry.kind] ?? 0) + 1}), {});
  assert.ok(kinds.base >= 7 && kinds.lazy >= 20 && kinds.scripts >= 25, JSON.stringify(kinds));
  assert.ok(layout.every(entry => /^(base|lazy|scripts)\//.test(entry.target)));
  assert.ok(layout.some(entry => entry.target === 'lazy/fonts/intos'), 'vendored faces keep the renderer package-relative path');
  assert.ok(layout.some(entry => entry.target === 'base/roboto'), 'npm faces sit in their package name');
  assert.ok(layout.some(entry => entry.target === 'base/carlito'), 'the vendored eager family sits under base');
  const base = previewBaseFaces();
  assert.equal(base.length, 33, 'the eager faces are the 33 Office and base faces');
  assert.ok(base.some(face => face.family === 'Roboto' && face.weight === 400 && !face.italic && face.file === 'base/roboto/400Regular/Roboto_400Regular.ttf'));
  assert.equal(new Set(base.map(face => face.file)).size, base.length, 'no two faces share a file');
}

// --- copying the font root ------------------------------------------------------------------------------------------
{
  const out = await mkdtemp(path.join(tmpdir(), 'opf-preview-fonts-'));
  try {
    const result = copyPreviewFonts({outDir: out});
    assert.equal(result.missing.length, 0);
    assert.ok(result.copied > 100 && result.files.length === result.copied);
    assert.ok(existsSync(path.join(out, 'LICENSES.txt')));
    // Every copied file is the pinned bytes (the copy verifies; this checks the verifier left nothing out of the list).
    const pinned = new Map(BUNDLED_FONT_MANIFEST.packages.flatMap(pkg => pkg.faces.map(face => [face.sha256, `${pkg.name}/${face.file}`])));
    for (const file of result.files.slice(0, 12)) assert.ok(pinned.has(crypto.createHash('sha256').update(await readFile(path.join(out, file))).digest('hex')), file);
    const licenses = await readFile(path.join(out, 'LICENSES.txt'), 'utf8');
    assert.match(licenses, /SIL OPEN FONT LICENSE/);
    assert.ok(!existsSync(path.join(out, 'scripts')), 'script faces are opt in');
    const again = copyPreviewFonts({outDir: out});
    assert.equal(again.copied, 0, 'a second run finds every face already verified');
    assert.equal(again.verified, result.copied);
    const scripts = copyPreviewFonts({outDir: out, scripts: ['Hebr']});
    assert.ok(scripts.files.some(file => file.startsWith('scripts/')), 'a script selection copies its packages');
    assert.ok(!scripts.files.some(file => /noto-sans-jp/.test(file)));
    assert.throws(() => copyPreviewFonts({}), TypeError);
  } finally { await rm(out, {recursive: true, force: true}); }
}

// --- the deck store ---------------------------------------------------------------------------------------------
{
  const store = createDeckStore({document: deck});
  assert.equal(store.svg(0), store.svg(0), 'a slide is drawn once and kept');
  assert.equal(store.svg(0), renderSlideSvg(deck, 0, {date: undefined}), 'the store draws exactly what renderSvg draws');
  assert.equal(store.info(3).title, 'Revenue grew 18 percent');
  await store.ready();
  const broken = createDeckStore({document: {slides: [{id: 'a', title: 'x'}, {id: 'a', title: 'y'}]}});
  assert.throws(() => broken.svg(0), (error) => error instanceof DeckError && error.code === 'invalid-document' && /slide ids must be unique/.test(error.message) && error.message.includes('/slides/1/id'), 'an invalid deck says where');
  assert.throws(() => createDeckStore({document: '{'}), (error) => error.code === 'invalid-document');
  const dated = createDeckStore({document: {slides: [{id: 'a', title: 'x'}], design: {footer: {right: {date: true}}}}, date: '2026-10-01'});
  assert.doesNotThrow(() => dated.svg(0));
}

console.log('player unit checks passed');
