import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'gallery-bootstrap-test-')));
  const json = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), JSON.stringify(value));
  };
  mkdirSync(path.join(root, 'scripts'));
  copyFileSync(new URL('../scripts/bootstrap-engines.mjs', import.meta.url), path.join(root, 'scripts/bootstrap-engines.mjs'));
  copyFileSync(new URL('../scripts/bootstrap-pnpm.mjs', import.meta.url), path.join(root, 'scripts/bootstrap-pnpm.mjs'));
  copyFileSync(new URL('../scripts/bootstrap-command.mjs', import.meta.url), path.join(root, 'scripts/bootstrap-command.mjs'));
  copyFileSync(new URL('../scripts/bootstrap-artifacts.mjs', import.meta.url), path.join(root, 'scripts/bootstrap-artifacts.mjs'));
  json('package.json', { version: '3.0.0', type: 'module', opf: {catalogSchema: 3} });
  json('package-lock.json', {});
  const pins={galleryVersion:'3.0.0',core:{sha:'a'.repeat(40)},render:{sha:'b'.repeat(40)}};json('.github/bootstrap-engines.json',pins);
  for (const name of ['opf', 'opf-render','gallery']) json(`node_modules/@openpresentation/${name}/package.json`, { name: `@openpresentation/${name}`, version: name==='gallery'?'3.0.0':'0.18.1', opf:name==='gallery'?{catalogSchema:3}:undefined, exports: { '.': './index.js', './package.json': './package.json' } });
  for (const name of ['opf', 'opf-render','gallery']) writeFileSync(path.join(root, `node_modules/@openpresentation/${name}/index.js`), 'export {};');
  copyFileSync(path.join(root,'node_modules/@openpresentation/gallery/package.json'),path.join(root,'package.json'));
  writeFileSync(path.join(root,'.gitignore'),'node_modules/\n');
  spawnSync('git',['init','-q'],{cwd:root});spawnSync('git',['add','.'],{cwd:root});const committed=spawnSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','release'],{cwd:root});assert.equal(committed.status,0,committed.stderr?.toString());
  const gallerySha=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const hashes = Object.fromEntries(['package.json', 'package-lock.json'].map(name => [name, createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex')]));
  const resolved = Object.fromEntries([['core', 'opf'], ['render', 'opf-render']].map(([name, pkg]) => [name, { path: path.join(root, `node_modules/@openpresentation/${pkg}/package.json`), entry: path.join(root, `node_modules/@openpresentation/${pkg}/index.js`), version: '0.18.1' }]));
  for (const item of Object.values(resolved)) {
    item.entry = path.join(path.dirname(item.path), 'index.js');
    const digest = createHash('sha256');
    for (const name of ['index.js', 'package.json']) digest.update(name).update('\0').update(readFileSync(path.join(path.dirname(item.path), name))).update('\0');
    item.digest = digest.digest('hex');
  }
  const artifacts=['gallery','opf','opf-render'].map(pkg=>{const dir=path.join(root,`node_modules/@openpresentation/${pkg}`),text=readFileSync(path.join(dir,'package.json'),'utf8'),manifest=JSON.parse(text);const sha=bytes=>createHash('sha256').update(bytes).digest('hex');return {name:manifest.name,version:manifest.version,sourceSha:pkg==='opf'?pins.core.sha:pkg==='opf-render'?pins.render.sha:gallerySha,originalManifest:manifest,originalManifestText:text,originalManifestSha256:sha(Buffer.from(text)),stagedManifest:manifest,stagedManifestSha256:sha(Buffer.from(text)),sha256:'d'.repeat(64),files:['index.js','package.json'].map(file=>({path:file,bytes:readFileSync(path.join(dir,file)).length,sha256:sha(readFileSync(path.join(dir,file)))}))};});
  json('node_modules/.gallery-bootstrap.json', { hashes, resolved,pins,artifacts });
  return { root, json, run: () => spawnSync(process.execPath, ['scripts/bootstrap-engines.mjs', '--verify'], { cwd: root, encoding: 'utf8' }) };
}

test('bootstrap verification refuses changed release manifests and a renderer with a stale nested core', () => {
  const f = fixture();
  try {
    assert.equal(f.run().status, 0);
    const manifest=JSON.parse(readFileSync(path.join(f.root,'package.json'),'utf8'));
    f.json('package.json',{...manifest,opf:{catalogSchema:2}});
    assert.match(f.run().stderr,/Gallery 3 bootstrap requires catalog schema 3/);
    f.json('package.json',manifest);
    const stateFile=path.join(f.root,'node_modules/.gallery-bootstrap.json');
    const state=JSON.parse(readFileSync(stateFile,'utf8'));
    const incorrect=structuredClone(state);incorrect.artifacts[0].sourceSha='f'.repeat(40);
    f.json('node_modules/.gallery-bootstrap.json',incorrect);
    assert.match(f.run().stderr,/gallery source differs from current release HEAD/);
    f.json('node_modules/.gallery-bootstrap.json',state);
    const wrongDigest=structuredClone(state);wrongDigest.artifacts[1].stagedManifestSha256='f'.repeat(64);
    f.json('node_modules/.gallery-bootstrap.json',wrongDigest);
    assert.match(f.run().stderr,/installed staged metadata digest changed/);
    f.json('node_modules/.gallery-bootstrap.json',state);
    writeFileSync(path.join(f.root, 'node_modules/@openpresentation/opf/index.js'), 'export const registry = true;');
    assert.match(f.run().stderr, /bootstrap bytes changed|engine resolution changed/);
    writeFileSync(path.join(f.root, 'node_modules/@openpresentation/opf/index.js'), 'export {};');
    f.json('package-lock.json', { changed: true });
    assert.match(f.run().stderr, /modified the gallery manifest or lockfile/);
    f.json('package-lock.json', {});
    f.json('node_modules/@openpresentation/opf-render/node_modules/@openpresentation/opf/package.json', { version: '0.18.0', exports: { '.': './index.js', './package.json': './package.json' } });
    assert.match(f.run().stderr, /Renderer resolves a different core/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('later versions use registry engines and reject leftover bootstrap state', () => {
  const f = fixture();
  try {
    f.json('package.json', { version: '2.1.0', type: 'module' });
    assert.match(f.run().stderr, /Unexpected bootstrap state/);
    rmSync(path.join(f.root, 'node_modules/.gallery-bootstrap.json'));
    const result = f.run();
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Registry engines/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('Gallery 3 source pins still require the actual remote default branch on every bootstrap', () => {
  const source=readFileSync(new URL('../scripts/bootstrap-engines.mjs',import.meta.url),'utf8');
  assert.match(source,/pins\.galleryVersion !== '3\.0\.0' \|\| manifest\.opf\?\.catalogSchema !== 3/);
  assert.match(source,/\['merge-base', '--is-ancestor', pin\.sha, remoteHead\]/);
  assert.match(source,/\['fetch', 'origin', `refs\/heads\/\$\{branch\}:\$\{remoteHead\}`\]/);
  assert.doesNotMatch(source,/refs\/pull\/|GITHUB_EVENT_NAME|ignoreAncestry/);
});
