import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {renderSvg} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {composeSlide, listNumbers} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {autoNumScheme, canonicalNumbering, deriveListNumbering, displayedNumbers, schemeNumbering} from '../dist/numbered-list.js';

// RR-33: numbered lists. OPF `numbering` exports as native a:buAutoNum at core's marker geometry, the preview draws
// the same numbers at the same positions, and import maps the auto-numbers back.
const decoder = new TextDecoder(), encoder = new TextEncoder();
const EMU = 9525;
const fonts = await loadFonts({pack: 'office', fallbackFamily: 'Roboto', strictGlyphs: false});

// ---- an implementation of the native schemes that shares nothing with core's formatter -------------------------------
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function nativeFormat(type, value) {
  const [, kind, tail] = /^(arabic|romanUc|romanLc|alphaUc|alphaLc)(Period|ParenR|ParenBoth)$/.exec(type);
  let body;
  if (kind === 'arabic') body = String(value);
  else if (kind.startsWith('roman')) {
    let rest = value;
    body = ROMAN.map(([amount, glyphs]) => { let out = ''; while (rest >= amount) { out += glyphs; rest -= amount; } return out; }).join('');
    if (kind === 'romanLc') body = body.toLowerCase();
  } else {
    body = String.fromCharCode(65 + (value - 1) % 26).repeat(Math.ceil(value / 26));
    if (kind === 'alphaLc') body = body.toLowerCase();
  }
  return tail === 'Period' ? `${body}.` : tail === 'ParenR' ? `${body})` : `(${body})`;
}

// ---- reading the native list shapes ----------------------------------------------------------------------------------
const slideXml = (entries, index) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
function nativeListLines(xml) {
  return [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => /name="OPF list /.test(shape)).map(shape => {
    const pPr = shape.match(/<a:pPr\b([^>]*)>([\s\S]*?)<\/a:pPr>/);
    const attr = (name) => pPr[1].match(new RegExp(`\\b${name}="(-?\\d+)"`))?.[1];
    const auto = pPr[2].match(/<a:buAutoNum type="([A-Za-z]+)"(?: startAt="(\d+)")?\/>/);
    return {
      name: shape.match(/name="([^"]*)"/)[1],
      text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
      x: +shape.match(/<a:off x="(-?\d+)"/)[1] / EMU, y: +shape.match(/<a:off x="-?\d+" y="(-?\d+)"/)[1] / EMU,
      marL: +(attr('marL') ?? 0) / EMU, indent: +(attr('indent') ?? 0) / EMU, level: +(attr('lvl') ?? 0),
      auto: auto ? {type: auto[1], startAt: auto[2] === undefined ? 1 : +auto[2]} : undefined,
      char: pPr[2].match(/<a:buChar char="([^"]*)"/)?.[1],
      size: +(pPr[2].match(/<a:buSzPts val="(\d+)"/)?.[1] ?? 0) / 100,
      order: pPr[2].replace(/<a:(lnSpc|spcBef|spcAft)>[\s\S]*?<\/a:\1>/g, '').match(/<a:(buClr|buSzPts|buFont|buAutoNum|buChar)\b/g)?.map(tag => tag.slice(3)),
    };
  });
}
// The marker texts of a slide's preview, in drawing order, with the first line of text that follows each.
function previewMarkers(svg) {
  const markers = [];
  for (const match of svg.matchAll(/<text\b([^>]*\baria-hidden="true"[^>]*)>([^<]*)<\/text>/g)) {
    const attrs = match[1], get = name => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const after = svg.slice(match.index + match[0].length).match(/<text\b[^>]*\bx="(-?[\d.]+)"/);
    markers.push({text: match[2], x: +get('x'), y: +get('y'), size: +get('font-size'), weight: get('font-weight'), textX: +after[1]});
  }
  return markers;
}

// ---- the deck: every style, suffix, start, nesting, wide marker, restart and a neighbour block ---------------------------
const lines = ['Define the goal', 'Pick the owner', 'Ship it'];
const deck = {design: {theme: 'classic', fontScheme: 'roboto'}, slides: [
  {title: 'Styles', blocks: [{items: lines, numbering: 'arabic'}, {items: lines, numbering: 'roman-upper'}, {items: lines, numbering: 'alpha-lower'}]},
  {title: 'Suffix and start', items: ['Review', 'Collect', 'Resolve', 'Publish'], numbering: {style: 'alpha-upper', start: 3, suffix: 'paren'}},
  {title: 'Per level', items: ['Freeze', {text: 'Migrate', level: 1}, {text: 'Verify', level: 1}, {text: 'Sample', level: 2}, 'Switch', {text: 'Watch', level: 1}, 'Retire'],
    numbering: ['arabic', {style: 'alpha-lower', suffix: 'paren'}, {style: 'roman-lower', suffix: 'paren-both'}]},
  {title: 'Wide markers', items: ['Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'], numbering: {style: 'roman-lower', start: 8, suffix: 'paren-both'}},
  {title: 'Bullets and restart', left: {bullets: ['First', 'Second', {text: 'Resumed', start: 6}, 'Seventh'], numbering: 'arabic'}, right: {items: ['Plain', 'Plain again']}},
  {title: 'Beside a block', left: {items: [{text: 'Collect', description: 'Interviews and the backlog.'}, {text: 'Draft', description: 'One page.'}, 'Decide'], numbering: 'arabic'}, right: {metric: {value: '3', label: 'steps'}}},
  {title: 'Bold lead', items: [[{text: 'Bold', bold: true}, ' lead'], 'Plain lead'], numbering: 'arabic'},
]};

for (const [label, options] of [['estimated', {}], ['measured', {fonts}]]) {
  const diagnostics = [];
  const entries = unzipSync(await toPptx(deck, {seed: 1, ...options, onDiagnostic: d => diagnostics.push(d)}));
  const previews = renderSvg(deck, options);
  assert.deepEqual(diagnostics.filter(d => /numbering/.test(d.code)), [], `${label}: no numbering diagnostics`);
  let numbered = 0, bullets = 0;
  for (const [index, slide] of deck.slides.entries()) {
    const native = nativeListLines(slideXml(entries, index));
    const markers = previewMarkers(previews[index]);
    const nativeMarkers = native.filter(line => line.auto || line.char);
    assert.equal(nativeMarkers.length, markers.length, `${label} slide ${index}: one preview marker per native marker line`);
    const composed = composeSlide(slide, {presentation: deck, slideIndex: index, textMeasurement: options.textMeasurement}).items.filter(item => item.text?.listEntries).flatMap(item => item.text.listEntries);
    for (const [number, line] of nativeMarkers.entries()) {
      const marker = markers[number], where = `${label} slide ${index} marker ${number}`;
      if (line.auto) {
        numbered++;
        // The same number: the native scheme counted from startAt, the preview's text, and core's composed marker.
        assert.equal(nativeFormat(line.auto.type, line.auto.startAt), marker.text, `${where}: number text`);
        assert.equal(composed[number].marker.text, marker.text, `${where}: core marker text`);
        assert.equal(composed[number].marker.number.value, line.auto.startAt, `${where}: startAt is core's counted number`);
        assert.equal(line.auto.type, autoNumScheme(composed[number].marker.number.style, composed[number].marker.number.suffix), `${where}: scheme`);
        // The same position: the number starts at marL + indent and the text at marL, both from the shape's left edge.
        assert.ok(Math.abs(line.x + line.marL + line.indent - marker.x) < .05, `${where}: number x (native ${line.x + line.marL + line.indent}, preview ${marker.x})`);
        assert.ok(Math.abs(line.x + line.marL - marker.textX) < .05, `${where}: text x (native ${line.x + line.marL}, preview ${marker.textX})`);
        // The same size, and the weight core measured the marker at.
        assert.ok(Math.abs(line.size - marker.size * .75) < .01, `${where}: marker size`);
        assert.equal(marker.weight === undefined ? 400 : +marker.weight, composed[number].marker.style.fontWeight, `${where}: weight`);
        assert.deepEqual(line.order, ['buClr', 'buSzPts', 'buFont', 'buAutoNum'], `${where}: bullet properties in schema order`);
        assert.equal(line.auto.startAt === 1, !/startAt=/.test(slideXml(entries, index).match(new RegExp(`name="${line.name}"[\\s\\S]*?</p:sp>`))[0]), `${where}: startAt only when not 1`);
      } else {
        bullets++;
        assert.equal(marker.text, '•', `${where}: bullet glyph`);
        assert.ok(line.char, `${where}: native bullet`);
        assert.ok(Math.abs(line.x + line.marL + line.indent - marker.x) < .05, `${where}: bullet x`);
      }
    }
  }
  assert.equal(numbered, 3 * 3 + 4 + 7 + 8 + 4 + 3 + 2, `${label}: every numbered entry was compared`);
  assert.equal(bullets, 2, `${label}: bullets are untouched`);
}

// ---- round trip: the numbers survive an export and import ------------------------------------------------------------
{
  const imported = await fromPptx(await toPptx(deck, {seed: 1}), {});
  // Every list payload of a slide in authoring order, wherever the importer put it (root, blocks or a region).
  const listsIn = value => value === null || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(listsIn) : [...(Array.isArray(value.items) || Array.isArray(value.bullets) ? [value] : []), ...Object.values(value).flatMap(listsIn)];
  const textOf = item => typeof item === 'string' ? item : Array.isArray(item) ? item.map(run => run.text ?? run).join('') : textOf(item.text);
  const expected = deck.slides.flatMap(slide => [slide.blocks, [slide.left, slide.right, slide].filter(Boolean)].flat().filter(Boolean).filter(block => (block.items || block.bullets) && block.numbering));
  const found = imported.slides.flatMap(slide => listsIn(Object.fromEntries(Object.entries(slide).filter(([key]) => !['title', 'notes'].includes(key))))).filter(block => block.numbering !== undefined);
  assert.equal(found.length, expected.length, 'every numbered list imports with numbering');
  for (const [index, block] of expected.entries()) {
    const original = block.items ?? block.bullets;
    const back = found[index];
    const backItems = back.items ?? back.bullets;
    assert.deepEqual(listNumbers(backItems, back.numbering).map(n => n.text), listNumbers(original, block.numbering).map(n => n.text), `list ${index}: same numbers after the round trip`);
    assert.deepEqual(backItems.map(textOf), original.map(textOf), `list ${index}: same text`);
  }
  // Canonical authored forms come back unchanged.
  assert.equal(found[0].numbering, 'arabic');
  assert.equal(found[1].numbering, 'roman-upper');
  assert.equal(found[2].numbering, 'alpha-lower');
  assert.deepEqual(found[3].numbering, {style: 'alpha-upper', start: 3, suffix: 'paren'});
  assert.deepEqual(found[4].numbering, ['arabic', {style: 'alpha-lower', suffix: 'paren'}, {style: 'roman-lower', suffix: 'paren-both'}]);
  assert.deepEqual(found[5].numbering, {style: 'roman-lower', start: 8, suffix: 'paren-both'});
  // The entry start that restarts the count returns as an entry start.
  assert.deepEqual((found[6].items ?? found[6].bullets).map(item => item.start), [undefined, undefined, 6, undefined]);
  assert.equal(canonicalNumbering(found[3].numbering), canonicalNumbering(deck.slides[1].numbering));
}

// ---- decks that do not use numbering export exactly as before: bullets, no auto-numbers -------------------------------
{
  const plain = {design: {fontScheme: 'roboto'}, slides: [{title: 'Plain', items: ['One', {text: 'Two', level: 1}, 'Three']}]};
  const xml = slideXml(unzipSync(await toPptx(plain, {seed: 1})), 0);
  assert.ok(!/buAutoNum/.test(xml));
  assert.deepEqual([...xml.matchAll(/<a:buChar char="(&#x[0-9a-f]+;)"\/>/g)].map(match => match[1]), ['&#x2022;', '&#x25e6;', '&#x2022;']);
  const back = await fromPptx(await toPptx(plain, {seed: 1}), {});
  assert.ok(!JSON.stringify(back).includes('numbering'));
}

// ---- the schemes ---------------------------------------------------------------------------------------------------
for (const style of ['arabic', 'roman-upper', 'roman-lower', 'alpha-upper', 'alpha-lower']) for (const suffix of ['period', 'paren', 'paren-both']) {
  const type = autoNumScheme(style, suffix);
  assert.deepEqual(schemeNumbering(type), {style, suffix});
  for (const value of [1, 4, 9, 26, 27, 28, 52, 53, 3999]) {
    if (style.startsWith('roman') || value <= 3999) assert.equal(nativeFormat(type, value), listNumbers([{text: 'x', start: value}], {style, suffix})[0].text, `${type} ${value}`);
  }
}
assert.equal(schemeNumbering('arabicPlain'), undefined);
assert.equal(schemeNumbering('hebrew2Minus'), undefined);

// ---- importing a native list (no OPF tags): PowerPoint's own counting, unknown schemes, mixed lists -------------------
const nativeDeck = async (paragraphsXml) => {
  const base = unzipSync(await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Native', items: ['placeholder']}]}, {seed: 1, provenance: false}));
  const xml = slideXml(base, 0).replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF list [\s\S]*?<\/p:sp>/g, '');
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="90" name="Content 2"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="1828800"/><a:ext cx="7315200" cy="3200400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</p:txBody></p:sp>`;
  base['ppt/slides/slide1.xml'] = encoder.encode(xml.replace('</p:spTree>', `${shape}</p:spTree>`));
  const diagnostics = [];
  const result = await fromPptx(zipSync(base), {onDiagnostic: d => diagnostics.push(d)});
  const block = (result.slides[0].blocks ?? [result.slides[0]]).find(b => b.items);
  return {block, diagnostics, text: item => typeof item === 'string' ? item : Array.isArray(item) ? item.map(r => r.text ?? r).join('') : Array.isArray(item.text) ? item.text.map(r => r.text ?? r).join('') : item.text};
};
const para = (text, {level = 0, auto, bullet = 'char'} = {}) => `<a:p><a:pPr marL="342900" indent="-342900"${level ? ` lvl="${level}"` : ''}>${auto ? `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${auto.type}"${auto.startAt ? ` startAt="${auto.startAt}"` : ''}/>` : bullet === 'char' ? '<a:buChar char="&#8226;"/>' : '<a:buNone/>'}</a:pPr><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p>`;
{
  // One shape, consecutive paragraphs: one sequence counting from startAt; nested paragraphs form their own sequences.
  const {block, diagnostics, text} = await nativeDeck([
    para('a', {auto: {type: 'arabicPeriod', startAt: 3}}), para('b', {auto: {type: 'arabicPeriod', startAt: 3}}),
    para('x', {level: 1, auto: {type: 'alphaLcParenR'}}), para('y', {level: 1, auto: {type: 'alphaLcParenR'}}),
    para('c', {auto: {type: 'arabicPeriod', startAt: 3}}),
    para('z', {level: 1, auto: {type: 'alphaLcParenR'}}),
  ].join(''));
  assert.deepEqual(block.items.map(text), ['a', 'b', 'x', 'y', 'c', 'z']);
  assert.deepEqual(block.numbering, [{start: 3}, {style: 'alpha-lower', suffix: 'paren'}]);
  assert.deepEqual(listNumbers(block.items, block.numbering).map(n => n.text), ['3.', '4.', 'a)', 'b)', '5.', 'a)'], 'numbers as PowerPoint draws them (nested entries do not interrupt, a new parent restarts the child)');
  assert.deepEqual(diagnostics.filter(d => /numbering/.test(d.code)), []);
  assert.ok(block.items.every(item => item.start === undefined), 'no entry needs an explicit start');
}
{
  // A different startAt begins a new sequence: the restart is an entry start.
  const {block, text} = await nativeDeck([para('a', {auto: {type: 'romanUcPeriod'}}), para('b', {auto: {type: 'romanUcPeriod'}}), para('c', {auto: {type: 'romanUcPeriod', startAt: 10}}), para('d', {auto: {type: 'romanUcPeriod', startAt: 10}})].join(''));
  assert.equal(block.numbering, 'roman-upper');
  assert.deepEqual(listNumbers(block.items, block.numbering).map(n => n.text), ['I.', 'II.', 'X.', 'XI.']);
  assert.equal(block.items[2].start, 10);
  assert.deepEqual(block.items.map(text), ['a', 'b', 'c', 'd']);
}
{
  // Unknown schemes and mixed lists say so instead of guessing.
  const unknown = await nativeDeck([para('a', {auto: {type: 'arabicPlain'}}), para('b', {auto: {type: 'arabicPlain'}})].join(''));
  assert.equal(unknown.block.numbering, 'arabic');
  assert.deepEqual(unknown.diagnostics.filter(d => /numbering/.test(d.code)).map(d => d.code), ['numbering-scheme-adapted']);
  const mixed = await nativeDeck([para('a', {auto: {type: 'arabicPeriod'}}), para('b'), para('c', {auto: {type: 'arabicPeriod'}})].join(''));
  assert.equal(mixed.block.numbering, undefined);
  assert.deepEqual(mixed.diagnostics.filter(d => /numbering/.test(d.code)).map(d => d.code), ['numbering-mixed']);
  const styles = await nativeDeck([para('a', {auto: {type: 'arabicPeriod'}}), para('b', {auto: {type: 'romanLcPeriod'}})].join(''));
  assert.deepEqual(styles.diagnostics.filter(d => /numbering/.test(d.code)).map(d => d.code), ['numbering-style-adapted']);
}

// ---- derivation unit checks ----------------------------------------------------------------------------------------
{
  const numbered = (level, type, value) => ({level, number: {type, value}});
  const derived = deriveListNumbering([numbered(0, 'arabicPeriod', 1), numbered(1, 'alphaLcParenR', 1), numbered(1, 'alphaLcParenR', 2), numbered(0, 'arabicPeriod', 2), numbered(1, 'alphaLcParenR', 1)]);
  assert.deepEqual(derived.numbering, ['arabic', {style: 'alpha-lower', suffix: 'paren'}]);
  assert.equal(derived.starts.size, 0);
  assert.deepEqual(displayedNumbers([{level: 0, autoNum: {type: 'arabicPeriod'}}, {level: 0, autoNum: {type: 'arabicPeriod'}}, {level: 0}, {level: 0, autoNum: {type: 'arabicPeriod'}}]), [1, 2, undefined, 1], 'an unnumbered paragraph ends the sequence');
  assert.equal(deriveListNumbering([{level: 0}]).numbering, undefined);
}

console.log('Numbered lists passed: native a:buAutoNum for every style and suffix, preview and native numbers, marker positions and sizes agree (estimated and measured), start only when not 1, import maps auto-numbers back, native counting, unknown schemes, mixed lists, plain lists unchanged.');
