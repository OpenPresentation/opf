import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  auditEmbedVerifierSource,
  hasOfficeQuitInvocation,
  PERMITTED_CARLITO_FIXTURE_SHA256,
} from './native-font-embed-audit.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const embedVerifier = path.join(root, 'native-font-embed.ps1');
const editVerifier = path.join(root, 'native-font-edit.ps1');

assert.equal(process.versions.node.split('.')[0], '24', 'Native font embed controls require Node 24.');

const outcomes = [];

const embedSource = await readFile(embedVerifier, 'utf8');
const embedFailures = auditEmbedVerifierSource(embedSource);
assert.equal(embedFailures.length, 0, embedFailures.map(item => item.message).join('; '));
outcomes.push({name: 'embed-verifier-requests-embed', passed: true});

const editSource = await readFile(editVerifier, 'utf8');
assert.match(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/, 'Gate E native-font-edit must keep EmbedFonts 0.');
assert.doesNotMatch(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*-1\s*\)/, 'Gate E must not request font embedding.');
outcomes.push({name: 'gate-e-still-no-embed', passed: true});

assert.equal(PERMITTED_CARLITO_FIXTURE_SHA256.size, 4);
outcomes.push({name: 'carlito-fixture-set-bounded', passed: true});

assert.match(editSource, /tolerancePoints=0\.02/, 'Gate E native-font-edit must keep the 0.02pt geometry gate.');
outcomes.push({name: 'gate-e-geometry-gate-present', passed: true});

if (process.platform === 'win32') {
  const ps = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const child = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', embedVerifier, '-PureRegression'], {
    cwd: packageRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  outcomes.push({name: 'embed-pure-regression', passed: true});
} else {
  outcomes.push({name: 'embed-pure-regression', passed: true, skipped: 'non-Windows runner'});
}

const negative = auditEmbedVerifierSource('$script:presentation.SaveAs($savedPath,24,0)', {label: 'negative'});
assert.ok(negative.some(item => item.code === 'embed-forced-off'));
outcomes.push({name: 'audit-rejects-embed-off', passed: true});

assert.equal(
  auditEmbedVerifierSource("throw 'Embed harness must not call Application.Quit'").filter(item => item.code === 'application-quit').length,
  0,
  'Ban prose in strings must not trip application-quit',
);
assert.ok(hasOfficeQuitInvocation('$app.Quit()'), 'Real .Quit() invocations must be detected');
assert.ok(auditEmbedVerifierSource('$app.Quit()').some(item => item.code === 'application-quit'));
outcomes.push({name: 'audit-quit-ban-not-prose', passed: true});

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline controls for native-font-embed.ps1 and Carlito fixture bounds. No Office object was constructed on non-Windows runners.',
  node: process.version,
  embedVerifier,
  embedVerifierSha256: sha(embedSource),
  checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts/native-font-embed-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
