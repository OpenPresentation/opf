// CE-20: face analysis must not repeat the same selection for every fitting trial.
// Exercise the real public analysis, its existing recording-measurement seam and
// observable ReadonlyMap lookups; no timing limit or implementation-only counter.
import assert from 'node:assert/strict';
import {presentationFaces} from '../dist/fonts-browser.js';
import {createFontAnalysis} from '../dist/lazy-fonts.js';
import {deckInternals} from '../dist/svg-internals.js';

class ObservedAliases extends Map {
  reads = new Map();
  has(key) { this.reads.set(key, (this.reads.get(key) ?? 0) + 1); return super.has(key); }
}
const face = (family, weight = 400, italic = false) => ({family, weight, italic});
const families = (result) => [...new Set(result.map(entry => entry.family))].sort();
const deck = (runs = 'Body') => ({name: 'Face selection', design: {fontScheme: {major: 'Requested', minor: 'Requested'}}, slides: [{title: 'Heading', text: runs}]});
const faces = [face('Chosen'), face('Chosen', 700), face('Chosen', 400, true), face('Other'), face('Other', 700), face('Other', 400, true)];

// These schema-valid rich runs repeatedly request an alias while the layout fits
// and paints them. The result still contains all regular/bold/italic faces.
{
  const aliases = new ObservedAliases([['requested', 'Chosen']]);
  const input = deck(Array.from({length: 12}, (_, index) => ({text: `Repeated alias run ${index} `, fontFamily: 'Requested', italic: index % 2 === 1})));
  const before = structuredClone(input);
  const actual = presentationFaces(input, {}, {faces, aliases, fallbackFamily: 'Chosen'});
  assert.deepEqual(actual, [face('Chosen'), face('Chosen', 700), face('Chosen', 400, true)]);
  assert.deepEqual(input, before, 'analysis keeps the authored document');
  const lookups = aliases.reads.get('requested');
  console.log(`CE20 actual public face analysis: ${lookups} Requested alias lookups for regular, bold and italic.`);
  assert.ok(lookups <= 3, `Repeated fitting must select each successful Requested face once, not ${lookups} times`);
}

// A new faces call owns a new view, including when one analysis handle or input
// object is reused. Registry context changes also invalidate per-slide results.
{
  const analysis = createFontAnalysis(), aliases = new Map([['requested', 'Chosen']]);
  const registry = {faces: [...faces], aliases};
  assert.deepEqual(families(analysis.faces(deck(), {}, registry)), ['Chosen']);
  aliases.set('requested', 'Other');
  assert.deepEqual(families(analysis.faces(deck(), {}, registry)), ['Other'], 'changed aliases are current');
  registry.faces.push(face('Requested'), face('Requested', 700));
  assert.deepEqual(families(analysis.faces(deck(), {}, registry)), ['Requested'], 'newly held faces win over aliases');
  const aptos = {name: 'Policy', slides: [{title: 'Heading', text: 'Body'}]};
  const policy = {faces: [face('Intos'), face('Intos Display', 700), ...faces], policy: 'none'};
  assert.deepEqual(families(analysis.faces(aptos, {}, policy)), ['Aptos', 'Aptos Display']);
  policy.policy = 'metric';
  assert.deepEqual(families(analysis.faces(aptos, {}, policy)), ['Intos', 'Intos Display'], 'changed policy is current');
  policy.policy = 'none'; policy.fallbackFamily = 'Chosen';
  assert.deepEqual(families(analysis.faces(aptos, {}, policy)), ['Chosen']);
  policy.fallbackFamily = 'Other';
  assert.deepEqual(families(analysis.faces(aptos, {}, policy)), ['Other'], 'changed fallback family is current');
}

// Do not trim raw family keys: pickFace distinguishes a trailing space before
// applying fallback. Italics, weights and symbol replacements keep their rules.
{
  const input = {name: 'Raw family', design: {fontScheme: {major: 'Chosen', minor: 'Chosen'}}, slides: [{text: [{text: 'Exact', fontFamily: 'Chosen'}, {text: 'Fallback', fontFamily: 'Chosen '}]}]};
  assert.deepEqual(families(presentationFaces(input, {}, {faces, fallbackFamily: 'Other'})), ['Chosen', 'Other']);
  const symbols = {name: 'Symbols', design: {fontScheme: {major: 'Wingdings', minor: 'Wingdings'}}, slides: [{title: 'A', text: [{text: 'B', italic: true}, {text: 'C', bold: true}]}]};
  assert.deepEqual(presentationFaces(symbols, {}, {faces: [face('Noto Sans Symbols 2')], policy: 'visual'}), [face('Noto Sans Symbols 2')]);
}

// Tap the existing renderer-to-analysis measurement handoff without replacing
// its composition or drawing. This observes the actual analysis resolver while
// keeping registryView private and adding no production test hook.
function inspectResolver(registry, inspect) {
  const original = deckInternals.openDeck;
  let inspected = false;
  deckInternals.openDeck = (...args) => {
    const opened = original(...args);
    return {...opened, bind(index, measurement) {
      if (!inspected) { inspected = true; inspect(measurement.resolveStyle); }
      return opened.bind(index, measurement);
    }};
  };
  try { presentationFaces(deck(), {}, registry); }
  finally { deckInternals.openDeck = original; }
  assert.ok(inspected, 'the public analysis handed its real measurement to the renderer');
}

{
  const aliases = new ObservedAliases([['requested', 'Chosen']]);
  inspectResolver({faces, aliases}, resolve => {
    const input = {fontFamily: 'Requested', fontWeight: 400, italic: false, fontSize: 27, color: '#123456', path: 'slides.0.text.0', lang: 'ja', direction: 'rtl', tracking: 0.2, extension: {keep: true}};
    const original = structuredClone(input), first = resolve(input);
    assert.deepEqual(first, {...input, fontFamily: 'Chosen', fontWeight: 400, italic: false});
    assert.notEqual(first, input);
    first.fontFamily = 'Corrupted'; first.fontWeight = 999; first.italic = true; first.color = '#000000';
    const next = {...input, path: 'slides.0.text.1', fontSize: 31, color: '#abcdef', lang: 'ar'};
    const second = resolve(next);
    assert.deepEqual(second, {...next, fontFamily: 'Chosen', fontWeight: 400, italic: false}, 'cache returns a fresh complete current style');
    assert.deepEqual(input, original, 'returned-style mutation does not change the caller');
    assert.equal(aliases.reads.get('requested'), 1, 'same raw successful selection is reused');
    input.fontFamily = 'Other'; input.fontWeight = 700; input.italic = true;
    assert.deepEqual(resolve(input), {...input, fontFamily: 'Other', fontWeight: 400, italic: true}, 'changed style selection fields are current');
    const missingBefore = aliases.reads.get('missing') ?? 0;
    for (const path of ['slides.0.text.2', 'slides.0.text.3']) {
      const unresolved = {fontFamily: 'Missing', path, fontSize: 19};
      assert.deepEqual(resolve(unresolved), unresolved, 'unavailable face keeps the current style/path for renderer diagnostics');
    }
    assert.equal(aliases.reads.get('missing') - missingBefore, 2, 'failed selections are never cached');
  });
}

// Bound successful choices within one view. Revisiting an evicted request still
// resolves it correctly; no successful-result cache survives the faces call.
{
  const aliases = new ObservedAliases(Array.from({length: 514}, (_, index) => [`alias${index}`, 'Chosen']));
  inspectResolver({faces, aliases}, resolve => {
    for (let index = 0; index < 514; index++) assert.equal(resolve({fontFamily: `Alias${index}`, path: `slides.0.text.${index}`}).fontFamily, 'Chosen');
    assert.equal(resolve({fontFamily: 'Alias0', path: 'slides.0.text.again'}).fontFamily, 'Chosen');
    assert.equal(aliases.reads.get('alias0'), 2, 'the old successful choice was evicted at the bound');
  });
}
console.log('CE20 face selection: public work, fresh view, complete styles, errors, weights, symbols and bounded choices pass.');
