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
// FF-24c: PptxGenJS 4.0.1 cannot emit hlink/folHlink, so a reserved literal is rewritten in the slide part.
assert.equal(runFill(first, 'link'), '<a:schemeClr val="hlink"/>');
assert.equal(resolve(runFill(first, 'link'), colors), hex(forest.hyperlink));
for (const text of ['slot', 'role', 'secondary']) assert.equal(resolve(runFill(first, text), colors), {slot: hex(forest.accent2), role: hex(forest.accent1), secondary: hex(forest.dark2)}[text]);
assert.match(first, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"\/><\/a:solidFill>/, 'classic background slot light1');
// Default text on a theme background follows the theme: tx1 on the light1 (bg1) background.
assert.equal(runFill(first, 'Runs'), '<a:schemeClr val="tx1"/>', 'default heading text pairs with the bg1 background');
assert.equal(resolve(runFill(first, 'Runs'), colors), hex(forest.dark1));
// FF-24b: a slide with its own color scheme is pinned to literal colors, even
// where a value coincides with the deck theme (boost and forest-green share dark1
// and light1), so a PowerPoint theme edit never partially recolors it.
const second = slideXml(refs, 2);
assert.equal(runFill(second, 'other'), `<a:srgbClr val="${hex(boost.accent2)}"/>`);
assert.equal(runFill(second, 'shared'), `<a:srgbClr val="${hex(boost.dark1)}"/>`, 'a coinciding slot stays literal on an override slide');
assert.equal(runFill(second, 'Override'), `<a:srgbClr val="${hex(boost.dark1)}"/>`, 'default text stays literal on an override slide');
assert.match(second, /<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"(?:\/>|><\/a:srgbClr>)<\/a:solidFill>/, 'override slide background stays literal');
assert.doesNotMatch(second, /<a:schemeClr/, 'no scheme reference at all on an override slide');
// A literal background keeps literal default text.
const third = slideXml(refs, 3);
assert.match(third, /<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"(?:\/>|><\/a:srgbClr>)<\/a:solidFill>/, 'explicit solid backgrounds stay literal');
assert.equal(runFill(third, 'Solid'), `<a:srgbClr val="${hex(forest.dark1)}"/>`, 'text on a literal background stays literal');
// Even an override slide whose scheme equals the deck scheme stays literal.
const sameOverride = slideXml(parts(await toPptx({design: {colorScheme: 'forest-green'}, slides: [{title: 'Same', design: {colorScheme: 'forest-green'}, text: [{text: 'pinned', color: 'accent2'}]}]})));
assert.doesNotMatch(sameOverride, /<a:schemeClr/);

// FF-24b: default text pairs only with an opaque light/dark theme background, and
// only where the resolved default color is exactly the paired deck slot.
const pairing = async (design, slide = {title: 'Pair', text: 'Body', items: [{text: 'Item', description: 'Muted'}]}) => {
  const entries = parts(await toPptx({design, slides: [slide]}));
  return {xml: slideXml(entries), colors: themeOf(entries).colors, entries};
};
const cool = catalogs.colorSchemes.find(record => record.id === 'cool-horizon');
const minimal = await pairing({theme: 'minimal'});
assert.match(minimal.xml, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="tx2"\/>/, 'minimal background is dark2 (tx2)');
assert.equal(runFill(minimal.xml, 'Pair'), '<a:schemeClr val="bg1"/>', 'light1 text on a dark2 background');
assert.equal(runFill(minimal.xml, 'Body'), '<a:schemeClr val="bg1"/>');
assert.equal(runFill(minimal.xml, 'Muted'), '<a:schemeClr val="bg2"/>', 'muted text is light2 on a dark background');
assert.equal(resolve(runFill(minimal.xml, 'Muted'), minimal.colors), hex(cool.light2));
assert.match(minimal.xml, /<a:buClr><a:schemeClr val="bg1"\/><\/a:buClr>/, 'list markers follow the default text');
const dark = await pairing({theme: 'dark'});
assert.match(dark.xml, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="tx1"\/>/);
assert.equal(runFill(dark.xml, 'Pair'), '<a:schemeClr val="bg1"/>');
const classic = await pairing({theme: 'classic'});
assert.equal(runFill(classic.xml, 'Pair'), '<a:schemeClr val="tx1"/>');
assert.equal(runFill(classic.xml, 'Muted'), '<a:schemeClr val="tx2"/>');
// A text role that differs from dark1 is not the paired slot: literal.
const role = await pairing({theme: 'classic', colorScheme: {id: 'cool-horizon', text: '#333333'}});
assert.equal(runFill(role.xml, 'Pair'), '<a:srgbClr val="333333"/>');
// Translucent theme background: the backdrop is not the theme slot alone.
const translucent = await pairing({theme: 'classic', background: {type: 'theme', slot: 'light1', opacity: .5}});
assert.equal(runFill(translucent.xml, 'Pair'), `<a:srgbClr val="${hex(cool.dark1)}"/>`);
// Theme backgrounds are limited to light1/light2/dark1/dark2 by the schema, so every
// theme background has a semantic text pair.
// Card text sits on a literal card fill and stays literal.
const card = await pairing({theme: 'minimal', contentBox: true}, {title: 'Cards', composition: {mode: 'row'}, blocks: [{text: 'Inside card'}, {text: 'Second'}]});
assert.ok(card.xml.includes('name="OPF card'), 'cards exported');
assert.equal(runFill(card.xml, 'Cards'), '<a:schemeClr val="bg1"/>', 'the heading outside the card still pairs');
assert.equal(runFill(card.xml, 'Inside card'), `<a:srgbClr val="${hex(cool.light1)}"/>`, 'card text stays literal');
// Table cell text follows the theme with its theme-referenced fill (FF-24c); see test/table-theme-colors.mjs.
const table = await pairing({theme: 'classic'}, {title: 'Table', table: {columns: ['A'], rows: [['cell']]}});
assert.equal(runFill(table.xml, 'cell'), '<a:schemeClr val="tx1"/>', 'default cell text pairs with the bg2 surface fill');

// FF-24b: the slide master follows a non-bg1 theme background, with paired
// default text, so slides added in PowerPoint match. The layout inherits it.
const masterOf = entries => strFromU8(entries['ppt/slideMasters/slideMaster1.xml']);
const layoutOf = entries => strFromU8(entries['ppt/slideLayouts/slideLayout1.xml']);
for (const [result, background, text] of [[dark, 'tx1', 'bg1'], [minimal, 'tx2', 'bg1']]) {
  const master = masterOf(result.entries);
  assert.equal(XMLValidator.validate(master), true);
  assert.match(master, new RegExp(`<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>`));
  const styles = master.match(/<p:txStyles>[\s\S]*<\/p:txStyles>/)[0];
  assert.doesNotMatch(styles, /schemeClr val="tx1"/);
  const vendorStyles = masterOf(classic.entries).match(/<p:txStyles>[\s\S]*<\/p:txStyles>/)[0];
  assert.equal(styles, vendorStyles.split('<a:schemeClr val="tx1"/>').join(`<a:schemeClr val="${text}"/>`), 'every title, body and other level uses the paired text; nothing else changes');
  assert.doesNotMatch(layoutOf(result.entries), /<p:bg>/, 'layout inherits the master background');
}
const vendorMaster = masterOf(classic.entries);
assert.doesNotMatch(vendorMaster, /<p:bg>/, 'a light1 deck keeps the vendored master');
assert.match(layoutOf(classic.entries), /<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"\/><\/p:bgRef><\/p:bg>/);
// Imported slides keep their own backgrounds; the master background does not leak.
const darkImport = await importWith(zipSync(dark.entries));
assert.equal(darkImport.document.design.theme, 'dark');
assert.equal((darkImport.document.slides[0].design ?? darkImport.document.design).background, undefined, "the master background does not leak into the import");

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
