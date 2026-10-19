import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx as exportPptx, fromPptx} from '../dist/index.js';

// FF-24 (font-fidelity-everywhere): the exported theme carries the deck color
// scheme, document slot/role references become a:schemeClr where the deck theme
// holds exactly that color, and fromPptx recovers design.colorScheme (and a
// catalog design.theme when the package corroborates it).
// OPF 0.15 (FA-23): the themes and colour schemes are the gallery snapshot's, which the host registers explicitly for
// export and import (`catalogs: [defaultCatalog]`). Recovery matches the first registered catalog: an exact match imports
// as its bare id; with no catalog registered the colour scheme imports as inline slots and no theme id is recovered.
const catalogs = [defaultCatalog];
const records = kind => Object.entries(defaultCatalog[kind]).map(([id, record]) => ({id, ...record}));
const colorSchemes = records('colorSchemes'), themes = records('themes');
const toPptx = (presentation, options = {}) => exportPptx(presentation, {catalogs, ...options});

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
  // A colour may be written self-closed or as an empty pair (`<a:schemeClr val="tx1"></a:schemeClr>`); both are the same colour.
  return run.match(/<a:solidFill>(<a:(?:srgbClr|schemeClr) val="[^"]+"\s*\/>)/)?.[1] ?? run.match(/<a:solidFill>(<a:(srgbClr|schemeClr) val="[^"]+")><\/a:\2>/)?.[1]?.concat('/>');
};
// RR-96: a content role (tx1, bg1, ...) resolves through the clrMap in force: the master's (a dark deck maps bg1 to a dark slot), or
// the default map when none is given.
const clrMapOf = entries => Object.fromEntries([...strFromU8(entries['ppt/slideMasters/slideMaster1.xml']).match(/<p:clrMap ([^>]*)\/>/)[1].matchAll(/(\w+)="(\w+)"/g)].map(m => [m[1], m[2]]));
const resolve = (fill, colors, clrMap = CONTENT) => {
  const scheme = fill.match(/schemeClr val="([^"]+)"/)?.[1];
  return scheme ? colors[clrMap[scheme] ?? scheme] : fill.match(/srgbClr val="([^"]+)"/)[1];
};
const importWith = async (bytes, options = {catalogs}) => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {...options, onDiagnostic: d => diagnostics.push(d)});
  assert.equal(validate(document, {only: ['format']}).valid, true);
  return {document, diagnostics, theme: diagnostics.filter(d => d.path?.startsWith('design.'))};
};

// 1. Every catalog color scheme writes all twelve slots and its name, and comes back as its id.
for (const record of colorSchemes) {
  const bytes = await toPptx({name: record.id, design: {colorScheme: record.id}, slides: [{title: 'Scheme'}]});
  const theme = themeOf(parts(bytes));
  for (const [slot, element] of SLOTS) assert.equal(theme.colors[element], hex(record[slot]), `${record.id} ${slot}`);
  assert.equal(theme.schemeName, record.name.replace('&', '&amp;'));
  assert.equal(theme.name, 'pptx.gallery', 'no explicit theme uses the generated gallery theme name');
  const {document, theme: reports} = await importWith(bytes);
  assert.equal(document.design.colorScheme, record.id);
  assert.equal(document.design.theme, undefined);
  assert.deepEqual(reports, []);
  // Without a registered catalog the same package imports the colours as inline slots (the stored FF-32 reference still
  // restores; without provenance nothing names the scheme).
  const unregistered = await importWith(await toPptx({name: record.id, design: {colorScheme: record.id}, slides: [{title: 'Scheme'}]}, {provenance: false}), {});
  assert.deepEqual(unregistered.document.design.colorScheme, Object.fromEntries(SLOTS.map(([slot]) => [slot, `#${hex(record[slot])}`])), `${record.id} imports inline without catalogs`);
}

// 2. Catalog themes: name the theme, write its scheme, recover both ids.
for (const record of themes) {
  const bytes = await toPptx({name: record.id, design: {theme: record.id}, slides: [{title: 'Theme'}]});
  const entries = parts(bytes), theme = themeOf(entries);
  const scheme = colorSchemes.find(item => item.id === record.colorScheme);
  assert.equal(theme.name, record.name);
  assert.equal(theme.family, record.name, 'thm15 theme family follows the theme name');
  assert.equal(theme.schemeName, scheme.name.replace('&', '&amp;'));
  for (const [slot, element] of SLOTS) assert.equal(theme.colors[element], hex(scheme[slot]));
  // The theme background slot is a native theme reference that resolves to the same color.
  const slot = record.background.slot;
  const background = slideXml(entries).match(/<p:bg><p:bgPr><a:solidFill>(<a:schemeClr val="[^"]+"\/>)<\/a:solidFill>/)?.[1];
  assert.ok(background, `${record.id} background is a scheme color`);
  assert.equal(resolve(background, theme.colors, clrMapOf(entries)), hex(scheme[slot]));
  const {document, theme: reports} = await importWith(bytes);
  assert.equal(document.design.theme, record.id);
  // RR-59: the colour scheme the theme brings was not authored, so the round trip leaves it absent.
  assert.equal(document.design.colorScheme, undefined, `${record.id}: the unstated colour scheme stays absent`);
  assert.deepEqual(reports, []);
  // FF-24 recovers both ids from a plain package (no provenance) with the catalog registered.
  const plain = await importWith(await toPptx({name: record.id, design: {theme: record.id}, slides: [{title: 'Theme'}]}, {provenance: false}));
  assert.equal(plain.document.design.theme, record.id);
  assert.equal(plain.document.design.colorScheme, record.colorScheme);
  assert.deepEqual(plain.theme, []);
  // The recovered design exports the same theme part.
  assert.equal(themeOf(parts(await toPptx(document))).xml, theme.xml, `${record.id} theme part round-trips`);
  // No registered catalog on import: no theme id is recovered from the name alone.
  const unregistered = await importWith(await toPptx({name: record.id, design: {theme: record.id}, slides: [{title: 'Theme'}]}, {provenance: false}), {});
  assert.equal(unregistered.document.design.theme, undefined, `${record.id}: no theme id without catalogs`);
}

// 3. Scheme references only where the document names a slot or role that the deck theme holds.
const forest = colorSchemes.find(record => record.id === 'forest-green');
const boost = colorSchemes.find(record => record.id === 'boost');
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
// RR-96: default text is the text role (tx1), which is the deck's dark1 here; only the authored background is a literal.
assert.equal(runFill(third, 'Solid'), '<a:schemeClr val="tx1"/>', 'default text on a literal background is the text role');
assert.equal(resolve(runFill(third, 'Solid'), colors), hex(forest.dark1));
// Even an override slide whose scheme equals the deck scheme stays literal.
const sameOverride = slideXml(parts(await toPptx({design: {colorScheme: 'forest-green'}, slides: [{title: 'Same', design: {colorScheme: 'forest-green'}, text: [{text: 'pinned', color: 'accent2'}]}]})));
assert.doesNotMatch(sameOverride, /<a:schemeClr/);

// FF-24b: default text pairs only with an opaque light/dark theme background, and
// only where the resolved default color is exactly the paired deck slot.
const pairing = async (design, slide = {title: 'Pair', text: 'Body', items: [{text: 'Item', description: 'Muted'}]}) => {
  const entries = parts(await toPptx({design, slides: [slide]}));
  return {xml: slideXml(entries), colors: themeOf(entries).colors, entries};
};
const cool = colorSchemes.find(record => record.id === 'cool-horizon');
const minimal = await pairing({theme: 'minimal'});
// RR-96: the slide background is always the bg1 role and default text the tx1 role; a dark theme background is carried by the
// master's clrMap (bg1 = the dark slot, tx1 = light1), not by a different scheme name per slide.
const minimalMap = clrMapOf(minimal.entries);
assert.match(minimal.xml, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"\/>/, 'minimal background is the bg1 role');
assert.equal(minimalMap.bg1, 'dk2', 'minimal background is dark2 through the clrMap');
assert.equal(minimalMap.tx1, 'lt1', 'text on a dark2 background is light1 through the clrMap');
assert.equal(runFill(minimal.xml, 'Pair'), '<a:schemeClr val="tx1"/>', 'light1 text on a dark2 background');
assert.equal(resolve(runFill(minimal.xml, 'Pair'), minimal.colors, minimalMap), hex(cool.light1));
assert.equal(runFill(minimal.xml, 'Body'), '<a:schemeClr val="tx1"/>');
assert.equal(runFill(minimal.xml, 'Muted'), '<a:schemeClr val="tx2"/>', 'muted text is the tx2 role, light2 on a dark background');
assert.equal(resolve(runFill(minimal.xml, 'Muted'), minimal.colors, minimalMap), hex(cool.light2));
assert.match(minimal.xml, /<a:buClr><a:schemeClr val="tx1"\/><\/a:buClr>/, 'list markers follow the default text');
const dark = await pairing({theme: 'classic', variant: 'dark1'});
assert.match(dark.xml, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"\/>/);
assert.equal(clrMapOf(dark.entries).bg1, 'dk1', 'a dark1 variant is dark1 through the clrMap');
assert.equal(runFill(dark.xml, 'Pair'), '<a:schemeClr val="tx1"/>');
const classic = await pairing({theme: 'classic'});
assert.equal(runFill(classic.xml, 'Pair'), '<a:schemeClr val="tx1"/>');
assert.equal(runFill(classic.xml, 'Muted'), '<a:schemeClr val="tx2"/>');
// A text role that differs from dark1 is not the paired slot: literal.
const role = await pairing({theme: 'classic', colorScheme: {id: 'cool-horizon', text: '#333333'}});
assert.equal(runFill(role.xml, 'Pair'), '<a:srgbClr val="333333"/>');
// Translucent theme background: the backdrop is not the theme slot alone.
const translucent = await pairing({theme: 'classic', background: {type: 'theme', slot: 'light1', opacity: .5}});
// RR-96: default text is the tx1 role whatever the backdrop; it is the deck's dark1 here.
assert.equal(runFill(translucent.xml, 'Pair'), '<a:schemeClr val="tx1"/>');
assert.equal(resolve(runFill(translucent.xml, 'Pair'), translucent.colors, clrMapOf(translucent.entries)), hex(cool.dark1));
// Theme backgrounds are limited to light1/light2/dark1/dark2 by the schema, so every
// theme background has a semantic text pair.
// Card text sits on a literal card fill and stays literal.
const card = await pairing({theme: 'minimal', contentBox: true}, {title: 'Cards', composition: {mode: 'row'}, blocks: [{text: 'Inside card'}, {text: 'Second'}]});
assert.ok(card.xml.includes('name="OPF card'), 'cards exported');
assert.equal(runFill(card.xml, 'Cards'), '<a:schemeClr val="tx1"/>', 'the heading outside the card still pairs');
// RR-96: card text is the text role too, so it follows the deck's variant like the rest.
assert.equal(runFill(card.xml, 'Inside card'), '<a:schemeClr val="tx1"/>', 'card text is the text role');
assert.equal(resolve(runFill(card.xml, 'Inside card'), card.colors, clrMapOf(card.entries)), hex(cool.light1));
// Table cell text follows the theme with its theme-referenced fill (FF-24c); see test/table-theme-colors.mjs.
const table = await pairing({theme: 'classic'}, {title: 'Table', table: {columns: ['A'], rows: [['cell']]}});
assert.equal(runFill(table.xml, 'cell'), '<a:schemeClr val="tx1"/>', 'default cell text pairs with the bg2 surface fill');

// FF-24b / RR-96: the slide master follows a dark theme background through its clrMap (bg1 = the dark slot, tx1 = light1) with the
// vendored text styles, so slides added in PowerPoint match; the master and layout keep bg1/tx1 references and no literal background.
const masterOf = entries => strFromU8(entries['ppt/slideMasters/slideMaster1.xml']);
const layoutOf = entries => strFromU8(entries['ppt/slideLayouts/slideLayout1.xml']);
const vendorMaster = masterOf(classic.entries);
assert.equal(clrMapOf(classic.entries).bg1, 'lt1', 'a light1 deck keeps the default clrMap');
for (const [result, background] of [[dark, 'dk1'], [minimal, 'dk2']]) {
  const master = masterOf(result.entries);
  assert.equal(XMLValidator.validate(master), true);
  assert.deepEqual(Object.fromEntries(Object.entries(clrMapOf(result.entries)).filter(([role]) => /^(bg|tx)\d$/.test(role))), {bg1: background, tx1: 'lt1', bg2: 'dk2', tx2: 'lt2'}, 'the master clrMap is the dark map');
  assert.match(master, /<p:cSld name="pptx.gallery"><p:spTree>/, 'the master carries no literal background');
  const styles = master.match(/<p:txStyles>[\s\S]*<\/p:txStyles>/)[0];
  assert.equal(styles, vendorMaster.match(/<p:txStyles>[\s\S]*<\/p:txStyles>/)[0], 'every title, body and other level is the text role; nothing else changes');
  assert.match(layoutOf(result.entries), /<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"\/><\/p:bgRef><\/p:bg>/, 'the layout background is the bg1 role');
}
assert.doesNotMatch(vendorMaster, /<p:bg>/, 'a light1 deck keeps the vendored master');
assert.match(layoutOf(classic.entries), /<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"\/><\/p:bgRef><\/p:bg>/);
// Imported slides keep their own backgrounds; the master background does not leak.
const darkImport = await importWith(zipSync(dark.entries));
assert.equal(darkImport.document.design.theme, 'classic');
assert.equal((darkImport.document.slides[0].design ?? darkImport.document.design).background, undefined, "the master background does not leak into the import");

// 4. Inline overrides come back relative to the named catalog scheme.
const override = await importWith(await toPptx({design: {colorScheme: {id: 'boost', accent1: '#123456'}}, slides: [{title: 'Override'}]}));
assert.deepEqual(override.document.design.colorScheme, {id: 'boost', accent1: '#123456'});
assert.deepEqual(override.theme, []);

// 5. Foreign and damaged themes (a package with no stored references, whose scheme is named Cool Horizon).
const base = parts(await toPptx({design: {colorScheme: 'cool-horizon'}, slides: [{title: 'Base'}]}, {provenance: false}));
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

// 6. No design: core's engine default colour scheme (cool-horizon's slots, no record name) and generated gallery theme name.
// It is recovered as cool-horizon only where that record is registered.
const bare = parts(await exportPptx({slides: [{title: 'Base'}]}));
const defaults = themeOf(bare);
assert.equal(defaults.schemeName, 'OpenPresentation');
assert.equal(defaults.name, 'pptx.gallery');
for (const [slot, element] of SLOTS) assert.equal(defaults.colors[element], hex(cool[slot]), `engine default ${slot}`);
// RR-59: the full round trip leaves the unstated design absent; FF-24 recovers it from a plain package (no provenance).
assert.equal((await importWith(zipSync(bare))).document.design, undefined, 'the unstated colour scheme stays absent');
const plainBare = await exportPptx({slides: [{title: 'Base'}]}, {provenance: false});
assert.equal((await importWith(plainBare)).document.design.colorScheme, 'cool-horizon');
assert.equal(typeof (await importWith(plainBare, {})).document.design.colorScheme, 'object', 'inline without catalogs');

console.log(JSON.stringify({test: 'theme-colors', passed: true, colorSchemes: colorSchemes.length, themes: themes.length}));
