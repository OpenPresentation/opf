// OPF 0.37 renamed eight keys. A PowerPoint file written before 0.37 keeps the old spelling inside its stored OPF records; the importer
// reads each record through core's rename table, so such a file imports as the same deck with the new keys. A record that needs no
// rewrite is the same object after the read.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {upgradeTag} from '../dist/legacy-tags.js';

const decode = xml => [...xml.matchAll(/<p:tag name="([^"]+)" val="([0-9A-Fa-f]*)"/g)].map(match => [match[1], Buffer.from(match[2], 'hex').toString('utf8')]);
const tagText = bytes => Object.entries(unzipSync(bytes)).filter(([part]) => /^ppt\/tags\/.*\.xml$/.test(part)).flatMap(([, data]) => decode(strFromU8(data)));

// 1. A file PowerPoint saved with 0.36 (the native-panels fixture) holds `languageFamily` (and the short script values) in its document record.
const legacy = new Uint8Array(await readFile(new URL('fixtures/lh34-native-panels/native-saved.pptx', import.meta.url)));
const stored = tagText(legacy).map(([, text]) => text).join('\n');
assert.match(stored, /"languageFamily"/, 'the 0.36 file stores the old key');
assert.doesNotMatch(stored, /"scriptGroup"/);
const imported = await fromPptx(legacy);
const text = JSON.stringify(imported);
assert.doesNotMatch(text, /"languageFamily"|"organizationId"|"verticalAlign"|"minFontSize"|"maxFontSize"/, 'no old key survives the import');
const errors = validate(imported).findings.filter(finding => finding.severity === 'error');
assert.deepEqual(errors.map(finding => `${finding.path}: ${finding.message}`), [], 'the imported deck is valid OPF 0.37');
assert.match(text, /"scriptGroup"/, 'the record is read as scriptGroup');

// 2. A file written now stores the new spelling, and importing it changes nothing.
const written = await toPptx(imported);
const storedNow = tagText(written).map(([, value]) => value).join('\n');
assert.doesNotMatch(storedNow, /"languageFamily"|"organizationId"|"verticalAlign"/);
const again = await fromPptx(written);
assert.deepEqual(validate(again).findings.filter(finding => finding.severity === 'error'), []);

// 3. A record that needs nothing is not rewritten, not even copied.
for (const [family, record] of [
  ['document', {v: 1, vocabulary: 2, slides: 1, design: {fontScheme: {scriptGroup: 'complexScript'}, background: {appearance: 'dark'}}, native: {}}],
  ['slide', {v: 1, vocabulary: 2, slide: 0, composition: {minFontSizePx: 16, maxFontSizePx: 40}, native: {}}],
  ['data', {v: 1, vocabulary: 2, kind: 'table', authored: {columns: ['A'], rows: [[{value: 'x', style: {anchor: 'top'}}]]}}],
]) assert.equal(upgradeTag(record, family), record, `${family}: the same object`);

// 4. An older record is rewritten by the table, and the input is left alone.
const old = {v: 1, vocabulary: 2, kind: 'table', authored: {columns: ['A'], rows: [[{value: 'x', style: {verticalAlign: 'top'}}]]}};
assert.deepEqual(upgradeTag(old, 'data').authored.rows[0][0].style, {anchor: 'top'});
assert.equal(old.authored.rows[0][0].style.verticalAlign, 'top');
const note = upgradeTag({v: 1, role: 'entry', slide: 0, entry: 0, number: 1, kind: 'reference', id: 'r', source: 'references.0', url: 'https://example.com/r'}, 'annotation');
assert.equal(note.link, 'https://example.com/r');
assert.equal(note.url, undefined);

console.log('Renamed keys: a 0.36 PowerPoint file imports as valid 0.37 OPF, records written now use the new spelling, current records are not copied.');
