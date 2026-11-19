// Every finding opf-pptx reports says what the user can do (or that nothing is needed): the report gives a finding the help of its code,
// and a code with none reached users as an empty `help` (opf#1366: pptx/native-body-fallback). Each code the package source reports is scanned:
// a `code:` field (every literal of its expression, so both codes of a ternary), the code argument of the positional report helpers
// (`report('code', message)`, `report(path, 'code', message)`, `report(frame, cell, 'code', message)`), and the warnings opf-pptx passes
// on from core under its own prefix. A code built from a template string is not seen; the literal codes it builds are listed elsewhere in
// the source. Thrown OPFPptxError codes (errors that stop an export or import) are not covered here.
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {Reporter} from '@openpresentation/opf/internal/engine';

const dir = new URL('../src/', import.meta.url);
const CODE = /['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"]/g;
const codes = new Map();
for (const file of readdirSync(dir).filter(name => name.endsWith('.js'))) {
  const source = readFileSync(new URL(file, dir), 'utf8');
  for (const [, expression] of source.matchAll(/\bcode\s*:\s*([^,}]*)/g)) for (const [, code] of expression.matchAll(CODE)) codes.set(code, file);
  // The first literal of a report call that more arguments follow (a one-argument report('tight-wrap') is a fallback reason, not a code).
  for (const [, code] of source.matchAll(/\breport\(\s*(?:(?:[A-Za-z_$][\w$.]*|''|""|`[^`]*`)\s*,\s*){0,2}['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"]\s*,/g)) codes.set(code, file);
}
// Core's warnings that opf-pptx reports as its own (index.js: the chart data and option diagnostics and the variable notes of toPptx).
const core = readdirSync(new URL('../../javascript/src/', import.meta.url)).filter(name => name.endsWith('.ts'))
  .map(name => readFileSync(new URL(`../../javascript/src/${name}`, import.meta.url), 'utf8')).join('\n');
for (const code of ['chart-mapping-adapted', 'chart-highlight-adapted', 'chart-option-adapted', 'variable-example-used', 'variable-builtin-missing']) {
  assert.ok(core.includes(`'${code}'`) || core.includes(`"${code}"`), `core no longer reports ${code}`);
  codes.set(code, 'core');
}
assert.ok(codes.size > 150, `scanned ${codes.size} codes`);
for (const code of ['native-body-fallback', 'unsupported-table-merge', 'unsupported-body-text-style', 'theme-unverified', 'layout-reference-changed', 'unresolved-asset-reference'])
  assert.ok(codes.has(code), `the scan misses ${code}`);

const root = new URL('../../../', import.meta.url);
const bad = [];
for (const [code, file] of codes) {
  const reporter = new Reporter();
  reporter.add('pptx', {code, path: 'slides.0', message: 'm'});
  const {help} = reporter.findings[0];
  if (typeof help !== 'string' || help.trim().length < 40 || !/[.!?]$/.test(help) || /\b(TODO|TBD|FIXME|XXX)\b|lorem/i.test(help)) bad.push(`${code} (${file}): ${JSON.stringify(help)}`);
  // A path the help sends the reader to exists.
  for (const [cited] of help?.matchAll(/\bdocs\/[\w./-]+\.md\b/g) ?? []) if (!existsSync(new URL(cited, root))) bad.push(`${code}: cites missing ${cited}`);
}
assert.deepEqual(bad, [], 'finding codes without a real help sentence');

const reporter = new Reporter();
reporter.add('pptx', {code: 'native-body-fallback', path: 'slides.2.title', message: 'm'});
assert.match(reporter.findings[0].help, /--body-text native/);
console.log(`pptx finding help: ${codes.size} codes, all with help`);
