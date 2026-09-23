import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import * as opf from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';

// FF-07 (font-fidelity-everywhere). Run `lang`, paragraph `rtl` and the theme
// and run East Asian/complex-script fonts follow core's resolveScriptFonts()
// (FF-18). Expected families come from the resolver and the bundled catalogs;
// PowerPoint-target names such as Meiryo are only compared as strings.

// `text` is a native sample for right-to-left cases; its slides still carry
// Latin table labels, digits and code, which keep their own direction.
const deck = (language, extra = {}, text = 'Heading') => ({name: 'Script fonts', ...(language === undefined ? {} : {language}), ...extra, slides: [
  {title: text, subtitle: 'Subtitle', text},
  {title: 'List', items: [text, {text: 'Two', level: 1}], notes: text},
  {title: 'Table', table: {columns: ['Name', text], rows: [['A', '1']]}},
  {title: 'Chart', chart: {type: 'column', data: {columns: ['Label', 'A', 'B'], rows: [['One', 1, 2], ['Two', 3, 4]]}}},
  {id: 'code', layout: 'code-1x', title: 'Code', code: {source: 'const x = 1;', language: 'ts'}},
]});
const read = async (presentation, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(presentation, {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const entries = unzipSync(new Uint8Array(bytes));
  const xml = Object.fromEntries(Object.entries(entries).filter(([name]) => /\.(xml|rels)$/.test(name)).map(([name, value]) => [name, strFromU8(value)]));
  return {bytes, xml, diagnostics};
};
const partsMatching = (xml, pattern) => Object.entries(xml).filter(([name]) => pattern.test(name)).map(([, value]) => value);
const slides = xml => partsMatching(xml, /^ppt\/slides\/slide\d+\.xml$/).join('');
const themeFonts = (xml, tag) => {
  const block = xml['ppt/theme/theme1.xml'].match(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`))[0];
  const [, latin, ea, cs] = block.match(/^<a:\w+><a:latin typeface="([^"]*)"[^>]*\/><a:ea typeface="([^"]*)"\/><a:cs typeface="([^"]*)"\/>/);
  return {latin, ea, cs, block, script: script => block.match(new RegExp(`<a:font script="${script}" typeface="([^"]*)"`))?.[1]};
};
const langs = xml => new Set(Object.values(xml).flatMap(value => [...value.matchAll(/<a:(?:rPr|endParaRPr|defRPr)\b[^>]*?\slang="([^"]*)"/g)].map(match => match[1])));
const runFaces = (xml, slot) => new Set([...slides(xml).matchAll(new RegExp(`<a:${slot}\\s+typeface="([^"]*)"`, 'g'))].map(match => match[1]).filter(face => !face.startsWith('+')));

if (typeof opf.resolveScriptFonts !== 'function') {
  // Core without the FF-18 resolver: output stays as before FF-07 and a
  // language-bearing document is told why.
  const {xml, diagnostics} = await read(deck('japanese'));
  assert.deepEqual([...langs(xml)], ['en-US']);
  assert.equal(themeFonts(xml, 'minorFont').ea, '');
  assert.deepEqual(diagnostics.map(diagnostic => diagnostic.code).filter(code => code.startsWith('language')), ['language-export-unavailable']);
  console.log('Script fonts: core has no resolveScriptFonts; pre-FF-07 output and the language-export-unavailable diagnostic are verified.');
  process.exit(0);
}

const {resolveScriptFonts, catalogs} = opf;
const languageRecord = id => catalogs.languages.find(record => record.id === id);
const schemeFamilies = id => {const scheme = catalogs.fontSchemes.find(record => record.id === id); return {heading: scheme.major, body: scheme.minor};};

// One language per script class named in FF-06/FF-07.
const cases = [
  {id: 'english-us', role: 'latin', script: 'Latn'},
  {id: 'english-gb', role: 'latin', script: 'Latn'},
  {id: 'french', role: 'latin', script: 'Latn'},
  {id: 'russian', role: 'latin', script: 'Cyrl'},
  {id: 'greek', role: 'latin', script: 'Grek'},
  {id: 'japanese', role: 'eastAsian', script: 'Jpan', supplement: 'Jpan'},
  {id: 'chinese-simplified', role: 'eastAsian', script: 'Hans', supplement: 'Hans'},
  {id: 'chinese-traditional', role: 'eastAsian', script: 'Hant', supplement: 'Hant'},
  {id: 'korean', role: 'eastAsian', script: 'Kore', supplement: 'Hang'},
  {id: 'arabic', role: 'complexScript', script: 'Arab', supplement: 'Arab', rtl: true, text: 'مرحبا بالعالم'},
  {id: 'hebrew', role: 'complexScript', script: 'Hebr', supplement: 'Hebr', rtl: true, text: 'שלום עולם'},
  {id: 'hindi', role: 'complexScript', script: 'Deva', supplement: 'Deva'},
  {id: 'thai', role: 'complexScript', script: 'Thai', supplement: 'Thai'},
];

const latin = resolveScriptFonts(deck(undefined));
for (const expected of cases) {
  const presentation = deck(expected.id, {}, expected.text), record = languageRecord(expected.id);
  const resolved = resolveScriptFonts(presentation);
  assert.equal(resolved.script, expected.script, `${expected.id} script`);
  assert.equal(resolved.scriptRole, expected.role, `${expected.id} role`);
  assert.equal(resolved.rtl, !!expected.rtl, `${expected.id} direction`);
  const {xml, diagnostics} = await read(presentation);
  for (const [name, value] of Object.entries(xml)) assert.equal(XMLValidator.validate(value), true, `${expected.id} ${name} is well-formed XML`);
  assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code.startsWith('language')), [], `${expected.id} language resolves`);

  // lang: the curated OOXML culture tag, on every run, end-of-paragraph and default run property; never altLang.
  assert.equal(resolved.lang, record.ooxmlLang, `${expected.id} curated OOXML tag`);
  assert.deepEqual([...langs(xml)], [record.ooxmlLang], `${expected.id} lang`);
  assert.ok(!Object.values(xml).some(value => /\saltLang="/.test(value)), `${expected.id} writes no altLang`);

  // Theme: latin is the chosen heading/body family. Languages written in the
  // latin slot keep the vendored empty ea/cs (gated on FF-05); other languages
  // fill both with the resolved slots.
  const major = themeFonts(xml, 'majorFont'), minor = themeFonts(xml, 'minorFont');
  assert.deepEqual([major.latin, minor.latin], [latin.heading.latin, latin.body.latin], `${expected.id} theme latin`);
  const own = expected.role === 'latin' ? null : schemeFamilies(record.fontScheme);
  if (!own) assert.deepEqual([major.ea, major.cs, minor.ea, minor.cs], ['', '', '', ''], `${expected.id} keeps theme ea/cs empty`);
  else assert.deepEqual([major.ea, major.cs, minor.ea, minor.cs], [resolved.heading.eastAsian, resolved.heading.complexScript, resolved.body.eastAsian, resolved.body.complexScript], `${expected.id} theme ea/cs`);
  for (const [slot, key] of own ? [['ea', 'eastAsian'], ['cs', 'complexScript']] : []) {
    const want = key === expected.role ? own : {heading: latin.heading.latin, body: latin.body.latin};
    assert.deepEqual({heading: major[slot], body: minor[slot]}, want, `${expected.id} theme ${slot} follows ${key === expected.role ? 'the language font scheme' : 'the latin family'}`);
  }

  // Supplement: the language's own script entry names the language font; every other vendored entry is unchanged.
  const vendored = (await read(deck(undefined))).xml;
  if (expected.supplement) {
    assert.deepEqual({heading: major.script(expected.supplement), body: minor.script(expected.supplement)}, own, `${expected.id} ${expected.supplement} supplement`);
    const strip = block => block.replace(new RegExp(`<a:font script="${expected.supplement}" typeface="[^"]*"/>`), '').replace(/<a:(?:latin|ea|cs) typeface="[^"]*"\/>/g, '');
    assert.equal(strip(major.block), strip(themeFonts(vendored, 'majorFont').block), `${expected.id} leaves the other per-script entries`);
  } else {
    assert.equal(resolved.supplement, undefined);
    assert.equal(major.block.replace(/<a:(?:ea|cs) typeface="[^"]*"\/>/g, ''), themeFonts(vendored, 'majorFont').block.replace(/<a:(?:ea|cs) typeface="[^"]*"\/>/g, ''), `${expected.id} keeps the vendored per-script list`);
  }

  // Runs: the language's own slot names the language font for heading and body text; the other slot repeats latin.
  const slot = {eastAsian: 'ea', complexScript: 'cs', latin: 'latin'}[expected.role];
  if (own) {
    assert.deepEqual(runFaces(xml, slot), new Set([own.heading, own.body]), `${expected.id} run ${slot}`);
    const other = slot === 'ea' ? 'cs' : 'ea';
    assert.deepEqual(runFaces(xml, other), runFaces(xml, 'latin'), `${expected.id} run ${other} repeats latin`);
    // Headings take the heading slot; the chart keeps its body face.
    const title = xml['ppt/slides/slide1.xml'].match(/name="OPF heading slides\.0\.title line 0"[\s\S]*?<\/p:sp>/)[0];
    assert.match(title, new RegExp(`<a:${slot} typeface="${own.heading}"/>`), `${expected.id} title ${slot}`);
    // Chart text (whose latin/ea/cs FF-08 sets to the body font) takes the body script font.
    const chart = partsMatching(xml, /^ppt\/charts\/chart\d+\.xml$/).join('');
    assert.match(chart, new RegExp(`<a:${slot} typeface="${own.body}"/>`), `${expected.id} chart ${slot}`);
  } else {
    for (const other of ['ea', 'cs']) assert.deepEqual(runFaces(xml, other), runFaces(xml, 'latin'), `${expected.id} run ${other} repeats latin`);
  }

  // Direction: core's paragraphDirection() decides every slide and notes
  // paragraph of an RTL deck (rtl="1", else an explicit rtl="0" under the
  // right-to-left master defaults). LTR decks write no paragraph direction.
  const directions = value => [...value.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, body]) => ({
    text: [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
    rtl: /^<a:pPr\b[^>]*\srtl="([01])"/.exec(body)?.[1],
  }));
  const notes = partsMatching(xml, /^ppt\/notesSlides\/notesSlide\d+\.xml$/).join('');
  for (const paragraph of [...directions(slides(xml)), ...directions(notes)]) {
    const want = expected.rtl ? (opf.paragraphDirection(paragraph.text, 'rtl') === 'rtl' ? '1' : '0') : undefined;
    assert.equal(paragraph.rtl, want, `${expected.id} paragraph "${paragraph.text}" direction`);
  }
  if (expected.rtl) {
    const all = directions(slides(xml));
    assert.ok(all.some(paragraph => paragraph.text === expected.text && paragraph.rtl === '1'), `${expected.id} native text is right-to-left`);
    assert.ok(all.some(paragraph => paragraph.text === 'const x = 1;' && paragraph.rtl === '0'), `${expected.id} code stays left-to-right`);
    assert.ok(all.some(paragraph => paragraph.text === 'Name' && paragraph.rtl === '0'), `${expected.id} Latin label stays left-to-right`);
    assert.ok(all.some(paragraph => paragraph.text === '1' && paragraph.rtl === '1'), `${expected.id} digits take the deck direction`);
  }
  const master = xml['ppt/slideMasters/slideMaster1.xml'];
  assert.equal(/<a:lvl1pPr\b[^>]*\srtl="1"/.test(master), !!expected.rtl, `${expected.id} master default direction`);
  // Alignment stays exactly as composed (absolute l/ctr/r), so native geometry keeps matching the renderer.
  assert.deepEqual([...slides(xml).matchAll(/\salgn="(\w+)"/g)].map(match => match[1]), [...slides((await read(deck(undefined, {}, expected.text))).xml).matchAll(/\salgn="(\w+)"/g)].map(match => match[1]), `${expected.id} alignment unchanged`);

  // Import maps lang back to the catalog language without new diagnostics.
  const imported = [];
  const restored = await fromPptx((await read(presentation)).bytes, {onDiagnostic: diagnostic => imported.push(diagnostic.code)});
  assert.equal(restored.language, expected.id, `${expected.id} import`);
  assert.deepEqual(imported.filter(code => /language|script-font|rtl/.test(code)), [], `${expected.id} import diagnostics`);
  assert.equal(opf.validatePresentation(restored).valid, true);
}

// A document without a language is en-US and keeps the vendored empty theme ea/cs.
{
  const {xml} = await read(deck(undefined));
  assert.deepEqual([...langs(xml)], ['en-US']);
  const major = themeFonts(xml, 'majorFont'), minor = themeFonts(xml, 'minorFont');
  assert.deepEqual([major.ea, major.cs, minor.ea, minor.cs], ['', '', '', '']);
  assert.equal((await fromPptx((await read(deck(undefined))).bytes)).language, 'english-us');
}

// An explicit eastAsian slot on the design font scheme fills ea in a Latin deck
// (CJK inside a Latin deck). The FF-32 stored font scheme restores that slot;
// without provenance the importer reports it cannot carry it.
{
  const fontScheme = {id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}};
  const {xml, bytes} = await read(deck('english-us', {design: {fontScheme}}));
  const stored = [];
  const restoredScheme = await fromPptx(bytes, {onDiagnostic: diagnostic => stored.push(diagnostic.code)});
  assert.deepEqual(restoredScheme.design.fontScheme, fontScheme);
  assert.ok(!stored.includes('script-font-not-imported'), 'the restored scheme reproduces the theme ea');
  const observedOnly = (await read(deck('english-us', {design: {fontScheme}}), {provenance: false})).bytes;
  assert.equal(themeFonts(xml, 'minorFont').ea, 'Noto Sans JP');
  assert.equal(themeFonts(xml, 'minorFont').cs, '', 'only the explicit slot fills');
  assert.deepEqual(runFaces(xml, 'ea'), new Set(['Noto Sans JP']));
  assert.deepEqual([...langs(xml)], ['en-US']);
  const diagnostics = [];
  await fromPptx(observedOnly, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.ok(diagnostics.includes('script-font-not-imported'));
}

// Authored tags: a region tag is used as written and imports as that tag (it
// still resolves to the English record); an uncatalogued tag round-trips as a
// tag with a diagnostic. Without FF-32 provenance, records sharing one
// curated OOXML tag import as the record of the same primary language, with a
// diagnostic; with it, the stored id wins and nothing is ambiguous.
{
  const nz = await read(deck('en-NZ'));
  assert.deepEqual([...langs(nz.xml)], ['en-NZ']);
  const nzDiagnostics = [];
  assert.equal((await fromPptx(nz.bytes, {onDiagnostic: diagnostic => nzDiagnostics.push(diagnostic.code)})).language, 'en-NZ');
  assert.deepEqual(nzDiagnostics.filter(code => code.startsWith('language')), []);
  for (const [id, imported] of [['chittagonian', 'bengali'], ['tagalog', 'filipino'], ['english', 'english-us']]) {
    const diagnostics = [];
    const restored = await fromPptx((await read(deck(id), {provenance: false})).bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
    assert.equal(restored.language, imported, `${id} imports as ${imported}`);
    // en is en-US for OOXML: english-us carries that exact tag, so nothing is ambiguous.
    assert.equal(diagnostics.includes('language-ambiguous'), id !== 'english', `${id} ambiguity diagnostic`);
    const withStored = [];
    assert.equal((await fromPptx((await read(deck(id))).bytes, {onDiagnostic: diagnostic => withStored.push(diagnostic.code)})).language, id, `${id} stored reference wins`);
    assert.deepEqual(withStored.filter(code => /language|metadata-reference/.test(code)), [], `${id} no duplicate language diagnostics`);
  }
  const {bytes} = await read(deck('haw-US'));
  const diagnostics = [];
  const restored = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.equal(restored.language, 'haw-US');
  assert.ok(diagnostics.includes('language-uncatalogued'));
}

// Unresolvable references fall back to en-US and say so.
{
  const {xml, diagnostics} = await read(deck('https://example.com/languages/custom.json'));
  assert.deepEqual([...langs(xml)], ['en-US']);
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'language-unresolved'));
}

// FF-32 x FF-07: a stored language wins while the runs still carry its tag;
// runs retagged to another language keep the observed language and name the
// stored reference once.
{
  const {bytes} = await read(deck('japanese'));
  const entries = unzipSync(new Uint8Array(bytes));
  for (const [name, value] of Object.entries(entries)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) entries[name] = new TextEncoder().encode(strFromU8(value).replace(/(\slang=")ja-JP"/g, '$1fr-FR"'));
  }
  const {zipSync} = await import('fflate');
  const diagnostics = [];
  const restored = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.equal(restored.language, 'french');
  assert.deepEqual(diagnostics.filter(code => code === 'metadata-reference-changed'), ['metadata-reference-changed']);
}

// Import of mixed run languages keeps the dominant one and reports the rest;
// RTL paragraphs under a left-to-right language are reported. These packages
// carry no FF-32 provenance, so only the runs decide.
{
  const {bytes} = await read(deck('arabic', {}, 'مرحبا'), {provenance: false});
  const entries = unzipSync(new Uint8Array(bytes));
  const slide = strFromU8(entries['ppt/slides/slide1.xml']);
  let first = true;
  entries['ppt/slides/slide1.xml'] = new TextEncoder().encode(slide.replace(/(<a:rPr\b[^>]*?\slang=")ar-SA"/g, (match, prefix) => {
    if (!first) return match;
    first = false;
    return `${prefix}fr-FR"`;
  }));
  const {zipSync} = await import('fflate');
  const diagnostics = [];
  const restored = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.equal(restored.language, 'arabic');
  assert.ok(diagnostics.includes('mixed-run-languages'));
  // Values that name no language are not counted.
  const noLanguage = Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, /^ppt\/slides\/slide\d+\.xml$/.test(name)
    ? new TextEncoder().encode(strFromU8(value).replace(/(<a:rPr\b[^>]*?\slang=")(?:ar-SA|fr-FR)"/g, '$1x-none"')) : value]));
  const none = [];
  assert.equal((await fromPptx(zipSync(noLanguage), {onDiagnostic: diagnostic => none.push(diagnostic.code)})).language, undefined);
  assert.ok(none.includes('rtl-language-mismatch'));
  for (const [name, value] of Object.entries(entries)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) entries[name] = new TextEncoder().encode(strFromU8(value).replace(/(\slang=")ar-SA"/g, '$1en-US"'));
  }
  const rtl = [];
  assert.equal((await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => rtl.push(diagnostic.code)})).language, 'english-us');
  assert.ok(rtl.includes('rtl-language-mismatch'));
}

// Deterministic: the same document exports the same bytes.
assert.deepEqual((await read(deck('japanese'))).bytes, (await read(deck('japanese'))).bytes);

console.log(`Script fonts passed: ${cases.length} languages across Latin, Cyrillic, Greek, CJK (ja/zh-Hans/zh-Hant/ko), Arabic/Hebrew RTL, Indic and Thai; lang, rtl, theme and run ea/cs, supplements, import and diagnostics.`);
