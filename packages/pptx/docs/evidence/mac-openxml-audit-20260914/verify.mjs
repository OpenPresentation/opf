import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
const root = new URL('./', import.meta.url);
const read = file => readFile(new URL(file, root));
const json = async file => JSON.parse(await read(file));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = await json('SHA256SUMS.json');
for (const [file, sha] of Object.entries(inventory)) assert.equal(hash(await read(file)), sha, file);
const manifests = Object.fromEntries(await Promise.all(['before', 'after', 'installed'].map(async phase => [phase, await json(`${phase}/manifest.json`)])));
assert.equal(manifests.after.cases.length, 21);
assert.deepEqual(manifests.installed.cases, manifests.after.cases);
for (const phase of ['before', 'after', 'installed']) {
  for (const variant of ['original', 'reordered']) {
    const sdk = await json(`${phase}/${variant}-sdk.json`), opc = await json(`${phase}/${variant}-opc.json`);
    assert.equal(sdk.sdkVersion, '3.5.1.0');
    assert.equal(sdk.results.length, 21);
    assert.equal(opc.results.length, 21);
    for (const item of manifests[phase].cases) {
      const folder = phase === 'before' && item.id === 'notes-control' ? 'before' : 'after';
      const file = `${item.id}.pptx`, sha = hash(await read(`${folder}/${variant}/${file}`));
      assert.equal(sha, item[`${variant}Sha256`]);
      const result = sdk.results.find(entry => entry.file === file);
      assert.equal(result.sha256, sha);
      assert.equal(result.exception, undefined);
      assert.deepEqual(result.versions.map(v => v.target), ['Office2007', 'Office2019', 'Microsoft365']);
      for (const version of result.versions) {
        assert.equal(version.errors.length, variant === 'original' ? 1 : 0);
        if (variant === 'original') {
          assert.equal(version.errors[0].id, 'Sch_UnexpectedElementContentExpectingComplex');
          assert.equal(version.errors[0].part, '/ppt/presentation.xml');
          assert.match(version.errors[0].description, /notesMasterIdLst/);
        }
      }
      const relationships = opc.results.find(entry => entry.file === file);
      assert.equal(relationships.sha256, sha);
      assert.deepEqual(relationships.errors, phase === 'before' && item.id === 'notes-control' ? [{code: 'missing-content-type-part', part: '/ppt/slideMasters/slideMaster2.xml'}] : []);
    }
  }
}
for (const item of manifests.after.cases) {
  const before = unzipSync(await read(`after/original/${item.id}.pptx`)), after = unzipSync(await read(`after/reordered/${item.id}.pptx`));
  assert.deepEqual(Object.keys(before).sort(), Object.keys(after).sort());
  assert.deepEqual(Object.keys(before).filter(key => hash(before[key]) !== hash(after[key])), ['ppt/presentation.xml']);
}
const damage = (await json('negative-control/report.json')).results[0];
assert.equal(hash(await read('negative-control/damaged.pptx')), damage.sha256);
assert.deepEqual(damage.errors.map(e => e.code).sort(), ['duplicate-relationship-id', 'missing-content-type-part', 'missing-internal-target']);
assert.match((await read('logs/npm-test-after.log')).toString(), /Corpus structure passed: 126 decks, 805 slides/);
assert.match((await read('logs/packed-install-after-network.log')).toString(), /Local tarball consumer passed/);
console.log(`Verified ${Object.keys(inventory).length} evidence hashes, 21 source/installed pairs, original SDK failures, reordered SDK success and package controls. Native acceptance remains pending.`);
