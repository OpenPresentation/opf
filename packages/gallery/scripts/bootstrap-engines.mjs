/** One-release build bootstrap. It changes node_modules only, never the published manifest or lockfile. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {bootstrapPnpmEnvironment} from './bootstrap-pnpm.mjs';
import {stageBootstrapPackage,verifyBootstrapInstallation,digest} from './bootstrap-artifacts.mjs';
import { existsSync, mkdirSync, symlinkSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'node_modules', '.gallery-bootstrap.json');
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const pins = JSON.parse(readFileSync(path.join(root, '.github', 'bootstrap-engines.json'), 'utf8'));
let childEnvironment=process.env;
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, env:childEnvironment, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();
const hashes = () => Object.fromEntries(['package.json', 'package-lock.json'].map(name => [name, createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex')]));
function packageDigest(directory) {
  const hash = createHash('sha256');
  function walk(relative = '') {
    for (const name of readdirSync(path.join(directory, relative)).sort()) {
      if (name === 'node_modules') continue;
      const child = path.join(relative, name);
      const file = path.join(directory, child);
      const stat = lstatSync(file);
      if (stat.isDirectory()) walk(child);
      else {
        if (!stat.isFile()) throw new Error(`Unexpected package file: ${file}`);
        hash.update(child.replaceAll(path.sep, '/')).update('\0').update(readFileSync(file)).update('\0');
      }
    }
  }
  walk();
  return hash.digest('hex');
}
function resolved() {
  const require = createRequire(path.join(root, 'package.json'));
  const core = require.resolve('@openpresentation/opf/package.json');
  const render = require.resolve('@openpresentation/opf-render/package.json');
  const renderCore = createRequire(render).resolve('@openpresentation/opf/package.json');
  if (core !== renderCore) throw new Error(`Renderer resolves a different core: ${renderCore}; expected ${core}`);
  return Object.fromEntries([['core', core, '@openpresentation/opf'], ['render', render, '@openpresentation/opf-render']].map(([name, file, specifier]) => {
    const entry = fileURLToPath(import.meta.resolve(specifier));
    const expected = require.resolve(specifier);
    if (entry !== expected || !entry.startsWith(path.dirname(file) + path.sep)) throw new Error(`Unexpected ${name} export entry: ${entry}; expected ${expected}`);
    return [name, { path: file, entry, version: JSON.parse(readFileSync(file, 'utf8')).version, digest: packageDigest(path.dirname(file)) }];
  }));
}
function verify() {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (JSON.stringify(state.hashes) !== JSON.stringify(hashes())) throw new Error('Bootstrap modified the gallery manifest or lockfile');
  assert.deepEqual(state.pins,pins,'bootstrap source pins changed');
  assert.deepEqual(state.artifacts?.map(item=>item.name),['@openpresentation/gallery','@openpresentation/opf','@openpresentation/opf-render'],'incomplete bootstrap artifact graph');
  for(const [name,packageName]of [['core','@openpresentation/opf'],['render','@openpresentation/opf-render']])assert.equal(state.artifacts.find(item=>item.name===packageName).sourceSha,pins[name].sha,'bootstrap artifact source differs from configured pin');
  {
    for(const artifact of state.artifacts)verifyBootstrapInstallation(path.join(root,'node_modules',artifact.name),artifact);
    const core=path.join(root,'node_modules/@openpresentation/opf/package.json'),render=path.join(root,'node_modules/@openpresentation/opf-render/package.json'),gallery=path.join(root,'node_modules/@openpresentation/gallery/package.json');
    for(const entry of [core,render])assert.equal(createRequire(entry).resolve('@openpresentation/gallery/package.json'),gallery,'bootstrap engines resolve different gallery copies');
    const local=state.artifacts.find(item=>item.name==='@openpresentation/gallery');
    assert.equal(local.sourceSha,run('git',['rev-parse','HEAD']),'bootstrap gallery source differs from current release HEAD');
    assert.equal(local.originalManifestSha256,state.hashes['package.json'],'bootstrap gallery metadata differs from release manifest');
    for(const file of local.files.filter(item=>item.path.startsWith('dist/')))assert.equal(digest(readFileSync(path.join(root,file.path))),file.sha256,'local emitted catalog differs from bootstrap gallery');
  }
  if (JSON.stringify(state.resolved) !== JSON.stringify(resolved())) throw new Error('Bootstrap engine resolution changed during the gates');
  console.log(JSON.stringify(state, null, 2));
}
// Future releases use their ordinary registry pins. Remove this one-release configuration after 0.19 is published.
if (manifest.version !== pins.galleryVersion) {
  if (existsSync(statePath)) throw new Error('Unexpected bootstrap state outside the configured gallery release');
  console.log('Registry engines: ' + JSON.stringify(resolved()));
} else if (process.argv.includes('--verify')) {
  verify();
} else {
  if (pins.galleryVersion !== '2.0.0') throw new Error('Bootstrap is restricted to gallery 2.0.0');
  const expectedRepositories = { core: 'OpenPresentation/opf', render: 'OpenPresentation/opf-render' };
  for (const [name, repository] of Object.entries(expectedRepositories)) {
    if (pins[name].repository !== repository || !/^[a-f0-9]{40}$/.test(pins[name].sha)) throw new Error(`Invalid immutable ${name} pin`);
  }
  const original = hashes();
  const temporary = mkdtempSync(path.join(tmpdir(), 'gallery-engines-'));
  try {
    const sources = {};
    for (const name of ['core', 'render']) {
      const pin = pins[name];
      const directory = path.join(temporary, name);
      run('git', ['clone', '--no-checkout', `https://github.com/${pin.repository}.git`, directory]);
      // The remote default branch is fetched explicitly; no PR ref or local branch can satisfy this gate.
      const remoteHead = run('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], directory);
      if (!/^refs\/remotes\/origin\/[A-Za-z0-9._/-]+$/.test(remoteHead)) throw new Error('Invalid remote default branch');
      const branch = remoteHead.slice('refs/remotes/origin/'.length);
      run('git', ['fetch', 'origin', `refs/heads/${branch}:${remoteHead}`], directory);
      run('git', ['merge-base', '--is-ancestor', pin.sha, remoteHead], directory);
      run('git', ['checkout', '--detach', pin.sha], directory);
      if (run('git', ['rev-parse', 'HEAD'], directory) !== pin.sha) throw new Error('Checkout differs from the pin');
      sources[name] = directory;
    }
    console.log(`Corepack ${run('corepack', ['--version'])}`);
    const manager = JSON.parse(readFileSync(path.join(sources.core, 'package.json'), 'utf8')).packageManager;
    if (!/^pnpm@[0-9]+\.[0-9]+\.[0-9]+(?:\+sha.*)?$/.test(manager ?? '')) throw new Error('Core has no exact pnpm packageManager pin');
    const expectedPnpm = manager.slice('pnpm@'.length).split('+')[0];
    if (run('corepack', ['pnpm', '--version'], sources.core) !== expectedPnpm) throw new Error('Corepack pnpm does not match the source pin');
    childEnvironment=bootstrapPnpmEnvironment(temporary);
    if (run('pnpm',['--version'],sources.core)!==expectedPnpm) throw new Error('Temporary pnpm shim does not match the source pin');
    // Build local static data first. These are development artifacts, not published engine metadata.
    run('npm',['run','build']);
    const {stagedManifest}=await import(pathToFileURL(path.join(sources.core,'scripts/candidate-gallery-pack.mjs')));
    const {tar}=await import(pathToFileURL(path.join(sources.core,'scripts/archive-tar.mjs')));
    const packages={gallery:root,core:path.join(sources.core,'packages/javascript'),render:sources.render};
    const originals=Object.fromEntries(Object.entries(packages).map(([name,directory])=>[name,JSON.parse(readFileSync(path.join(directory,'package.json'),'utf8'))]));
    assert.deepEqual(Object.values(originals).map(item=>item.name),['@openpresentation/gallery','@openpresentation/opf','@openpresentation/opf-render']);
    const versions=Object.fromEntries(Object.values(originals).map(item=>[item.name,item.version]));
    const tarballs=Object.fromEntries(Object.values(originals).map(item=>[item.name,path.join(temporary,`${item.name.slice(1).replace('/','-')}-${item.version}.tgz`)]));
    const artifacts=[];
    const pack=(name)=>{
      const record=stageBootstrapPackage({directory:packages[name],temporary,original:originals[name],staged:stagedManifest(originals[name],versions,tarballs),sourceSha:name==='gallery'?run('git',['rev-parse','HEAD']):pins[name].sha,run,tar});
      assert.equal(record.file,tarballs[record.name]);artifacts.push(record);return record.file;
    };
    const galleryTarball=pack('gallery');
    run('corepack', ['pnpm', 'install', '--frozen-lockfile'], sources.core);
    // The frozen source install has gallery1. Replace only temporary development links with this release's exact built data.
    const builtGallery=path.join(temporary,'staging/gallery');
    for(const consumer of [sources.core,packages.core]){
      const scope=path.join(consumer,'node_modules/@openpresentation');mkdirSync(scope,{recursive:true});
      rmSync(path.join(scope,'gallery'),{recursive:true,force:true});symlinkSync(builtGallery,path.join(scope,'gallery'),'junction');
    }
    run('node',['scripts/materialize-gallery-catalog.mjs'],sources.core);
    run('corepack', ['pnpm', '--filter', '@openpresentation/opf', 'build'], sources.core);
    const coreTarball=pack('core');
    run('npm', ['ci'], sources.render);
    run('npm', ['install', '--no-save', '--package-lock=false', coreTarball], sources.render);
    run('npm', ['run', 'build'], sources.render);
    const renderTarball=pack('render');
    run('npm', ['install', '--no-save', '--package-lock=false', galleryTarball,coreTarball, renderTarball]);
    const state = {qualification:'development-only staged bootstrap; published engine metadata is not qualified',pins,hashes:original,artifacts,resolved:resolved()};
    writeFileSync(statePath, JSON.stringify(state));
    mkdirSync(path.join(root,'node_modules/.gallery-bootstrap-evidence'),{recursive:true});
    writeFileSync(path.join(root,'node_modules/.gallery-bootstrap-evidence/manifest.json'),JSON.stringify(state,null,2)+'\n');
    verify();
  } finally {
    childEnvironment=process.env;
    rmSync(temporary, { recursive: true, force: true });
  }
}
