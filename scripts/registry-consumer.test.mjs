import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CONSUMER_PACKAGES, ESBUILD_VERSION, consumerManifest, consumerPackages, existsAtRef, fileAtRef, installConsumer, parsePins, pinOverrides,
  registryManifest, rendererOptionalPeers, resolveRef, verifiedPackages,
} from './registry-consumer.mjs';
import { registryPlan } from './registry-plan.mjs';
import { developerQuickstartInput, DEVELOPER_QUICKSTART_FILE, QUICKSTART_033 } from './developer-quickstart-input.mjs';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const withDirectory = (action) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'registry-consumer-'));
  return Promise.resolve(action(directory)).finally(() => rmSync(directory, { recursive: true, force: true }));
};
const git = (cwd, ...args) => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

// What `npm view <name>@<spec>` answers for a published set, for registryPlan().
const view = (versions = {}) => (spec) => {
  const at = spec.lastIndexOf('@');
  const name = spec.slice(0, at);
  return { version: versions[name] ?? spec.slice(at + 1), gitHead: 'a'.repeat(40) };
};

test('MR-56: the set is registryPlan() at the shared version; a pin overrides one package', () => {
  const shared = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  assert.deepEqual(shared, CONSUMER_PACKAGES.map((name) => ({ name, version: '0.26.0' })), 'the five libraries, in the order the site manifest lists them');
  const pins = parsePins(['opf-editor=0.25.3', '@openpresentation/cli=0.25.1', 'gallery=5.0.0']);
  assert.equal(pinOverrides(pins), '@openpresentation/opf-editor@0.25.3,@openpresentation/cli@0.25.1,@openpresentation/gallery@5.0.0');
  const pinned = registryPlan({ tag: '0.25.0', refs: false, overrides: pinOverrides(pins), view: (spec) => ({ version: spec.slice(spec.lastIndexOf('@') + 1) === '0.25.0' ? '0.25.0' : spec.slice(spec.lastIndexOf('@') + 1), gitHead: 'b'.repeat(40) }) });
  assert.deepEqual(Object.fromEntries(consumerPackages(pinned).map((item) => [item.name, item.version])), {
    '@openpresentation/opf': '0.25.0', '@openpresentation/opf-render': '0.25.0', '@openpresentation/opf-editor': '0.25.3', '@openpresentation/opf-pptx': '0.25.0', '@openpresentation/cli': '0.25.1',
  });
  assert.throws(() => consumerPackages({ packages: [] }), /has no @openpresentation\/opf/);
  assert.equal(pinOverrides(), '');
  for (const bad of ['opf-editor', 'opf-editor=1.0', 'nope=0.26.0', 'opf=0.26.0=1']) assert.throws(() => parsePins([bad]), /--pin needs/, bad);
});

test('MR-56: the consumer installs the five libraries at exact versions, the bundler and the renderer\'s optional peers', () => {
  const renderer = {
    dependencies: { harfbuzzjs: '0.4.0' },
    peerDependencies: { sharp: '^0.35.5', '@expo-google-fonts/arimo': '^0.4.0', required: '^1.0.0', bundled: '^1.0.0' },
    peerDependenciesMeta: { sharp: { optional: true }, '@expo-google-fonts/arimo': { optional: true }, bundled: { optional: true } },
    devDependencies: { sharp: '0.35.5' },
  };
  renderer.dependencies.bundled = '1.0.0';
  assert.deepEqual(rendererOptionalPeers(renderer), { sharp: '0.35.5', '@expo-google-fonts/arimo': '^0.4.0' }, 'tested version, else the range; required peers and bundled ones are not added');
  const manifest = consumerManifest({ packages: consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() })), rendererPackage: renderer });
  assert.equal(manifest.dependencies.esbuild, ESBUILD_VERSION);
  assert.equal(manifest.dependencies['@openpresentation/opf-editor'], '0.26.0');
  assert.equal(manifest.dependencies.sharp, '0.35.5');
  assert.ok(!('@openpresentation/gallery' in manifest.dependencies), 'core brings the gallery package');
  assert.equal(manifest.type, 'module');
});

test('MR-56: the bundler is the esbuild the workspace builds with', () => {
  assert.match(readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'), new RegExp(`^  '?esbuild@${ESBUILD_VERSION.replaceAll('.', '\\.')}'?:`, 'm'));
});

test('MR-56: a ref names one commit and its files are read from that commit, not from the working tree', () => withDirectory((directory) => {
  git(directory, 'init', '-q', '-b', 'main');
  mkdirSync(path.join(directory, 'packages/editor/examples'), { recursive: true });
  writeFileSync(path.join(directory, 'packages/editor/examples/playground.js'), 'one');
  git(directory, 'add', '-A');
  git(directory, 'commit', '-q', '-m', 'one');
  git(directory, 'tag', 'v0.26.0');
  const first = git(directory, 'rev-parse', 'HEAD');
  writeFileSync(path.join(directory, 'packages/editor/examples/playground.js'), 'two');
  writeFileSync(path.join(directory, 'packages/editor/examples/later.js'), 'later');
  git(directory, 'add', '-A');
  git(directory, 'commit', '-q', '-m', 'two');
  assert.equal(resolveRef('v0.26.0', { cwd: directory }), first, 'an annotated or lightweight tag resolves to its commit');
  assert.match(resolveRef('HEAD', { cwd: directory }), /^[a-f0-9]{40}$/);
  assert.notEqual(resolveRef('HEAD', { cwd: directory }), first);
  assert.equal(fileAtRef(first, 'packages/editor/examples/playground.js', { cwd: directory }), 'one');
  assert.equal(fileAtRef('HEAD', 'packages/editor/examples/playground.js', { cwd: directory }), 'two');
  assert.equal(existsAtRef(first, 'packages/editor/examples/later.js', { cwd: directory }), false);
  assert.equal(existsAtRef('HEAD', 'packages/editor/examples/later.js', { cwd: directory }), true);
  assert.throws(() => fileAtRef(first, 'packages/editor/examples/later.js', { cwd: directory }), /failed/);
  assert.throws(() => resolveRef('v9.9.9', { cwd: directory }), /does not name a commit|failed/);
  for (const bad of ['', '--output=x', undefined]) assert.throws(() => resolveRef(bad, { cwd: directory }), /not a git ref/, String(bad));
}));

test('MR-56: the renderer manifest is the registry\'s, for exactly the version asked for', () => {
  const answer = (body, status = 0) => () => ({ status, stdout: JSON.stringify(body), stderr: 'npm error E404\nmore' });
  assert.deepEqual(registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({ name: '@openpresentation/opf-render', version: '0.26.0', peerDependencies: {} }) }).version, '0.26.0');
  assert.throws(() => registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({}, 1) }), /not on the registry: npm error E404/);
  assert.throws(() => registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({ name: '@openpresentation/opf-render', version: '0.25.0' }) }), /answered/);
});

function fakeInstall(directory, packages, { link = false, resolved = 'https://registry.npmjs.org/x/-/x.tgz', integrity = 'sha512-abc' } = {}) {
  const lock = { packages: {} };
  for (const { name, version } of packages) {
    mkdirSync(path.join(directory, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(directory, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
    lock.packages[`node_modules/${name}`] = { version, resolved, integrity, ...(link ? { link: true } : {}) };
  }
  writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify(lock));
}

test('MR-56: only a clean registry install of the exact versions is accepted', () => withDirectory(async (directory) => {
  const expected = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  fakeInstall(directory, expected);
  const packages = await verifiedPackages(directory, expected);
  assert.deepEqual(packages.map((item) => item.name), CONSUMER_PACKAGES, 'the manifest order the site verifier expects');
  assert.ok(packages.every((item) => item.integrity === 'sha512-abc' && item.tarball.startsWith('https://registry.npmjs.org/')));
  await assert.rejects(verifiedPackages(directory, consumerPackages(registryPlan({ tag: '0.26.1', refs: false, view: view() }))), /clean registry installation/);
  fakeInstall(directory, expected, { link: true });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
  fakeInstall(directory, expected, { resolved: 'file:../x.tgz' });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
  fakeInstall(directory, expected, { integrity: 'sha1-abc' });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
}));

test('MR-56: an install of the same set is reused without npm', () => withDirectory(async (directory) => {
  const consumer = path.join(directory, 'consumer');
  const packages = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  const options = { directory: consumer, packages, rendererPackage: {} };
  mkdirSync(consumer, { recursive: true });
  writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify(consumerManifest(options), null, 2)}\n`);
  fakeInstall(consumer, packages);
  const reused = await installConsumer(options);
  assert.equal(reused.directory, consumer);
  assert.equal(reused.packages.length, CONSUMER_PACKAGES.length);
}));

test('MR-56: the gallery editor scripts read no release plan and no sibling checkout but the pptx.gallery site', () => {
  for (const file of ['scripts/vendor-gallery-editor.mjs', 'scripts/gallery-editor-assets.mjs', 'scripts/registry-consumer.mjs']) {
    // Code only: no comment lines, and registry-consumer.mjs borrows the module-resolution helpers of registry-toolchain.mjs.
    const code = readFileSync(path.join(root, file), 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line) && !/^import .* from '\.\/registry-toolchain\.mjs';$/.test(line)).join('\n');
    assert.ok(!/release-plan|registry-toolchain|\.\.\/opf-(editor|render|pptx)|verificationRefs|exampleRefs/.test(code), `${file} names the release plan or a sibling checkout`);
  }
});

test('MR-56: vendor-gallery-editor needs a version, a site directory and a known pin before it touches anything', () => {
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/vendor-gallery-editor.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /usage: vendor-gallery-editor\.mjs --version X\.Y\.Z/);
  assert.match(run('--version', '0.26.0', '--site').stderr, /--site needs a value/);
  assert.match(run('--version', '0.26.0', '--pin', 'nope=0.26.0').stderr, /--pin needs/);
  assert.match(run('--version', '0.26', '--site', '/x').stderr, /usage: vendor-gallery-editor/);
  assert.match(run('--version', '0.26.0', '--ref', 'no-such-ref', '--site', '/x').stderr, /does not name a commit|failed/);
});

test('MR-56: pnpm vendor:gallery-editor runs the script, and no registry-mode prepare script is left', () => {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['vendor:gallery-editor'], 'node scripts/vendor-gallery-editor.mjs');
  assert.equal(scripts['prepare:gallery:registry'], undefined);
});

// Input selection follows the real registry plan's core version/ref, not source
// package.json or a caller-provided schema toggle. No network/product import.
const quickstartPlan=(version,gitHead=QUICKSTART_033.gitHead)=>registryPlan({tag:version,refs:false,view:()=>({version,gitHead})});
test('published033 quickstart selects exact immutable release bytes, preserving all authored values and double spaces',()=>{
 const input=developerQuickstartInput(quickstartPlan('0.33.0'),{cwd:root}),release=Buffer.from(fileAtRef(QUICKSTART_033.gitHead,DEVELOPER_QUICKSTART_FILE,{cwd:root}));assert.deepEqual(input.bytes,release);assert.equal(input.bytes.length,5615);assert.equal(createHash('sha256').update(input.bytes).digest('hex'),QUICKSTART_033.sha256);assert.deepEqual(input.provenance,{kind:'registry-release-input',version:'0.33.0',registryGitHead:QUICKSTART_033.gitHead,sourceRef:QUICKSTART_033.gitHead,path:DEVELOPER_QUICKSTART_FILE,bytes:5615,sha256:QUICKSTART_033.sha256});
 const original=JSON.parse(input.bytes),current=JSON.parse(readFileSync(path.join(root,DEVELOPER_QUICKSTART_FILE))),projected=structuredClone(original);for(const role of ['header','footer']){const entries=Object.entries(projected.design[role]);projected.design[role]=Object.fromEntries(entries.map(([key,value])=>[key==='left'?'start':key==='right'?'end':key,value]));}assert.deepEqual(projected,current,'Only the four typed furniture slot names differ; every authored value stays exact');assert.equal(original.design.header.left.text,'Developer  quickstart');assert.equal(original.slides[3].title,'Next  steps');
});
test('quickstart selector uses release input before034 and exact current input from034, without reading the other channel',()=>{
 for(const version of ['0.32.1','0.33.1']){let reads=0;const bytes=Buffer.from('{"literal":"slides.0.left and Developer  quickstart"}\n');const selected=developerQuickstartInput(quickstartPlan(version),{readRelease:(ref,file)=>{reads++;assert.equal(ref,QUICKSTART_033.gitHead);assert.equal(file,DEVELOPER_QUICKSTART_FILE);return bytes;},readCurrent:()=>{throw new Error('Wrong current-input channel');}});assert.deepEqual(selected.bytes,bytes);assert.equal(reads,1);assert.equal(selected.provenance.kind,'registry-release-input');}
 for(const version of ['0.34.0','0.34.2','0.35.0','1.0.0']){let reads=0;const bytes=readFileSync(path.join(root,DEVELOPER_QUICKSTART_FILE)),selected=developerQuickstartInput(quickstartPlan(version),{readCurrent:file=>{reads++;assert.equal(file,DEVELOPER_QUICKSTART_FILE);return bytes;},readRelease:()=>{throw new Error('Wrong historical-input channel');}});assert.deepEqual(selected.bytes,bytes);assert.equal(selected.provenance.kind,'current-034-input');assert.equal(selected.provenance.sourceRef,null);assert.equal(reads,1);assert.equal(JSON.parse(selected.bytes).design.header.start.text,'Developer  quickstart');}
});
test('quickstart input rejects missing/ambiguous/malformed version or release authority and changed033 bytes',()=>{
 const invalid=[()=>({packages:[],verificationRefs:{opf:QUICKSTART_033.gitHead}}),()=>{const p=quickstartPlan('0.33.0');p.packages.push({...p.packages[0]});return p;},...['0.33','0.33.0-next','00.33.0','latest',undefined].map(version=>()=>{const p=quickstartPlan('0.33.0');p.packages[0].version=version;return p;}),()=>{const p=quickstartPlan('0.33.0');delete p.verificationRefs.opf;return p;},()=>quickstartPlan('0.33.0','a'.repeat(40))];
 for(const make of invalid){let reads=0;assert.throws(()=>developerQuickstartInput(make(),{readRelease:()=>{reads++;return '';},readCurrent:()=>{reads++;return '';}}));assert.equal(reads,0);}
 const release=Buffer.from(fileAtRef(QUICKSTART_033.gitHead,DEVELOPER_QUICKSTART_FILE,{cwd:root}));for(const bytes of [Buffer.from(release.toString().replace('Developer  quickstart','Developer quickstart')),readFileSync(path.join(root,DEVELOPER_QUICKSTART_FILE))])assert.throws(()=>developerQuickstartInput(quickstartPlan('0.33.0'),{readRelease:()=>bytes}));assert.throws(()=>developerQuickstartInput(quickstartPlan('0.33.0'),{readRelease:()=>{throw new Error('Missing immutable input');}}),/Missing immutable input/);
});
test('registry quickstart retains every original workflow/CLI/source assertion verbatim after input selection',()=>{
 const file='scripts/test-developer-quickstart.mjs',before=fileAtRef('e1480c66ba8df5e47869be63040b5cb1abb4e96f',file,{cwd:root}),after=readFileSync(path.join(root,file),'utf8'),marker='  const originalDeck =';assert.equal(after.slice(after.indexOf(marker)),before.slice(before.indexOf(marker)));assert.ok(after.includes("assert.match(svgs[0], /Developer  quickstart/);"));assert.ok(after.includes('developerQuickstartInput(plan, {cwd: root})'));assert.ok(!after.includes('copyFile(deckSource'));
});
