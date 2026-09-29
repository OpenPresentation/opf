import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';
import {unzipSync, zipSync} from './fflate/index.mjs';

// FF-05 E6 input preparation only. This script never starts Office, registers
// fonts, edits authored text, or interprets the native Fonts collection.
const source = new URL('../fixture/canonical/source.pptx', import.meta.url);
assert.equal(process.argv.length, 3, 'Usage: node preparation/derive.mjs FRESH_OUTPUT_DIRECTORY');
const destination = path.resolve(process.argv[2]);
await mkdir(destination); // exclusive fresh directory, never reuse a native run
const outputRoot = pathToFileURL(destination + path.sep);
const output = new URL('./calibri-control.pptx', outputRoot);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
const encoder = new TextEncoder();
const literal = Buffer.from('Carlito');
const original = await readFile(source);
const sourceHash = hash(original);
const expectedSourceHash = 'f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb';
assert.equal(sourceHash, expectedSourceHash, 'Only the reviewed canonical Carlito fixture may generate this finite control.');
const before = unzipSync(original);
const names = Object.keys(before).sort();
const after = Object.fromEntries(names.map(name => [name, before[name]]));
const changes = [], emptyScriptSlots = [];

// Scan markup, skipping comments, CDATA and processing instructions. The
// fixture is UTF-8 XML; round-trip checks below prevent encoding changes.
function attributes(xml, part) {
  const result = [], stack = [], root = {children: new Map(), path: ''};
  for (const token of xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g)) {
    const tag = token[0];
    if (/^<\//.test(tag)) {
      const name = tag.match(/^<\/([^\s>]+)/)?.[1];
      assert.equal(stack.pop()?.name, name, `${part}: balanced XML markup`);
      continue;
    }
    const name = tag.match(/^<([A-Za-z_][\w.:-]*)\b/)?.[1];
    if (!name) continue;
    const parent = stack.at(-1) ?? root;
    const index = (parent.children.get(name) ?? 0) + 1;
    parent.children.set(name, index);
    const path = `${parent.path}/${name}[${index}]`;
    for (const attribute of tag.matchAll(/\s(typeface)(\s*=\s*)(["'])([^"']*)\3/g)) {
      const value = attribute[4];
      const valueIndex = token.index + attribute.index + attribute[0].length - value.length - 1;
      result.push({part, path, element: name, attribute: attribute[1], value,
        valueCharacterOffset: valueIndex, valueByteOffset: Buffer.byteLength(xml.slice(0, valueIndex)),
        beforeAttribute: attribute[0].trimStart(), openingTag: tag});
    }
    if (!/\/\s*>$/.test(tag)) stack.push({name, path, children: new Map()});
  }
  assert.equal(stack.length, 0, `${part}: closed XML markup`);
  return result;
}

for (const part of names.filter(name => /\.xml$/i.test(name))) {
  const xml = decoder.decode(before[part]);
  assert.deepEqual(encoder.encode(xml), before[part], `${part}: lossless UTF-8 decoding`);
  const found = attributes(xml, part);
  emptyScriptSlots.push(...found.filter(item => /(?:^|:)(?:ea|cs)$/.test(item.element) && item.value === '').map(({part, path, beforeAttribute, openingTag}) => ({part, path, attribute: beforeAttribute, openingTag})));
  const edits = found.filter(item => item.value === 'Carlito');
  let modified = xml;
  for (const edit of [...edits].reverse()) {
    modified = modified.slice(0, edit.valueCharacterOffset) + 'Calibri' + modified.slice(edit.valueCharacterOffset + 'Carlito'.length);
  }
  if (!edits.length) continue;
  after[part] = encoder.encode(modified);
  for (const {value, openingTag, ...edit} of edits) changes.push({...edit,
    beforeValue: value, afterValue: 'Calibri', afterAttribute: edit.beforeAttribute.replace('Carlito', 'Calibri'),
    beforeOpeningTag: openingTag, afterOpeningTag: openingTag.replace(/(\btypeface\s*=\s*["'])Carlito(["'])/, '$1Calibri$2')});
  assert.deepEqual(attributes(modified, part).map(item => item.value), found.map(item => item.value === 'Carlito' ? 'Calibri' : item.value));
}
assert.equal(changes.length, 17, 'The finite control changes exactly 17 typeface attributes.');
assert.equal(emptyScriptSlots.length, 4, 'The finite control retains exactly four empty theme ea/cs slots.');
assert.ok(emptyScriptSlots.every(slot => slot.part === 'ppt/theme/theme1.xml'), 'Every empty ea/cs slot belongs to the canonical theme.');

function inventory(entries) {
  const occurrences = [];
  for (const part of names) {
    const bytes = Buffer.from(entries[part]);
    for (let offset = bytes.indexOf(literal); offset !== -1; offset = bytes.indexOf(literal, offset + literal.length)) {
      occurrences.push({part, byteOffset: offset,
        context: bytes.subarray(Math.max(0, offset - 60), Math.min(bytes.length, offset + literal.length + 60)).toString('utf8')});
    }
  }
  return occurrences;
}
const originalLiteralInventory = inventory(before).map(item => ({...item,
  classification: changes.some(change => change.part === item.part && change.valueByteOffset === item.byteOffset) ? 'changed-typeface-attribute' : 'unchanged-non-target-content'}));
const remainingLiteralInventory = inventory(after);
const nonAttributeOccurrencesBefore = originalLiteralInventory.filter(item => item.classification !== 'changed-typeface-attribute');
assert.equal(nonAttributeOccurrencesBefore.length, 0, 'The canonical source has no non-attribute Carlito occurrences.');
assert.equal(remainingLiteralInventory.length, 0, 'No literal Carlito occurrence may remain in this finite control.');

const embeddedFontEntries = names.filter(name => /^ppt\/fonts(?:\/|$)|\.(?:ttf|otf|fntdata|odttf)$/i.test(name));
const embeddedFontRelationships = names.filter(name => /\.rels$/i.test(name)).flatMap(part => {
  const xml = decoder.decode(before[part]);
  return [...xml.matchAll(/<Relationship\b[^>]*\bType=["'][^"']*\/(?:font|fontData)["'][^>]*\/?\s*>/gi)].map(match => ({part, xml: match[0]}));
});
const embeddedFontContentTypes = [...decoder.decode(before['[Content_Types].xml']).matchAll(/<(?:Override|Default)\b[^>]*\bContentType=["'][^"']*(?:fontdata|opentype|font-sfnt)[^"']*["'][^>]*\/?\s*>/gi)].map(match => match[0]);
assert.deepEqual(embeddedFontEntries, [], 'No embedded font entries.');
assert.deepEqual(embeddedFontRelationships, [], 'No embedded font relationships.');
assert.deepEqual(embeddedFontContentTypes, [], 'No embedded font content types.');

// Fixed local calendar time and entry order make ZIP generation independent
// of the wall clock. Repacking normalizes ZIP metadata, not OPC part content.
const zip = () => zipSync(Object.fromEntries(names.map(name => [name, [after[name],
  {mtime: new Date(2000, 0, 1, 0, 0, 0), level: 9, os: 0}]])), {level: 9});
const generated = zip(), repeated = zip();
assert.deepEqual(generated, repeated, 'Deterministic ZIP output.');
const reopened = unzipSync(generated);
assert.deepEqual(Object.keys(reopened).sort(), names, 'Same OPC entry set.');
for (const name of names) assert.deepEqual(reopened[name], after[name], `${name}: exact generated part content`);

const parts = names.map(part => ({part, beforeSha256: hash(before[part]), afterSha256: hash(reopened[part]),
  beforeBytes: before[part].byteLength, afterBytes: reopened[part].byteLength,
  changedAttributes: changes.filter(change => change.part === part).length}));
const changedParts = parts.filter(part => part.beforeSha256 !== part.afterSha256);
assert.equal(changedParts.length, 3, 'The finite control changes exactly three OPC parts.');
assert.deepEqual(changedParts.map(part => part.part), [...new Set(changes.map(change => change.part))].sort());
for (const part of parts) if (part.changedAttributes === 0) assert.equal(part.beforeSha256, part.afterSha256, `${part.part}: unchanged content`);
for (const part of names.filter(name => /\.rels$/i.test(name))) assert.deepEqual(before[part], reopened[part], `${part}: relationship structure unchanged`);
for (const slot of emptyScriptSlots) assert.ok(decoder.decode(reopened[slot.part]).includes(slot.openingTag), `${slot.path}: empty script slot unchanged`);
assert.equal(hash(await readFile(source)), sourceHash, 'Canonical source remains unchanged.');
assert.notEqual(source.href, output.href);

await writeFile(output, generated);
assert.equal(hash(await readFile(output)), hash(generated), 'Written output hash matches verified input.');
const fflateSource = new URL('./fflate/index.mjs', import.meta.url);
const fflatePackage = JSON.parse(await readFile(new URL('./fflate/package.json', import.meta.url), 'utf8'));
const manifest = {
  purpose: 'FF-05 E6 offline Calibri control input preparation; no native run or root-cause claim.',
  finiteControlGuard: {expectedSourceSha256: expectedSourceHash, expectedChangedAttributes: 17, expectedChangedParts: 3,
    expectedRemainingCarlitoOccurrences: 0, expectedNonAttributeCarlitoOccurrences: 0, expectedEmptyThemeScriptSlots: 4},
  canonicalSource: fileURLToPath(source), sourceSha256: sourceHash, sourceBytes: original.byteLength,
  output: fileURLToPath(output), outputSha256: hash(generated), outputBytes: generated.byteLength,
  script: fileURLToPath(import.meta.url), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  dependency: {name: 'fflate', version: fflatePackage.version, source: fileURLToPath(fflateSource), sha256: hash(await readFile(fflateSource))},
  zipPolicy: {entryOrder: 'lexicographic', compressionLevel: 9, localCalendarTimestamp: '2000-01-01 00:00:00', os: 0,
    note: 'ZIP container metadata is normalized on repack; all unmodified OPC entry contents remain byte-identical.'},
  counts: {entries: names.length, changedParts: changedParts.length, changedTypefaceAttributes: changes.length,
    originalLiteralCarlitoOccurrences: originalLiteralInventory.length, nonAttributeOccurrencesBefore: nonAttributeOccurrencesBefore.length,
    remainingLiteralCarlitoOccurrences: remainingLiteralInventory.length, emptyScriptSlots: emptyScriptSlots.length},
  verified: {canonicalSourceUnchanged: true, deterministicRepeatedOutput: true, exactEntrySet: true,
    onlyListedAttributesChanged: true, allOtherPartBytesUnchanged: true, allRelationshipsUnchanged: true,
    emptyScriptSlotsUnchanged: true, noEmbeddedFonts: true},
  changedParts, changes, parts, emptyScriptSlots,
  originalLiteralInventory, nonAttributeOccurrencesBefore, remainingLiteralInventory,
  embeddedFonts: {entries: embeddedFontEntries, relationships: embeddedFontRelationships, contentTypes: embeddedFontContentTypes},
};
await writeFile(new URL('./manifest.json', outputRoot), JSON.stringify(manifest, null, 2) + '\n');
const diff = changes.map(change => `${change.part} ${change.path}/@typeface (byte ${change.valueByteOffset})\n- ${change.beforeAttribute}\n+ ${change.afterAttribute}`).join('\n\n') + '\n';
await writeFile(new URL('./xml-attribute-diff.txt', outputRoot), diff);
console.log(JSON.stringify({sourceSha256: sourceHash, outputSha256: hash(generated), counts: manifest.counts,
  changedParts: changedParts.map(part => part.part), remainingLiteralInventory, verified: manifest.verified}, null, 2));
