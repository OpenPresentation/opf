// RR-105: a native reference helper's data labels follow CT_DLbls (the c:dLbl entries, then either c:delete or the show flags, never
// both), every c:ser and c:dLbl child is in schema order, and a helper's label is written in its slide's language (German, Arabic with
// its complex-script face, and a slide whose language differs from the deck's).
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';

const chart = (label, labelPosition) => ({type: 'line', data: {columns: ['Q', 'V'], rows: [['Q1', 10], ['Q2', 20], ['Q3', 15]]},
  referenceLines: [{value: 12, label, ...(labelPosition ? {labelPosition} : {})}, {value: 18}]});
const SER = ['idx', 'order', 'tx', 'spPr', 'marker', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'smooth', 'extLst'];
const DLBL = ['idx', 'delete', 'layout', 'tx', 'numFmt', 'spPr', 'txPr', 'dLblPos', 'showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize', 'separator', 'extLst'];
const DLBLS_GROUP = ['numFmt', 'spPr', 'txPr', 'dLblPos', 'showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize', 'separator', 'showLeaderLines', 'leaderLines'];
// The top-level children of an element's body (balanced c:/a: elements; whitespace between them skipped).
function children(body) {
  const out = [];
  let at = 0;
  while (at < body.length) {
    const open = /<(c|a):(\w+)\b[^>]*?(\/?)>/y;
    while (/\s/.test(body[at] ?? '')) at++;
    if (at >= body.length) break;
    open.lastIndex = at;
    const match = open.exec(body);
    assert.ok(match, `an element at ${body.slice(at, at + 40)}`);
    if (match[3]) { out.push({name: match[2], xml: match[0], body: ''}); at = open.lastIndex; continue; }
    const tag = `${match[1]}:${match[2]}`;
    let depth = 1, scan = open.lastIndex;
    const any = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
    any.lastIndex = scan;
    let end;
    while (depth) { end = any.exec(body); assert.ok(end, `closing ${tag}`); if (end[2]) continue; depth += end[1] ? -1 : 1; }
    out.push({name: match[2], xml: body.slice(at, any.lastIndex), body: body.slice(open.lastIndex, end.index)});
    at = any.lastIndex;
  }
  return out;
}
const inOrder = (names, sequence) => names.every((name, i) => !i || sequence.indexOf(names[i - 1]) <= sequence.indexOf(name)) && names.every(name => sequence.includes(name));

async function helpers(deck) {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck});
  const bytes = await toPptx(deck, {fonts});
  fonts.dispose?.();
  const zip = unzipSync(new Uint8Array(bytes));
  const series = Object.keys(zip).filter(path => /^ppt\/charts\/chart\d+\.xml$/.test(path)).sort().flatMap(path =>
    [...strFromU8(zip[path]).matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(([, body]) => ({path, body})).filter(({body}) => body.includes('OPF reference ')));
  return {bytes, series};
}

for (const [language, label, slideLanguage, cs] of [['de-DE', 'Ziel & <Plan> "1"'], ['ar-SA', 'الهدف', undefined, true], ['en-US', 'Objectif', 'fr-FR']]) {
  const deck = {language, slides: [{title: 'Umsatz', ...(slideLanguage ? {language: slideLanguage} : {}), chart: chart(label)}]};
  const {bytes, series} = await helpers(deck);
  assert.equal(series.length, 2, `${language}: two native helpers`);
  for (const {body} of series) {
    const kids = children(body), names = kids.map(kid => kid.name);
    assert.ok(inOrder(names, SER), `${language}: c:ser children in schema order (${names.join(', ')})`);
    const dLbls = children(kids.find(kid => kid.name === 'dLbls').body), entries = dLbls.filter(kid => kid.name === 'dLbl'), rest = dLbls.slice(entries.length).map(kid => kid.name);
    assert.ok(dLbls.slice(0, entries.length).every(kid => kid.name === 'dLbl'), `${language}: the c:dLbl entries come first`);
    if (entries.length) {
      assert.equal(entries.length, 1);
      assert.equal(rest.includes('delete'), false, `${language}: a labeled helper has the show flags and no c:delete`);
      assert.ok(inOrder(rest, DLBLS_GROUP), `${language}: the show flags in order (${rest.join(', ')})`);
      // LH-110: every show flag is explicit; CT_Boolean defaults to true, and Keynote refuses an absent showPercent/showBubbleSize.
      assert.deepEqual(rest, ['showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize', 'showLeaderLines']);
      const entry = children(entries[0].body).map(kid => kid.name);
      assert.deepEqual(entry.filter(name => name.startsWith('show')), ['showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize'], language + ': the c:dLbl states every show flag');
      assert.ok(inOrder(entry, DLBL), `${language}: c:dLbl children in order (${entry.join(', ')})`);
      assert.equal(entry.includes('delete'), false);
      const runs = [...entries[0].body.matchAll(/<a:rPr\b[^>]*\blang="([^"]+)"[^>]*>([\s\S]*?)<\/a:rPr>/g)];
      assert.ok(runs.length > 0, `${language}: the label has runs`);
      for (const [, lang, properties] of runs) {
        assert.equal(lang, slideLanguage ?? language, `${language}: the label is in the slide's language`);
        if (cs) assert.match(properties, /<a:cs typeface="(?!Aptos)[^"]+"\/>/, `${language}: the label's complex-script face is the deck's Arabic face`);
      }
    } else assert.deepEqual(rest, ['delete'], `${language}: an unlabeled helper only deletes its labels`);
  }
  // The labels import back.
  const back = await fromPptx(bytes);
  assert.deepEqual(back.slides[0].chart.referenceLines.map(line => [line.value, line.label]), [[12, label], [18, undefined]], `${language}: the reference lines import`);
}
console.log('Chart reference label XML: CT_DLbls choice, schema order, and the slide language of the label (German, Arabic, a French slide).');
