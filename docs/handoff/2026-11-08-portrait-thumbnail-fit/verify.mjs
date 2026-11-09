import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const folder = new URL('./', import.meta.url), root = fileURLToPath(new URL('../../../', import.meta.url));
const read = name => fs.readFileSync(new URL(name, folder));
const json = name => JSON.parse(read(name));
const hash = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root });
const receipt = json('receipt.json'), files = json('files.json');
for (const a of files) {
 const stored = read(a.file), raw = a.compression === 'gzip' ? gunzipSync(stored) : stored;
 assert.equal(stored.length, a.storedBytes, a.file); assert.equal(hash(stored), a.storedSha256, a.file);
 assert.equal(raw.length, a.rawBytes, a.file); assert.equal(hash(raw), a.rawSha256, a.file);
}
assert.equal(git('rev-parse', receipt.source + '^{tree}').toString().trim(), receipt.sourceTree);
for (const s of receipt.sourceFiles) {
 const source = git('show', receipt.source + ':' + s.file);
 assert.equal(hash(source), s.sha256, s.file);
 assert.equal(fs.readFileSync(new URL('../../../' + s.file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'), source.toString().replace(/\r\n/g, '\n'), s.file);
}
for (const s of receipt.unchanged) assert.equal(git('rev-parse', receipt.source + ':' + s.file).toString().trim(), s.gitBlob, s.file);
const observations = name => JSON.parse(gunzipSync(read(name + '-observations.json.gz')));
const inside = (box, clip) => box.left >= clip.left - 1 && box.top >= clip.top - 1 && box.right <= clip.right + 1 && box.bottom <= clip.bottom + 1;
assert.ok(observations('before').at(-1).thumbnails.some(t => !inside(t.paintedSlide, t.clip)), 'original crop is retained');
const forward = observations('after'); assert.equal(forward.length, 7);
for (const phase of forward) for (const t of phase.thumbnails) {
 assert.ok(inside(t.paintedSlide, t.clip), phase.phase);
 assert.ok(Math.abs(t.matrix.a - t.matrix.d) < .0001, phase.phase);
 assert.ok(t.labels.every(label => label.bounds && inside(label.bounds, t.clip)), phase.phase);
}
const correction = JSON.parse(gunzipSync(read('check-text-after-restore.json.gz')));
assert.equal(correction.head, receipt.source); assert.equal(correction.tree, receipt.sourceTree); assert.equal(correction.exit, 0);
assert.equal(receipt.results.mapped.failed, 2); assert.equal(receipt.results.mapped.fullLocalGreen, false);
const later = git('diff', '--name-only', receipt.source, 'HEAD').toString().trim();
for (const p of later ? later.split('\n') : []) assert.ok(p.startsWith('docs/handoff/2026-11-08-portrait-thumbnail-fit/') || p === 'docs/programs/cloud-editor/burndown.md', p);
console.log(JSON.stringify({ verified: true, artifacts: files.length, source: receipt.source, paintedPhases: forward.length, textCorrectionPassed: true, originalMappedGreen: false }));
