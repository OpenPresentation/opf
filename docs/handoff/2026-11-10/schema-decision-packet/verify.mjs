// Read-only review probe. No branch merge, schema generation or product mutation.
// Run from this checkout with installed workspace dependencies, or set
// OPF_SCHEMA_REVIEW_MODULES to a node_modules directory containing ajv and ajv-formats.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OPF_SCHEMA_REVIEW_MODULES
  ? path.join(path.resolve(process.env.OPF_SCHEMA_REVIEW_MODULES), '__review__.cjs')
  : path.join(root, 'packages/javascript/package.json'));
const Ajv = require('ajv/dist/2020.js');
const addFormats = require('ajv-formats');
const refs = {
  current: '7618e916dacc166463cddf5f2ea029f523bbe51d',
  proposed: 'c7d396520c324c2d448757e906c00cf326dbd99e',
};
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const schemaPath = 'spec/schemas/opf.schema.json';
const schemas = Object.fromEntries(Object.entries(refs).map(([name, ref]) => {
  const bytes = git('show', `${ref}:${schemaPath}`);
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);
  return [name, { ref, sha256: digest(bytes), validate: ajv.compile(JSON.parse(bytes)) }];
}));
const examples = JSON.parse(readFileSync(path.join(here, 'examples.json'), 'utf8'));
const validations = examples.map(({ id, schema, document }) => {
  const valid = schemas[schema].validate(document);
  assert.equal(valid, true, `${id}: ${JSON.stringify(schemas[schema].validate.errors)}`);
  return { id, schema, valid };
});

const legacyPath = 'packages/pptx/src/legacy-tags.js';
const legacyBytes = git('show', `${refs.proposed}:${legacyPath}`);
const { upgradeTag } = await import(`data:text/javascript;base64,${legacyBytes.toString('base64')}`);
const literal = 'slides.0.left';
const corruptionCases = [
  ['text', { text: literal }],
  ['code', { code: { source: literal, language: 'text' } }],
  ['table', { table: { columns: ['Field'], rows: [[literal]] } }],
  ['extension-string', { extensions: { note: literal } }],
  ['extension-vocabulary', { extensions: { titleAlignment: 'left' } }],
  ['extension-key', { extensions: { 'slides.0.left': 'literal data' } }],
].map(([id, input]) => {
  const output = upgradeTag(input);
  assert.notDeepEqual(output, input, `${id}: reproduce original defect without repairing source`);
  return { id, input, output, preserved: false };
});
const structural = { v: 1, role: 'caption', path: literal, align: 'right', text: 'Go left' };
const upgraded = upgradeTag(structural);
assert.equal(upgraded.path, 'slides.0.start');
assert.equal(upgraded.align, 'end');
assert.equal(upgraded.text, 'Go left');
const collision = { design: { footer: { left: { text: 'old' }, start: { text: 'new' } } } };
assert.deepEqual(upgradeTag(collision), collision);

const typo = { design: { titleAlignmnt: 'left' }, slides: [{ text: 'Plan' }] };
assert.equal(schemas.current.validate(typo), true);
assert.equal(schemas.proposed.validate(typo), false);

console.log(JSON.stringify({
  scope: 'schema validation and pure unadopted migration probe only; no composition, SVG, editor, PPTX or native acceptance',
  node: process.version,
  ajv: require('ajv/package.json').version,
  ajvFormats: require('ajv-formats/package.json').version,
  schemas: Object.fromEntries(Object.entries(schemas).map(([name, { ref, sha256 }]) => [name, { ref, path: schemaPath, sha256 }])),
  validations,
  legacy: { ref: refs.proposed, path: legacyPath, sha256: digest(legacyBytes), corruptionCases, structuralPositive: true, collisionPreserved: true },
  typo: { currentAccepts: true, proposedRejects: true },
}, null, 2));
