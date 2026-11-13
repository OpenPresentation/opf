// RR-105 (#1290, ribbon audit gap 15): File > Info shows the deck's tags (cp:keywords, joined with "; ") and language
// (dc:language, the BCP-47 tag of an authored `language`), and docProps/app.xml names "OPF" as the application instead of
// claiming PowerPoint wrote the file. Import reads keywords back as the deck's `tags`; the language keeps coming from the runs
// (every run carries it), so dc:language is not read back. With full provenance the stored values return exactly, while
// tags edited in PowerPoint (File > Info > Tags) win over the stored ones.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const part = (bytes, name) => strFromU8(unzipSync(bytes)[name]);
const replacePart = (bytes, name, edit) => {
  const parts = unzipSync(bytes);
  parts[name] = strToU8(edit(strFromU8(parts[name])));
  return zipSync(parts);
};
let checks = 0;

// 1. Export: keywords, language and the application name.
{
  const deck = {name: 'Properties', language: 'de-DE', tags: ['quarterly-review', 'sales & ops'], slides: [{title: 'Umsatz'}]};
  const bytes = await toPptx(structuredClone(deck), {});
  const core = part(bytes, 'docProps/core.xml'), app = part(bytes, 'docProps/app.xml');
  assert.match(core, /<cp:keywords>quarterly-review; sales &amp; ops<\/cp:keywords>/);
  assert.match(core, /<dc:language>de-DE<\/dc:language>/);
  assert.match(app, /<Application>OPF<\/Application>/);
  assert.doesNotMatch(app, /Microsoft Office PowerPoint/);
  // Round trip with full provenance: the same document.
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.tags, deck.tags);
  assert.equal(imported.language, 'de-DE');
  const again = await fromPptx(await toPptx(structuredClone(imported), {}));
  assert.deepEqual(again, imported, 'the round trip is stable');
  checks++;
}

// 2. A Language object writes its bcp47 tag; a deck with neither tags nor language writes neither element.
{
  const bytes = await toPptx({name: 'Object', language: {bcp47: 'fr-CA', name: 'French (Canada)'}, slides: [{title: 'Bonjour'}]}, {});
  assert.match(part(bytes, 'docProps/core.xml'), /<dc:language>fr-CA<\/dc:language>/);
  const plain = await toPptx({name: 'Plain', slides: [{title: 'Hello'}]}, {});
  const core = part(plain, 'docProps/core.xml');
  assert.doesNotMatch(core, /cp:keywords|dc:language/);
  assert.equal((await fromPptx(plain)).tags, undefined, 'no keywords, no tags');
  checks++;
}

// 3. Without provenance the native properties are the only source: keywords split on ";"; the language from the runs.
{
  const bytes = await toPptx({name: 'Bare', language: 'es-ES', tags: ['alpha', 'beta'], slides: [{title: 'Hola'}]}, {provenance: false});
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.tags, ['alpha', 'beta']);
  assert.equal(imported.language, 'es-ES');
  // The language comes from the runs, as before: dc:language is written for File > Info but not read back, so a deck whose runs
  // name no language still imports without one (test/script-fonts.mjs).
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts).filter(name => /^ppt\/(?:slides\/slide|slideLayouts\/slideLayout|slideMasters\/slideMaster|theme\/theme)\d+\.xml$/.test(name))) parts[name] = strToU8(strFromU8(parts[name]).replace(/\s(?:lang|altLang)="[^"]*"/g, ''));
  assert.equal((await fromPptx(zipSync(parts))).language, undefined, 'dc:language alone does not set the language');
  checks++;
}

// 4. Tags edited in PowerPoint win over the stored tags; unchanged keywords restore the stored array exactly.
{
  const deck = {name: 'Edited', tags: ['one', 'two'], slides: [{title: 'Slide'}]};
  const bytes = await toPptx(structuredClone(deck), {});
  const diagnostics = [];
  const edited = await fromPptx(replacePart(bytes, 'docProps/core.xml', xml => xml.replace(/<cp:keywords>[^<]*<\/cp:keywords>/, '<cp:keywords>one; three</cp:keywords>')), {onDiagnostic: d => diagnostics.push(d)});
  assert.deepEqual(edited.tags, ['one', 'three']);
  assert.ok(diagnostics.some(d => d.path === 'tags'), 'the stored tags were not restored, and import says so');
  checks++;
}

// 5. A plain PPTX from another tool with keywords: they become tags.
{
  const bytes = await toPptx({name: 'Foreign', slides: [{title: 'Slide'}]}, {provenance: false});
  const foreign = replacePart(bytes, 'docProps/core.xml', xml => xml.replace('</dc:subject>', '</dc:subject><cp:keywords>finance;board ; ;q3</cp:keywords>'));
  assert.deepEqual((await fromPptx(foreign)).tags, ['finance', 'board', 'q3']);
  checks++;
}
// 6. Company (File > Info) is the deck's primary organization (role 'primary', else the first); without one no Company is written.
// Import does not read it.
{
  const company = async deck => strFromU8(unzipSync(await toPptx(deck, {}))['docProps/app.xml']).match(/<Company>([^<]*)<\/Company>/)?.[1];
  assert.equal(await company({name: 'None', slides: [{title: 'Slide'}]}), undefined, 'no organization, no Company (previously the fixed "OpenPresentation")');
  assert.equal(await company({name: 'One', organization: {id: 'acme', name: 'Acme & Co'}, slides: [{title: 'Slide'}]}), 'Acme &amp; Co');
  assert.equal(await company({name: 'Two', organization: [{id: 'x', name: 'Partner'}, {id: 'y', name: 'Owner', role: 'primary'}], slides: [{title: 'Slide'}]}), 'Owner');
  assert.equal(await company({name: 'First', organization: [{id: 'x', name: 'Partner'}, {id: 'y', name: 'Other'}], slides: [{title: 'Slide'}]}), 'Partner');
  const imported = await fromPptx(await toPptx({name: 'Plain', slides: [{title: 'Slide'}]}, {provenance: false}));
  assert.equal(imported.organization, undefined, 'Company is not imported');
  checks++;
}
console.log(`document-properties: ${checks} checks`);
