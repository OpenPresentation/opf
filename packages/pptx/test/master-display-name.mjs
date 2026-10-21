// Archive metadata: generated master names and default theme names are branded.
// Windows showed that the master cSld name alone did not change Home > Layout's category; native UI proof is separate.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {defaultCatalog, toPptx, fromPptx} from './helpers/default-catalog.mjs';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const fixed = {seed: 1, timestamp: '2026-01-01T00:00:00Z', provenance: false};
const catalog = {...defaultCatalog, themes: {...defaultCatalog.themes,
  authored: {...defaultCatalog.themes.classic, name: 'Author & "Studio"'}}};
const embeddedTheme = {...defaultCatalog.themes.classic, name: 'Embedded Studio'};
const cases = [
  {label: 'default', deck: {name: 'Authored deck name', slides: [{title: 'Default'}]}, theme: 'pptx.gallery', masters: 1},
  {label: 'named theme', deck: {design: {theme: 'classic'}, slides: [{layout: 'cover', title: 'Cover'}]}, theme: defaultCatalog.themes.classic.name, masters: 1},
  {label: 'authored theme', deck: {design: {theme: 'authored'}, slides: [{layout: 'text', title: 'Text', text: 'Body'}]}, theme: catalog.themes.authored.name, masters: 1},
  {label: 'embedded theme', deck: {design: {theme: 'embedded'}, catalogs: {default: {source: defaultCatalog.source, themes: {embedded: embeddedTheme}}}, slides: [{layout: 'text', title: 'Embedded', text: 'Body'}]}, theme: embeddedTheme.name, masters: 1, importCatalog: {...catalog, themes: {...catalog.themes, embedded: embeddedTheme}}},
  {label: 'script profiles and custom layouts', deck: {language: 'ja', design: {theme: 'classic', header: {left: {text: 'Shared header'}}},
    catalogs: {custom: {layouts: {studio: {name: 'Studio & Notes', direction: 'column', regions: [{name: 'title'}, {name: 'body', accepts: ['text']}]}}}},
    slides: [{layout: 'text', title: '日本語', text: 'ひらがな'},
      {layout: 'studio', title: '日本語', text: 'カタカナ', design: {fontScheme: 'ms-mincho'}},
      {layout: 'studio', title: 'No header', text: 'Body', design: {fontScheme: 'ms-mincho', header: false}}]},
    theme: defaultCatalog.themes.classic.name, masters: 2},
];
cases.push({...cases.at(-1), label: 'default theme and script profiles',
  deck: {...cases.at(-1).deck, design: {header: {left: {text: 'Shared header'}}}}, theme: 'pptx.gallery'});
for (const {label, deck, theme, masters, importCatalog = catalog} of cases) {
  const before = structuredClone(deck);
  const bytes = await toPptx(deck, {...fixed, catalogs: [catalog]});
  assert.deepEqual(deck, before, `${label}: authored document stays unchanged`);
  const entries = unzipSync(bytes);
  const xml = path => parser.parse(strFromU8(entries[path]));
  const masterPaths = Object.keys(entries).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path));
  assert.equal(masterPaths.length, masters, `${label}: all expected script masters exist`);
  for (const path of masterPaths) assert.equal(xml(path)['p:sldMaster']['p:cSld'].name, 'pptx.gallery', `${label}: ${path} retains the generated master name`);
  assert.equal(xml('ppt/theme/theme1.xml')['a:theme'].name, theme, `${label}: default theme is branded and authored theme identity is retained`);
  assert.equal(xml('ppt/theme/theme2.xml')['a:theme'].name, theme, `${label}: notes theme copies the finished deck theme`);
  for (const part of ['ppt/theme/theme1.xml', 'ppt/theme/theme2.xml']) {
    const family = strFromU8(entries[part]).match(/<thm15:themeFamily\b[^>]*\bname="([^"]*)"/);
    assert.ok(family, `${label}: theme family is present`);
    assert.equal(parser.parse(`<name value="${family[1]}"/>`).name.value, theme, `${label}: theme family follows the same display identity`);
  }
  const app = xml('docProps/app.xml')['Properties'];
  const pairs = app.HeadingPairs['vt:vector']['vt:variant'];
  const titles = app.TitlesOfParts['vt:vector']['vt:lpstr'];
  let offset = 0, themeNames;
  for (let i = 0; i < pairs.length; i += 2) {
    const count = Number(pairs[i + 1]['vt:i4']);
    if (pairs[i]['vt:lpstr'] === 'Theme') themeNames = titles.slice(offset, offset + count);
    offset += count;
  }
  assert.ok(themeNames, `${label}: application theme-name group exists`);
  assert.deepEqual(themeNames, Object.keys(entries).filter(path => /^ppt\/theme\/theme\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map(path => xml(path)['a:theme'].name), `${label}: application metadata names every finished theme`);
  const layoutNames = Object.keys(entries).filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path))
    .map(path => xml(path)['p:sldLayout']['p:cSld'].name);
  for (const record of Object.values(catalog.layouts)) assert.ok(layoutNames.includes(record.name), `${label}: ${record.name} keeps its Gallery label`);
  if (masters === 2) {
    assert.ok(layoutNames.includes('Studio & Notes'), 'custom layout label is preserved');
    const themeNames = Object.keys(entries).filter(path => /^ppt\/theme\/theme\d+\.xml$/.test(path)).map(path => xml(path)['a:theme'].name);
    assert.ok(themeNames.includes(`1_${theme}`), 'script clone keeps its existing theme identity convention');
  }
  if (deck.name) assert.equal(xml('docProps/core.xml')['cp:coreProperties']['dc:title'], deck.name, 'master label does not replace the deck name');
  if (deck.design?.theme) {
    const imported = await fromPptx(bytes, {catalogs: [importCatalog]});
    assert.equal(imported.design.theme, deck.design.theme, `${label}: theme still recovers without provenance`);
  }
}
console.log('Master and default theme display names: six exported archives; default/authored themes, all Gallery labels, custom layouts and two script profiles preserved.');
