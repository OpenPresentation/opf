// opf-pptx#222: test/openxml/generate.mjs is a manual harness (its output goes to the Open XML SDK validator and to native
// PowerPoint comparisons), so nothing exercised it and it went stale (missing catalogs, the notesMasterIdLst order). This runs
// it offline from source and reads every generated package part back as XML, so it cannot rot unnoticed. No Office, COM, .NET or network.
// test/native-furniture-fixtures.mjs needs a registry-installed consumer (a published release), so it stays a manual run.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml } from '@rgrove/parse-xml';
import { unzipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'opf-pptx-openxml-'));
try {
  const output = path.join(temporary, 'new');
  const run = spawnSync(process.execPath, [path.join(root, 'test/openxml/generate.mjs'), output], { cwd: root, encoding: 'utf8', timeout: 240000, windowsHide: true });
  assert.equal(run.status, 0, `test/openxml/generate.mjs failed:\n${run.stdout}\n${run.stderr}`);
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.mode, 'source');
  assert.equal(manifest.cases.length, 21, 'the generator defines 21 cases');
  for (const variant of ['original', 'repacked', 'reordered']) {
    const files = (await readdir(path.join(output, variant))).sort();
    assert.deepEqual(files, manifest.cases.map(item => `${item.id}.pptx`).sort(), `${variant}: one deck per case`);
  }
  for (const item of manifest.cases) {
    assert.deepEqual(item.changedParts, ['ppt/presentation.xml'], `${item.id}: only presentation.xml differs in the reordered control`);
    // The production order is <p:notesMasterIdLst> before <p:sldIdLst>; the reordered diagnostic variant reverses it.
    for (const [variant, notesFirst] of [['original', true], ['reordered', false]]) {
      const entries = unzipSync(new Uint8Array(await readFile(path.join(output, variant, `${item.id}.pptx`))));
      for (const [name, bytes] of Object.entries(entries).filter(([name]) => /\.(?:xml|rels)$/.test(name)))
        assert.doesNotThrow(() => parseXml(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), `${variant}/${item.id}: ${name} is well-formed XML`);
      const presentation = new TextDecoder().decode(entries['ppt/presentation.xml']);
      const notes = presentation.indexOf('<p:notesMasterIdLst>'), slides = presentation.indexOf('<p:sldIdLst>');
      if (notes !== -1) assert.equal(notes < slides, notesFirst, `${variant}/${item.id}: notesMasterIdLst order`);
    }
  }
  console.log(`Open XML generator smoke passed: ${manifest.cases.length} cases, original and reordered controls read back as well-formed XML.`);
} finally {
  assert.ok(path.basename(temporary).startsWith('opf-pptx-openxml-'));
  await rm(temporary, { recursive: true, force: true });
}
