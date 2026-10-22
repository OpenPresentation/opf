import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_ENV, compareVersions, decide, declaredFloor, gate, gateSkipped, installedCoreVersion, parseVersion } from '../scripts/published-core-gate.mjs';

// RR-55: the gate that skips only the packed install against published core while a declared unreleased core is not on npm.
const cmp = (a, b) => compareVersions(a, b);
assert.equal(cmp('0.13.0', '0.14.0'), -1);
assert.equal(cmp('0.14.0', '0.14.0'), 0);
assert.equal(cmp('0.14.1', '0.14.0'), 1);
assert.equal(cmp('0.9.0', '0.14.0'), -1, 'numeric, not lexical');
assert.equal(cmp('1.0.0', '0.99.99'), 1);
assert.equal(cmp('0.14.0-rc.1', '0.14.0'), -1, 'a prerelease is lower than its release');
assert.equal(cmp('0.14.0', '0.14.0-rc.1'), 1);
assert.equal(cmp('0.14.0-rc.1', '0.14.0-rc.2'), -1);
assert.equal(cmp('0.14.0-rc.2', '0.14.0-rc.10'), -1, 'numeric identifiers compare as numbers');
assert.equal(cmp('0.14.0-alpha', '0.14.0-alpha.1'), -1, 'a shorter prerelease is lower');
assert.equal(cmp('0.14.0-alpha.1', '0.14.0-beta'), -1);
assert.equal(cmp('0.14.0-1', '0.14.0-alpha'), -1, 'numeric identifiers are lower than alphanumeric');
assert.equal(cmp('0.14.0+build.5', '0.14.0'), 0, 'build metadata is ignored');
assert.equal(cmp('0.13.0-rc.1', '0.14.0-rc.1'), -1);
assert.throws(() => cmp('latest', '0.14.0'), /not a semver version/);
assert.equal(parseVersion('v0.14.0'), null);
assert.equal(parseVersion('0.14'), null);
assert.equal(parseVersion('01.2.3'), null);

assert.equal(declaredFloor({}), null);
assert.equal(declaredFloor({ opf: {} }), null);
assert.equal(declaredFloor({ opf: { requiresUnreleasedCore: '0.14.0' } }), '0.14.0');
assert.throws(() => declaredFloor({ opf: { requiresUnreleasedCore: '^0.14.0' } }), /must be a version/);
assert.throws(() => declaredFloor({ opf: { requiresUnreleasedCore: 14 } }), /must be a version/);

assert.deepEqual(decide({ declared: null, installed: '0.13.1' }), { skip: false }, 'no field: behaviour is unchanged, and no installed core is needed');
assert.deepEqual(decide({ declared: null, installed: null }), { skip: false });
assert.equal(decide({ declared: '0.14.0', installed: '0.13.1' }).skip, true);
assert.match(decide({ declared: '0.14.0', installed: '0.13.1' }).message, /requiresUnreleasedCore 0\.14\.0.*is 0\.13\.1.*test:packed.*skipped/);
assert.equal(decide({ declared: '0.14.0', installed: '0.14.0-rc.1' }).skip, true, 'a prerelease of the declared core is still lower');
assert.equal(decide({ declared: '0.14.0', installed: '0.14.0' }).skip, false, 'once core is published the check runs again');
assert.equal(decide({ declared: '0.14.0', installed: '0.15.2' }).skip, false);
assert.equal(decide({ declared: '0.14.0-rc.1', installed: '0.14.0-rc.2' }).skip, false);
assert.throws(() => decide({ declared: '0.14.0', installed: null }), /run npm ci first/);

const scratch = mkdtempSync(path.join(tmpdir(), 'published-core-gate-'));
try {
  const pkg = (manifest, installed) => {
    const root = mkdtempSync(path.join(scratch, 'pkg-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', ...manifest }));
    if (installed) {
      const dir = path.join(root, 'node_modules', '@openpresentation', 'opf');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@openpresentation/opf', version: installed }));
    }
    return root;
  };
  assert.equal(installedCoreVersion(pkg({}, '0.13.1')), '0.13.1');
  assert.equal(gate(pkg({}, '0.13.1')).skip, false);
  assert.equal(gate(pkg({}, null)).skip, false, 'no field, no installed core needed');
  assert.equal(gate(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.13.1')).skip, true);
  assert.equal(gate(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.14.0')).skip, false);
  assert.throws(() => gate(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, null)), /run npm ci first/);
  // --forbid (release workflows): any declared field is refused, even one the installed core already satisfies
  assert.throws(() => gate(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.15.0'), { forbid: true }), /must be deleted before a release/);
  assert.equal(gate(pkg({}, '0.13.1'), { forbid: true }).skip, false);


  // The CLI as CI runs it: a notice and skip=true in $GITHUB_OUTPUT, exit 0; no field leaves skip=false; a bad field exits 1.
  const script = fileURLToPath(new URL('../scripts/published-core-gate.mjs', import.meta.url));
  const out = path.join(scratch, 'github-output');
  const envFile = path.join(scratch, 'github-env');
  const run = (root, args = []) => {
    writeFileSync(out, '');
    writeFileSync(envFile, '');
    const result = spawnSync(process.execPath, [script, '--root', root, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out, GITHUB_ENV: envFile } });
    return { ...result, output: readFileSync(out, 'utf8'), exported: readFileSync(envFile, 'utf8') };
  };
  const skipping = run(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.13.1'));
  assert.equal(skipping.status, 0, skipping.stderr);
  assert.equal(skipping.output, 'skip=true\n');
  assert.equal(skipping.exported, 'OPF_PUBLISHED_CORE_GATE=skip\n', 'a skip is exported to the later steps through $GITHUB_ENV');
  assert.match(skipping.stdout, /^::notice::RR-55: .*0\.14\.0.*0\.13\.1/m);
  const plain = run(pkg({}, '0.13.1'));
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(plain.output, 'skip=false\n');
  assert.equal(plain.exported, '', 'no skip, nothing exported');
  assert.equal(plain.stdout.includes('::notice::'), false, 'no field: silent');
  assert.equal(run(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.14.0')).output, 'skip=false\n');
  const invalid = run(pkg({ opf: { requiresUnreleasedCore: 'soon' } }, '0.13.1'));
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout + invalid.stderr, /::error::package\.json opf\.requiresUnreleasedCore must be a version/);
  assert.equal(run(pkg({ opf: { requiresUnreleasedCore: '0.14.0' } }, '0.14.0'), ['--forbid']).status, 1);
  assert.equal(run(pkg({}, null), ['--forbid']).status, 0);

  // The tests that install or bundle against published dependencies honour the exported variable.
  assert.equal(GATE_ENV, 'OPF_PUBLISHED_CORE_GATE');
  assert.equal(gateSkipped({ OPF_PUBLISHED_CORE_GATE: 'skip' }), true);
  assert.equal(gateSkipped({}), false, 'a local run without the variable still runs them');
  assert.equal(gateSkipped({ OPF_PUBLISHED_CORE_GATE: 'run' }), false);
  const bundleTest = fileURLToPath(new URL('./packed-bundle-browser.mjs', import.meta.url));
  const env = { ...process.env, OPF_PUBLISHED_CORE_GATE: 'skip' };
  const skipped = spawnSync(process.execPath, [bundleTest], { encoding: 'utf8', env, timeout: 60000 });
  assert.equal(skipped.status, 0, skipped.stdout + skipped.stderr);
  assert.match(skipped.stdout, /^::notice::RR-55: packed browser bundle skipped/m);
  assert.doesNotMatch(skipped.stdout, /Packed browser bundle passed/);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log('published-core-gate: ok');
