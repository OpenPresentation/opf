// Installs the published OPF packages (versions from release-plan.json) from the npm registry into a standalone TypeScript
// consumer, checks that the committed lockfile pins exactly those versions and integrity hashes, type-checks the consumer
// with a pinned TypeScript, and writes `engines-installed.mjs` for the font-switch matrix (RR-04, FF-10).
//
//   node scripts/published-matrix/prepare-consumer.mjs [directory] [--update-lock]
//
// The default directory is artifacts/published-matrix/consumer. `--update-lock` rewrites the committed
// package.json versions and package-lock.json from release-plan.json instead of installing.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const template = path.join(here, 'consumer');
const PACKAGES = ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor'];
const argv = process.argv.slice(2);
const updateLock = argv.includes('--update-lock');
const target = path.resolve(argv.find((arg) => !arg.startsWith('--')) ?? path.join(root, 'artifacts', 'published-matrix', 'consumer'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd, label = `${command} ${args.join(' ')}`) {
  console.log(`$ ${label}`);
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', shell: command.endsWith('.cmd'), env: {...process.env, npm_config_update_notifier: 'false'}});
  assert.equal(result.status, 0, `${label} failed (${result.status})`);
}

const plan = JSON.parse(await readFile(path.join(root, 'release-plan.json'), 'utf8'));
const planned = Object.fromEntries(PACKAGES.map((name) => [name, plan.packages.find((entry) => entry.name === name)?.version]));
for (const [name, version] of Object.entries(planned)) assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `release-plan.json lists ${name}`);

// The renderer's optional peers are its offline script-font packs: the matrix draws every script, so the consumer installs them all.
const npmView = (spec) => {
  const result = spawnSync(npm, ['view', spec, 'peerDependencies', '--json'], {encoding: 'utf8', shell: true});
  assert.equal(result.status, 0, `npm view ${spec} failed: ${result.stderr}`);
  return JSON.parse(result.stdout || '{}');
};
// Used by the matrix directly (zip and XML checks), so they are explicit dependencies at the versions the packages resolve.
const HELPERS = ['fflate', 'fast-xml-parser'];

if (updateLock) {
  const manifest = JSON.parse(await readFile(path.join(template, 'package.json'), 'utf8'));
  const peers = npmView(`@openpresentation/opf-render@${planned['@openpresentation/opf-render']}`);
  manifest.dependencies = Object.fromEntries(Object.entries({...planned, ...peers, ...Object.fromEntries(HELPERS.map((name) => [name, manifest.dependencies[name] ?? '*']))}).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path.join(template, 'package.json'), `${JSON.stringify(manifest, null, 2)}
`);
  await rm(path.join(template, 'package-lock.json'), {force: true});
  run(npm, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], template);
  const resolved = JSON.parse(await readFile(path.join(template, 'package-lock.json'), 'utf8'));
  for (const name of HELPERS) manifest.dependencies[name] = resolved.packages[`node_modules/${name}`].version;
  await writeFile(path.join(template, 'package.json'), `${JSON.stringify(manifest, null, 2)}
`);
  run(npm, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], template);
  console.log('Updated the consumer manifest and lockfile to', JSON.stringify(planned));
  process.exit(0);
}

const manifest = JSON.parse(await readFile(path.join(template, 'package.json'), 'utf8'));
assert.deepEqual(Object.fromEntries(PACKAGES.map((name) => [name, manifest.dependencies[name]])), planned, 'scripts/published-matrix/consumer/package.json pins the versions in release-plan.json; run prepare-consumer.mjs --update-lock');
const lock = JSON.parse(await readFile(path.join(template, 'package-lock.json'), 'utf8'));
const expectedPeers = lock.packages['node_modules/@openpresentation/opf-render'].peerDependencies ?? {};
for (const [name, version] of Object.entries(expectedPeers)) assert.equal(manifest.dependencies[name], version, `the consumer installs the renderer peer ${name}@${version}; run prepare-consumer.mjs --update-lock`);
for (const name of PACKAGES) {
  const entry = lock.packages[`node_modules/${name}`];
  assert.equal(entry?.version, planned[name], `package-lock.json pins ${name}@${planned[name]}; run prepare-consumer.mjs --update-lock`);
  assert.match(entry.integrity ?? '', /^sha512-/, `${name} has a registry integrity hash`);
  assert.match(entry.resolved ?? '', /^https:\/\/registry\.npmjs\.org\//, `${name} resolves from the npm registry`);
}

await rm(target, {recursive: true, force: true});
await mkdir(target, {recursive: true});
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.bundler.json', 'tsconfig.emit.json']) await cp(path.join(template, file), path.join(target, file));
await cp(path.join(template, 'src'), path.join(target, 'src'), {recursive: true});
// Registry tarballs only: no lifecycle scripts, no lockfile changes.
run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], target);

const installed = {};
for (const name of PACKAGES) {
  const installedManifest = JSON.parse(await readFile(path.join(target, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'));
  assert.equal(installedManifest.version, planned[name], `${name} installed at the planned version`);
  installed[name] = {version: installedManifest.version, integrity: lock.packages[`node_modules/${name}`].integrity, resolved: lock.packages[`node_modules/${name}`].resolved};
}
await writeFile(path.join(target, 'installed.json'), `${JSON.stringify({node: process.version, platform: process.platform, arch: process.arch, packages: installed}, null, 2)}\n`);

// The same entry points as engines-source.mjs, resolved from this consumer's node_modules.
await writeFile(path.join(target, 'engines-installed.mjs'), `import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {renderSvgDeck, svgToPng as publishedSvgToPng} from '@openpresentation/opf-render';
import {checkPptxTypefaces, toPptx as publishedToPptx} from '@openpresentation/opf-pptx';
import {validatePresentation} from '@openpresentation/opf';
export {BUNDLED_FONT_MANIFEST, prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
export {createScriptTextMeasurement, designatedFamilies, detectScripts, fontPolicyFor} from '@openpresentation/opf-render/fonts';
export {renderSvgDeck} from '@openpresentation/opf-render';
export {fromPptx} from '@openpresentation/opf-pptx';
export {createEditorSession} from '@openpresentation/opf-editor';
// The 0.14 shapes of the font-switch matrix (scripts/published-matrix/engines-source.mjs) over the published packages: the
// fonts object is the old option bag, a whole deck renders with renderSvgDeck, and the published editor calls its deck "document".
// Browser and determinism checks keep the published names above.
export const loadFonts = async (options) => { const {registry, options: prepared} = await prepareNodeFonts(options); return {...prepared, registry, get substitutions() { return registry.substitutions; }}; };
export const renderSvg = (presentation, {fonts, ...rest} = {}) => renderSvgDeck(presentation, {...fonts, ...rest});
export const toPptx = (presentation, {fonts, ...rest} = {}) => publishedToPptx(presentation, {...fonts, ...rest});
export const svgToPng = (svg, {fonts, ...rest} = {}) => publishedSvgToPng(svg, {...fonts, ...rest});
export const checkTypefaces = (input, {families, ...rest}) => checkPptxTypefaces(input, {fonts: families, ...rest});
export const validate = (presentation) => validatePresentation(presentation);
export const presentationOf = (editor) => editor.document;
// CI-only scaffolding while the published core is 0.13 (RR-55): the published-matrix workflow runs the font-switch harness of
// the release tag (opf-v0.13.0), which calls these 0.13 names (its toPptx and svgToPng calls pass the option bag, which the
// wrappers above forward unchanged). The 0.14 release-prep deletes them together with the 0.14 wrappers.
export {checkPptxTypefaces, validatePresentation};
export {catalogs} from '@openpresentation/opf/catalogs';
export {resolveFontFamilies, resolveFontSchemeReference} from '@openpresentation/opf/composition';
export {resolveScriptFonts} from '@openpresentation/opf';
// The package versions' own dependencies, as installed beside them.
export {strToU8, unzipSync, zipSync} from 'fflate';
export {XMLValidator} from 'fast-xml-parser';
export const source = {kind: 'published-packages', packages: ${JSON.stringify(planned)}};
`);

// TypeScript consumer: type-check against the published declarations, then compile and run the smoke program.
const tsc = ['node_modules/typescript/bin/tsc'];
run(process.execPath, [...tsc, '--noEmit', '-p', 'tsconfig.json'], target, 'tsc --noEmit (NodeNext)');
run(process.execPath, [...tsc, '--noEmit', '-p', 'tsconfig.bundler.json'], target, 'tsc --noEmit (Bundler)');
run(process.execPath, [...tsc, '-p', 'tsconfig.emit.json'], target, 'tsc (emit)');
console.log(`Published consumer ready in ${target}`);
