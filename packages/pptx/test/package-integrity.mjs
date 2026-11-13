// RR-105: the static package integrity check (helpers/package-integrity.mjs) finds each defect it is written for, and
// every bundled example and in-repository qualification deck exports a package that passes it. A violation is a file
// PowerPoint may refuse to open or offer to repair; the check needs no PowerPoint.
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strFromU8, strToU8, unzipSync} from 'fflate';
import {examples} from '@openpresentation/opf/examples';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';
import {packageIntegrity} from './helpers/package-integrity.mjs';

const fixture = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const png = `data:image/png;base64,${Buffer.from(fixture).toString('base64')}`;
const rules = entries => packageIntegrity(entries).map(finding => finding.rule);
const edit = (entries, part, change) => {
  const before = strFromU8(entries[part]), after = change(before);
  assert.notEqual(after, before, `the mutation changes ${part}`);
  return {...entries, [part]: strToU8(after)};
};

// A clean package: two slides, a picture watermark on each, so it has tags parts, media and notes.
const clean = unzipSync(await toPptx({design: {watermark: {src: png, opacity: 0.1}}, slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}]}));
assert.deepEqual(packageIntegrity(clean), [], JSON.stringify(packageIntegrity(clean)));
const slideRels = 'ppt/slides/_rels/slide1.xml.rels', types = '[Content_Types].xml';
const tagsRel = strFromU8(clean[slideRels]).match(/<Relationship Id="(rIdOpfWatermark\d+)"[^>]*Target="\.\.\/tags\/([^"]+)"/);
assert.ok(tagsRel, 'the clean package relates a watermark tags part');

// Each rule fires on its defect.
const cases = {
  'duplicate-content-type-override': edit(clean, types, xml => xml.replace('</Types>', `<Override PartName="/ppt/tags/${tagsRel[2]}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>`)),
  'dangling-content-type-override': edit(clean, types, xml => xml.replace('</Types>', '<Override PartName="/ppt/tags/missing.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>')),
  'part-without-content-type': {...clean, 'ppt/extra.bin': new Uint8Array([1])},
  'equivalent-part-names': {...clean, 'PPT/Presentation.xml': clean['ppt/presentation.xml']},
  'malformed-xml': edit(clean, 'ppt/slides/slide2.xml', xml => xml.replace('</p:sld>', '')),
  'missing-relationship-target': edit(clean, slideRels, xml => xml.replace(`../tags/${tagsRel[2]}`, '../tags/missing.xml')),
  'duplicate-relationship-id': edit(clean, slideRels, xml => xml.replace('</Relationships>', `<Relationship Id="${tagsRel[1]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/${tagsRel[2]}"/></Relationships>`)),
  'unresolved-relationship-reference': edit(clean, 'ppt/slides/slide1.xml', xml => xml.replace(`r:id="${tagsRel[1]}"`, 'r:id="rIdNowhere"')),
  'shared-single-owner-part': edit(clean, 'ppt/slides/_rels/slide2.xml.rels', xml => xml.replace(/(Id="rIdOpfWatermark\d+"[^>]*Target="\.\.\/tags\/)[^"]+"/, `$1${tagsRel[2]}"`)),
  'duplicate-shape-id': edit(clean, 'ppt/slides/slide1.xml', xml => {
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
    return xml.replace(`<p:cNvPr id="${ids[1]}"`, `<p:cNvPr id="${ids[0]}"`);
  }),
  'duplicate-slide-id': edit(clean, 'ppt/presentation.xml', xml => {
    const [first, second] = [...xml.matchAll(/<p:sldId id="(\d+)"/g)].map(match => match[1]);
    return xml.replace(`<p:sldId id="${second}"`, `<p:sldId id="${first}"`);
  }),
};
// A tags reference that resolves to a relationship of another type (the picture's image).
const imageId = strFromU8(clean['ppt/slides/slide1.xml']).match(/<a:blip r:embed="([^"]+)"/)[1];
cases['wrong-relationship-type'] = edit(clean, 'ppt/slides/slide1.xml', xml => xml.replace(`<p:tags r:id="${tagsRel[1]}"`, `<p:tags r:id="${imageId}"`));
cases['relationship-target-content-type'] = edit(clean, slideRels, xml => xml.replace(`../tags/${tagsRel[2]}`, '../slideLayouts/slideLayout1.xml'));
for (const [rule, entries] of Object.entries(cases)) assert.ok(rules(entries).includes(rule), `${rule} fires: ${JSON.stringify(packageIntegrity(entries))}`);

// Every bundled example (images substituted, as in export-corpus.mjs) passes.
const failures = [];
for (const {file, deck} of examples) {
  const findings = packageIntegrity(unzipSync(await toPptx(deck, {imageResolver: async () => fixture})));
  if (findings.length) failures.push({file, findings});
}

// The qualification decks kept in this repository, with their own images.
const decks = fileURLToPath(new URL('../../../scripts/native-acceptance/qualification/decks/', import.meta.url));
const qualification = (await readdir(decks)).filter(name => name.endsWith('.opf.json'));
for (const name of qualification) {
  const deck = JSON.parse(await readFile(path.join(decks, name), 'utf8'));
  const imageResolver = async src => {
    if (typeof src !== 'string' || /^[a-z]+:/i.test(src)) return undefined;
    return new Uint8Array(await readFile(path.join(decks, src)));
  };
  const findings = packageIntegrity(unzipSync(await toPptx(deck, {catalogs: [gallery], imageResolver})));
  if (findings.length) failures.push({file: name, findings});
}
assert.deepEqual(failures, [], JSON.stringify(failures, null, 1));
assert.ok(examples.length >= 149 && qualification.length >= 6);
console.log(`Package integrity passed: ${Object.keys(cases).length} rules fire on their defects; ${examples.length} examples and ${qualification.length} qualification decks export clean packages.`);
