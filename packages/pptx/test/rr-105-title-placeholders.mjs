// RR-105 (opf#1291): in the default export every title is the slide's Title placeholder. A one-line title is its measured line; a
// wrapped title whose lines PowerPoint's own wrap keeps is one native wrapped box; any other wrapped title is one box of core's lines, one
// paragraph per line (no wrap), whose paragraph breaks import reads back as soft wraps. Only a title that box cannot place keeps per-line
// boxes. Both are written at single spacing (PowerPoint drew any other spacing's first line higher, 2026-11-12).
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
const paragraphs = shape => [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(([paragraph]) => paragraph);
const text = shape => paragraphs(shape).map(paragraph => [...paragraph.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''));
const long = 'Quarterly results show steady growth in every region and a clear plan for the year ahead';

// 1. A plain wrapped title: one native wrapped box at single spacing, bound, in the default export (it was one box per line before).
{
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{title: long, items: ['One', 'Two']}]});
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0, 'one title shape');
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'soft-wrap');
  assert.match(title, /<a:bodyPr[^>]*wrap="square"[^>]*><a:noAutofit\/><\/a:bodyPr>/);
  assert.match(title, /<a:lnSpc><a:spcPct val="100000"\/><\/a:lnSpc>/, 'single spacing');
  assert.deepEqual(out.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  assert.equal((await imported(out.bytes)).value.slides[0].title, long);
}

// 2. Fixed breaks: a face measured with a visual substitute cannot verify a native wrap, so core's lines are one paragraph each.
const bookman = {design: {fontScheme: 'bookman'}, slides: [{title: 'Onboarding experience redesign for every new customer in the first ninety days', items: ['One']}]};
{
  const out = await exported(bookman);
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0, 'one title shape');
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'fixed-breaks');
  assert.match(title, /<a:bodyPr[^>]*wrap="none"[^>]*><a:noAutofit\/><\/a:bodyPr>/);
  const lines = paragraphs(title);
  assert.ok(lines.length >= 2, 'one paragraph per measured line');
  assert.ok(lines.every(line => /<a:lnSpc><a:spcPct val="100000"\/><\/a:lnSpc>/.test(line)), 'single spacing on every line');
  assert.ok(!/<a:spcBef>/.test(lines[0]) && lines.slice(1).every(line => /<a:spcBef><a:spcPts val="\d+"\/><\/a:spcBef>/.test(line)), 'space before each later line makes up the pitch');
  assert.ok(!/<a:br\b/.test(title));
  assert.equal(text(title).join(''), bookman.slides[0].title);
  assert.deepEqual(out.diagnostics.filter(item => item.code === 'native-body-fallback'), []);
  const back = await imported(out.bytes);
  assert.equal(back.value.slides[0].title, bookman.slides[0].title, 'paragraph breaks import as soft wraps');
  assert.deepEqual(back.diagnostics.filter(item => /heading/.test(item.code)), []);
  // A copy PowerPoint saved: other run and paragraph-end attributes, the tags kept; it imports the same.
  const xml = out.slide(0).replace(/<a:endParaRPr\b[^>]*\/>/g, '<a:endParaRPr lang="en-US" sz="3975" dirty="0"><a:latin typeface="Bookman Old Style"/></a:endParaRPr>');
  const saved = await imported(zipSync({...out.entries, 'ppt/slides/slide1.xml': strToU8(xml)}));
  assert.equal(saved.value.slides[0].title, bookman.slides[0].title);
  // An edit in PowerPoint keeps its words; the paragraph breaks stay soft wraps.
  const edited = xml.replace('Onboarding', 'Better onboarding');
  assert.equal((await imported(zipSync({...out.entries, 'ppt/slides/slide1.xml': strToU8(edited)}))).value.slides[0].title, `Better ${bookman.slides[0].title.replace('Onboarding', 'onboarding')}`);
}

// 3. An authored hard break is a paragraph the tag lists and imports as "\n"; the wraps of the long line stay soft.
{
  const title = 'First line\nSecond line that is long enough to wrap onto yet another line of this wide title box on the slide';
  const out = await exported({design: {fontScheme: 'roboto'}, slides: [{title, items: ['One']}]});
  const [shape, ...rest] = out.titles(0);
  assert.equal(rest.length, 0);
  assert.match(shape, /<p:ph type="title"\/>/);
  assert.ok(paragraphs(shape).length >= 3, 'one paragraph per line, the hard break among them');
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
  // Its single line takes a fallback face's height (1.204 sizes measured), which no measured face covers: fixed lines.
  assert.equal(slideTitle(cjk.slide(0)).tier, 'fixed-breaks', 'a Japanese title keeps its measured lines');
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

// 8. Core places each line by its ink. Where one box would move a line more than 1 px (at 960) from its measured place, the title keeps
// fixed lines, each paragraph with the margin that starts it there (layout-sampler 36, "How a team / joins the pilot": the J starts 2.95 px
// right of the H; boutique-hotel-revenue-recovery's cover, right-aligned, ends its first line 1.85 px right of the second).
{
  const {examples} = await import('@openpresentation/opf/examples');
  const {deck: sampler} = examples.find(entry => entry.file.endsWith('layout-sampler.opf.json'));
  const out = await exported({...sampler, slides: [sampler.slides[35]]});
  const [title, ...rest] = out.titles(0);
  assert.equal(rest.length, 0);
  assert.match(title, /<p:ph type="title"\/>/);
  assert.equal(slideTitle(out.slide(0)).tier, 'fixed-breaks', 'lines placed apart keep fixed breaks');
  const margin = (shape, name) => [...shape.matchAll(/<a:pPr\b[^>]*>/g)].map(([pPr]) => Number(new RegExp(`\\b${name}="(-?\\d+)"`).exec(pPr)?.[1] ?? 0));
  const [first, second] = margin(title, 'marL');
  assert.ok(first === 0 && second > 2.5 * 9525 && second < 3.5 * 9525, `the second line starts its 2.95 px further right (${first}, ${second})`);
  assert.equal((await imported(out.bytes)).value.slides[0].title, sampler.slides[35].title);
  const {deck: hotel} = examples.find(entry => entry.file.endsWith('boutique-hotel-revenue-recovery.opf.json'));
  const right = await exported({...hotel, slides: [hotel.slides[0]]});
  assert.equal(slideTitle(right.slide(0)).tier, 'fixed-breaks', 'right-aligned lines placed apart are one title');
  const [end1, end2] = margin(right.titles(0)[0], 'marR');
  assert.ok(end1 === 0 && end2 > 1.5 * 9525 && end2 < 2.2 * 9525, `the second line ends its 1.85 px further left (${end1}, ${end2})`);
  assert.equal((await imported(right.bytes)).value.slides[0].title, hotel.slides[0].title);
}

// 9. Edits in PowerPoint to a title of fixed lines. While its paragraphs are the exported lines (a line retyped), the paragraph breaks
// are soft wraps again; once an edit joins, deletes or adds a line, which breaks were wraps is unknown, so every paragraph break reads as
// the line break the user sees. No edit throws, runs words together or loses a word that is still there.
{
  const title = 'Onboarding experience redesign for every new customer in the first ninety days of their contract with us';
  const out = await exported({design: {fontScheme: 'bookman'}, slides: [{title, items: ['One']}]});
  const xml = out.slide(0), [shape] = out.titles(0), lines = paragraphs(shape);
  assert.ok(lines.length >= 3, 'three lines to edit');
  const texts = text(shape);
  const runsOf = paragraph => paragraph.replace(/^<a:p>(?:<a:pPr\b[^>]*\/>|<a:pPr\b[\s\S]*?<\/a:pPr>)?/, '').replace(/<a:endParaRPr\b[^>]*\/><\/a:p>$/, '');
  const withParagraphs = list => xml.replace(shape, shape.replace(/<a:p>[\s\S]*<\/a:p>/, list.join('')));
  const importedTitle = async list => {
    const diagnostics = [], value = await fromPptx(zipSync({...out.entries, 'ppt/slides/slide1.xml': strToU8(withParagraphs(list))}), {onDiagnostic: item => diagnostics.push(item)});
    assert.deepEqual(diagnostics.filter(item => item.code === 'invalid-heading-provenance'), []);
    return value.slides[0].title;
  };
  // Retyped: the same paragraphs, other words; still soft wraps.
  const retyped = lines.map((paragraph, index) => index === 1 ? paragraph.replace(/<a:t>[^<]*<\/a:t>/, '<a:t>retyped middle words </a:t>') : paragraph);
  assert.equal(await importedTitle(retyped), texts[0] + 'retyped middle words ' + texts.slice(2).join(''));
  // Joined: the first two lines one paragraph (Delete at the end of the first).
  const joined = [lines[0].replace(/<a:endParaRPr\b[^>]*\/><\/a:p>$/, '') + runsOf(lines[1]) + '</a:p>', ...lines.slice(2)];
  assert.equal(await importedTitle(joined), [texts[0] + texts[1], ...texts.slice(2)].join('\n'));
  // Deleted: the second line removed.
  assert.equal(await importedTitle([lines[0], ...lines.slice(2)]), [texts[0], ...texts.slice(2)].join('\n'));
  // Added: a new line after the first (Enter, then typing).
  const added = lines[1].replace(/<a:t>[^<]*<\/a:t>/, '<a:t>An added line</a:t>');
  assert.equal(await importedTitle([lines[0], added, ...lines.slice(1)]), [texts[0], 'An added line', ...texts.slice(1)].join('\n'));
}
