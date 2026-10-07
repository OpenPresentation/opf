// FA-10: rich headline text. A TextRun[] title, subtitle, tag and quote body export as native runs (colour, weight, links, citation
// markers) at core's rich-line geometry, keep their heading/quote tags, and import back as TextRun[] when their runs are formatted
// differently from one another and as a plain string when they are uniform.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';

const fonts = await loadFonts({pack: 'office'}), decoder = new TextDecoder(), encoder = new TextEncoder();
const options = {fonts};
const deck = () => ({
  design: {fontScheme: 'roboto'},
  references: [{id: 'r1', text: 'Annual report'}],
  slides: [
    {
      tag: ['Q3 ', {text: 'review', italic: true}],
      title: ['Revenue grew ', {text: '28%', color: 'accent1'}, {text: ' year on year', cite: 'r1'}],
      subtitle: [{text: 'Read the ', bold: true}, {text: 'report', link: 'https://example.com/report'}],
      text: 'Body stays a string.',
    },
    {title: 'Voices', quote: {text: ['Cut review time by ', {text: '40%', color: '#1D4ED8'}, ' in a quarter'], attribution: 'Ada, VP Operations'}},
    {title: 'A string title', subtitle: 'A string subtitle', text: 'Plain', quote: undefined},
    {title: ['Line one\n', {text: 'Line two', color: '#C00000'}]},
  ],
});
const document = deck();
delete document.slides[2].quote;
const diagnostics = [];
const bytes = await toPptx(document, options);
const entries = unzipSync(bytes);
const slideXml = index => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
const runs = xml => [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(match => ({props: match[1].match(/<a:rPr\b[^>]*>/)?.[0] ?? '', text: match[1].match(/<a:t>([^<]*)<\/a:t>/)?.[1] ?? '', xml: match[1]}));
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([raw]) => ({raw, name: raw.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? ''}));

// Export: one named native text box per rich line, with the authored run formatting.
const first = shapes(slideXml(0));
const titleLines = first.filter(shape => shape.name.startsWith('OPF heading slides.0.title line '));
assert.ok(titleLines.length >= 1, 'the rich title is exported as tagged heading lines');
const titleRuns = titleLines.flatMap(shape => runs(shape.raw));
assert.equal(titleRuns.filter(run => !/baseline=/.test(run.props)).map(run => run.text).join(''), 'Revenue grew 28% year on year');
const accent = titleRuns.find(run => run.text === '28%');
assert.match(accent.xml, /<a:schemeClr val="accent1"\/>|<a:srgbClr val="[0-9A-F]{6}"\/>/, 'the accent word has its own colour');
assert.notEqual(accent.xml.match(/<a:(?:schemeClr|srgbClr) val="[^"]+"/)[0], titleRuns[0].xml.match(/<a:(?:schemeClr|srgbClr) val="[^"]+"/)[0], 'it differs from the neighbouring run');
assert.ok(titleRuns.some(run => /baseline="30000"/.test(run.props) && run.text === '1'), 'the citation marker is a superscript run');
assert.ok(first.some(shape => shape.name === 'OPF heading slides.0.tag line 0'));
assert.ok(runs(first.find(shape => shape.name === 'OPF heading slides.0.subtitle line 0').raw).some(run => /<a:hlinkClick /.test(run.xml) && run.text === 'report'), 'the subtitle link is a hyperlink run');
// The geometry is core's: every rich title line sits where composeSlide put it.
const geometry = composeSlide(document.slides[0], {presentation: document, slideIndex: 0, layout: {id: 'blank'}, width: 1280, height: 720, fontFamilies: {heading: 'Roboto', body: 'Roboto'}, textMeasurement: fonts.textMeasurement});
assert.ok(geometry.items.find(item => item.field === 'title').text.richLines.length >= 1);
// Quote: the lines carry the quote tags and the quotation marks.
const quoteLines = shapes(slideXml(1)).filter(shape => shape.name.startsWith('OPF quote '));
assert.ok(quoteLines.length >= 2, 'a rich quote body and its footer export as tagged lines');
assert.match(quoteLines.map(shape => runs(shape.raw).map(run => run.text).join("")).join("").replaceAll("&quot;", "\""), /^"Cut review time by 40% in a quarter"Ada, VP Operations$/);
// A string heading keeps the plain path: no rich lines are needed for it.
assert.ok(shapes(slideXml(2)).some(shape => shape.name.startsWith('OPF heading slides.2.title')));

// Import: TextRun[] where the formatting differs, a string where it is uniform.
const imported = await fromPptx(bytes, {onDiagnostic: item => diagnostics.push(item)});
const strip = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : Object.fromEntries(Object.entries(run).filter(([key]) => !['fontSize', 'fontFamily'].includes(key)))) : value;
const [one, two, three] = imported.slides;
assert.equal(typeof three.title, 'string');
assert.equal(three.title, 'A string title');
assert.equal(three.subtitle, 'A string subtitle');
assert.ok(Array.isArray(one.title), 'a title with a differently coloured word imports as runs');
const flat = value => (Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : value);
assert.equal(flat(one.title), 'Revenue grew 28% year on year');
const word = one.title.find(run => typeof run === 'object' && run.text === '28%');
assert.ok(word && (word.color === 'accent1' || /^#[0-9A-F]{6}$/i.test(word.color)), 'the accent word keeps its colour');
assert.deepEqual(one.title.filter(run => typeof run === 'string' || run.color === undefined).map(run => typeof run === 'string' ? run : run.text).join('').includes('Revenue grew'), true, 'runs that only carry the heading default stay plain');
const cited = one.title.find(run => typeof run === 'object' && run.cite !== undefined);
assert.deepEqual(cited?.cite, 'r1', 'the marker run becomes a cite on the run before it');
assert.equal(flat(one.title).includes('1 '), false);
assert.deepEqual(strip(one.tag), ['Q3 ', {text: 'review', italic: true}]);
assert.deepEqual(strip(one.subtitle).map(run => typeof run === 'string' ? run : run.text), ['Read the ', 'report']);
assert.equal(one.subtitle.find(run => run.text === 'report').link, 'https://example.com/report');
assert.equal(one.subtitle[0].bold, true);
assert.ok(Array.isArray(two.quote?.text) && two.quote.attribution === 'Ada, VP Operations', JSON.stringify(two.quote));
assert.equal(flat(two.quote.text), 'Cut review time by 40% in a quarter');
assert.equal(two.quote.text.find(run => typeof run === 'object' && run.text === '40%').color.toUpperCase(), '#1D4ED8');

// A hard line break inside a rich heading keeps its boundary through the tags.
const broken = imported.slides[3].title;
assert.ok(Array.isArray(broken) && flat(broken) === 'Line one\nLine two', JSON.stringify(broken));
assert.equal(broken.find(run => typeof run === 'object').color.toUpperCase(), '#C00000');

// A native title placeholder with one differently formatted run imports as runs; a uniform one as a string, and stays the title.
const mixedXml = (title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${title}</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
const withTitle = async title => {
  const copy = {...entries};
  copy['ppt/slides/slide3.xml'] = encoder.encode(mixedXml(title));
  // Drop the exported OPF tags of the slide so only the native placeholder is read.
  for (const key of Object.keys(copy)) if (key.startsWith('ppt/slides/_rels/slide3')) copy[key] = encoder.encode(decoder.decode(copy[key]).replace(/<Relationship\b[^>]*relationships\/tags"[^>]*\/>/g, ''));
  return fromPptx(zipSync(copy), options);
};
const nativeMixed = await withTitle('<a:r><a:rPr lang="en-US"/><a:t>Growth was </a:t></a:r><a:r><a:rPr lang="en-US" b="1"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:rPr><a:t>strong</a:t></a:r>');
assert.ok(Array.isArray(nativeMixed.slides[2].title), JSON.stringify(nativeMixed.slides[2].title));
assert.equal(flat(nativeMixed.slides[2].title), 'Growth was strong');
const nativeUniform = await withTitle('<a:r><a:rPr lang="en-US" b="1"/><a:t>Growth was </a:t></a:r><a:r><a:rPr lang="en-US" b="1"/><a:t>strong</a:t></a:r>');
assert.equal(nativeUniform.slides[2].title, 'Growth was strong');
console.log('Rich headings: export, tags, citation markers, quote body, and import as runs or a string.');
