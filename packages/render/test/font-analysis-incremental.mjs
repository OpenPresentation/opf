// The 0.28.0 startup regression: the browser fonts handle's `pending` (asked before every render) composed every slide of the deck twice per call,
// once to find the font families (`presentationFamilies`, with core's regex-heavy default measurement) and once to find the faces it draws
// (`presentationFaces`). The analysis now keeps each slide's result by the slide's content and redoes only the slides that changed, the families come
// from the slide designs without composing, and each drawn string is scanned once.
//
// This test holds the work to counts (no timing): each slide analyzed once, an edit of one slide analyzes one slide, a deck the same as before
// analyzes none. And it holds the results to the 0.28.0 algorithms, which it carries as references, over every example deck.
import assert from 'node:assert/strict';
import { examples } from '@openpresentation/opf/examples';
import { catalogs } from './catalog-harness.mjs';
import { resolvePresentation, toSvg } from '../dist/svg.js';
import { pickFace } from '../dist/font-registry.js';
import { createFontAnalysis, presentationFaces, presentationFamilies } from '../dist/lazy-fonts.js';
import { analyzePresentationScripts, createScriptAnalysis, drawnStrings } from '../dist/script-font-pack.js';
import { lazyFontList, loadFonts as loadBrowserFonts } from '../dist/fonts-browser.js';
import { itemizeScripts, scriptOfCharacter } from '../dist/script-fonts.js';
import { loadFonts } from '../dist/fonts-node.js';

// ---- the 0.28.0 algorithms, as references ----
const NOT_RESOLVE = new Set(['fonts', 'onDiagnostic', 'trace', 'glyphFallback', 'imageResolver', 'strictAssets', 'signal']);
const resolveOptionsOf = options => Object.fromEntries(Object.entries(options ?? {}).filter(([key]) => !NOT_RESOLVE.has(key)));
const lc = value => String(value).trim().toLowerCase();
function referenceFamilies(presentation, options = {}) {
  const families = new Set();
  for (const slide of resolvePresentation(presentation, resolveOptionsOf(options)).slides) for (const family of Object.values(slide.design?.fonts ?? {})) if (typeof family === 'string' && family) families.add(family);
  return families;
}
function referenceFaces(presentation, options = {}, registry) {
  const seen = new Map();
  const pool = registry && [...registry.faces].map(face => ({ ...face, familyGroup: face.familyGroup ?? face.family }));
  const settle = style => {
    if (!pool) return { ...style };
    try { const { face } = pickFace(pool, style?.fontFamily, style, registry); return { ...style, fontFamily: face.family, fontWeight: face.weight, italic: face.italic }; } catch { return { ...style }; }
  };
  const record = style => {
    const family = style?.fontFamily;
    if (typeof family !== 'string' || !family.trim() || family.startsWith('+')) return;
    const weight = Number.isFinite(style.fontWeight) ? style.fontWeight : 400, italic = style.italic === true;
    const key = `${lc(family)}\u0000${weight}\u0000${italic}`;
    if (!seen.has(key)) seen.set(key, { family, weight, italic });
  };
  toSvg(presentation, { ...resolveOptionsOf(options), fonts: { textMeasurement: { measure(text, size, style) { if (text !== '') record(settle(style)); return String(text).length * size * 0.01; }, resolveStyle: settle } } });
  return [...seen.values()].sort((a, b) => a.family < b.family ? -1 : a.family > b.family ? 1 : Number(a.italic) - Number(b.italic) || a.weight - b.weight);
}
const outcome = run => { try { return { value: run() }; } catch (error) { return { error: error?.code ?? error?.message }; } };

// The registry view a browser handle analyzes with: the office faces it holds and every vendored face it could load.
const office = (await loadFonts({ pack: 'office', substitutionPolicy: 'visual' })).registry;
const held = office.describeFaces(), heldKeys = new Set(held.map(face => `${lc(face.family)}\u0000${face.weight}\u0000${!!face.italic}`));
const view = { faces: [...held, ...lazyFontList().filter(face => !heldKeys.has(`${lc(face.family)}\u0000${face.weight}\u0000${!!face.italic}`))], policy: 'visual', aliases: new Map(), fallbackFamily: 'Roboto' };
const options = { catalogs };

// ---- the same results as 0.28.0, over every example deck ----
{
  const analysis = createFontAnalysis();
  let decks = 0, faces = 0;
  for (const { file, deck } of examples) {
    for (const registry of [undefined, view]) {
      const expected = outcome(() => referenceFaces(deck, options, registry));
      assert.deepEqual(outcome(() => analysis.faces(deck, options, registry)), expected, `${file}: the faces${registry ? ' a registry draws' : ''} are 0.28.0's`);
      assert.deepEqual(outcome(() => presentationFaces(deck, options, registry)), expected, `${file}: presentationFaces is 0.28.0's`);
      faces += expected.value?.length ?? 0;
    }
    const families = outcome(() => [...referenceFamilies(deck, options)]);
    assert.deepEqual(outcome(() => [...analysis.families(deck, options)]), families, `${file}: the families are 0.28.0's, in order`);
    assert.deepEqual(outcome(() => [...presentationFamilies(deck, options)]), families, `${file}: presentationFamilies is 0.28.0's`);
    decks++;
  }
  assert.ok(decks > 100 && faces > 500, `compared ${decks} example decks (${faces} faces)`);
}

// ---- each slide analyzed once; an edit analyzes the slide it changed ----
const tour = examples.find(({ file }) => /full-feature-tour/.test(file)).deck;
const big = { ...structuredClone(tour), slides: Array.from({ length: 40 }, (_, index) => ({ ...structuredClone(tour.slides[index % tour.slides.length]), id: `slide-${index + 1}` })) };
const count = big.slides.length;
{
  const analysis = createFontAnalysis(), { stats } = analysis;
  const first = analysis.faces(big, options, view);
  assert.deepEqual(first, referenceFaces(big, options, view));
  assert.deepEqual({ ...stats }, { decks: 1, slides: count, designs: 0 }, 'the first analysis composes every slide once');
  for (let again = 0; again < 5; again++) assert.deepEqual(analysis.faces(structuredClone(big), { catalogs: [...catalogs] }, { ...view, faces: [...view.faces] }), first);
  assert.deepEqual({ ...stats }, { decks: 1, slides: count, designs: 0 }, 'the same deck again (a copy, with an equal option list) composes nothing and is not checked again');

  const edited = structuredClone(big);
  edited.slides[7].title = 'A title in italics';
  edited.slides[7].text = [{ text: 'Bold ', bold: true }, { text: 'and italic', italic: true }];
  assert.deepEqual(analysis.faces(edited, options, view), referenceFaces(edited, options, view), 'the edited deck is analyzed right');
  assert.deepEqual({ ...stats }, { decks: 2, slides: count + 1, designs: 0 }, 'an edit of one slide composes that slide');

  // A host that changes the deck in place is analyzed right too: keys come from the content, not the object.
  edited.slides[9].title = 'Changed in place';
  analysis.faces(edited, options, view);
  assert.equal(stats.slides, count + 2, 'a slide changed in place is analyzed again');

  // Slides known from different decks, put together: nothing is composed, but the new deck is opened and checked as toSvg would.
  const mixed = structuredClone(big);
  mixed.slides[9] = structuredClone(edited.slides[9]);
  analysis.faces(mixed, options, view);
  assert.deepEqual({ ...stats }, { decks: 4, slides: count + 2, designs: 0 }, 'a new combination of known slides is checked, not composed');

  // What every slide reads besides itself: the deck's design, the options, the registry view.
  analysis.faces({ ...edited, design: { ...edited.design, fontScheme: 'roboto' } }, options, view);
  assert.equal(stats.slides, 2 * count + 2, 'a deck-level change analyzes every slide');
  // A deck with no variables draws the same with `variables: false`, `{}` or none (the editor's views pass all three); one that uses
  // them ({{slide.number}} in this footer) draws its tokens as written with `variables: false`.
  const plain = { name: 'Plain', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ title: 'One', text: 'First.' }, { title: 'Two', items: ['A', 'B'] }] };
  analysis.faces(plain, options, view);
  const known = stats.slides;
  analysis.faces(plain, { ...options, variables: false }, view);
  analysis.faces(plain, { ...options, variables: {} }, view);
  assert.equal(stats.slides, known, '`variables` that cannot change the deck do not key it');
  analysis.faces(edited, { ...options, variables: false }, view);
  assert.equal(stats.slides, known + count, '`variables: false` keys a deck that uses variables');
  analysis.faces(edited, options, { ...view, faces: view.faces.slice(0, -1) });
  assert.equal(stats.slides, known + 2 * count, 'another registry view analyzes every slide');

  // Families: from the slide designs, without composing.
  const families = analysis.families(big, options);
  assert.deepEqual([...families], [...referenceFamilies(big, options)]);
  assert.equal(stats.designs, count);
  analysis.families(edited, options);
  assert.equal(stats.designs, count + 2, 'an edit of two slides resolves two designs');
  assert.equal(stats.slides, known + 2 * count, 'families compose no slide');

  // Errors are toSvg's, and a failed analysis keeps nothing of the failing deck.
  const broken = structuredClone(big);
  broken.slides[3].layout = 42;
  assert.deepEqual(outcome(() => analysis.faces(broken, options, view)), outcome(() => referenceFaces(broken, options, view)));
  assert.deepEqual(outcome(() => analysis.families(broken, options)), outcome(() => [...referenceFamilies(broken, options)]));
  assert.ok(outcome(() => analysis.faces(broken, options, view)).error, 'an invalid deck throws, every time');
}

// ---- scripts: each drawn string scanned once, the families resolved without composing ----
{
  const japanese = { ...structuredClone(big), language: 'ja' };
  japanese.slides[2].title = '四半期レビュー 12%';
  japanese.slides[3].text = 'ハングル 한국어와 漢字、そして العربية';
  const memory = createScriptAnalysis();
  const expected = analyzePresentationScripts(japanese, undefined, options);
  const strings = new Set(drawnStrings(japanese)).size;
  for (let again = 0; again < 4; again++) assert.deepEqual(analyzePresentationScripts(structuredClone(japanese), undefined, options, memory), expected);
  assert.equal(memory.stats.strings, strings, 'every drawn string is scanned once over four analyses');
  assert.equal(memory.fonts.stats.designs, count, 'the families resolve each slide design once');
  assert.equal(memory.fonts.stats.slides, 0, 'script detection composes no slide');
  japanese.slides[3].text = 'もう一つの文';
  assert.deepEqual(analyzePresentationScripts(japanese, undefined, options, memory), analyzePresentationScripts(japanese, undefined, options));
  assert.equal(memory.stats.strings, strings + 1, 'an edited string is the one string scanned');
  assert.equal(memory.fonts.stats.designs, count + 1, 'an edited slide is the one design resolved');
}

// ---- script detection: one precompiled pattern classifies a character as the 48 per-script patterns did ----
{
  const scripts = ['Latn', 'Cyrl', 'Grek', 'Hani', 'Hira', 'Kana', 'Hang', 'Bopo', 'Yiii', 'Arab', 'Hebr', 'Syrc', 'Thaa', 'Nkoo', 'Adlm', 'Rohg', 'Mand', 'Samr',
    'Deva', 'Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Sinh', 'Thai', 'Laoo', 'Tibt', 'Mymr', 'Khmr', 'Mong', 'Bali', 'Java', 'Lana',
    'Tale', 'Talu', 'Cakm', 'Olck', 'Armn', 'Geor', 'Ethi', 'Cher', 'Tfng', 'Vaii', 'Zinh', 'Zyyy'].map(code => [code, new RegExp(String.raw`^\p{Script=${code}}$`, 'u')]);
  const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
  const reference = character => character.codePointAt(0) < 0x80 ? (/[A-Za-z]/.test(character) ? 'Latn' : 'Zyyy') : ignorable.test(character) ? 'Zinh' : (scripts.find(([, pattern]) => pattern.test(character))?.[0] ?? 'Zzzz');
  const differ = [];
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const character = String.fromCodePoint(code);
    if (scriptOfCharacter(character) !== reference(character)) differ.push(code.toString(16));
  }
  assert.deepEqual(differ.slice(0, 10), [], 'every code point has the script the per-script patterns gave it');
  // The Han key of a text is worked out once per text: the itemization is that of the language and the whole text, as before.
  // (Expected values: 0.28.0's itemization of the same texts.)
  const runs = (text, profile) => itemizeScripts(text, profile).map(run => [run.text, run.script]);
  assert.deepEqual(runs('漢字とかな、漢字', { bcp47: 'zh-Hans' }), [['漢字とかな、漢字', 'Jpan']]);
  assert.deepEqual(runs('漢字 한국 漢字', {}), [['漢字', 'Kore'], [' ', 'Latn'], ['한국', 'Kore'], [' ', 'Latn'], ['漢字', 'Kore']]);
  assert.deepEqual(runs('Total 漢字。', { bcp47: 'zh-Hant-TW' }), [['Total ', 'Latn'], ['漢字。', 'Hant']]);
  assert.deepEqual(runs('“漢字”…', { bcp47: 'ja' }), [['“漢字”…', 'Jpan']]);
}

// ---- the browser handle: pending, asked again and again, analyzes each slide once ----
{
  class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
  const set = new Set(); set.ready = Promise.resolve();
  const document = { fonts: set, defaultView: { FontFace: Face } };
  const eager = office.embeddedFonts.map(face => ({ family: face.family, weight: face.weight, italic: face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64')) }));
  const handle = await loadBrowserFonts({ faces: eager, document, fetch: async () => ({ ok: false, status: 404 }), substitutionPolicy: 'visual', renderOptions: options });
  const roboto = { ...structuredClone(big), design: { ...big.design, fontScheme: 'roboto' } };
  for (let call = 0; call < 6; call++) handle.pending(structuredClone(roboto), options);
  const stats = handle.analysisStats;
  assert.equal(stats.slides, count, 'six pending calls compose each slide once');
  assert.ok(stats.designs <= count, 'and resolve each slide design at most once');
  assert.equal(stats.strings, new Set(drawnStrings(roboto)).size, 'and scan each drawn string once');
  roboto.slides[0].title = 'Edited';
  handle.pending(roboto, options);
  assert.equal(handle.analysisStats.slides, count + 1, 'an edit composes the edited slide');
  assert.equal(handle.analysisStats.strings, stats.strings + 1, 'and scans the edited string');
  handle.dispose();
}

console.log('font analysis: 0.28.0 results over every example deck; each slide analyzed once, an edit analyzes its slide, each string scanned once');
