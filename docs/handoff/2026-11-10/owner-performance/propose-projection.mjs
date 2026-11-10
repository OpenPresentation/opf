// Proposed typed vocabulary projection only. The immutable raw inputs stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceValidator} from './validate-source-inputs.mjs';
import {fileRecord} from './bindings.mjs';

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const inputDir = path.resolve(option('--inputs', 'artifacts/owner-performance-inputs'));
const out = path.resolve(option('--out', 'artifacts/owner-projection-proposal-ed51'));
const manifest = JSON.parse(readFileSync(new URL('input-manifest.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(!existsSync(out), 'Fresh proposal output required');
const validator = sourceValidator({moduleRoot: option('--module-root', process.cwd()), schemaRef: option('--schema-ref', 'ed51a7e8a6636bb2e08c9a446a7d22c21ad81066')});
const projected = [], records = [];
const at = (document, parts) => parts.reduce((value, key) => value[key], document);
for (const [name, key] of [['original-16', 'original'], ['extended-36', 'extended']]) {
  const raw = readFileSync(path.join(inputDir, name + '.opf.json'));
  assert.equal(hash(raw), manifest[key].sha256);
  const original = JSON.parse(raw), document = structuredClone(original), changes = [];
  assert.equal(document.language, 'en-US', 'This physical-to-logical proposal is scoped to the exact LTR owner workload');
  const rename = (parts, before, after, type) => {
    const object = at(document, parts);
    if (!Object.hasOwn(object, before)) return;
    assert.ok(!Object.hasOwn(object, after), 'Typed property collision');
    object[after] = object[before]; delete object[before];
    changes.push({kind: 'rename-property', type, parts, before, after});
  };
  const alignment = (parts, type) => {
    const object = at(document, parts), before = object.align;
    if (!['left', 'right'].includes(before)) return;
    const after = before === 'left' ? 'start' : 'end';
    object.align = after; changes.push({kind: 'alignment-enum', type, parts, property: 'align', before, after});
  };
  const before = document.design.titleAlignment;
  assert.equal(before, 'left'); document.design.titleAlignment = 'start';
  changes.push({kind: 'alignment-enum', type: 'Design.titleAlignment', parts: ['design'], property: 'titleAlignment', before, after: 'start'});
  rename(['design', 'footer'], 'left', 'start', 'HeaderFooter zone');
  rename(['design', 'footer'], 'right', 'end', 'HeaderFooter zone');
  const regions = {'top+middle:left+center+right': 'top+middle:start+center+end', 'bottom:left+center+right': 'bottom:start+center+end', left: 'start'};
  for (const [slideIndex, slide] of document.slides.entries()) {
    for (const [oldName, newName] of Object.entries(regions)) rename(['slides', slideIndex], oldName, newName, 'Slide promoted region');
    // Styled table cells keep their value, styles, physical padding and borders.
    // Only the declared TextStyle.align enum changes, never data cells or keys.
    if (slide.table) {
      for (const [columnIndex, cell] of (slide.table.columns ?? []).entries()) if (cell?.style) alignment(['slides', slideIndex, 'table', 'columns', columnIndex, 'style'], 'StyledTableCell TextStyle.align');
      for (const [rowIndex, row] of (slide.table.rows ?? []).entries()) for (const [columnIndex, cell] of row.entries()) if (cell?.style) alignment(['slides', slideIndex, 'table', 'rows', rowIndex, columnIndex, 'style'], 'StyledTableCell TextStyle.align');
    }
  }
  const inverse = structuredClone(document);
  for (const change of changes.toReversed()) {
    const object = at(inverse, change.parts);
    if (change.kind === 'rename-property') {object[change.before] = object[change.after]; delete object[change.after];}
    else object[change.property] = change.before;
  }
  assert.deepEqual(inverse, original, 'Typed inverse restores the entire original document value');
  assert.deepEqual(document.datasets, original.datasets, 'Dataset names, columns, numeric values and rows are untouched');
  assert.ok(validator.validate(document), JSON.stringify(validator.validate.errors));
  const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
  projected.push(document);
  records.push({name, rawBytes: raw.length, rawSha256: hash(raw), projectedBytes: bytes.length, projectedSha256: hash(bytes), valid: true, changes, inverseDeepEqual: true, rawAfterSha256: hash(readFileSync(path.join(inputDir, name + '.opf.json'))), bytes});
}
assert.deepEqual(projected[1].slides.slice(0, 16), projected[0].slides, 'The projected first sixteen slides remain identical');
mkdirSync(out, {recursive: true});
for (const record of records) writeFileSync(path.join(out, record.name + '.proposed.opf.json'), record.bytes, {flag: 'wx'});
const receipt = {scope: 'PROPOSED_TYPED_PROJECTION_NOT_ADOPTED_OR_BENCHMARKED', recipe: fileRecord(process.cwd(), fileURLToPath(import.meta.url)), schemaSource: validator.source, schemaRecords: validator.schemaRecords, ajv: validator.ajvVersion, ajvFormats: validator.formatsVersion, literalAndDatasetRewrite: false, firstSixteenProjectedSlideObjectsEqual: true, inverseScope: 'Whole parsed document deep equality; raw source bytes remain immutable and separately hash-verified', inputs: records.map(({bytes, ...record}) => record)};
writeFileSync(path.join(out, 'proposal.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({scope: receipt.scope, inputs: receipt.inputs.map(({name, projectedBytes, projectedSha256, changes}) => ({name, projectedBytes, projectedSha256, changes: changes.length})), out}));
