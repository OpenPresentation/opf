// Installs the published OPF packages (the registry's `latest` of each: scripts/registry-plan.mjs; MR-34) from the npm registry
// into a standalone TypeScript consumer, checks that the resulting lockfile pins exactly those versions with registry integrity
// hashes, type-checks the consumer with a pinned TypeScript, and writes `engines-installed.mjs` for the font-switch matrix
// (RR-04, FF-10). The committed package.json and lockfile of the template pin everything that is not an OPF package (TypeScript,
// Playwright, the font packages as of the last refresh); the OPF packages and the renderer's own pinned peers follow the set.
//
//   node scripts/published-matrix/prepare-consumer.mjs [directory] [--update-lock]
//
// The default directory is artifacts/published-matrix/consumer. `--update-lock` rewrites the committed package.json versions and
// package-lock.json from the current set instead of installing (run it to move the pinned third-party baseline).
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {consumerDependencies, assertConsumerLock, assertInstalledConsumerPackage} from './consumer-dependencies.mjs';
import {registryPlan} from '../registry-plan.mjs';

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

const plan = registryPlan({ refs: false });
const planned = Object.fromEntries(PACKAGES.map((name) => [name, plan.packages.find((entry) => entry.name === name)?.version]));
for (const [name, version] of Object.entries(planned)) assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `the registry has no exact ${plan.tag} version of ${name}`);

const consumerPlan = consumerDependencies(planned, plan.independentPackages);

// The renderer's optional peers are its offline font packs and, from opf-render 0.16.0 (RR-63), its converters (sharp,
// @resvg/resvg-js, pdf-lib): the matrix draws every script and rasterizes, so the consumer installs them all.
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
  manifest.dependencies = Object.fromEntries(Object.entries({...consumerPlan, ...peers, ...Object.fromEntries(HELPERS.map((name) => [name, manifest.dependencies[name] ?? '*']))}).sort(([a], [b]) => a.localeCompare(b)));
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

// The template's manifest with the set's OPF versions and the renderer's own pinned peers: everything else stays as committed.
const manifest = JSON.parse(await readFile(path.join(template, 'package.json'), 'utf8'));
const renderPeers = npmView(`@openpresentation/opf-render@${planned['@openpresentation/opf-render']}`);
manifest.dependencies = Object.fromEntries(Object.entries({...manifest.dependencies, ...consumerPlan, ...renderPeers}).sort(([a], [b]) => a.localeCompare(b)));

await rm(target, {recursive: true, force: true});
await mkdir(target, {recursive: true});
for (const file of ['package-lock.json', 'tsconfig.json', 'tsconfig.bundler.json', 'tsconfig.emit.json']) await cp(path.join(template, file), path.join(target, file));
await cp(path.join(template, 'src'), path.join(target, 'src'), {recursive: true});
await writeFile(path.join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
// Registry tarballs only: no lifecycle scripts. The committed lockfile is the base: entries that still match stay as pinned and
// npm resolves the OPF packages (and any peer the new renderer moved) to the set.
run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], target);
const lock = JSON.parse(await readFile(path.join(target, 'package-lock.json'), 'utf8'));
assertConsumerLock(consumerPlan, lock);

const installed = {};
for (const name of Object.keys(consumerPlan)) {
  const installedManifest = JSON.parse(await readFile(path.join(target, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'));
  assertInstalledConsumerPackage(name, installedManifest, consumerPlan);
  installed[name] = {version: installedManifest.version, integrity: lock.packages[`node_modules/${name}`].integrity, resolved: lock.packages[`node_modules/${name}`].resolved};
}
await writeFile(path.join(target, 'installed.json'), `${JSON.stringify({node: process.version, platform: process.platform, arch: process.arch, packages: installed}, null, 2)}\n`);

// The same entry points as engines-source.mjs, resolved from this consumer's node_modules. The matrix uses the 0.18 names of the
// renderer (RR-74: toSvg of a whole deck, toPng of one SVG); a published renderer older than 0.18 has them as renderSvg and svgToPng, which the harness of the plan core's release tag still calls, so both names are exported then.
const renderer = planned['@openpresentation/opf-render'].split('.').map(Number);
// RR-78: core 0.19 drops /catalog; the pptx.gallery catalog is then the @openpresentation/gallery package (core's dependency).
const core = planned['@openpresentation/opf'].split('.').map(Number);
const catalogEngines = core[0] > 0 || core[1] >= 19
  ? "export {catalogDisplay, gallery, CATALOG_SCHEMA as catalogSchema} from '@openpresentation/gallery';"
  // The harness of the plan core's release tag (before 0.19) reads `defaultCatalog`; the current harness reads `gallery`.
  : "export {catalogDisplay, defaultCatalog, defaultCatalog as gallery} from '@openpresentation/opf/catalog'; export const catalogSchema = 1;";
const rendererEngines = renderer[0] > 0 || renderer[1] >= 18
  ? "export {toSvg, toPng} from '@openpresentation/opf-render';"
  : ["import {renderSvg, svgToPng} from '@openpresentation/opf-render';", 'export {renderSvg, svgToPng};', 'export const toSvg = renderSvg;', 'export const toPng = svgToPng;'].join('\n');
await writeFile(path.join(target, 'engines-installed.mjs'), `export {BUNDLED_FONT_MANIFEST, loadFonts} from '@openpresentation/opf-render/fonts-node';
export {createScriptTextMeasurement, designatedFamilies, detectScripts, fontPolicyFor} from '@openpresentation/opf-render/fonts';
export {toSvg, toPng} from '@openpresentation/opf-render';
export {checkTypefaces, fromPptx, toPptx} from '@openpresentation/opf-pptx';
export {createEditorSession} from '@openpresentation/opf-editor';
// The harness of the published core's release commit (slow-checks.yml runs it as released) reads the deck of an editor session through
// this accessor; the current harness uses editor.presentation. Drop it when the plan's core tag has a harness without it.
export const presentationOf = (editor) => editor.presentation;
${catalogEngines}
export {resolveFontFamilies, resolveScriptFonts} from '@openpresentation/opf/composition';
export {resolveFontScheme, resolveReference, validate} from '@openpresentation/opf';
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
