import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {catalogs, validatePresentation} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';

// FF-24 (font-fidelity-everywhere): the exported theme carries the deck color
// scheme, document slot/role references become a:schemeClr where the deck theme
// holds exactly that color, and fromPptx recovers design.colorScheme (and a
// catalog design.theme when the package corroborates it).

const THEME = 'ppt/theme/theme1.xml';
const SLOTS = [['dark1', 'dk1'], ['light1', 'lt1'], ['dark2', 'dk2'], ['light2', 'lt2'], ['accent1', 'accent1'], ['accent2', 'accent2'], ['accent3', 'accent3'], ['accent4', 'accent4'], ['accent5', 'accent5'], ['accent6', 'accent6'], ['hyperlink', 'hlink'], ['followedHyperlink', 'folHlink']];
const CONTENT = {tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2'};
const hex = value => value.replace(/^#/, '').toUpperCase();
const parts = bytes => unzipSync(new Uint8Array(bytes));
const themeOf = entries => {
  const xml = strFromU8(entries[THEME]);
  assert.equal(XMLValidator.validate(xml), true, 'theme XML');
  const colors = {};
  for (const [, element] of SLOTS) colors[element] = xml.match(new RegExp(`<a:${element}><a:srgbClr val="([0-9A-F]{6})"/></a:${element}>`))?.[1];
  return {xml, colors, name: xml.match(/<a:theme\b[^>]*\bname="([^"]*)"/)[1], schemeName: xml.match(/<a:clrScheme name="([^"]*)"/)[1],
    family: xml.match(/<thm15:themeFamily\b[^>]*\bname="([^"]*)"/)?.[1]};
};
const slideXml = (entries, index = 1) => {
  const xml = strFromU8(entries[`ppt/slides/slide${index}.xml`]);
  assert.equal(XMLValidator.validate(xml), true, 'slide XML');
  return xml;
};
const runFill = (xml, text) => {
  const run = [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(m => m[1]).find(body => body.includes(`<a:t>${text}</a:t>`));
  assert.ok(run, `run ${text}`);
  return run.match(/<a:solidFill>(<a:(?:srgbClr|schemeClr) val="[^"]+"\s*\/>)/)?.[1];
};
const resolve = (fill, colors) => {
  const scheme = fill.match(/schemeClr val="([^"]+)"/)?.[1];
  return scheme ? colors[CONTENT[scheme] ?? scheme] : fill.match(/srgbClr val="([^"]+)"/)[1];
};
const importWith = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {onDiagnostic: d => diagnostics.push(d)});
  assert.equal(validatePresentation(document).valid, true);
  return {document, diagnostics, theme: diagnostics.filter(d => d.path?.startsWith('design.'))};
};

// 1. Every catalog color scheme writes all twelve slots and its name, and comes back as its id.
for (const record of catalogs.colorSchemes) {
  const bytes = await toPptx({name: record.id, design: {colorScheme: record.id}, slides: [{title: 'Scheme'}]});
  const theme = themeOf(parts(bytes));
  for (const [slot, element] of SLOTS) assert.equal(theme.colors[element], hex(record[slot]), `${record.id} ${slot}`);
  assert.equal(theme.schemeName, record.name.replace('&', '&amp;'));
  assert.equal(theme.name, 'Office Theme', 'no explicit theme keeps the vendored theme name');
  const {document, theme: reports} = await importWith(bytes);
  assert.equal(document.design.colorScheme, record.id);
  assert.equal(document.design.theme, undefined);
  assert.deepEqual(reports, []);
}

// 2. Catalog themes: name the theme, write its scheme, recover both ids.
for (const record of catalogs.themes) {
  const bytes = await toPptx({name: record.id, design: {theme: record.id}, slides: [{title: 'Theme'}]});
  const entries = parts(bytes), theme = themeOf(entries);
  const scheme = catalogs.colorSchemes.find(item => item.id === record.colorScheme);
  assert.equal(theme.name, record.name);
  assert.equal(theme.family, record.name, 'thm15 theme family follows the theme name');
  assert.equal(theme.schemeName, scheme.name.replace('&', '&amp;'));
  for (const [slot, element] of SLOTS) assert.equal(theme.colors[element], hex(scheme[slot]));
  // The theme background slot is a native theme reference that resolves to the same color.
  const slot = record.background.slot;
  const background = slideXml(entries).match(/<p:bg><p:bgPr><a:solidFill>(<a:schemeClr val="[^"]+"\/>)<\/a:solidFill>/)?.[1];
  assert.ok(background, `${record.id} background is a scheme color`);
  assert.equal(resolve(background, theme.colors), hex(scheme[slot]));
  const {document, theme: reports} = await importWith(bytes);
  assert.equal(document.design.theme, record.id);
  assert.equal(document.design.colorScheme, record.colorScheme);
  assert.deepEqual(reports, []);
  // The recovered design exports the same theme part.
  assert.equal(themeOf(parts(await toPptx(document))).xml, theme.xml, `${record.id} theme part round-trips`);
}

// 3. Scheme references only where the document names a slot or role that the deck theme holds.
const forest = catalogs.colorSchemes.find(record => record.id === 'forest-green');
const boost = catalogs.colorSchemes.find(record => record.id === 'boost');
const deck = {
  name: 'References',
  design: {theme: 'classic', colorScheme: 'forest-green'},
  variables: {risk: '#B42318'},
  slides: [
    {title: 'Runs', text: [
      {text: 'slot', color: 'accent2'}, ' ', {text: 'role', color: 'primary'}, ' ',
      {text: 'literal', color: '#4A7C59'}, ' ', {text: 'variable', color: 'var:risk'}, ' ',
      {text: 'link', color: 'hyperlink'}, ' ', {text: 'secondary', color: 'textSecondary'},
    ]},
    {title: 'Override', design: {colorScheme: 'boost'}, text: [{text: 'other', color: 'accent2'}, ' ', {text: 'shared', color: 'dark1'}]},
    {title: 'Solid', design: {background: {type: 'solid', color: '#FFFFFF'}}, text: 'Literal background'},
  ],
};
const refs = parts(await toPptx(deck));
const {colors} = themeOf(refs);
const first = slideXml(refs, 1);
assert.equal(runFill(first, 'slot'), '<a:schemeClr val="accent2"/>');
assert.equal(runFill(first, 'role'), '<a:schemeClr val="accent1"/>', 'primary maps to accent1');
assert.equal(runFill(first, 'secondary'), '<a:schemeClr val="tx2"/>', 'textSecondary on a light background is dark2');
assert.equal(runFill(first, 'literal'), '<a:srgbClr val="4A7C59"/>', 'literal hex stays literal even when it equals accent1');
assert.equal(runFill(first, 'variable'), '<a:srgbClr val="B42318"/>');
// PptxGenJS 4.0.1 cannot emit hlink/folHlink run colors, so those stay literal.
assert.equal(runFill(first, 'link'), `<a:srgbClr val="${hex(forest.hyperlink)}"/>`);
for (const text of ['slot', 'role', 'secondary']) assert.equal(resolve(runFill(first, text), colors), {slot: hex(forest.accent2), role: hex(forest.accent1), secondary: hex(forest.dark2)}[text]);
assert.match(first, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"\/><\/a:solidFill>/, 'classic background slot light1');
// A slide-level scheme differs from the deck theme: its colors stay literal and correct.
const second = slideXml(refs, 2);
assert.equal(runFill(second, 'other'), `<a:srgbClr val="${hex(boost.accent2)}"/>`);
assert.equal(runFill(second, 'shared'), '<a:schemeClr val="tx1"/>', 'a slot equal in both schemes is still the deck theme color');
assert.match(slideXml(refs, 3), /<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"(?:\/>|><\/a:srgbClr>)<\/a:solidFill>/, 'explicit solid backgrounds stay literal');

// 4. Inline overrides come back relative to the named catalog scheme.
const override = await importWith(await toPptx({design: {colorScheme: {id: 'boost', accent1: '#123456'}}, slides: [{title: 'Override'}]}));
assert.deepEqual(override.document.design.colorScheme, {id: 'boost', accent1: '#123456'});
assert.deepEqual(override.theme, []);

// 5. Foreign and damaged themes.
const base = parts(await toPptx({slides: [{title: 'Base'}]}));
const withTheme = change => {
  const entries = {...base};
  entries[THEME] = strToU8(change(strFromU8(base[THEME])));
  return zipSync(entries);
};
const office = {dk1: '<a:sysClr val="windowText" lastClr="000000"/>', lt1: '<a:sysClr val="window" lastClr="FFFFFF"/>', dk2: '<a:srgbClr val="44546A"/>', lt2: '<a:srgbClr val="E7E6E6"/>', accent1: '<a:srgbClr val="4472C4"/>', accent2: '<a:srgbClr val="ED7D31"/>', accent3: '<a:srgbClr val="A5A5A5"/>', accent4: '<a:srgbClr val="FFC000"/>', accent5: '<a:srgbClr val="5B9BD5"/>', accent6: '<a:srgbClr val="70AD47"/>', hlink: '<a:srgbClr val="0563C1"/>', folHlink: '<a:srgbClr val="954F72"/>'};
const officeScheme = xml => xml.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, `<a:clrScheme name="Office">${Object.entries(office).map(([element, color]) => `<a:${element}>${color}</a:${element}>`).join('')}</a:clrScheme>`);
const foreign = await importWith(withTheme(officeScheme));
assert.deepEqual(foreign.document.design.colorScheme, {dark1: '#000000', light1: '#FFFFFF', dark2: '#44546A', light2: '#E7E6E6', accent1: '#4472C4', accent2: '#ED7D31', accent3: '#A5A5A5', accent4: '#FFC000', accent5: '#5B9BD5', accent6: '#70AD47', hyperlink: '#0563C1', followedHyperlink: '#954F72'}, 'unknown schemes import as inline slots');
assert.deepEqual(foreign.theme, []);
const unreadable = await importWith(withTheme(xml => xml.replace(/<a:accent4>[\s\S]*?<\/a:accent4>/, '<a:accent4><a:schemeClr val="accent1"/></a:accent4>')));
assert.deepEqual(unreadable.theme.map(d => [d.code, d.path]), [['unsupported-theme-colors', 'design.colorScheme']]);
assert.match(unreadable.theme[0].message, /accent4/);
assert.deepEqual(unreadable.document.design.colorScheme, {id: 'cool-horizon'}, 'readable slots equal to the named scheme add no overrides');
const missing = await importWith((() => {const entries = {...base}; delete entries[THEME]; return zipSync(entries);})());
assert.equal(missing.document.design.colorScheme, undefined);
assert.deepEqual(missing.theme.map(d => d.code), ['unsupported-theme-colors']);
// A foreign theme that only shares a catalog theme's name is not bound to it.
const namedBold = await importWith(withTheme(xml => officeScheme(xml).replace(/(<a:theme\b[^>]*\bname=")[^"]*/, '$1Bold')));
assert.equal(namedBold.document.design.theme, undefined);
assert.deepEqual(namedBold.theme.map(d => [d.code, d.path]), [['theme-unverified', 'design.theme']]);

// 6. No design: engine defaults write cool-horizon and keep the vendored theme name.
const defaults = themeOf(base);
assert.equal(defaults.schemeName, 'Cool Horizon');
assert.equal(defaults.name, 'Office Theme');
assert.equal((await importWith(zipSync(base))).document.design.colorScheme, 'cool-horizon');

console.log(JSON.stringify({test: 'theme-colors', passed: true, colorSchemes: catalogs.colorSchemes.length, themes: catalogs.themes.length}));
