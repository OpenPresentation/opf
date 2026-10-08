import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {resolvePresentation, resolveScriptFonts, fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {checkTypefaces, inventoryTypefaces} from '../dist/index.js';

// opf-pptx#168 (FF-05). A slide may select its own script fonts (slides[].design.fontScheme, a slide theme, or an
// inline fontScheme with eastAsian/complexScript), and core resolves them per slide. Slide runs name no East Asian /
// complex-script font (FF-05: PowerPoint lists an explicit run ea/cs as an empty-name font), so each distinct script
// profile gets its own slide master and theme, and a slide uses the master whose theme carries its script fonts.
// A deck with one profile keeps one master (its bytes do not change). Notes share the one notes master; a slide on
// another master that has notes is reported.

const exported = async (presentation, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(presentation), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const entries = unzipSync(bytes);
  const xml = Object.fromEntries(Object.entries(entries).filter(([name]) => /\.(xml|rels)$/.test(name)).map(([name, value]) => [name, strFromU8(value)]));
  return {bytes, xml, diagnostics, codes: diagnostics.map(diagnostic => diagnostic.code)};
};

// Package helpers: relationships, slide order, each slide's layout -> master -> theme.
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const resolveTarget = (source, target) => {
  const parts = source.split('/').slice(0, -1);
  for (const piece of target.split('/')) piece === '..' ? parts.pop() : parts.push(piece);
  return parts.join('/');
};
const relationships = (xml, path) => [...(xml[relsOf(path)] ?? '').matchAll(/<Relationship\b[^>]*\/>/g)].map(([node]) => ({
  id: /\sId="([^"]*)"/.exec(node)[1], type: /\sType="[^"]*\/([^"/]+)"/.exec(node)[1], path: resolveTarget(path, /\sTarget="([^"]*)"/.exec(node)[1])
}));
const related = (xml, path, type) => relationships(xml, path).filter(rel => rel.type === type).map(rel => rel.path);
const slidePaths = xml => [...xml['ppt/presentation.xml'].matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
  .map(match => relationships(xml, 'ppt/presentation.xml').find(rel => rel.id === match[1]).path);
const chain = (xml, slide) => {
  const [layout] = related(xml, slide, 'slideLayout'), [master] = related(xml, layout, 'slideMaster'), [theme] = related(xml, master, 'theme');
  return {layout, master, theme};
};
const fontGroup = (xml, theme, tag) => {
  const block = xml[theme].match(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`))[0];
  const face = element => block.match(new RegExp(`<a:${element} typeface="([^"]*)"`))?.[1];
  return {latin: face('latin'), ea: face('ea'), cs: face('cs'), script: script => block.match(new RegExp(`<a:font script="${script}" typeface="([^"]*)"`))?.[1]};
};
const ROLES = [['majorFont', 'heading'], ['minorFont', 'body']], SLOTS = [['ea', 'eastAsian'], ['cs', 'complexScript']];

/** The package invariants of opf-pptx#168, and the per-slide fonts reaching each slide's master theme. Returns the master per slide. */
const assertProfiles = (label, presentation, {xml}) => {
  for (const [name, value] of Object.entries(xml)) assert.equal(XMLValidator.validate(value), true, `${label}: ${name} is well-formed`);
  const slides = slidePaths(xml), chains = slides.map(slide => chain(xml, slide));
  const preview = resolvePresentation(structuredClone(presentation)).slides.map(slide => slide.scriptFonts.profile);
  slides.forEach((slide, index) => {
    const resolved = resolveScriptFonts(presentation, {slideIndex: index}), {theme} = chains[index];
    for (const [tag, role] of ROLES) {
      const group = fontGroup(xml, theme, tag);
      for (const [element, slot] of SLOTS) {
        if (resolved.sources[slot] === 'latin') continue;
        assert.equal(group[element], resolved[role][slot], `${label}: slide ${index + 1} ${tag} ${element} names its own ${slot} family (${theme})`);
        assert.equal(preview[index][role][slot], group[element], `${label}: slide ${index + 1} preview ${role} ${slot} matches the export`);
      }
      if (resolved.supplement) assert.equal(group.script(resolved.supplement.script), resolved.supplement[role], `${label}: slide ${index + 1} ${tag} ${resolved.supplement.script} entry`);
      assert.ok(group.ea, `${label}: slide ${index + 1} ${tag} ea names a font (FF-05)`);
    }
  });
  // FF-05 stays fixed: no run in a slide or notes slide names an East Asian / complex-script font.
  for (const [name, value] of Object.entries(xml)) {
    if (/^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(name)) assert.doesNotMatch(value, /<a:(?:ea|cs)\s+typeface="(?!\+)/, `${label}: ${name} has no run-level ea/cs`);
  }
  // Masters: every one is listed, owns one layout and one theme; master and layout ids are unique and in range.
  const masters = related(xml, 'ppt/presentation.xml', 'slideMaster');
  const listed = [...xml['ppt/presentation.xml'].matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]));
  assert.equal(listed.length, masters.length, `${label}: every master is listed`);
  const layoutIds = masters.flatMap(master => [...xml[master].matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1])));
  const ids = [...listed, ...layoutIds];
  assert.equal(new Set(ids).size, ids.length, `${label}: master and layout ids are unique`);
  assert.ok(ids.every(id => id >= 2147483648), `${label}: master and layout ids are in range`);
  const themes = masters.map(master => related(xml, master, 'theme'));
  assert.ok(themes.every(list => list.length === 1), `${label}: each master has one theme`);
  assert.equal(new Set(themes.flat()).size, masters.length, `${label}: no two masters share a theme`);
  for (const master of masters) {
    const [layout] = related(xml, master, 'slideLayout');
    assert.deepEqual(related(xml, layout, 'slideMaster'), [master], `${label}: ${layout} belongs to ${master}`);
  }
  // The notes master owns a copy of the presentation theme (FF-05), not any master's theme.
  const [notesMaster] = related(xml, 'ppt/presentation.xml', 'notesMaster');
  const [notesTheme] = related(xml, notesMaster, 'theme');
  assert.ok(!themes.flat().includes(notesTheme), `${label}: the notes master owns its theme`);
  assert.equal(xml[notesTheme].replace(/name="[^"]*"/, ''), xml[themes[0][0]].replace(/name="[^"]*"/, ''), `${label}: the notes theme is the presentation theme`);
  // Package integrity: every relationship target and content-type override exists, every new part is declared.
  const types = xml['[Content_Types].xml'];
  for (const [name] of Object.entries(xml).filter(([name]) => name.endsWith('.rels'))) {
    const source = name.replace(/_rels\/([^/]+)\.rels$/, '$1');
    for (const rel of relationships(xml, source)) if (rel.type !== 'hyperlink') assert.ok(Object.hasOwn(xml, rel.path) || /\.(png|jpe?g|gif|svg|xlsx)$/.test(rel.path), `${label}: ${name} -> ${rel.path} exists`);
  }
  for (const [, part] of types.matchAll(/<Override PartName="\/([^"]+)"/g)) assert.ok(Object.hasOwn(xml, part), `${label}: override ${part} exists`);
  for (const part of Object.keys(xml).filter(name => /^ppt\/(?:slideMasters\/slideMaster|slideLayouts\/slideLayout|theme\/theme)\d+\.xml$/.test(name))) {
    assert.match(types, new RegExp(`PartName="/${part}"`), `${label}: ${part} has a content type`);
  }
  // docProps/app.xml lists every theme and exactly the fonts the package uses.
  assert.equal([...xml['docProps/app.xml'].matchAll(/<vt:lpstr>Theme<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>(\d+)/g)][0]?.[1], String(masters.length + 1), `${label}: app.xml counts every theme`);
  return {masters: chains.map(entry => masters.indexOf(entry.master) + 1), themes: themes.map(([theme]) => theme), chains};
};

const thai = 'ภาษาไทยเป็นภาษาที่มีวรรณยุกต์';
const inline = (slot, family) => ({major: 'Arial', minor: 'Arial', [slot]: {major: family, minor: family}});

// 1. The opf-pptx#168 repro: Thai, slide 1 Angsana New, slide 2 DilleniaUPC.
const repro = {name: 'Per-slide script font', language: 'th', design: {theme: 'classic', dimensions: 'widescreen'}, slides: [
  {id: 'one', title: 'รายงานสรุปผล', design: {fontScheme: 'angsana-new'}, blocks: [{text: thai}]},
  {id: 'two', title: 'รายงานสรุปผล', design: {fontScheme: 'dilleniaupc'}, blocks: [{text: thai}]},
]};
{
  const result = await exported(repro);
  const {masters, chains} = assertProfiles('repro', repro, result);
  assert.deepEqual(masters, [1, 2], 'repro: slide 2 uses its own master');
  assert.deepEqual([fontGroup(result.xml, chains[0].theme, 'minorFont').cs, fontGroup(result.xml, chains[1].theme, 'minorFont').cs], ['Angsana New', 'DilleniaUPC']);
  assert.equal(fontGroup(result.xml, chains[1].theme, 'majorFont').script('Thai'), 'DilleniaUPC', 'repro: slide 2 theme Thai entry');
  // Only the script slots differ between the two themes (and the theme name, as PowerPoint names a second master's theme).
  const strip = theme => result.xml[theme].replace(/<a:(?:ea|cs) typeface="[^"]*"\/>|<a:font script="Thai" typeface="[^"]*"\/>/g, '');
  assert.equal(strip(chains[1].theme), strip(chains[0].theme).replace(/name="Classic"/, 'name="1_Classic"'), 'repro: themes differ only in their script fonts');
  assert.deepEqual(result.diagnostics.filter(diagnostic => /script|language/.test(diagnostic.code)), [], 'repro: no script diagnostics');
  assert.deepEqual(checkTypefaces(result.bytes, {families: ['Angsana New', 'DilleniaUPC', 'Tenorite', 'Tenorite Display'],
    themeScripts: {major: {cs: 'Angsana New'}, minor: {cs: 'Angsana New'}}, themeScriptsByPart: {[chains[1].theme]: {major: {cs: 'DilleniaUPC'}, minor: {cs: 'DilleniaUPC'}}}}).violations, [], 'repro: the package names only the chosen fonts');
  // A slide's theme references resolve against its own master's theme.
  const inventory = inventoryTypefaces(result.bytes);
  assert.equal(inventory.themeParts[chains[1].theme].minor.cs, 'DilleniaUPC');
}

// 2. Three profiles: East Asian Meiryo, complex-script Traditional Arabic, complex-script Nirmala UI.
// The deck names its colour scheme: an engine-default one has no catalog id, and the import (with the default catalog
// registered) recovers the equal gallery record, so the re-export would name the theme's colour scheme differently.
const threeProfiles = {name: 'Three script profiles', design: {colorScheme: 'cool-horizon'}, slides: [
  {title: '日本語', design: {fontScheme: inline('eastAsian', 'Meiryo')}, text: 'ひらがな'},
  {title: 'مرحبا', design: {fontScheme: inline('complexScript', 'Traditional Arabic')}, text: 'مرحبا بالعالم', notes: 'مرحبا'},
  {title: 'नमस्ते', design: {fontScheme: inline('complexScript', 'Nirmala UI')}, text: 'नमस्ते दुनिया'},
]};
{
  const result = await exported(threeProfiles);
  const {masters, chains} = assertProfiles('three', threeProfiles, result);
  assert.deepEqual(masters, [1, 2, 3], 'three: one master per profile');
  // A later master is the presentation theme plus the slide's own selections: slide 2 keeps slide 1's East Asian font.
  assert.deepEqual(['ea', 'cs'].map(slot => fontGroup(result.xml, chains[1].theme, 'minorFont')[slot]), ['Meiryo', 'Traditional Arabic']);
  assert.deepEqual(['ea', 'cs'].map(slot => fontGroup(result.xml, chains[2].theme, 'minorFont')[slot]), ['Meiryo', 'Nirmala UI']);
  assert.equal(fontGroup(result.xml, chains[0].theme, 'minorFont').cs, '', 'three: the presentation theme selects no complex-script font');
  // Slide 2 has notes: the one notes master carries the presentation theme, which is reported.
  assert.deepEqual(result.diagnostics.filter(diagnostic => diagnostic.code === 'script-font-notes-not-exported').map(diagnostic => diagnostic.path), ['slides.1.notes']);
  assert.match(result.diagnostics.find(diagnostic => diagnostic.code === 'script-font-notes-not-exported').message, /Traditional Arabic/);
  assert.ok(!result.codes.includes('script-font-per-slide-not-exported'));
}

// 3. A per-slide override mixed with the deck default: slides 1 and 3 (Japanese, Meiryo through the language) share master 1.
const mixed = {name: 'Mixed', language: 'ja', design: {colorScheme: 'cool-horizon'}, slides: [
  {title: '日本語の見出し', text: 'ひらがなとカタカナ', notes: 'メモ'},
  {title: '日本語の見出し', design: {fontScheme: 'ms-mincho'}, text: 'ひらがなとカタカナ'},
  {title: '日本語の見出し', text: 'ひらがなとカタカナ', notes: 'メモ'},
  {title: '日本語の見出し', design: {fontScheme: 'ms-mincho'}, text: 'ひらがなとカタカナ'},
]};
{
  const result = await exported(mixed);
  const {masters, chains} = assertProfiles('mixed', mixed, result);
  assert.deepEqual(masters, [1, 2, 1, 2], 'mixed: slides with the same profile share a master');
  assert.deepEqual([fontGroup(result.xml, chains[0].theme, 'minorFont').ea, fontGroup(result.xml, chains[1].theme, 'minorFont').ea], ['Meiryo', 'MS Mincho']);
  assert.deepEqual(result.diagnostics.filter(diagnostic => /script|language/.test(diagnostic.code)), [], 'mixed: slides on master 1 with notes are not reported');
}

// 4. One profile: one master, one layout, the presentation theme and the notes theme (the 976-deck corpus is byte-identical).
for (const [label, presentation] of [
  ['same profile through the language', {name: 'Same', language: 'th', design: {theme: 'classic'}, slides: [{title: thai, design: {fontScheme: 'angsana-new'}}, {title: thai}]}],
  ['Latin-only per-slide schemes', {name: 'Latin', slides: [{title: 'One', design: {fontScheme: 'georgia'}}, {title: 'Two', design: {fontScheme: 'arial'}}]}],
  ['later slide selects nothing', {name: 'Nothing', slides: [{title: '日本語', design: {fontScheme: inline('eastAsian', 'Meiryo')}}, {title: 'Two'}]}],
  ['one slide', {name: 'One', language: 'ja', slides: [{title: '日本語', design: {fontScheme: 'ms-mincho'}, notes: 'メモ'}]}],
]) {
  const result = await exported(presentation);
  const parts = Object.keys(result.xml).filter(name => /^ppt\/(?:slideMasters|slideLayouts|theme)\/[^/]+\.xml$/.test(name)).sort();
  assert.deepEqual(parts, ['ppt/slideLayouts/slideLayout1.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/theme/theme1.xml', 'ppt/theme/theme2.xml'], `${label}: one master`);
  assert.deepEqual(result.diagnostics.filter(diagnostic => /script-font/.test(diagnostic.code)), [], `${label}: not reported`);
  assertProfiles(label, presentation, result);
}

// 5. Determinism: the same document exports the same bytes; a different slide order numbers masters in slide order.
for (const presentation of [repro, threeProfiles, mixed]) {
  const [first, second] = [await exported(presentation), await exported(presentation)];
  assert.deepEqual(first.bytes, second.bytes, `${presentation.name}: deterministic`);
}
{
  const reversed = {...threeProfiles, slides: [...threeProfiles.slides].reverse()};
  const result = await exported(reversed);
  const {chains} = assertProfiles('reversed', reversed, result);
  assert.equal(fontGroup(result.xml, chains[0].theme, 'minorFont').cs, 'Nirmala UI', 'reversed: master 1 follows the new first slide');
}

// 6. Round trip. With provenance (the default) each slide's design and script fonts come back; without it, the import
// cannot restore a per-slide font scheme and says so for every slide whose master theme names script fonts.
for (const presentation of [repro, threeProfiles, mixed]) {
  const back = await fromPptx((await exported(presentation)).bytes);
  presentation.slides.forEach((slide, index) => {
    assert.deepEqual(back.slides[index].design?.fontScheme, slide.design?.fontScheme, `${presentation.name}: slide ${index + 1} design.fontScheme round-trips`);
    const [source, imported] = [resolveScriptFonts(presentation, {slideIndex: index}), resolveScriptFonts(back, {slideIndex: index})];
    assert.deepEqual([imported.heading, imported.body, imported.sources], [source.heading, source.body, source.sources], `${presentation.name}: slide ${index + 1} script fonts round-trip`);
  });
  // Re-exporting the imported document gives the same masters and themes.
  const again = await exported(back), first = await exported(presentation);
  for (const name of Object.keys(first.xml).filter(name => /^ppt\/(?:theme\/theme\d+|slideMasters\/slideMaster\d+|slideLayouts\/slideLayout\d+)\.xml$|^ppt\/slides\/_rels\//.test(name))) {
    assert.equal(again.xml[name], first.xml[name], `${presentation.name}: re-export keeps ${name}`);
  }
}
{
  const diagnostics = [];
  await fromPptx((await exported(repro, {provenance: false})).bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'script-font-not-imported' && diagnostic.path === 'slides.1.design.fontScheme' && /DilleniaUPC/.test(diagnostic.message)),
    'without provenance, slide 2 master theme script font is reported on import');
}

console.log(JSON.stringify({test: 'per-slide-script-fonts', passed: true, decks: 3, singleProfile: 4}));
