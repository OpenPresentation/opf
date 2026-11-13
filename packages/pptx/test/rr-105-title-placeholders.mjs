// RR-105 (opf#1291): in the default export every title is the slide's Title placeholder. A one-line title is its measured line; a
// wrapped title whose lines PowerPoint's own wrap keeps is one native wrapped box; any other wrapped title is one box of core's lines
// joined by line breaks (a:br, no wrap), which import reads back as soft wraps. Only a title that box cannot place keeps per-line boxes.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {slideTitle} from '../scripts/title-placeholders.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const base = {seed: 1291, timestamp: '2026-11-12T00:00:00Z', zipDate: '2026-11-12T00:00:00Z', fonts};
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
async function exported(deck, extra = {}) {
  const diagnostics = [];
  await fonts.ensure(deck);
  const bytes = new Uint8Array(await toPptx(deck, {...base, ...extra, onDiagnostic: value => diagnostics.push(value)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  const slide = index => strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
  const titles = index => shapes(slide(index)).filter(shape => shape.includes(`name="OPF heading slides.${index}.title line `));
  return {bytes, entries, diagnostics, slide, titles};
}
const imported = async bytes => {
  const diagnostics = [], value = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {value, diagnostics};
};
const text = shape => [...shape.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\b/g)].map(match => match[1] ?? '\n').join('');
const long = 'Quarterly results show steady growth in every region and a clear plan for the year ahead';

// 1. A plain wrapped title: one native wrapped box, bound, in the default export (it was one box per line before).
{
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{title: long, items: ['One', 'Two']}]});
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0, 'one title shape');
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'soft-wrap');
  assert.match(title, /<a:bodyPr[^>]*wrap="square"[^>]*><a:noAutofit\/><\/a:bodyPr>/);
  assert.deepEqual(out.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  assert.equal((await imported(out.bytes)).value.slides[0].title, long);
}

// 2. Fixed breaks: a face measured with a visual substitute cannot verify a native wrap, so core's lines are one box with a:br.
const bookman = {design: {fontScheme: 'bookman'}, slides: [{title: 'Onboarding experience redesign for every new customer in the first ninety days', items: ['One']}]};
{
  const out = await exported(bookman);
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0, 'one title shape');
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'fixed-breaks');
  assert.match(title, /<a:bodyPr[^>]*wrap="none"[^>]*><a:noAutofit\/><\/a:bodyPr>/);
  // Single spacing scaled to core's pitch (1.22 sizes over PowerPoint's single line of 1.2 sizes); exact spacing drew the first line higher.
  assert.match(title, /<a:lnSpc><a:spcPct val="10166[67]"\/><\/a:lnSpc>/, 'the measured pitch as scaled single spacing');
  assert.ok(!/<a:spcPts\b/.test(title), 'no exact spacing');
  assert.equal((title.match(/<a:p>/g) ?? []).length, 1, 'one paragraph');
  assert.ok((title.match(/<a:br\/>/g) ?? []).length >= 1, 'core lines joined by line breaks');
  assert.equal(text(title).replaceAll('\n', ''), bookman.slides[0].title);
  assert.deepEqual(out.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  const back = await imported(out.bytes);
  assert.equal(back.value.slides[0].title, bookman.slides[0].title, 'line breaks import as soft wraps');
  assert.deepEqual(back.diagnostics.filter(item => /heading/.test(item.code)), []);
  // A copy PowerPoint saved: the line breaks carry run properties and the tags survive; it imports the same.
  const xml = out.slide(0).replaceAll('<a:br/>', '<a:br><a:rPr lang="en-US" dirty="0"/></a:br>');
  const saved = await imported(zipSync({...out.entries, 'ppt/slides/slide1.xml': strToU8(xml)}));
  assert.equal(saved.value.slides[0].title, bookman.slides[0].title);
  // An edit in PowerPoint keeps its words; the line breaks stay soft wraps.
  const edited = xml.replace('Onboarding', 'Better onboarding');
  assert.equal((await imported(zipSync({...out.entries, 'ppt/slides/slide1.xml': strToU8(edited)}))).value.slides[0].title, `Better ${bookman.slides[0].title.replace('Onboarding', 'onboarding')}`);
}

// 3. An authored hard break is a new paragraph and imports as "\n"; the wrap inside a line stays a soft wrap.
{
  const title = 'First line\nSecond line that is long enough to wrap onto yet another line of this wide title box on the slide';
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{title, items: ['One']}]});
  const [shape, ...rest] = out.titles(0);
  assert.equal(rest.length, 0);
  assert.match(shape, /<p:ph type="title"\/>/);
  assert.equal((shape.match(/<a:p>/g) ?? []).length, 2, 'the hard break is a paragraph');
  assert.equal((await imported(out.bytes)).value.slides[0].title, title);
}

// 4. Rich runs (slant, color, link), wrapped and on one line: bound, runs kept, the same TextRun[] back.
{
  // Titles are bold by default, so a bold run would read back as the title's own look: the runs differ in slant, color and link.
  const rich = ['Revenue grew ', {text: 'twenty-four percent', italic: true, color: '#C0392B'}, ' across every region we serve, read the ', {text: 'full report', link: 'https://example.com/report'}];
  const oneLine = ['Short ', {text: 'slanted', italic: true}];
  for (const scheme of ['roboto', 'bookman']) {
    const out = await exported({design: {fontScheme: scheme}, slides: [{title: rich, items: ['One']}, {title: oneLine, items: ['One']}]});
    for (const index of [0, 1]) {
      const [title, ...rest] = out.titles(index);
      assert.equal(rest.length, 0, `${scheme} slide ${index + 1}: one title shape`);
      assert.match(title, /<p:ph type="title"\/>/, `${scheme} slide ${index + 1}: bound`);
    }
    assert.match(out.titles(0)[0], /<a:hlinkClick r:id="rId\d+"/);
    const back = (await imported(out.bytes)).value.slides;
    assert.deepEqual(back[0].title, rich, `${scheme}: rich title round trip`);
    assert.deepEqual(back[1].title, oneLine, `${scheme}: one-line rich title round trip`);
  }
}

// 5. Right-to-left and CJK titles: bound, the same text back. PowerPoint broke right-to-left soft wraps a word later (2026-11-12), so a
// right-to-left title (and any shaped script) keeps core's lines as fixed breaks; a Japanese title keeps PowerPoint's own wrap.
{
  const arabic = 'تقرير الخدمات الرقمية الحكومية للربع الثالث مع خطة التحسين الكاملة لكل الوزارات والهيئات المحلية في جميع المحافظات خلال السنوات الثلاث القادمة';
  const japanese = '第三四半期のデジタル行政サービスに関する報告書とすべての省庁および地方機関のための完全な改善計画';
  const out = await exported({language: {bcp47: 'ar', direction: 'rtl', script: 'Arab'}, slides: [{title: arabic, items: ['واحد']}]});
  const [title] = out.titles(0);
  assert.match(title, /<p:ph type="title"\/>/);
  assert.match(title, /<a:pPr\b[^>]*\brtl="1"/);
  assert.equal(out.titles(0).length, 1);
  assert.equal(slideTitle(out.slide(0)).tier, 'fixed-breaks', 'a right-to-left title keeps its measured lines');
  const hindi = await exported({language: {bcp47: 'hi', script: 'Deva'}, slides: [{title: 'डिजिटल सरकारी सेवाओं की तीसरी तिमाही की रिपोर्ट और सभी मंत्रालयों के लिए पूरी सुधार योजना', items: ['एक']}]});
  assert.equal(slideTitle(hindi.slide(0)).tier, 'fixed-breaks', 'a shaped script keeps its measured lines');
  assert.equal((await imported(out.bytes)).value.slides[0].title, arabic);
  const cjk = await exported({language: {bcp47: 'ja', script: 'Jpan'}, slides: [{title: japanese, items: ['一']}]});
  assert.equal(cjk.titles(0).length, 1);
  assert.match(cjk.titles(0)[0], /<p:ph type="title"\/>/);
  assert.equal(slideTitle(cjk.slide(0)).tier, 'soft-wrap', 'a Japanese title keeps native wrap');
  assert.equal((await imported(cjk.bytes)).value.slides[0].title, japanese);
}

// 6. A cover title with its accent rule is the Center Title; a slide without a title stays without one.
{
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{layout: 'cover', title: long, subtitle: 'Subtitle'}, {items: ['No title here']}]});
  assert.equal(out.titles(0).length, 1);
  assert.match(out.titles(0)[0], /<p:ph type="(?:ctrTitle|title)"\/>/);
  assert.deepEqual(slideTitle(out.slide(1)), {titled: false, bound: false, boxes: 0});
  assert.ok(!/<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(out.slide(1)), 'no title placeholder is invented');
  const back = (await imported(out.bytes)).value.slides;
  assert.equal(back[0].title, long);
  assert.equal(back[1].title, undefined);
}

// 7. A title neither tier can place (a tab: its measured lines carry tab stops) keeps per-line boxes and says why.
{
  const title = 'Quarter\tA title that is long enough to wrap over two lines of the slide because it carries a great many words';
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{title, items: ['One']}]});
  assert.ok(out.titles(0).length > 1, 'per-line boxes');
  assert.ok(!out.titles(0).some(shape => /<p:ph\b/.test(shape)), 'not bound');
  assert.ok(out.diagnostics.some(item => item.code === 'native-body-fallback' && item.path === 'slides.0.title' && item.reason === 'unsupported-text'));
  assert.equal((await imported(out.bytes)).value.slides[0].title, title);
}

// 8. Core places each line by its ink. Where one box would move a line more than 1 px (at 960) from its measured place, a left-aligned
// title keeps fixed breaks with a first-line indent (layout-sampler 36, "How a team / joins the pilot": the J starts 2.95 px right of the H).
{
  const {examples} = await import('@openpresentation/opf/examples');
  const {deck: sampler} = examples.find(entry => entry.file.endsWith('layout-sampler.opf.json'));
  const out = await exported({...sampler, slides: [sampler.slides[35]]});
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0);
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'fixed-breaks', 'lines placed apart keep fixed breaks');
  const pPr = /<a:pPr\b[^>]*>/.exec(title)[0], marL = Number(/\bmarL="(-?\d+)"/.exec(pPr)[1]), indent = Number(/\bindent="(-?\d+)"/.exec(pPr)[1]);
  assert.ok(marL > 9525 && indent === -marL, `the first line at the box, the others a first-line indent further right (${marL}, ${indent})`);
  assert.equal((await imported(out.bytes)).value.slides[0].title, sampler.slides[35].title);
}
