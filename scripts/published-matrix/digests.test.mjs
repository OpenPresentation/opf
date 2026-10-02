// Negative controls for the digest comparison (RR-04): the cross-OS and determinism checks must fail on a one-byte
// difference, a missing state, an environment mismatch and a stale allow-list entry, and pass only what the allow-list explains.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {compareHosts, diffDigests} from './digests.mjs';

const state = (seed) => ({pptx: `pptx-${seed}`, svg: `svg-${seed}`, slides: [`a-${seed}`, `b-${seed}`], png: [`p-${seed}`, `q-${seed}`]});
const host = (overrides = {}) => ({
  digests: {states: 2, digests: {'pairwise-01 A': state(1), 'chart:pie': state(2)}},
  consumer: {svg: 'c-svg', png: 'c-png', pptx: 'c-pptx'},
  installed: {packages: {'@openpresentation/opf': {integrity: 'sha512-one'}}},
  determinism: {passed: true, node: 'v24.21.0', icu: '78.3', unicode: '17.0', tzdata: '2026c', graphemeSignature: '121111211112'},
  ...overrides
});

test('identical hosts have no differences', () => {
  const result = compareHosts({linux: host(), windows: host(), macos: host()});
  assert.deepEqual(result.differences, []);
  assert.deepEqual(result.stale, []);
  assert.equal(result.states, 2);
});

test('a single changed PPTX digest on one host is unexplained', () => {
  const changed = host();
  changed.digests.digests['pairwise-01 A'] = {...state(1), pptx: 'pptx-other'};
  const result = compareHosts({linux: host(), windows: changed, macos: host()});
  assert.deepEqual(result.differences.map((difference) => `${difference.key}.${difference.field}`), ['pairwise-01 A.pptx']);
  assert.deepEqual(result.differences[0].groups, [['linux', 'macos'], ['windows']]);
});

test('a changed PNG, a changed slide hash and a missing state are each reported', () => {
  const changed = host();
  changed.digests.digests['chart:pie'] = {...state(2), png: ['p-2', 'x'], slides: ['a-2', 'x']};
  delete changed.digests.digests['pairwise-01 A'];
  const result = compareHosts({linux: host(), windows: changed});
  assert.deepEqual(result.differences.map((difference) => `${difference.key}.${difference.field}`).sort(), ['chart:pie.png', 'chart:pie.slides', 'pairwise-01 A.pptx', 'pairwise-01 A.png', 'pairwise-01 A.slides', 'pairwise-01 A.svg'].sort());
});

test('a different ICU, tz database or package integrity is an environment difference', () => {
  const other = host();
  other.determinism = {...other.determinism, icu: '77.1', tzdata: '2025b'};
  other.installed = {packages: {'@openpresentation/opf': {integrity: 'sha512-two'}}};
  const result = compareHosts({linux: host(), windows: other});
  assert.deepEqual(result.differences.map((difference) => `${difference.key}.${difference.field}`).sort(), ['environment.icu', 'environment.tzdata', 'installed @openpresentation/opf.integrity']);
});

test('the allow-list explains exactly what it names, and a stale entry is reported', () => {
  const changed = host();
  changed.digests.digests['chart:pie'] = {...state(2), png: ['p-2', 'x']};
  const entries = [
    {id: 'pie-png-on-windows', reason: 'a reason', pattern: '^chart:pie$', fields: ['png'], hosts: ['linux', 'windows']},
    {id: 'stale', reason: 'matches nothing', pattern: '^nothing$'},
    {id: 'optional', reason: 'may match nothing', pattern: '^nothing$', optional: true}
  ];
  const result = compareHosts({linux: host(), windows: changed}, {entries});
  assert.deepEqual(result.differences, []);
  assert.deepEqual(result.allowed.map((item) => item.allowedBy), ['pie-png-on-windows']);
  assert.deepEqual(result.stale, ['stale']);
  // The same entry does not hide a PPTX difference, nor a difference on a host it does not name.
  changed.digests.digests['chart:pie'] = {...state(2), png: ['p-2', 'x'], pptx: 'other'};
  assert.deepEqual(compareHosts({linux: host(), windows: changed}, {entries}).differences.map((difference) => difference.field), ['pptx']);
  assert.deepEqual(compareHosts({linux: host(), windows: host(), macos: changed}, {entries}).differences.map((difference) => `${difference.key}.${difference.field}`), ['chart:pie.pptx', 'chart:pie.png']);
});

test('diffDigests names every differing field and honours ignored fields', () => {
  const baseline = {a: state(1), b: state(2)};
  const other = {a: {...state(1), svg: 'changed', png: ['x', 'q-1']}, c: state(3)};
  const {differing, informational} = diffDigests(baseline, other, {ignore: ['png']});
  assert.deepEqual(differing.sort(), ['a.svg', 'b: missing in the other run', 'c: missing in the baseline']);
  assert.deepEqual(informational, ['a.png']);
});

test('the committed allow-list names a reason for every entry', () => {
  const allowlist = JSON.parse(readFileSync(new URL('./allowlist.json', import.meta.url), 'utf8'));
  for (const entry of allowlist.entries) {
    assert.ok(entry.id && entry.reason && entry.reason.length > 20, `${entry.id}: an allow-list entry needs an id and a reason`);
    assert.ok(entry.pattern !== undefined || entry.fields !== undefined, `${entry.id}: an allow-list entry may not match everything`);
  }
});
