import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {LANGUAGES, paragraphDirection, resolveScriptFonts} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';

// FF-07 (font-fidelity-everywhere). Run `lang`, paragraph `rtl` and the theme
// and run East Asian/complex-script fonts follow core's resolveScriptFonts()
// (FF-18). Expected families come from the resolver and core's language
// vocabulary (OPF 0.15: `language` is a BCP-47 tag, not a catalog id);
// PowerPoint-target names such as Meiryo are only compared as strings.

// `text` is a native sample for right-to-left cases; its slides still carry
// Latin table labels, digits and code, which keep their own direction.
const deck = (language, extra = {}, text = 'Heading') => ({name: 'Script fonts', ...(language === undefined ? {} : {language}), ...extra, slides: [
  {title: text, subtitle: 'Subtitle', text},
  {title: 'List', items: [text, {text: 'Two', level: 1}], notes: text},
  {title: 'Table', table: {columns: ['Name', text], rows: [['A', '1']]}},
  {title: 'Chart', chart: {type: 'column', data: {columns: ['Label', 'A', 'B'], rows: [['One', 1, 2], ['Two', 3, 4]]}}},
  {id: 'code', layout: 'code', title: 'Code', code: {source: 'const x = 1;', language: 'ts'}},
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

const languageRecord = tag => LANGUAGES.find(record => record.tag === tag);
const languageFamilies = record => ({heading: record.fonts.powerpoint.major, body: record.fonts.powerpoint.minor});

// One language per script class named in FF-06/FF-07.
const cases = [
  {id: 'en-US', role: 'latin', script: 'Latn'},
  {id: 'en-GB', role: 'latin', script: 'Latn'},
  {id: 'fr', role: 'latin', script: 'Latn'},
  {id: 'ru', role: 'latin', script: 'Cyrl'},
  {id: 'el', role: 'latin', script: 'Grek'},
  {id: 'ja', role: 'eastAsian', script: 'Jpan', supplement: 'Jpan'},
  {id: 'zh-Hans', role: 'eastAsian', script: 'Hans', supplement: 'Hans'},
  {id: 'zh-Hant', role: 'eastAsian', script: 'Hant', supplement: 'Hant'},
  {id: 'ko', role: 'eastAsian', script: 'Kore', supplement: 'Hang'},
  {id: 'ar', role: 'complexScript', script: 'Arab', supplement: 'Arab', rtl: true, text: 'مرحبا بالعالم'},
  {id: 'he', role: 'complexScript', script: 'Hebr', supplement: 'Hebr', rtl: true, text: 'שלום עולם'},
  {id: 'hi', role: 'complexScript', script: 'Deva', supplement: 'Deva'},
  {id: 'th', role: 'complexScript', script: 'Thai', supplement: 'Thai'},
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

  // Theme: latin is the chosen heading/body family. FF-49: a theme ea/cs is written only for the slot the language
  // (or the font scheme) supplies a script font for, exactly as Office leaves the others empty; a Japanese deck
  // writes ea only, an Arabic deck cs only, and Latin-slot languages neither.
  const major = themeFonts(xml, 'majorFont'), minor = themeFonts(xml, 'minorFont');
  assert.deepEqual([major.latin, minor.latin], [latin.heading.latin, latin.body.latin], `${expected.id} theme latin`);
  const own = expected.role === 'latin' ? null : languageFamilies(record);
  const slotKeys = {ea: 'eastAsian', cs: 'complexScript'};
  for (const [slot, key] of Object.entries(slotKeys)) {
    const supplied = own && key === expected.role;
    assert.equal(resolved.sources[key] !== 'latin', Boolean(supplied), `${expected.id} resolver source for ${key}`);
    // FF-05: the ea slot is never empty (PowerPoint lists an empty one as an empty-name font through every paragraph end mark): it
    // repeats the latin family when nothing is selected. cs stays empty.
    const unselected = slot === 'ea' ? {heading: major.latin, body: minor.latin} : {heading: '', body: ''};
    assert.deepEqual({heading: major[slot], body: minor[slot]}, supplied ? own : unselected, `${expected.id} theme ${slot} ${supplied ? 'names the language font scheme' : slot === 'ea' ? 'repeats the latin family' : 'stays empty (nothing selected)'}`);
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

  // Runs (FF-05): slide runs name only the latin face, as PowerPoint writes them; an explicit run ea/cs typeface makes
  // PowerPoint list an empty-name font. The East Asian and complex-script faces come from the theme slots above.
  const slot = {eastAsian: 'ea', complexScript: 'cs', latin: 'latin'}[expected.role];
  for (const other of ['ea', 'cs']) assert.deepEqual(runFaces(xml, other), new Set(), `${expected.id} run ${other} is not written`);
  assert.deepEqual(partsMatching(xml, /^ppt\/notesSlides\/notesSlide\d+\.xml$/).filter(part => /<a:(?:ea|cs)\s+typeface="[^+"]/.test(part)), [], `${expected.id} notes runs name no ea/cs`);
  if (own) {
    // Chart text (whose latin/ea/cs FF-08 sets to the body font) takes the body script font.
    const chart = partsMatching(xml, /^ppt\/charts\/chart\d+\.xml$/).join('');
    assert.match(chart, new RegExp(`<a:${slot} typeface="${own.body}"/>`), `${expected.id} chart ${slot}`);
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
    const want = expected.rtl ? (paragraphDirection(paragraph.text, 'rtl') === 'rtl' ? '1' : '0') : undefined;
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
  // Alignment is logical for right-to-left text (RR-05): against the same document in a left-to-right deck, a right-to-left paragraph
  // flips l and r (its start edge is the right), a left-to-right paragraph and every centred one keep their alignment.
  const paragraphs = value => [...value.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, body]) => ({algn: /^<a:pPr\b[^>]*\salgn="(\w+)"/.exec(body)?.[1] ?? 'l', rtl: /^<a:pPr\b[^>]*\srtl="([01])"/.exec(body)?.[1]}));
  const flip = {l: 'r', r: 'l', ctr: 'ctr'};
  const ownParagraphs = paragraphs(slides(xml)), baseline = paragraphs(slides((await read(deck(undefined, {}, expected.text))).xml));
  assert.equal(ownParagraphs.length, baseline.length, `${expected.id} paragraph count`);
  assert.deepEqual(ownParagraphs.map(paragraph => paragraph.algn), baseline.map((paragraph, index) => ownParagraphs[index].rtl === '1' ? flip[paragraph.algn] : paragraph.algn), `${expected.id} logical alignment`);

  // Import restores the stored language tag (the runs still carry its OOXML tag) without new diagnostics.
  const imported = [];
  const restored = await fromPptx((await read(presentation)).bytes, {onDiagnostic: diagnostic => imported.push(diagnostic.code)});
  assert.equal(restored.language, expected.id, `${expected.id} import`);
  assert.deepEqual(imported.filter(code => /language|script-font|rtl/.test(code)), [], `${expected.id} import diagnostics`);
  assert.equal(validate(restored, {only: ['format']}).valid, true);
}

// A document without a language is en-US; its theme ea repeats the latin family (FF-05) and cs keeps the vendored empty slot.
{
  const {xml} = await read(deck(undefined));
  assert.deepEqual([...langs(xml)], ['en-US']);
  const major = themeFonts(xml, 'majorFont'), minor = themeFonts(xml, 'minorFont');
  assert.deepEqual([major.ea, major.cs, minor.ea, minor.cs], [major.latin, '', minor.latin, '']);
  // RR-59: the round trip leaves the unstated language absent; a plain package (no provenance) imports the run tag as a BCP-47 tag.
  assert.equal((await fromPptx((await read(deck(undefined))).bytes)).language, undefined, 'the unstated language stays absent');
  assert.equal((await fromPptx((await read(deck(undefined), {provenance: false})).bytes)).language, 'en-US', 'the run tag imports as a BCP-47 tag');
}

// FF-05: East Asian text in a deck whose language selects no East Asian font. The theme ea slot names a font for that
// text (kana is Japanese, hangul Korean, Han alone Simplified Chinese; each as core resolves it for that language), so
// the East Asian text does not read an unresolved +mn-ea; without such text the slot repeats the latin family.
{
  const resolvedFor = language => resolveScriptFonts({...deck('en-US'), language}).body.eastAsian;
  for (const [text, language] of [['日本語のテキスト', 'ja'], ['한국어 텍스트', 'ko'], ['中文文本', 'zh-Hans']]) {
    const presentation = deck('en-US', {}, text);
    const {xml} = await read(presentation);
    const expected = resolvedFor(language);
    assert.notEqual(expected, themeFonts(xml, 'minorFont').latin, `${language} resolves to an East Asian family`);
    assert.deepEqual([themeFonts(xml, 'majorFont').ea, themeFonts(xml, 'minorFont').ea], [expected, expected], `${language} text in an English deck names ${expected}`);
    assert.equal(themeFonts(xml, 'minorFont').cs, '', 'complex script stays empty');
    assert.deepEqual(runFaces(xml, 'ea'), new Set(), `${language} text: runs name no ea`);
    assert.equal(themeFonts(xml, 'minorFont').latin, 'Aptos', 'the content rule changes no latin font');
  }
  const {xml: latinOnly} = await read(deck('en-US'));
  assert.equal(themeFonts(latinOnly, 'minorFont').ea, themeFonts(latinOnly, 'minorFont').latin, 'no East Asian text: ea repeats latin');
  // A deck language with its own East Asian font is not overridden by the text.
  const korean = await read(deck('ko', {}, '日本語のテキスト'));
  assert.equal(themeFonts(korean.xml, 'minorFont').ea, resolvedFor('ko'), 'the deck language wins');
}

// An explicit eastAsian slot on the design font scheme fills ea in a Latin deck
// (CJK inside a Latin deck). The FF-32 stored font scheme restores that slot;
// without provenance the importer reports it cannot carry it.
{
  const fontScheme = {eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}};
  const {xml, bytes} = await read(deck('en-US', {design: {fontScheme}}));
  const stored = [];
  const restoredScheme = await fromPptx(bytes, {onDiagnostic: diagnostic => stored.push(diagnostic.code)});
  assert.deepEqual(restoredScheme.design.fontScheme, fontScheme);
  assert.ok(!stored.includes('script-font-not-imported'), 'the restored scheme reproduces the theme ea');
  const observedOnly = (await read(deck('en-US', {design: {fontScheme}}), {provenance: false})).bytes;
  assert.equal(themeFonts(xml, 'minorFont').ea, 'Noto Sans JP');
  assert.equal(themeFonts(xml, 'minorFont').cs, '', 'only the explicit slot fills');
  assert.deepEqual(runFaces(xml, 'ea'), new Set(), 'runs name no ea');
  assert.deepEqual([...langs(xml)], ['en-US']);
  const diagnostics = [];
  await fromPptx(observedOnly, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.ok(diagnostics.includes('script-font-not-imported'));
}

// Authored tags (OPF 0.15): a region tag is used as written and imports as that tag; a tag outside core's language table
// round-trips as a tag. Without FF-32 provenance the dominant run tag (the curated OOXML tag) imports as the BCP-47 tag;
// with it, the stored tag wins. No languages catalog is involved, so nothing is ambiguous or uncatalogued.
{
  const nz = await read(deck('en-NZ'));
  assert.deepEqual([...langs(nz.xml)], ['en-NZ']);
  const nzDiagnostics = [];
  assert.equal((await fromPptx(nz.bytes, {onDiagnostic: diagnostic => nzDiagnostics.push(diagnostic.code)})).language, 'en-NZ');
  assert.deepEqual(nzDiagnostics.filter(code => code.startsWith('language')), []);
  for (const [tag, runTag] of [['ja', 'ja-JP'], ['fr', 'fr-FR'], ['en', 'en-US']]) {
    const diagnostics = [];
    const restored = await fromPptx((await read(deck(tag), {provenance: false})).bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
    assert.equal(restored.language, runTag, `${tag} without provenance imports as the run tag ${runTag}`);
    assert.deepEqual(diagnostics.filter(code => code.startsWith('language')), [], `${tag}: no language diagnostics`);
    const withStored = [];
    assert.equal((await fromPptx((await read(deck(tag))).bytes, {onDiagnostic: diagnostic => withStored.push(diagnostic.code)})).language, tag, `${tag} stored tag wins`);
    assert.deepEqual(withStored.filter(code => /language|metadata-reference/.test(code)), [], `${tag} no duplicate language diagnostics`);
  }
  const {bytes} = await read(deck('haw-US'));
  const diagnostics = [];
  const restored = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.equal(restored.language, 'haw-US');
  assert.deepEqual(diagnostics.filter(code => code === 'language-uncatalogued' || code === 'language-ambiguous'), [], 'no catalog diagnostics');
}

// A tag whose script core does not know falls back to en-US and says so.
{
  const {xml, diagnostics} = await read(deck('zz-ZZ'));
  assert.deepEqual([...langs(xml)], ['en-US']);
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'language-unresolved'));
}

// FF-32 x FF-07: a stored language wins while the runs still carry its tag;
// runs retagged to another language keep the observed language and name the
// stored reference once.
{
  const {bytes} = await read(deck('ja'));
  const entries = unzipSync(new Uint8Array(bytes));
  for (const [name, value] of Object.entries(entries)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) entries[name] = new TextEncoder().encode(strFromU8(value).replace(/(\slang=")ja-JP"/g, '$1fr-FR"'));
  }
  const {zipSync} = await import('fflate');
  const diagnostics = [];
  const restored = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic.code)});
  assert.equal(restored.language, 'fr-FR');
  assert.deepEqual(diagnostics.filter(code => code === 'metadata-reference-changed'), ['metadata-reference-changed']);
}

// Import of mixed run languages keeps the dominant one and reports the rest;
// RTL paragraphs under a left-to-right language are reported. These packages
// carry no FF-32 provenance, so only the runs decide.
{
  const {bytes} = await read(deck('ar', {}, 'مرحبا'), {provenance: false});
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
  assert.equal(restored.language, 'ar-SA');
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
  assert.equal((await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => rtl.push(diagnostic.code)})).language, 'en-US');
  assert.ok(rtl.includes('rtl-language-mismatch'));
}

// RR-17 (RR-42 native run): the deck language's own Office script entry names the deck's font. Vietnamese is a Latin-script
// language with its own `Viet` entry (Office default: Times New Roman / Arial), which PowerPoint applies to vi-VN runs and
// lists in Presentation.Fonts; it now takes the theme latin family, major in majorFont and minor in minorFont, and every
// other vendored entry is unchanged. Uyghur (`Uigh`) follows the same rule, taking the complex-script family when the deck
// selects one. Other languages keep the vendored Viet and Uigh entries.
{
  const vietnamese = deck('vi-Latn', {}, 'Tiếng Việt: Quốc Ngữ');
  const resolved = resolveScriptFonts(vietnamese);
  assert.equal(resolved.lang, 'vi-VN');
  assert.equal(resolved.supplement, undefined, 'core names no supplement for a Latin-script language');
  const {xml} = await read(vietnamese);
  const vendored = (await read(deck(undefined))).xml;
  for (const tag of ['majorFont', 'minorFont']) {
    const ours = themeFonts(xml, tag), theirs = themeFonts(vendored, tag);
    assert.equal(ours.script('Viet'), ours.latin, `vietnamese ${tag} Viet names the theme latin family`);
    assert.equal(ours.script('Viet'), tag === 'majorFont' ? resolved.heading.latin : resolved.body.latin);
    assert.notEqual(theirs.script('Viet'), ours.latin, `a deck without the language keeps the vendored ${tag} Viet entry`);
    const strip = block => block.replace(/<a:font script="Viet" typeface="[^"]*"\/>/, '').replace(/<a:(?:latin|ea|cs) typeface="[^"]*"\/>/g, '');
    assert.equal(strip(ours.block), strip(theirs.block), `vietnamese ${tag}: the other per-script entries are unchanged`);
  }
  // Every theme part (the slide master's and the notes master's own theme) carries the rule.
  for (const [name, part] of Object.entries(xml).filter(([name]) => /^ppt\/theme\/theme\d+\.xml$/.test(name))) {
    assert.ok(!/<a:font script="Viet" typeface="(?:Arial|Times New Roman)"\/>/.test(part), `${name} keeps no Office Viet default`);
  }
  // A Latin deck in another language is unchanged.
  assert.equal(themeFonts((await read(deck('fr'))).xml, 'minorFont').script('Viet'), themeFonts(vendored, 'minorFont').script('Viet'));
  // Uyghur (outside core's language table; a language object): Arabic script, so core names the Arab supplement when the deck
  // selects a complex-script font, and the Uigh entry PowerPoint applies to ug-CN runs takes that same family; with no
  // complex-script font selected, Uigh takes the latin family. Arab follows core's rule as before. The font scheme is a
  // reference to the gallery snapshot, which the host registers.
  const catalogs = [defaultCatalog];
  const uyghur = fontScheme => ({language: {bcp47: 'ug-Arab', name: 'Uyghur', ooxmlLang: 'ug-CN', script: 'Arab', direction: 'rtl', ...(fontScheme ? {fontScheme} : {})}, name: 'Uyghur', slides: [{title: 'ئۇيغۇرچە', text: 'Uyghur'}]});
  for (const [fontScheme, expect] of [['arabic-typesetting', {major: 'Arabic Typesetting', minor: 'Arabic Typesetting', arab: true}], [undefined, {major: 'Aptos Display', minor: 'Aptos', arab: false}]]) {
    const presentation = uyghur(fontScheme), resolved = resolveScriptFonts(presentation, {catalogs});
    assert.equal(resolved.lang, 'ug-CN');
    const {xml: ug} = await read(presentation, {catalogs});
    const [major, minor] = [themeFonts(ug, 'majorFont'), themeFonts(ug, 'minorFont')];
    assert.deepEqual([major.script('Uigh'), minor.script('Uigh')], [expect.major, expect.minor], `uyghur (${fontScheme ?? 'no script font'}) Uigh`);
    if (expect.arab) assert.deepEqual([major.script('Arab'), minor.script('Arab')], [expect.major, expect.minor], 'uyghur keeps core\'s Arab supplement');
    else assert.deepEqual([major.script('Arab'), minor.script('Arab')], [themeFonts(vendored, 'majorFont').script('Arab'), themeFonts(vendored, 'minorFont').script('Arab')], 'uyghur without a script font keeps the vendored Arab entry');
  }
  // Every other language keeps the vendored Viet and Uigh entries (Arabic changes only its own Arab entry).
  for (const id of ['en-US', 'fr', 'ar', 'ja']) {
    const {xml: other} = await read(deck(id));
    for (const tag of ['majorFont', 'minorFont']) for (const script of ['Viet', 'Uigh']) assert.equal(themeFonts(other, tag).script(script), themeFonts(vendored, tag).script(script), `${id} ${tag} ${script} stays vendored`);
  }
}

// Deterministic: the same document exports the same bytes.
assert.deepEqual((await read(deck('ja'))).bytes, (await read(deck('ja'))).bytes);

console.log(`Script fonts passed: ${cases.length} languages across Latin, Cyrillic, Greek, CJK (ja/zh-Hans/zh-Hant/ko), Arabic/Hebrew RTL, Indic and Thai; lang, rtl, theme and run ea/cs, supplements, import and diagnostics.`);
