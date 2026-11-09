import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseBurndown } from '../../../programs/release-readiness/report.mjs';
const folder = new URL('./', import.meta.url), root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = name => fs.readFileSync(new URL(name, folder));
const json = name => JSON.parse(read(name));
const hash = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root });
const receipt = json('receipt.json'), files = json('files.json');
assert.equal(files.length, receipt.artifacts);
for (const a of files) {
 assert.ok(!a.file.includes('/') && !a.file.includes('..'));
 const stored = read(a.file), raw = gunzipSync(stored);
 assert.equal(stored.length, a.storedBytes, a.file); assert.equal(hash(stored), a.storedSha256, a.file);
 assert.equal(raw.length, a.rawBytes, a.file); assert.equal(hash(raw), a.rawSha256, a.file);
}
assert.equal(git('rev-parse', receipt.source + '^{tree}').toString().trim(), receipt.sourceTree);
assert.equal(git('rev-parse', receipt.metadata + '^{tree}').toString().trim(), receipt.metadataTree);
for (const b of receipt.packageBindings) {
 assert.equal(git('rev-parse', 'HEAD:' + b.file).toString().trim(), b.gitBlob, b.file);
 assert.equal(hash(git('show', receipt.source + ':' + b.file)), b.sha256, b.file);
}
for (const b of receipt.unchanged) assert.equal(git('rev-parse', 'HEAD:' + b.file).toString().trim(), b.gitObject, b.file);
assert.equal(git('diff', '--name-only', receipt.source, receipt.metadata, '--', 'packages').toString(), '');
const retry = JSON.parse(gunzipSync(read('cli-package-after-inputs.log.exit.json.gz')));
assert.equal(retry.source, receipt.metadata); assert.equal(retry.packageSource, receipt.source); assert.equal(retry.exit, 0);
const log = gunzipSync(read('cli-package-after-inputs.log.gz'));
assert.equal(hash(log), retry.sha256); assert.match(log.toString(), /pass 238/); assert.match(log.toString(), /CLI passed 94 command checks/); assert.match(log.toString(), /opf convert passed 82 drawing checks/);
assert.match(gunzipSync(read('metadata-check-changed.log.gz')).toString(), /check-changed: passed/);
assert.match(gunzipSync(read('check-changed.log.gz')).toString(), /3 of 12 steps failed/);
const menu = JSON.parse(gunzipSync(read('after-menu.log.gz'))); assert.equal(menu.passed, true); assert.equal(menu.checks.length, 18);
assert.equal(receipt.originalAggregateGreen, false); assert.equal(receipt.packedOrRegistryQualification, false);
parseBurndown(fs.readFileSync(new URL('../../../../docs/programs/release-readiness/burndown.md', import.meta.url), 'utf8'));
const later = git('diff', '--name-only', receipt.source, 'HEAD').toString().trim();
for (const file of later ? later.split('\n') : []) assert.ok(file.startsWith('docs/handoff/2026-11-08/rr105-catalog-contracts/') || file === 'docs/programs/release-readiness/burndown.md', file);
console.log(JSON.stringify({ verified: true, artifacts: files.length, source: receipt.source, metadata: receipt.metadata, packageInputsUnchanged: true, cliNodeTests: 238, commandChecks: 94, drawingChecks: 82, menuSections: 18, composedCoverage: true, originalAggregateGreen: false }));
