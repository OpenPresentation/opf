import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const folder = new URL('./', import.meta.url), root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = name => fs.readFileSync(new URL(name, folder));
const json = name => JSON.parse(read(name));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = b => createHash('sha256').update(b).digest('hex');
const receipt = json('combined-receipt.json'), proof = json('merge-proof.json'), files = json('files.json');
for (const f of files) {
 const stored = read(f.file), raw = gunzipSync(stored);
 assert.equal(stored.length, f.storedBytes, f.file); assert.equal(hash(stored), f.storedSha256, f.file);
 assert.equal(raw.length, f.rawBytes, f.file); assert.equal(hash(raw), f.rawSha256, f.file);
}
assert.equal(git('rev-parse', receipt.source + '^{tree}').toString().trim(), receipt.sourceTree);
for (const b of receipt.sourceBindings) {
 assert.equal(git('rev-parse', receipt.source + ':' + b.file).toString().trim(), b.gitBlob, b.file);
 assert.equal(git('rev-parse', 'HEAD:' + b.file).toString().trim(), b.gitBlob, b.file);
 assert.equal(hash(git('show', receipt.source + ':' + b.file)), b.sha256, b.file);
}
assert.deepEqual(git('diff', '--name-only', receipt.base, receipt.source, '--', 'packages').toString().trim().split('\n').sort(), proof.changedPackageFiles.slice().sort());
for (const ref of [proof.cacheEvidence, proof.fitEvidence]) git('merge-base', '--is-ancestor', ref, receipt.source);
for (const file of ['changes/ce-20-unused-thumbnail-cache.md', 'changes/ce-20-portrait-thumbnail-fit.md']) assert.equal(git('rev-parse', receipt.source + ':' + file).toString().trim(), git('rev-parse', 'HEAD:' + file).toString().trim());
const mapped = JSON.parse(gunzipSync(read('combined-mapped-exit.json.gz'))), browser = JSON.parse(gunzipSync(read('combined-workspace-browser-exit.json.gz')));
assert.equal(mapped.head, receipt.source); assert.equal(mapped.tree, receipt.sourceTree); assert.equal(mapped.exitCode, 0);
assert.equal(browser.source, receipt.source); assert.equal(browser.sourceAfter, receipt.source); assert.equal(browser.sourceTree, receipt.sourceTree); assert.equal(browser.sourceTreeAfter, receipt.sourceTree); assert.equal(browser.exit, 0); assert.equal(browser.attempt, 1);
assert.match(gunzipSync(read('combined-editor-contract.log.gz')).toString(), /146 scripts passed \(contract suite\)/);
const log = gunzipSync(read('combined-workspace-browser.log.gz'));
assert.equal(hash(log), browser.logSha256); assert.match(log.toString(), /workspace browser checks passed \(24\)/);
assert.equal(receipt.workspace.realCachePhasesPassed, 12); assert.equal(receipt.workspace.paintedFitPhasesPassed, 7);
const later = git('diff', '--name-only', receipt.source, 'HEAD').toString().trim();
for (const file of later ? later.split('\n') : []) assert.ok(file.startsWith('docs/handoff/2026-11-08/ce20-thumbnail-repairs/') || file === 'docs/programs/cloud-editor/burndown.md', file);
console.log(JSON.stringify({ verified: true, source: receipt.source, artifacts: files.length, editorScripts: 146, workspaceChecks: 24, realCachePhases: 12, paintedFitPhases: 7, attempts: 1 }));
