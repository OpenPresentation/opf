import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import * as opfCore from '@openpresentation/opf';
import {examples} from '@openpresentation/opf/examples';
import {resolveFontFamilies} from '@openpresentation/opf/composition';
import {writeWorkbookFonts} from '../src/package-fonts.js';
import {toPptx, checkPptxTypefaces, inventoryPptxTypefaces, THEME_SCRIPT_SUPPLEMENTS} from '../src/index.js';

// FF-08 (font-fidelity-everywhere): the exported package names only the fonts
// the document chose. checkPptxTypefaces walks every XML part, including the
// embedded chart workbooks, and allows chosen fonts, theme references that
// resolve to them, empty theme ea/cs slots (FF-05) and the documented theme
// script supplements.

const vendor = await readFile(new URL('../vendor/pptxgenjs/pptxgen.es.js', import.meta.url), 'utf8');
const count = (source, needle) => source.split(needle).length - 1;
// Vendor-shape guards: these are the hard-coded defaults the export rewrites.
// A vendor update that changes them must revisit src/package-fonts.js.
assert.equal(count(vendor, "dataLabelFontFace || 'Arial'"), 5, 'chart data-label Arial fallbacks');
assert.equal(count(vendor, '<a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Arial"/>'), 1, 'pie data-label Arial');
assert.equal(count(vendor, '<a:cs    typeface="\' + rel.opts.legendFontFace'), 1, 'legend writes latin/cs only');
assert.match(vendor, /<vt:lpstr>Arial<\/vt:lpstr>\s*<vt:lpstr>Calibri<\/vt:lpstr>/, 'app.xml fixed fonts');
assert.match(vendor, /<name val="Geneva"\/>/, 'workbook styles font');
assert.match(vendor, /<a:latin typeface="Calibri Light" panose="020F0302020204030204"\/>/, 'workbook theme font');

const parts = bytes => unzipSync(new Uint8Array(bytes));
const text = (entries, name) => strFromU8(entries[name]);
const names = (entries, pattern) => Object.keys(entries).filter(name => pattern.test(name)).sort();
const repack = (bytes, edit) => { const entries = parts(bytes); edit(entries); return zipSync(entries, {level: 0}); };
const replacePart = (entries, name, from, to) => {
  const before = text(entries, name), after = before.replace(from, to);
  assert.notEqual(after, before, `mutation did not apply to ${name}`);
  entries[name] = strToU8(after);
};
const reasons = result => result.violations.map(violation => violation.reason);
const fontsUsed = entries => {
  const xml = text(entries, 'docProps/app.xml');
  const pairs = [...xml.match(/<HeadingPairs>[\s\S]*<\/HeadingPairs>/)[0].matchAll(/<vt:(?:lpstr|i4)>([^<]*)</g)].map(match => match[1]);
  const titles = [...xml.match(/<TitlesOfParts>[\s\S]*<\/TitlesOfParts>/)[0].matchAll(/<vt:lpstr>([^<]*)</g)].map(match => match[1]);
  assert.equal(pairs[0], 'Fonts Used');
  return titles.slice(0, Number(pairs[1]));
};

// The documented supplements are exactly the vendored theme's script list.
const plain = parts(await toPptx({slides: [{title: 'Plain', text: 'Body'}]}, {strictAssets: true}));
const theme = text(plain, 'ppt/theme/theme1.xml');
for (const role of ['major', 'minor']) {
  const block = theme.match(new RegExp(`<a:${role}Font>[\\s\\S]*?</a:${role}Font>`))[0];
  const listed = Object.fromEntries([...block.matchAll(/<a:font script="([^"]*)" typeface="([^"]*)"\/>/g)].map(match => [match[1], match[2]]));
  assert.deepEqual(listed, {...THEME_SCRIPT_SUPPLEMENTS[role]}, `${role} script supplements`);
}
assert.deepEqual(fontsUsed(plain), ['Aptos', 'Aptos Display']);
assert.ok(checkPptxTypefaces(plain, {fonts: ['Aptos', 'Aptos Display']}).ok);

// Chart deck: every chart family, a code slide, a table, notes and a per-slide
// serif override that carries its own chart.
const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 4, 6], ['Q2', 7, 5], ['Q3', 9, 8]]};
const chartSlides = ['bar', 'column', 'line', 'area', 'pie', 'doughnut', 'scatter'].map(type => ({title: `${type} chart`, chart: {type, data}, notes: 'Speaker notes'}));
const deck = {name: 'Charts', design: {fontScheme: 'consolas'}, slides: [
  ...chartSlides,
  {title: 'Code', layout: 'code-1x', code: {source: 'const score = urgency * confidence;', language: 'ts'}},
  {title: 'Table', table: {columns: ['Name', 'Value'], rows: [['A', '1'], ['B', '2']]}},
  {title: 'Serif override', design: {fontScheme: 'georgia'}, chart: {type: 'bar', data}},
]};
const {catalogs} = opfCore;
const consolas = resolveFontFamilies(catalogs.fontSchemes.find(record => record.id === 'consolas'));
const georgia = resolveFontFamilies(catalogs.fontSchemes.find(record => record.id === 'georgia'));
const chosen = [...new Set([...Object.values(consolas), ...Object.values(georgia)])];
const monospace = [consolas.heading, consolas.body, consolas.code, georgia.code];
const bytes = await toPptx(deck, {strictAssets: true});
const entries = parts(bytes);
assert.equal(Buffer.compare(Buffer.from(bytes), Buffer.from(await toPptx(deck, {strictAssets: true}))), 0, 'byte-deterministic');

const result = checkPptxTypefaces(bytes, {fonts: chosen, monospace});
assert.deepEqual(result.violations, []);
const charts = names(entries, /^ppt\/charts\/chart\d+\.xml$/);
const workbooks = names(entries, /^ppt\/embeddings\/.*\.xlsx$/);
assert.equal(charts.length, chartSlides.length + 1);
assert.equal(workbooks.length, charts.length);
const chartFamily = new Map();
for (const chart of charts) {
  const xml = text(entries, chart);
  assert.equal(XMLValidator.validate(xml), true, chart);
  assert.doesNotMatch(xml, /Arial|\+mn-|\+mj-/, `${chart} names no default or theme font`);
  // Every text property element names the chart font in latin, ea and cs.
  const properties = [...xml.matchAll(/<a:(defRPr|rPr)\b[^>]*?(?:\/>|>([\s\S]*?)<\/a:\1>)/g)];
  assert.ok(properties.length > 0, chart);
  const families = new Set();
  for (const [node, , body = ''] of properties) {
    const slots = [...body.matchAll(/<a:(latin|ea|cs) typeface="([^"]*)"\/>/g)];
    assert.deepEqual(slots.map(slot => slot[1]), ['latin', 'ea', 'cs'], node);
    for (const slot of slots) families.add(slot[2]);
  }
  assert.equal(families.size, 1, chart);
  chartFamily.set(chart, [...families][0]);
}
// Frame order follows slides: the last chart belongs to the Georgia slide.
assert.deepEqual(new Set(chartFamily.values()), new Set([consolas.body, georgia.body]));
assert.equal([...chartFamily.values()].filter(family => family === georgia.body).length, 1);
for (const workbook of workbooks) {
  const nested = unzipSync(entries[workbook]);
  for (const name of names(nested, /\.xml$/)) assert.equal(XMLValidator.validate(text(nested, name)), true, `${workbook}!/${name}`);
  const styles = text(nested, 'xl/styles.xml'), workbookTheme = text(nested, 'xl/theme/theme1.xml');
  const faces = new Set([...styles.matchAll(/<name val="([^"]*)"\/>/g)].map(match => match[1]));
  assert.equal(faces.size, 1, workbook);
  assert.ok([consolas.body, georgia.body].includes([...faces][0]));
  assert.doesNotMatch(workbookTheme, /<a:font script=|Calibri|panose/, workbook);
  assert.match(workbookTheme, /<a:minorFont><a:latin typeface="[^"]+"\/><a:ea typeface=""\/><a:cs typeface=""\/><\/a:minorFont>/);
}
// "Fonts Used" is the package's own font list: theme plus explicit runs.
assert.deepEqual(fontsUsed(entries), result.fontsUsed);
assert.ok(!fontsUsed(entries).includes('Arial') && !fontsUsed(entries).includes('Calibri'));
assert.ok(fontsUsed(entries).includes(consolas.body) && fontsUsed(entries).includes(georgia.body));
// pitchFamily follows the catalog type: fixed for monospace, roman for serif.
const pitches = new Map();
for (const entry of result.inventory.typefaces) if (entry.pitchFamily !== undefined) pitches.set(entry.typeface, new Set([...(pitches.get(entry.typeface) ?? []), entry.pitchFamily]));
assert.deepEqual([...pitches.get(consolas.body)], [49]);
assert.deepEqual([...pitches.get(georgia.body)], [18]);
if (pitches.has(consolas.code)) assert.deepEqual([...pitches.get(consolas.code)], [49]);
const aptos = parts(await toPptx({slides: [{title: 'Rule', layout: 'code-1x', code: {source: 'let x = 1;', language: 'ts'}}]}, {strictAssets: true}));
const aptosCheck = checkPptxTypefaces(aptos, {fonts: ['Aptos', 'Aptos Display', 'Roboto Mono'], monospace: ['Roboto Mono']});
assert.deepEqual(aptosCheck.violations, []);
assert.ok(aptosCheck.inventory.typefaces.some(entry => entry.typeface === 'Aptos Display' && entry.pitchFamily === 34));
assert.ok(aptosCheck.inventory.typefaces.some(entry => entry.typeface === 'Roboto Mono' && entry.pitchFamily === 49));

// Workbook fonts outside <fonts> (differential formats, rich-text runs) are rewritten too.
{
  const styles = '<styleSheet><fonts count="1"><font><name val="Geneva"/></font></fonts><dxfs count="1"><dxf><font><b/><name val="Arial"/></font></dxf></dxfs></styleSheet>';
  const strings = '<sst><si><r><rPr><rFont val="Calibri"/></rPr><t>x</t></r></si></sst>';
  const rewritten = unzipSync(writeWorkbookFonts(zipSync({'xl/styles.xml': strToU8(styles), 'xl/sharedStrings.xml': strToU8(strings)}), {heading: 'Georgia', body: 'Georgia'}));
  assert.equal(text(rewritten, 'xl/styles.xml'), styles.replace('Geneva', 'Georgia').replace('Arial', 'Georgia'));
  assert.equal(text(rewritten, 'xl/sharedStrings.xml'), strings.replace('Calibri', 'Georgia'));
}

// Negative controls: each leak class is detected, including nested parts.
const firstChart = charts[0], firstWorkbook = workbooks[0];
const control = (edit, options = {}) => reasons(checkPptxTypefaces(repack(bytes, edit), {fonts: chosen, monospace, ...options}));
assert.ok(control(e => replacePart(e, firstChart, /<a:latin typeface="[^"]*"\/>/, '<a:latin typeface="Arial"/>')).includes('foreign-typeface'));
assert.ok(control(e => { const nested = unzipSync(e[firstWorkbook]); replacePart(nested, 'xl/styles.xml', /<name val="[^"]*"\/>/, '<name val="Geneva"/>'); e[firstWorkbook] = zipSync(nested); })
  .includes('foreign-typeface'));
assert.ok(control(e => replacePart(e, 'docProps/app.xml', `<vt:lpstr>${georgia.body}</vt:lpstr>`, `<vt:lpstr>${consolas.body}</vt:lpstr>`)).includes('fonts-used-mismatch'));
assert.ok(control(e => replacePart(e, 'docProps/app.xml', /(<TitlesOfParts><vt:vector size="\d+" baseType="lpstr">)/, '$1<vt:lpstr>Calibri</vt:lpstr>')).includes('foreign-fonts-used'));
assert.ok(control(e => replacePart(e, 'ppt/theme/theme1.xml', '<a:font script="Jpan" typeface="游ゴシック"/>', '<a:font script="Jpan" typeface="MS Gothic"/>')).includes('foreign-script-supplement'));
assert.ok(control(e => replacePart(e, 'ppt/theme/theme1.xml', /<a:minorFont><a:latin typeface="[^"]*"/, '<a:minorFont><a:latin typeface="Calibri"')).includes('foreign-theme-reference'));
assert.ok(control(e => replacePart(e, 'ppt/slides/slide8.xml', /pitchFamily="49"/g, 'pitchFamily="34"')).includes('monospace-not-fixed-pitch'));
assert.ok(control(() => {}, {allowEmptyThemeScripts: false}).includes('empty-typeface'), 'FF-05 empty theme ea/cs is an explicit allowance');
assert.throws(() => checkPptxTypefaces(bytes, {}), TypeError);

// Corpus: every example deck, with the fonts its design and runs choose.
const records = (presentation, kind) => [...[presentation.catalogs?.[kind]?.records ?? presentation.catalogs?.[kind] ?? []].flat(), ...catalogs[kind]];
const id = reference => typeof reference === 'string' ? reference : reference?.id;
const designFonts = (presentation, design) => {
  const themeRecord = records(presentation, 'themes').find(record => record.id === (id(design.theme) ?? 'minimal'));
  const reference = design.fontScheme ?? themeRecord?.fontScheme;
  const schemes = records(presentation, 'fontSchemes');
  const base = schemes.find(record => record.id === (id(reference) ?? 'aptos')) ?? schemes.find(record => record.id === 'aptos');
  const scheme = {...base, ...(reference && typeof reference === 'object' ? reference : {})};
  return {...resolveFontFamilies(scheme), mono: scheme.type === 'monospace' ? [scheme.major, scheme.minor] : []};
};
// FF-07 writes the language's script fonts (theme and run ea/cs and the language's
// own theme supplement) through core resolveScriptFonts(). With a core that has
// the resolver, those resolved families are chosen fonts too; published cores
// without it export no script fonts, so nothing is added.
const scriptFonts = presentation => {
  if (typeof opfCore.resolveScriptFonts !== 'function') return [];
  return [undefined, ...presentation.slides.keys()].flatMap(slideIndex => {
    const resolved = opfCore.resolveScriptFonts(presentation, slideIndex === undefined ? {} : {slideIndex});
    const slots = [resolved.heading, resolved.body].flatMap(slot => [slot.latin, slot.eastAsian, slot.complexScript]);
    return [...slots, ...(resolved.supplement ? [resolved.supplement.heading, resolved.supplement.body] : [])].filter(Boolean);
  });
};
const runFamilies = value => !value || typeof value !== 'object' ? [] : Object.entries(value).flatMap(([key, child]) => key === 'fontFamily' && typeof child === 'string' ? [child] : runFamilies(child));
const corpus = {decks: 0, charts: 0, workbooks: 0, typefaces: 0, failures: []};
for (const {file, deck: example} of examples) {
  const roles = [example.design ?? {}, ...example.slides.map(slide => ({...example.design, ...slide.design}))].map(design => designFonts(example, design));
  const fonts = [...new Set([...roles.flatMap(role => [role.heading, role.body, role.code]), ...runFamilies(example.slides), ...scriptFonts(example)])];
  // A scheme's type describes its major/minor, not inline heading/body overrides.
  const mono = roles.flatMap(role => [...role.mono, role.code]);
  const exported = await toPptx(example, {imageResolver: async () => new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)))});
  const checked = checkPptxTypefaces(exported, {fonts, monospace: mono});
  corpus.decks++;
  corpus.typefaces += checked.inventory.typefaces.length;
  corpus.charts += checked.inventory.typefaces.filter(entry => /^ppt\/charts\/chart\d+\.xml$/.test(entry.part)).length ? 1 : 0;
  corpus.workbooks += new Set(checked.inventory.typefaces.filter(entry => entry.part.includes('.xlsx!/')).map(entry => entry.part.split('!/')[0])).size;
  if (!checked.ok) corpus.failures.push({file, fonts, violations: checked.violations.slice(0, 5)});
}
assert.equal(corpus.decks, examples.length);
assert.deepEqual(corpus.failures, [], JSON.stringify(corpus.failures, null, 1));
assert.ok(corpus.workbooks > 0, 'the corpus exercises embedded chart workbooks');
assert.equal(typeof inventoryPptxTypefaces, 'function');

console.log(JSON.stringify({test: 'typeface-inventory', passed: true, charts: charts.length, corpus: {decks: corpus.decks, decksWithCharts: corpus.charts, workbooks: corpus.workbooks, typefaces: corpus.typefaces}}));
