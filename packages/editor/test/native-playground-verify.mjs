import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fromPptx } from '@openpresentation/opf-pptx';
import { validate } from '@openpresentation/opf';

const root = new URL('../artifacts/browser-evidence/', import.meta.url);
const report = JSON.parse((await readFile(new URL('native.json', root), 'utf8')).replace(/^\uFEFF/, ''));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(report.sourceSha256, hash(await readFile(new URL('export.pptx', root))), 'Run the native check again for this browser export');
const bytes = await readFile(new URL('native-saved.pptx', root));
const presentation = await fromPptx(bytes);
assert.equal(validate(presentation, { only: ["format"] }).valid, true);
assert.equal(presentation.slides.length, 1);
assert.match(JSON.stringify(presentation), /Edited in native PowerPoint/);
let tables = 0;
const visit = value => {
  if (!value || typeof value !== 'object') return;
  if (value.table) tables++;
  Object.values(value).forEach(visit);
};
visit(presentation);
assert.equal(tables, 1);
report.savedSha256 = hash(bytes);
report.nativeSavedReimportValid = true;
report.nativeSavedReimportTables = tables;
await writeFile(new URL('native.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
