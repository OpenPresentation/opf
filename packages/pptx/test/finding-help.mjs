// Every finding opf-pptx reports says what the user can do (or that nothing is needed): the report gives a finding the help of its code,
// and a code with none reached users as an empty `help` (opf#1366: pptx/native-body-fallback). Each code the package source reports is scanned.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {Reporter} from '@openpresentation/opf/internal/engine';

const dir = new URL('../src/', import.meta.url);
const codes = new Map();
for (const file of readdirSync(dir).filter(name => name.endsWith('.js'))) {
  for (const [, code] of readFileSync(new URL(file, dir), 'utf8').matchAll(/\bcode:\s*['"]([a-z][a-z0-9-]+)['"]/g)) codes.set(code, file);
}
assert.ok(codes.size > 100, `scanned ${codes.size} codes`);
assert.ok(codes.has('native-body-fallback'));

const empty = [];
for (const [code, file] of codes) {
  const reporter = new Reporter();
  reporter.add('pptx', {code, path: 'slides.0', message: 'm'});
  const {help} = reporter.findings[0];
  if (typeof help !== 'string' || help.trim().length < 20 || !/[.!?]$/.test(help)) empty.push(`${code} (${file}): ${JSON.stringify(help)}`);
}
assert.deepEqual(empty, [], 'finding codes without a real help sentence');

const reporter = new Reporter();
reporter.add('pptx', {code: 'native-body-fallback', path: 'slides.2.title', message: 'm'});
assert.match(reporter.findings[0].help, /--body-text native/);
console.log(`pptx finding help: ${codes.size} codes, all with help`);
