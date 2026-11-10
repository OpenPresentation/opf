// Compile immutable schema Git blobs with AJV; never read mutable product dist.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const root = process.cwd();
export function sourceValidator({schemaRef = 'ed51a7e8a6636bb2e08c9a446a7d22c21ad81066', moduleRoot = root} = {}) {
const require = createRequire(path.join(path.resolve(moduleRoot), 'packages/javascript/package.json'));
const Ajv = require('ajv/dist/2020.js').default;
const formats = require('ajv-formats').default;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {maxBuffer: 16 * 1024 * 1024});
const source = git('rev-parse', schemaRef).toString().trim();
const schemas = git('ls-tree', '-r', '--name-only', source, 'spec/schemas').toString().trim().split('\n').filter(file => file.endsWith('.schema.json'));
const ajv = new Ajv({allErrors: true, verbose: true, strict: false, allowUnionTypes: true});
formats(ajv);
const schemaRecords = [];
let rootId;
for (const file of schemas) {
  const bytes = git('show', source + ':' + file);
  const schema = JSON.parse(bytes);
  ajv.addSchema(schema);
  if (file === 'spec/schemas/opf.schema.json') rootId = schema.$id;
  schemaRecords.push({file, gitBlob: git('rev-parse', source + ':' + file).toString().trim(), bytes: bytes.length, sha256: hash(bytes)});
}
const validate = ajv.getSchema(rootId);
assert.ok(validate);
return {validate, source, schemaRecords, ajvVersion: require('ajv/package.json').version, formatsVersion: require('ajv-formats/package.json').version};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const schemaRef = option('--schema-ref', 'ed51a7e8a6636bb2e08c9a446a7d22c21ad81066');
const moduleRoot = path.resolve(option('--module-root', root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const {validate,source,schemaRecords,ajvVersion,formatsVersion} = sourceValidator({schemaRef,moduleRoot});
const manifest = JSON.parse(readFileSync(new URL('input-manifest.json', import.meta.url)));
const inputDir = path.resolve(option('--inputs', 'artifacts/owner-performance-inputs'));
const inputs = [];
for (const [name, key] of [['original-16', 'original'], ['extended-36', 'extended']]) {
  const bytes = readFileSync(path.join(inputDir, name + '.opf.json'));
  assert.equal(bytes.length, manifest[key].bytes);
  assert.equal(hash(bytes), manifest[key].sha256);
  const valid = validate(JSON.parse(bytes));
  const errors = (validate.errors ?? []).map(({instancePath, schemaPath, keyword, params, message}) => ({instancePath, schemaPath, keyword, params, message}));
  inputs.push({name, bytes: bytes.length, sha256: hash(bytes), valid, errors});
}
const result = {scope: 'IMMUTABLE_SCHEMA_AJV_ONLY_NOT_PRODUCT_BUILD_OR_BENCHMARK', schemaSource: source, schemaRecords, ajv: ajvVersion, ajvFormats: formatsVersion, moduleRoot, inputs};
const out = path.resolve(option('--out', 'artifacts/owner-raw-ed51-schema.json'));
assert.ok(!existsSync(out), 'Fresh validation receipt required');
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({schemaSource: source, schemas: schemaRecords.length, inputs: inputs.map(({name, valid, errors}) => ({name, valid, errors: errors.length})), out}));

}
