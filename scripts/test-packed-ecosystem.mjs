import { mkdir, mkdtemp, readFile, writeFile, rm, realpath, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import {createHash, randomUUID} from 'node:crypto';
import {checkPackedTypes} from './check-packed-types.mjs';
import {LAZY_FONT_COUNTS} from './lazy-font-counts.mjs';
import {cliSkipNotice, installablePackages} from './release-plan-cli.mjs';
const root = fileURLToPath(new URL("../", import.meta.url)),
  out = path.join(root, "artifacts/npm");
const librariesOnly = process.argv.includes('--registry-libraries');
const registry = process.argv.includes('--registry') || librariesOnly;
const releasePlan = registry ? JSON.parse(await readFile(path.join(root, "release-plan.json"), "utf8")) : null;
// While the plan's CLI peer ranges conflict with the plan's libraries it is neither installed beside them nor run (release-plan-cli.mjs).
const cliNotice = registry && !librariesOnly ? await cliSkipNotice(releasePlan) : null;
if (cliNotice) console.log(`SKIP the CLI part of the registry consumer: ${cliNotice}`);
// layoutTable first shipped in core 0.6.0. Keep historical registry plans
// testable, while requiring the API and its pinned regression suite thereafter.
const coreVersion = releasePlan?.packages.find(item => item.name === '@openpresentation/opf')?.version.split('.').map(Number);
// RR-73: core 0.18 renamed importData to ingest; a registry plan before 0.18 still has the old name.
const dataImportName = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 18 ? 'ingest' : 'importData';
const verifyTableLayout = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 6;
// Styled-cell rollout targets core 0.7; published 0.6 fixtures remain separate.
const verifyStyledTables = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 7;
// Shared quote APIs first shipped in core 0.8 with renderer/PPTX 0.6 and editor 0.5.
const verifySharedQuotes = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 8;
// Shared code APIs shipped in core 0.9 with renderer/PPTX 0.7 and editor 0.6.
const verifySharedCode = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 9;
// Font preparation ships in renderer 0.8; keep prior registry plans testable.
const rendererVersion = releasePlan?.packages.find(item => item.name === '@openpresentation/opf-render')?.version.split('.').map(Number);
const verifyFontPreparation = !registry || rendererVersion?.[0] > 0 || rendererVersion?.[1] >= 8;
// RR-74: opf-render 0.18 names its engines toSvg, toPng and toPdf (slides count from 1). The candidate packages are the 0.18 ones; a
// registry plan whose renderer is older keeps the names it was published with, so each consumer below is written once with these.
const newRenderer = !registry || rendererVersion?.[0] > 0 || rendererVersion?.[1] >= 18;
const R = newRenderer ? {svg: 'toSvg', png: 'toPng', slide: 'toSvg'} : {svg: 'renderSvg', png: 'svgToPng', slide: 'renderSlideSvg'};
const slideSvg = (deck, options) => (newRenderer ? `toSvg(${deck},1,${options})` : `renderSlideSvg(${deck},0,${options})`);
const verifyEstimatedRichText = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 10;
// Furniture shipped in the coordinated core 0.10.1 train; older plans stay testable.
const verifyFurniture = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] > 10 || (coreVersion?.[1] === 10 && coreVersion?.[2] >= 1);
// RR-55: the candidate packages and the registry plan are both the 0.14 train (loadFonts handle, renderSvg for a deck, { fonts },
// editor.presentation), so each inline consumer below is one variant.
// RR-59: the portable script-font SVG and the unresolved-image gate ship in core/CLI/renderer/PPTX 0.16.
const verifyInstalledCliRegression = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 16;
const verifyColorRefs = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 11;

async function readHarnessBytes(repo, file) {
  const directory = repo === 'opf' ? root : path.resolve(root, '..', repo);
  if (!registry) return readFile(path.join(directory, file));
  const ref = releasePlan.verificationRefs?.[repo];
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error(`Missing immutable registry verification ref for ${repo}`);
  const result = spawnSync('git', ['show', `${ref}:${file}`], {cwd:directory});
  if (result.status !== 0) throw new Error(`Cannot read ${repo} release harness ${file}: ${result.stderr}`);
  return result.stdout;
}
async function readHarness(repo, file) {
  const source = (await readHarnessBytes(repo, file)).toString('utf8');
  if (repo !== 'opf' && /^test\/.+\.m?js$/.test(file)) await installLocalImports(repo, file, source);
  return source;
}
const SIBLING_PACKAGES = {'opf-render': '@openpresentation/opf-render', 'opf-pptx': '@openpresentation/opf-pptx', 'opf-editor': '@openpresentation/opf-editor'};
const installedLocal = new Set();
/**
 * OPF 0.15 (FA-23): a sibling test copied into the consumer may import local test modules (`./helpers/default-catalog.mjs`,
 * `./catalog-harness.mjs`: the helpers that register the default catalog the way a host does). Install every such module,
 * and the ones it imports in turn, at the same path under the consumer, with its imports of the sibling's own build
 * (`../dist/index.js`, `../../dist/index.js`) resolved to the installed package. A copied test is written at the consumer
 * root, so its local imports resolve there.
 */
async function installLocalImports(repo, file, source) {
  const base = path.posix.dirname(file);
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.\/[^'"]+\.m?js)['"]/g)) {
    const relative = path.posix.normalize(match[1]);
    if (relative.startsWith('..')) continue;
    const local = path.posix.join(base, relative);
    if (!local.startsWith('test/')) continue;
    const key = `${repo}:${local}`;
    if (installedLocal.has(key)) continue;
    let text;
    try { text = (await readHarnessBytes(repo, local)).toString('utf8'); } catch (error) { if (error.code === 'ENOENT' || /Cannot read/.test(error.message)) continue; throw error; }
    installedLocal.add(key);
    const depth = local.split('/').length - 2;
    const dist = `${'../'.repeat(depth + 1)}dist/index.js`;
    const target = path.join(consumer, relative.split('/').join(path.sep));
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, text.replaceAll(`'${dist}'`, `'${SIBLING_PACKAGES[repo]}'`).replaceAll(`"${dist}"`, `"${SIBLING_PACKAGES[repo]}"`));
    await installLocalImports(repo, local, text);
  }
}
const consumer = path.join(out, librariesOnly ? "registry-libraries-consumer" : registry ? "registry-consumer" : "consumer");
const manifest = registry
  ? { artifacts: await installablePackages(releasePlan) }
  : JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
if (librariesOnly) manifest.artifacts = manifest.artifacts.filter(item => item.name !== '@openpresentation/cli');
const renderSourceVersion = registry ? releasePlan.packages.find(item => item.name === '@openpresentation/opf-render')?.version : manifest.artifacts.find(item => item.name === '@openpresentation/opf-render')?.sourceVersion;
// RR-63: opf-render's PDF/PNG converters and font packages are optional peers (npm does not install them). Each consumer
// here (the candidate tarballs, the registry consumer the gallery and the registry checks build on) is a complete host:
// it installs every optional peer the planned renderer declares (the converters, the base and office fonts and the
// script packs that `scripts: 'all'`, the office-pack checks and the installed CLI's Japanese and Chinese SVG
// regression (RR-59, opf#476) load), at the versions the renderer tests. A renderer that still lists them as
// dependencies adds nothing.
const rendererPeers = {};
if (manifest.artifacts.some(item => item.name === '@openpresentation/opf-render')) {
  const rendererPackage = JSON.parse(await readHarness('opf-render', 'package.json'));
  for (const [name, range] of Object.entries(rendererPackage.peerDependencies ?? {})) {
    if (rendererPackage.peerDependenciesMeta?.[name]?.optional === true && !rendererPackage.dependencies?.[name]) rendererPeers[name] = rendererPackage.devDependencies?.[name] ?? range;
  }
}
await mkdir(out,{recursive:true});
const actualRoot=await realpath(root), actualOut=await realpath(out);
if (!actualOut.startsWith(actualRoot+path.sep)) throw new Error('Consumer artifacts must remain inside this checkout');
const actualConsumer=await realpath(consumer).catch(error=>{if(error.code==='ENOENT')return path.resolve(consumer);throw error;});
if (!actualConsumer.startsWith(actualOut+path.sep)) throw new Error('Refusing to remove a consumer outside the artifact directory');
await rm(consumer, { recursive: true, force: true });
await mkdir(consumer, { recursive: true });
const browserBuildId = randomUUID();
await writeFile(path.join(consumer, 'browser-build-id.json'), JSON.stringify(browserBuildId));
await writeFile(
  path.join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "opf-packed-consumer",
      private: true,
      type: "module",
      ...(!registry ? {devDependencies: {'@types/node': createRequire(new URL('../packages/javascript/package.json', import.meta.url))('@types/node/package.json').version}} : {}),
      dependencies: {
        ...rendererPeers,
        ...Object.fromEntries(manifest.artifacts.map((item) => [item.name, registry ? item.version : `file:../${item.file}`])),
      },
    },
    null,
    2,
  ),
);
function run(command, args, childEnv) {
  // npm's Windows shim is a batch file. Invoke its JS entrypoint without a
  // shell so paths with spaces and package arguments remain literal values.
  if (command==='npm' && process.platform==='win32') {
    // pnpm scripts set npm_execpath to pnpm.cjs, which must not be used as npm.
    const npmEntry=process.env.npm_execpath?.endsWith('npm-cli.js')?process.env.npm_execpath:(process.env.PATH??'').split(path.delimiter).flatMap(directory=>[
      path.join(directory,'node_modules/npm/bin/npm-cli.js'),
      path.resolve(directory,'../npm/bin/npm-cli.js'),
    ]).find(existsSync);
    if(!npmEntry||!existsSync(npmEntry))throw new Error('Cannot locate the npm JavaScript entrypoint');
    args=[npmEntry,...args];
    command=process.execPath;
  }
  const result = spawnSync(command, args, { cwd: consumer, stdio: "inherit",
    ...(childEnv ? {env: {...process.env, ...childEnv}} : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited ${result.status}`);
}
// New formatted furniture is candidate-only; historical registry fixtures stay unchanged.
if (!registry) run(process.execPath, [path.join(root, 'scripts/test-packed-furniture-absent.mjs')]);
run("npm", [
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  "--offline=false",
  "--prefer-online",
  "--cache",
  path.join(out,'cache'),
]);
// RR-62: the consumer installs core, the renderer, the converter and the editor; they must share the one installed core.
{
  const {assertSingleCore} = await import('./check-one-core.mjs');
  const installedCore = path.join(consumer, 'node_modules', '@openpresentation', 'opf');
  const installedPeers = ['opf-render', 'opf-pptx', 'opf-editor', 'cli'].map((name) => path.join(consumer, 'node_modules', '@openpresentation', name, 'package.json')).filter((file) => existsSync(file));
  await assertSingleCore({ expected: installedCore, roots: [consumer], resolvers: [path.join(consumer, 'package.json'), ...installedPeers], label: 'packed consumer' });
}
if (verifyColorRefs) {
  await mkdir(path.join(consumer, 'fixtures'), {recursive: true});
  await writeFile(path.join(consumer, 'fixtures/color-references.opf.json'),
    await readHarness('opf-render', 'test/fixtures/color-references.opf.json'));
  await writeFile(path.join(consumer, 'color-references.mjs'),
    (await readHarness('opf-render', 'test/color-references.mjs'))
      .replaceAll("'../dist/index.js'", "'@openpresentation/opf-render'"));
  run(process.execPath, ['color-references.mjs']);
  await writeFile(path.join(consumer, 'fixtures/core-color-references.opf.json'),
    await readHarness('opf', 'docs/fixtures/color-references.opf.json'));
  await writeFile(path.join(consumer, 'color-ref-export.mjs'),
    (await readHarness('opf-pptx', 'test/color-ref-export.mjs'))
      .replaceAll('"../dist/index.js"', '"@openpresentation/opf-pptx"')
      .replaceAll('"../dist/color-ref.js"', '"./node_modules/@openpresentation/opf-pptx/dist/color-ref.js"')
      .replaceAll('"../../opf/docs/fixtures/color-references.opf.json"', '"fixtures/core-color-references.opf.json"')
      .replaceAll('  fixture = null;', '  throw new Error("Pinned ColorRef fixture must load; fallback is not registry acceptance");'));
  run(process.execPath, ['color-ref-export.mjs']);
}
// These chart corrections are newer than the immutable published train.
// Run the original public fixtures against the coordinated installed packages.
if (!registry) {
  const cacheHarness = (await readHarness('opf-pptx', 'test/chart-cache-import.mjs'))
    .replace("process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js'", "'@openpresentation/opf-pptx'");
  await writeFile(path.join(consumer, 'chart-cache-import.mjs'), cacheHarness);
  run(process.execPath, ['chart-cache-import.mjs']);
  const axisHarness = (await readHarness('opf-render', 'test/chart-axis.mjs'))
    .replaceAll("'../dist/svg.js'", "'@openpresentation/opf-render/svg'");
  await writeFile(path.join(consumer, 'chart-axis.mjs'), axisHarness);
  run(process.execPath, ['chart-axis.mjs']);
  // Keep the original timezone assertions/workers; both public resolutions must use the installed candidate.
  const zipDateSource = await readHarness('opf-pptx', 'test/zip-date.mjs');
  if (zipDateSource.split("'../dist/index.js'").length !== 3) throw new Error('Expected both original ZIP date public import references');
  const zipDateHarness = zipDateSource.replaceAll("'../dist/index.js'", "'@openpresentation/opf-pptx'");
  const zipDateRoot = path.join(out, 'zip-date-candidate');
  await mkdir(zipDateRoot, {recursive: true});
  const zipDateArtifacts = await mkdtemp(path.join(zipDateRoot, 'installed-'));
  const zipDateHash = bytes => createHash('sha256').update(bytes).digest('hex');
  const zipDatePackage = manifest.artifacts.find(item => item.name === '@openpresentation/opf-pptx');
  if (!zipDatePackage) throw new Error('Missing candidate PPTX archive for ZIP date verification');
  const zipDateTar = await readFile(path.join(out, zipDatePackage.file));
  if (zipDateHash(zipDateTar) !== zipDatePackage.sha256) throw new Error('Candidate PPTX ZIP date tarball changed');
  const zipDateLockBytes = await readFile(path.join(consumer, 'package-lock.json'));
  const zipDateLocked = JSON.parse(zipDateLockBytes).packages['node_modules/@openpresentation/opf-pptx'];
  const zipDateIntegrity = 'sha512-' + createHash('sha512').update(zipDateTar).digest('base64');
  if (zipDateLocked?.integrity !== zipDateIntegrity || !zipDateLocked.resolved?.startsWith('file:') || zipDateLocked.link)
    throw new Error('ZIP date verification requires the same installed local PPTX archive');
  const zipDateRef = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: path.resolve(root, '..', 'opf-pptx'), encoding: 'utf8'});
  if (zipDateRef.status !== 0 || !/^[a-f0-9]{40}$/.test(zipDateRef.stdout.trim())) throw new Error('Cannot bind ZIP date source checkout');
  const zipDateEntrypoint = await realpath(createRequire(path.join(consumer, 'package.json')).resolve('@openpresentation/opf-pptx'));
  if (!zipDateEntrypoint.startsWith((await realpath(path.join(consumer, 'node_modules'))) + path.sep)) throw new Error('ZIP date entrypoint must be installed inside this consumer');
  await writeFile(path.join(consumer, 'zip-date.mjs'), zipDateHarness);
  await writeFile(path.join(zipDateArtifacts, 'source-fixture.mjs.txt'), zipDateSource);
  await writeFile(path.join(zipDateArtifacts, 'installed-fixture.mjs.txt'), zipDateHarness);
  await writeFile(path.join(zipDateArtifacts, 'binding.json'), JSON.stringify({
    scope: 'Coordinated candidate preview archive; original public fixture with only two import substitutions. Not registry or native acceptance.',
    source: {repository: 'opf-pptx', head: zipDateRef.stdout.trim(), file: 'test/zip-date.mjs', sha256: zipDateHash(zipDateSource)},
    installedFixtureSha256: zipDateHash(zipDateHarness), importReplacements: 2, artifact: zipDatePackage,
    installedIntegrity: zipDateIntegrity, lockSha256: zipDateHash(zipDateLockBytes), expectedEntrypoint: pathToFileURL(zipDateEntrypoint).href,
    installedEntrypointSha256: zipDateHash(await readFile(zipDateEntrypoint)),
    childEnv: {OPF_ZIP_DATE_ARTIFACTS: zipDateArtifacts},
  }, null, 2) + '\n');
  run(process.execPath, ['zip-date.mjs'], {OPF_ZIP_DATE_ARTIFACTS: zipDateArtifacts});
  const zipDateResults = (await readdir(zipDateArtifacts, {recursive: true})).filter(file => path.basename(file) === 'result.json');
  if (zipDateResults.length !== 4) throw new Error('Expected original three-zone and host-mutation ZIP date worker reports');
  for (const file of zipDateResults) {
    const result = JSON.parse(await readFile(path.join(zipDateArtifacts, file), 'utf8'));
    if (result.entrypoint !== pathToFileURL(zipDateEntrypoint).href) throw new Error('ZIP date worker resolved a different package entrypoint');
  }
}
if (verifyFontPreparation) {
  await writeFile(path.join(consumer,'check-font-preparation.mjs'), `
import assert from 'node:assert/strict';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const LAZY_FONT_COUNTS=${JSON.stringify(LAZY_FONT_COUNTS)};
import {${R.svg},resolvePresentation,${R.png}} from '@openpresentation/opf-render';
import {paginate} from '@openpresentation/opf/pagination';
import {createEditorSession} from '@openpresentation/opf-editor';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'});const {registry}=fonts;
assert.equal(fonts.loadSystemFonts,false);assert.equal(fonts.useBundledFonts,false);
const {mkdir,readFile,writeFile}=await import('node:fs/promises');
const {createHash}=await import('node:crypto');
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/font-preparation.json',JSON.stringify({systemFontDiscovery:false,bundledFallback:false,fonts:await Promise.all(fonts.fontFiles.map(async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})))},null,2)+'\\n');
const source={design:{fontScheme:'roboto'},slides:[{id:'fonts',title:'Prepared installed fonts',text:'A measured local document preserves its content.'}]};
const original=JSON.stringify(source);
const {presentation}=paginate(source,{fonts});
const editor=createEditorSession(presentation);
assert.deepEqual(editor.composeSlide(0,{fonts}),resolvePresentation(presentation,{fonts}).slides[0].geometry);
editor.set('slides.0.title','Editable prepared fonts');editor.undo();
assert.equal(editor.presentation.slides[0].title,source.slides[0].title);
const svgs=${R.svg}(editor.presentation,{fonts});
assert.ok((await ${R.png}(svgs[0],{fonts})).length>1000);
const imported=await fromPptx(await toPptx(editor.presentation,{fonts}));
assert.equal(imported.slides[0].title,source.slides[0].title);
assert.equal(JSON.stringify(source),original);
assert.equal(registry.embeddedFonts.length,33);// the eager npm faces; the vendored (embed used) faces are the lazy set: the open families and Intos
if(registry.lazyFonts){// renderers that vendor Intos and the open families (after 0.10.0) list them here; the pinned earlier renderer has none
// the vendored open and Intos faces, exact per renderer version (scripts/lazy-font-counts.mjs)
const renderVersion=${JSON.stringify(renderSourceVersion)};// the renderer's own version (release plan, or the source version behind a preview tarball)
const expectedLazy=LAZY_FONT_COUNTS[renderVersion];
assert.ok(expectedLazy&&expectedLazy.includes(registry.lazyFonts.length),'the lazy face count of renderer '+renderVersion+' is '+registry.lazyFonts.length+'; expected '+(expectedLazy??['a recorded count']).join(' or '));
// the four Noto Sans glyph-fallback faces (opf-render#57) are npm files, also embed used; every other embed-used face is a lazy one
assert.equal(fonts.embeddedFonts.filter(face=>face.embed==="used"&&face.family!=="Noto Sans").length,registry.lazyFonts.length);
}
console.log('Installed font preparation passed layout, edit/undo, SVG/PNG, editable PPTX export and heading reimport.');
`);
  run(process.execPath,['check-font-preparation.mjs']);
  if (verifyFurniture) {
    const furnitureHarness = (await readHarness('opf-pptx', 'test/furniture-provenance.mjs'))
      .replaceAll("'../dist/index.js'", "'@openpresentation/opf-pptx'")
      .replaceAll("'../vendor/pptxgenjs/pptxgen.es.js'", "'./node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'");
    await mkdir(path.join(consumer, 'fixtures/images'), {recursive: true});
    for (const name of ['wide.png', 'tall.png']) await writeFile(path.join(consumer, 'fixtures/images', name),
      await readHarnessBytes('opf-pptx', `test/fixtures/images/${name}`));
    await writeFile(path.join(consumer, 'furniture-provenance.mjs'), furnitureHarness);
    run(process.execPath, ['furniture-provenance.mjs']);
    // Formatted furniture fields are newer than the immutable registry train.
    // Exercise the complete existing fixture only against candidate tarballs.
    if (!registry) {
      const fieldsHarness = (await readHarness('opf-pptx', 'test/furniture-fields.mjs'))
        .replaceAll("'../dist/index.js'", "'@openpresentation/opf-pptx'")
        .replaceAll("'../dist/furniture-fields.js'", "'./node_modules/@openpresentation/opf-pptx/dist/furniture-fields.js'");
      await writeFile(path.join(consumer, 'furniture-fields.mjs'), fieldsHarness);
      run(process.execPath, ['furniture-fields.mjs']);
      const wrappedFieldsHarness = (await readHarness('opf-pptx', 'test/furniture-wrapped-date.mjs'))
        .replaceAll("'../dist/index.js'", "'@openpresentation/opf-pptx'");
      await writeFile(path.join(consumer, 'furniture-wrapped-date.mjs'), wrappedFieldsHarness);
      run(process.execPath, ['furniture-wrapped-date.mjs']);
    }
  }
  for (const repo of ['opf-render','opf-pptx']) {
    const source=(await readHarness(repo,'test/font-variants.mjs'))
      .replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'")
      .replaceAll("'../dist/fonts.js'","'@openpresentation/opf-render/fonts'")
      // RR-55: the renderer keeps createFontRegistry in an internal module that is not an entry point; the installed file is read by path.
      .replaceAll("'../dist/font-registry.js'","'./node_modules/@openpresentation/opf-render/dist/font-registry.js'")
      .replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'")
      .replaceAll("new URL('../../opf-render/package.json',import.meta.url)","import.meta.resolve('@openpresentation/opf-render/package.json')");
    const file=repo+'-font-variants.mjs';
    await writeFile(path.join(consumer,file),source);
    run(process.execPath,[file,'artifacts/'+repo+'-font-variants.json']);
  }
  await writeFile(path.join(consumer,'font-preparation-types.mts'), `
import {loadFonts,type NodeFontsHandle,type BundledFontManifest} from '@openpresentation/opf-render/fonts-node';
import {${R.svg},${R.png}} from '@openpresentation/opf-render';
import {paginate} from '@openpresentation/opf/pagination';
import {createEditorSession} from '@openpresentation/opf-editor';
import {toPptx} from '@openpresentation/opf-pptx';
import type {FontFaceSelection,TextStyle} from '@openpresentation/opf/composition';
const fonts:NodeFontsHandle=await loadFonts({pack:'office',substitutionPolicy:'visual'});
const manifest:BundledFontManifest=fonts.manifest;
const physical:FontFaceSelection={family:'Roboto SemiBold',bold:false,italic:false};
const measured:TextStyle=fonts.registry.textMeasurement.resolveStyle!({fontFamily:'Roboto',fontWeight:600,fontFace:physical});
const selected:FontFaceSelection|undefined=measured.fontFace;
void selected;
// @ts-expect-error Native style flags must be booleans, independent of numeric CSS weights.
const invalid:FontFaceSelection={family:'Roboto SemiBold',bold:600,italic:false};
const {presentation}=paginate({slides:[{title:'Prepared type consumer'}]},{fonts});
const editor=createEditorSession(presentation);
editor.composeSlide(0,{fonts});
await ${R.png}(${R.svg}(presentation,{fonts})[0],{fonts});
await toPptx(presentation,{fonts});
// @ts-expect-error The provenance catalog is immutable.
manifest.packages[0].faces[0].sha256='changed';
// @ts-expect-error Unknown packs are not valid inputs.
await loadFonts({pack:'unknown'});
`);
}
await writeFile(
  path.join(consumer, "check.mjs"),
  `import assert from 'node:assert/strict';
import {${dataImportName} as ingest} from '@openpresentation/opf/data';
import {fitRichText,fitList} from '@openpresentation/opf/composition';
import {parseTabularData} from '@openpresentation/opf-editor/data';
import {formatRichTextRange, replaceRichTextRange, richTextContent} from '@openpresentation/opf-editor/rich-text';
import {createEditorSession} from '@openpresentation/opf-editor';
import {prepareTrackResize,prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from '@openpresentation/opf-editor/layout';
import {createCanvasEditor} from '@openpresentation/opf-editor/canvas';
import {parseOpfTransfer,serializeOpfTransfer,prepareOpfImport} from '@openpresentation/opf-editor/transfer';
import {loadOpfGallery} from '@openpresentation/opf-editor/galleries';
import {listSchemaFields} from '@openpresentation/opf-editor/schema';
import {createSchemaInspector} from '@openpresentation/opf-editor/schema-inspector';
import {loadFonts as loadBrowserFonts} from '@openpresentation/opf-render/fonts-browser';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {${R.slide}} from '@openpresentation/opf-render';
import {toPptx} from '@openpresentation/opf-pptx';
assert.equal(ingest('Q,R\\nQ1,12',{as:'chart'}).chart.data.rows[0][1],12);
assert.equal(parseTabularData([{q:'Q1',r:12}]).rows[0][1],12);
assert.equal(fitList([{text:'Packed list',level:2}],{x:0,y:0,width:300,height:100}).listEntries[0].level,2);
assert.ok(fitRichText([{text:'Packed rich text',bold:true}],{x:0,y:0,width:300,height:100}).richLines.length);
assert.deepEqual(formatRichTextRange('Hello',0,5,{bold:true}),[{text:'Hello',bold:true}]);
assert.equal(richTextContent(replaceRichTextRange(['Hello'],1,4,'i')),'Hio');
assert.ok(listSchemaFields().length>=604);assert.equal(typeof createSchemaInspector,'function');
const fonts=await loadFonts();
// OPF 0.15: a host registers the default catalog (the deck names the roboto font scheme): @openpresentation/gallery from 0.19 (RR-78),
// core's /catalog from 0.15 to 0.18; a 0.14 core has neither and resolves it built in.
const host=await import('@openpresentation/gallery').then(module=>({catalogs:[module.gallery]}),()=>import('@openpresentation/opf/catalog').then(module=>({catalogs:[module.defaultCatalog]}),()=>({})));
const editor=createEditorSession({design:{fontScheme:'roboto'},slides:[{title:'Packed consumer',composition:{mode:'row'},blocks:[{text:'One'},{text:'Two'}]}]},host);
editor.set('slides.0.title','Installed consumer');
editor.applyPatch(prepareTrackResize(editor.presentation,editor.composeSlide(0).flows[0],0,.6).patches);
assert.equal(editor.get('slides.0.composition.weights.0'),1.2);
assert.equal(listBlockContainers(editor.presentation).length,1);
editor.applyPatch(prepareBlockMove(editor.presentation,'slides.0.blocks.0','slides.0',2).patches);
assert.equal(editor.get('slides.0.blocks.1.text'),'One');
editor.applyPatch(prepareBlockInsert(editor.presentation,'slides.0',createContentBlock('text')).patches);
editor.applyPatch(prepareBlockDuplicate(editor.presentation,'slides.0.blocks.2').patches);
editor.applyPatch(prepareBlockRemove(editor.presentation,'slides.0.blocks.2').patches);
assert.equal(editor.get('slides.0.blocks.2.text'),'Add your text');
const svg=${slideSvg('editor.presentation','{...host,fonts}')};
assert.match(svg,/Installed consumer/);
assert.equal(typeof createCanvasEditor,'function');assert.equal(typeof loadBrowserFonts,'function');
const richEditor=createEditorSession({design:{fontScheme:'roboto'},slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[['Cell']]}}]},host);
richEditor.set('slides.0.table.rows.0.0',formatRichTextRange('Cell',0,4,{bold:true,color:'#008800'}));
assert.deepEqual(richEditor.get('slides.0.table.rows.0.0'),[{text:'Cell',bold:true,color:'#008800'}]);
assert.match(${slideSvg('richEditor.presentation','{...host,trace:true,fonts}')},/data-opf-rich-text="true"/);
assert.ok((await toPptx(richEditor.presentation,{...host,fonts})).length>1000);
richEditor.undo();assert.equal(richEditor.get('slides.0.table.rows.0.0'),'Cell');
const copied=parseOpfTransfer(serializeOpfTransfer(editor.presentation,{scope:'slide',format:'markdown'}));
assert.equal(prepareOpfImport(editor.presentation,copied).presentation.slides.length,2);
const gallery=await loadOpfGallery('https://gallery.example/registry.json',{fetch:async()=>new Response(JSON.stringify({items:[{name:'Example',opf:copied.presentation}]}))});
assert.equal(gallery.items.length,1);
const pptx=await toPptx(editor.presentation,{...host,fonts});
assert.ok(pptx.length>1000);
console.log('Packed consumer: core, editor, SVG, measured fonts and PPTX passed.');\n`,
);
run(process.execPath, ["check.mjs"]);
if (verifySharedCode) run(process.execPath,[path.join(root,'scripts/test-installed-code.mjs'),consumer,...(registry?['--registry']:[])]);
if (verifySharedQuotes) {
  // Historical release plans retain their old fixtures; the new complete set
  // must exercise its quote APIs and shared accepted geometry from actual npm.
  for (const file of ['quote-layout.test.mjs','quote-composition.test.mjs']) {
    const source=(await readHarness('opf',`packages/javascript/test/${file}`))
      .replaceAll("'../dist/composition.js'","'@openpresentation/opf/composition'")
      .replaceAll("'../dist/pagination.js'","'@openpresentation/opf/pagination'");
    await writeFile(path.join(consumer,file),source);
    run(process.execPath,['--test',file]);
  }
  for (const repo of ['opf-render','opf-pptx']) {
    const source=(await readHarness(repo,'test/shared-quote.mjs'))
      .replaceAll("'../dist/svg.js'","'@openpresentation/opf-render/svg'")
      .replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'")
      .replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'");
    const file=repo+'-shared-quote.mjs';
    await writeFile(path.join(consumer,file),source);
    run(process.execPath,[file]);
  }
  await writeFile(path.join(consumer,'quote-editor.mjs'),await readHarness('opf','scripts/test-packed-quote.mjs'));
  run(process.execPath,['quote-editor.mjs']);
}
if (verifyStyledTables) {
  for (const name of ['styled-table.mjs','styled-table-import.mjs','table-border-styles.mjs']) {
    const source=(await readHarness('opf-pptx', `test/${name}`)).replaceAll("'../dist/index.js'", "'@openpresentation/opf-pptx'");
    await writeFile(path.join(consumer,name),source);
    run(process.execPath,[name]);
  }
  await writeFile(path.join(consumer,'styled-types.mts'),await readHarness('opf','packages/javascript/test/fixtures/styled-table-types.mts'));
}

if (verifyTableLayout) {
  const tableHarness = (await readHarness('opf', 'packages/javascript/test/table-layout.test.mjs'))
    .replaceAll("'../dist/composition.js'", "'@openpresentation/opf/composition'")
    .replaceAll("'../dist/pagination.js'", "'@openpresentation/opf/pagination'");
  await writeFile(path.join(consumer, 'table-layout.test.mjs'), tableHarness);
  run(process.execPath, ['--test', 'table-layout.test.mjs']);
}

if (registry) {
  for (const item of manifest.artifacts) {
    const installed = JSON.parse(await readFile(path.join(consumer, 'node_modules', item.name, 'package.json'), 'utf8'));
    if (installed.version !== item.version) throw new Error(`Expected ${item.name}@${item.version}, installed ${installed.version}`);
  }
  if (!librariesOnly && !cliNotice) {
    const cliRoot=path.join(consumer,'node_modules/@openpresentation/cli');
    const cli=JSON.parse(await readFile(path.join(cliRoot,'package.json'),'utf8'));
    const entry=path.join(cliRoot,cli.bin.opf);
    run(process.execPath, [entry,'--version']);
    run(process.execPath, [entry,'create', 'registry.opf.json', '--title', 'Registry consumer']);
    run(process.execPath, [entry,'validate', 'registry.opf.json']);
    // RR-59 (opf#476): script-font SVG, the unresolved-image gate and zero fetches through the published CLI beside the published peers (a CLI that predates the contract has no such test).
    const regression = path.join(root, 'packages/cli/test/installed-regression.mjs');
    if (verifyInstalledCliRegression) run(process.execPath, [regression], {OPF_TEST_BIN: entry});
  }
}

await writeFile(
  path.join(consumer, "browser.ts"),
  `import {presentation} from '@openpresentation/opf/schemas';
import type {Presentation} from '@openpresentation/opf/types';
export const richTable:Presentation={slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[[[{text:'Cell',italic:true}]]]}}]};
export const compositionSchema = presentation.$defs.Composition;
export const contentSchema = presentation.$defs.ContentPayload;
import {createCanvasEditor, type CanvasEditor} from '@openpresentation/opf-editor/canvas';
import {loadFonts} from '@openpresentation/opf-render/fonts-browser';
export {parseOpfTransfer,prepareOpfImport,serializeOpfTransfer} from '@openpresentation/opf-editor/transfer';
export {loadOpfGallery,loadOpfGalleryItem} from '@openpresentation/opf-editor/galleries';
export {createSchemaInspector} from '@openpresentation/opf-editor/schema-inspector';
export {formatRichTextRange,replaceRichTextRange,richTextContent,type TextRunFormat} from '@openpresentation/opf-editor/rich-text';
export {prepareTrackResize,prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from '@openpresentation/opf-editor/layout';
export {fitList,type ListFit,type ListValue} from '@openpresentation/opf/composition';
${verifyTableLayout ? "export {layoutTable,type TableLayout,type TableLayoutOptions,type TableCellLayout} from '@openpresentation/opf/composition';" : ''}
${verifySharedQuotes ? "export {layoutQuote,type QuoteLayout,type QuoteTextPart,type QuoteTextSource,type QuoteLayoutOptions,type CompositionExplanation} from '@openpresentation/opf/composition';" : ''}
${verifySharedCode ? "export {layoutCode,type CodeLayout,type CodeTextPart,type CodeTextFit,type CodeLayoutOptions} from '@openpresentation/opf/composition';" : ''}
export {schemaAtPath,listSchemaFields} from '@openpresentation/opf-editor/schema';
export async function mount(container:HTMLElement):Promise<CanvasEditor> {
 const fonts=await loadFonts({faces:[{url:'/fonts/Roboto.ttf'},{url:'/fonts/RobotoMono.ttf'}]});
 return createCanvasEditor(container,{presentation:{slides:[{title:'Hello'}]},fonts});
}\n`,
);
const require = createRequire(
  path.join(root, "packages/javascript/package.json"),
);
run(process.execPath, [
  require.resolve("typescript/bin/tsc"),
  "--strict",
  "--noEmit",
  "--module",
  "NodeNext",
  "--moduleResolution",
  "NodeNext",
  "--target",
  "ES2022",
  "--lib",
  "ES2022,DOM",
  "browser.ts",
  ...(verifyFontPreparation ? ["font-preparation-types.mts"] : []),
  ...(verifyStyledTables ? ["styled-types.mts"] : []),
]);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
await build({
  entryPoints: [path.join(consumer, "browser.ts")],
  outfile: path.join(consumer, "browser.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
});
console.log(
  "Packed consumer: TypeScript declarations and browser bundle passed.",
);
// OPF 0.15: the browser harnesses below run as a host would, so the editor and renderer they import register the default
// catalog (their decks name gallery records such as the roboto font scheme). Each harness imports the installed packages
// through these host modules; a call's own `catalogs` wins. A 0.14 core (an older registry plan) has no /catalog and resolves
// those records built in, so its host modules register nothing.
{
  const installedCore = JSON.parse(await readFile(path.join(consumer, 'node_modules/@openpresentation/opf/package.json'), 'utf8'));
  // RR-78: from 0.19 the catalog is the @openpresentation/gallery package (core's dependency) and core has no /catalog.
  const hasGallery = existsSync(path.join(consumer, 'node_modules/@openpresentation/gallery/package.json'));
  const hasCatalog = Boolean(installedCore.exports?.['./catalog']);
  await writeFile(path.join(consumer, 'host-catalogs.mjs'), hasGallery
    ? "import {gallery} from '@openpresentation/gallery';\nexport const withCatalogs = (options = {}) => (options.catalogs === undefined ? {...options, catalogs: [gallery]} : options);\n"
    : hasCatalog
      ? "import {defaultCatalog} from '@openpresentation/opf/catalog';\nexport const withCatalogs = (options = {}) => (options.catalogs === undefined ? {...options, catalogs: [defaultCatalog]} : options);\n"
      : 'export const withCatalogs = (options = {}) => options;\n');
  await writeFile(path.join(consumer, 'host-editor.mjs'), "import * as editor from '@openpresentation/opf-editor';\nimport {withCatalogs} from './host-catalogs.mjs';\nexport * from '@openpresentation/opf-editor';\nexport const createEditorSession = (input, options) => editor.createEditorSession(input, withCatalogs(options));\n");
  await writeFile(path.join(consumer, 'host-editor-canvas.mjs'), "import * as canvas from '@openpresentation/opf-editor/canvas';\nimport {withCatalogs} from './host-catalogs.mjs';\nexport * from '@openpresentation/opf-editor/canvas';\nexport const createCanvasEditor = (host, options) => canvas.createCanvasEditor(host, withCatalogs(options));\n");
  for (const [file, entry] of [['host-render.mjs', '@openpresentation/opf-render'], ['host-render-svg.mjs', '@openpresentation/opf-render/svg']]) {
    // The renderer's engines take a slide selection or the options second (0.18); the host adds its catalog to whichever is the options.
    const engines = newRenderer
      ? "export const toSvg = (input, slides, options) => (slides !== null && typeof slides === 'object' && !Array.isArray(slides) ? render.toSvg(input, withCatalogs(slides)) : render.toSvg(input, slides, withCatalogs(options)));\n"
      : 'export const renderSvg = (input, options) => render.renderSvg(input, withCatalogs(options));\nexport const renderSlideSvg = (input, index, options) => render.renderSlideSvg(input, index, withCatalogs(options));\n';
    await writeFile(path.join(consumer, file), `import * as render from '${entry}';\nimport {withCatalogs} from './host-catalogs.mjs';\nexport * from '${entry}';\n${engines}export const resolvePresentation = (input, options) => render.resolvePresentation(input, withCatalogs(options));\n`);
  }
}
/** A browser harness that imports the installed editor or renderer entry imports it through the host modules instead. */
const hosted = (source) => source
  .replace(/(['"])@openpresentation\/opf-editor\1/g, "'./host-editor.mjs'")
  .replace(/(['"])@openpresentation\/opf-editor\/canvas\1/g, "'./host-editor-canvas.mjs'")
  .replace(/(['"])@openpresentation\/opf-render\1/g, "'./host-render.mjs'")
  .replace(/(['"])@openpresentation\/opf-render\/svg\1/g, "'./host-render-svg.mjs'");
// Serve the same DOM regression harness using only the installed npm packages.
const harness = (await readHarness('opf-editor', 'test/browser-canvas.mjs'))
  .replace('../src/canvas.js', '@openpresentation/opf-editor/canvas')
  .replace('../src/index.js', '@openpresentation/opf-editor');
await writeFile(path.join(consumer, 'canvas-tests.mjs'), hosted(harness));
const browserOut=path.join(root,'artifacts/editor');
await mkdir(browserOut,{recursive:true});
// Build every required browser asset here; a clean registry check must not
// borrow HTML or fonts left by a previous source playground build.
await writeFile(path.join(consumer, 'browser-fonts.mjs'), `import {writeFile} from 'node:fs/promises';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
await writeFile(process.argv[2],JSON.stringify((await loadFonts({pack:'office'})).embeddedFonts));
`);
run(process.execPath, ['browser-fonts.mjs', path.join(browserOut, 'fonts.json')]);
function browserHtml(suite, controls = '') {
 return `<!doctype html><meta charset="utf-8"><title>Packed ${suite} checks</title><style>body{font:14px system-ui;margin:20px}#canvas{width:1000px;max-width:100%}</style><h1>Packed ${suite} checks</h1><div id="canvas"></div>${controls}<pre id="results"></pre><script type="module" src="./packed-${suite}-tests.js"></script>`;
}

await build({entryPoints:[path.join(consumer,'canvas-tests.mjs')],outfile:path.join(browserOut,'packed-canvas-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-canvas-tests.html'),'<!doctype html><title>Packed canvas checks</title><h1>Packed npm canvas checks</h1><pre id="results"></pre><div id="canvas" style="width:1280px"></div><script type="module" src="./packed-canvas-tests.js"></script>');
console.log('Packed browser harness built: artifacts/editor/packed-canvas-tests.html (serve alongside demo fonts.json).');

const richHarness=(await readHarness('opf','scripts/test-rich-text-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-editor/src/rich-text.js','@openpresentation/opf-editor/rich-text')
 .replace('../../opf-render/src/fonts-browser.js','@openpresentation/opf-render/fonts-browser');
await writeFile(path.join(consumer,'rich-tests.mjs'),hosted(richHarness));
await build({entryPoints:[path.join(consumer,'rich-tests.mjs')],outfile:path.join(browserOut,'packed-rich-text-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-rich-text-tests.html'),'<!doctype html><meta charset="utf-8"><title>Packed rich-text checks</title><h1>Packed rich-text checks</h1><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./packed-rich-text-tests.js"></script>');
if(verifyEstimatedRichText){
  await writeFile(path.join(browserOut,'packed-rich-text-estimated-tests.js'),await readFile(path.join(browserOut,'packed-rich-text-tests.js')));
  await writeFile(path.join(browserOut,'packed-rich-text-estimated-tests.html'),browserHtml('rich-text-estimated'));
}

const layoutHarness=(await readHarness('opf','scripts/test-layout-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'layout-tests.mjs'),hosted(layoutHarness));
await build({entryPoints:[path.join(consumer,'layout-tests.mjs')],outfile:path.join(browserOut,'packed-layout-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-layout-tests.html'),browserHtml('layout','<select id="pointer-mode"><option value="normal">Normal</option><option value="cancel">Cancel</option><option value="conflict">Conflict</option><option value="independent">Independent</option></select><button id="reset">Reset</button><button id="verify">Verify</button><button id="external">External change</button><button id="independent">Independent change</button><div id="pointer-state"></div>'));

const blockHarness=(await readHarness('opf','scripts/test-block-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'block-tests.mjs'),hosted(blockHarness));
await build({entryPoints:[path.join(consumer,'block-tests.mjs')],outfile:path.join(browserOut,'packed-block-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-block-tests.html'),browserHtml('block','<button id="verify">Verify</button><div id="drag-status"></div>'));

const listHarness=(await readHarness('opf','scripts/test-list-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/fonts-browser.js','@openpresentation/opf-render/fonts-browser');
await writeFile(path.join(consumer,'list-tests.mjs'),hosted(listHarness));
await build({entryPoints:[path.join(consumer,'list-tests.mjs')],outfile:path.join(browserOut,'packed-list-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-list-tests.html'),browserHtml('list'));

const creationHarness=(await readHarness('opf','scripts/test-create-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'create-tests.mjs'),hosted(creationHarness));
await build({entryPoints:[path.join(consumer,'create-tests.mjs')],outfile:path.join(browserOut,'packed-create-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-create-tests.html'),browserHtml('create'));

if (verifyStyledTables) {
  const styledHarness=(await readHarness('opf-editor','test/styled-table-browser.mjs'))
    .replace('../src/canvas.js','@openpresentation/opf-editor/canvas')
    .replace('../src/index.js','@openpresentation/opf-editor')
    .replace('../src/rich-text.js','@openpresentation/opf-editor/rich-text');
  await writeFile(path.join(consumer,'styled-table-tests.mjs'),hosted(styledHarness));
  await build({entryPoints:[path.join(consumer,'styled-table-tests.mjs')],outfile:path.join(browserOut,'packed-styled-table-tests.js'),bundle:true,platform:'browser',format:'esm'});
  await writeFile(path.join(browserOut,'packed-styled-table-tests.html'),browserHtml('styled-table'));
  console.log('Installed styled-table browser harness built: artifacts/editor/packed-styled-table-tests.html. Open it to verify real pointer/keyboard interaction.');
}

const browserSuites=['canvas','rich-text',...(verifyEstimatedRichText?['rich-text-estimated']:[]),'layout','block','list','create',...(verifyStyledTables?['styled-table']:[])];
const hashFile=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(path.join(browserOut,'packed-browser-manifest.json'),JSON.stringify({
  mode:librariesOnly?'registry-libraries':registry?'registry':'packed',
  consumer:path.relative(root,consumer).split(path.sep).join('/'),
  browserBuildId,
  lockSha256:await hashFile(path.join(consumer,'package-lock.json')),
  packages:Object.fromEntries(await Promise.all(manifest.artifacts.map(async item=>[
    item.name,JSON.parse(await readFile(path.join(consumer,'node_modules',item.name,'package.json'),'utf8')).version,
  ]))),
  suites:browserSuites,
  files:Object.fromEntries(await Promise.all(['fonts.json',...browserSuites.flatMap(suite=>[`packed-${suite}-tests.html`,`packed-${suite}-tests.js`])].map(async file=>[file,await hashFile(path.join(browserOut,file))]))),
},null,2)+'\n');
if (!registry) await checkPackedTypes(consumer, {downstream: true});
console.log(librariesOnly ? 'Registry library consumer passed for four exact versions; CLI and complete release verification remain separate.' : registry ? (cliNotice ? `Registry consumer passed for the four exact library versions of the release plan (no local package overrides); the CLI was skipped: ${cliNotice}.` : 'Registry consumer passed for all five exact release-plan versions (no local package overrides).') : 'Local tarball consumer passed; this is not a registry verification.');
