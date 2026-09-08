import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  out = path.join(root, "artifacts/npm");
const librariesOnly = process.argv.includes('--registry-libraries');
const registry = process.argv.includes('--registry') || librariesOnly;
const releasePlan = registry ? JSON.parse(await readFile(path.join(root, "release-plan.json"), "utf8")) : null;
// layoutTable first shipped in core 0.6.0. Keep historical registry plans
// testable, while requiring the API and its pinned regression suite thereafter.
const coreVersion = releasePlan?.packages.find(item => item.name === '@openpresentation/opf')?.version.split('.').map(Number);
const verifyTableLayout = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 6;
// Styled-cell rollout targets core 0.7; published 0.6 fixtures remain separate.
const verifyStyledTables = !registry || coreVersion?.[0] > 0 || coreVersion?.[1] >= 7;

async function readHarness(repo, file) {
  const directory = repo === 'opf' ? root : path.resolve(root, '..', repo);
  if (!registry) return readFile(path.join(directory, file), 'utf8');
  const ref = releasePlan.verificationRefs?.[repo];
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error(`Missing immutable registry verification ref for ${repo}`);
  const result = spawnSync('git', ['show', `${ref}:${file}`], {cwd:directory, encoding:'utf8'});
  if (result.status !== 0) throw new Error(`Cannot read ${repo} release harness ${file}: ${result.stderr}`);
  return result.stdout;
}
const consumer = path.join(out, librariesOnly ? "registry-libraries-consumer" : registry ? "registry-consumer" : "consumer");
const manifest = registry
  ? { artifacts: releasePlan.packages }
  : JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
if (librariesOnly) manifest.artifacts = manifest.artifacts.filter(item => item.name !== '@openpresentation/cli');
await rm(consumer, { recursive: true, force: true });
await mkdir(consumer, { recursive: true });
await writeFile(
  path.join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "opf-packed-consumer",
      private: true,
      type: "module",
      dependencies: Object.fromEntries(
        manifest.artifacts.map((item) => [item.name, registry ? item.version : `file:../${item.file}`]),
      ),
    },
    null,
    2,
  ),
);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: consumer, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(`${command} exited ${result.status}`);
}
run("npm", [
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  "--cache",
  "/tmp/opf-npm-cache",
]);
await writeFile(
  path.join(consumer, "check.mjs"),
  `import assert from 'node:assert/strict';
import {createDataContent} from '@openpresentation/opf/data';
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
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
import {loadBundledFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx} from '@openpresentation/opf-pptx';
assert.equal(createDataContent('Q,R\\nQ1,12',{as:'chart'}).chart.data.rows[0][1],12);
assert.equal(parseTabularData([{q:'Q1',r:12}]).rows[0][1],12);
assert.equal(fitList([{text:'Packed list',level:2}],{x:0,y:0,width:300,height:100}).listEntries[0].level,2);
assert.ok(fitRichText([{text:'Packed rich text',bold:true}],{x:0,y:0,width:300,height:100}).richLines.length);
assert.deepEqual(formatRichTextRange('Hello',0,5,{bold:true}),[{text:'Hello',bold:true}]);
assert.equal(richTextContent(replaceRichTextRange(['Hello'],1,4,'i')),'Hio');
assert.ok(listSchemaFields().length>=604);assert.equal(typeof createSchemaInspector,'function');
const fonts=await loadBundledFontRegistry();
const editor=createEditorSession({design:{fontScheme:'roboto'},slides:[{title:'Packed consumer',composition:{mode:'row'},blocks:[{text:'One'},{text:'Two'}]}]});
editor.set('slides.0.title','Installed consumer');
editor.applyPatch(prepareTrackResize(editor.document,editor.composeSlide(0).flows[0],0,.6).patches);
assert.equal(editor.get('slides.0.composition.weights.0'),1.2);
assert.equal(listBlockContainers(editor.document).length,1);
editor.applyPatch(prepareBlockMove(editor.document,'slides.0.blocks.0','slides.0',2).patches);
assert.equal(editor.get('slides.0.blocks.1.text'),'One');
editor.applyPatch(prepareBlockInsert(editor.document,'slides.0',createContentBlock('text')).patches);
editor.applyPatch(prepareBlockDuplicate(editor.document,'slides.0.blocks.2').patches);
editor.applyPatch(prepareBlockRemove(editor.document,'slides.0.blocks.2').patches);
assert.equal(editor.get('slides.0.blocks.2.text'),'Add your text');
const svg=renderSvg(editor.document,{textMeasurement:fonts.textMeasurement});
assert.match(svg,/Installed consumer/);
assert.equal(typeof createCanvasEditor,'function');assert.equal(typeof loadBrowserFontRegistry,'function');
const richEditor=createEditorSession({design:{fontScheme:'roboto'},slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[['Cell']]}}]});
richEditor.set('slides.0.table.rows.0.0',formatRichTextRange('Cell',0,4,{bold:true,color:'#008800'}));
assert.deepEqual(richEditor.get('slides.0.table.rows.0.0'),[{text:'Cell',bold:true,color:'#008800'}]);
assert.match(renderSvg(richEditor.document,{trace:true,textMeasurement:fonts.textMeasurement}),/data-opf-rich-text="true"/);
assert.ok((await toPptx(richEditor.document,{textMeasurement:fonts.textMeasurement})).length>1000);
richEditor.undo();assert.equal(richEditor.get('slides.0.table.rows.0.0'),'Cell');
const copied=parseOpfTransfer(serializeOpfTransfer(editor.document,{scope:'slide',format:'markdown'}));
assert.equal(prepareOpfImport(editor.document,copied).document.slides.length,2);
const gallery=await loadOpfGallery('https://gallery.example/registry.json',{fetch:async()=>new Response(JSON.stringify({items:[{name:'Example',opf:copied.document}]}))});
assert.equal(gallery.items.length,1);
const pptx=await toPptx(editor.document,{textMeasurement:fonts.textMeasurement});
assert.ok(pptx.length>1000);
console.log('Packed consumer: core, editor, SVG, measured fonts and PPTX passed.');\n`,
);
run(process.execPath, ["check.mjs"]);
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
  if (!librariesOnly) {
    run(path.join(consumer, 'node_modules/.bin/opf'), ['--version']);
    run(path.join(consumer, 'node_modules/.bin/opf'), ['create', 'registry.opf.json', '--title', 'Registry consumer']);
    run(path.join(consumer, 'node_modules/.bin/opf'), ['validate', 'registry.opf.json']);
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
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
export {parseOpfTransfer,prepareOpfImport,serializeOpfTransfer} from '@openpresentation/opf-editor/transfer';
export {loadOpfGallery,loadOpfGalleryItem} from '@openpresentation/opf-editor/galleries';
export {createSchemaInspector} from '@openpresentation/opf-editor/schema-inspector';
export {formatRichTextRange,replaceRichTextRange,richTextContent,type TextRunFormat} from '@openpresentation/opf-editor/rich-text';
export {prepareTrackResize,prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from '@openpresentation/opf-editor/layout';
export {fitList,type ListFit,type ListValue} from '@openpresentation/opf/composition';
${verifyTableLayout ? "export {layoutTable,type TableLayout,type TableLayoutOptions,type TableCellLayout} from '@openpresentation/opf/composition';" : ''}
export {schemaAtPath,listSchemaFields} from '@openpresentation/opf-editor/schema';
export async function mount(container:HTMLElement):Promise<CanvasEditor> {
 const fonts=await loadBrowserFontRegistry([{url:'/fonts/Roboto.ttf'},{url:'/fonts/RobotoMono.ttf'}]);
 return createCanvasEditor(container,{document:{slides:[{title:'Hello'}]},renderOptions:{textMeasurement:fonts.textMeasurement}});
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
// Serve the same DOM regression harness using only the installed npm packages.
const harness = (await readHarness('opf-editor', 'test/browser-canvas.mjs'))
  .replace('../src/canvas.js', '@openpresentation/opf-editor/canvas')
  .replace('../src/index.js', '@openpresentation/opf-editor');
await writeFile(path.join(consumer, 'canvas-tests.mjs'), harness);
const browserOut=path.join(root,'artifacts/editor');
await mkdir(browserOut,{recursive:true});
// Build every required browser asset here; a clean registry check must not
// borrow HTML or fonts left by a previous source playground build.
await writeFile(path.join(consumer, 'browser-fonts.mjs'), `import {writeFile} from 'node:fs/promises';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
await writeFile(process.argv[2],JSON.stringify((await loadOfficeFontRegistry()).embeddedFonts));
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
await writeFile(path.join(consumer,'rich-tests.mjs'),richHarness);
await build({entryPoints:[path.join(consumer,'rich-tests.mjs')],outfile:path.join(browserOut,'packed-rich-text-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-rich-text-tests.html'),'<!doctype html><meta charset="utf-8"><title>Packed rich-text checks</title><h1>Packed rich-text checks</h1><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./packed-rich-text-tests.js"></script>');

const layoutHarness=(await readHarness('opf','scripts/test-layout-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'layout-tests.mjs'),layoutHarness);
await build({entryPoints:[path.join(consumer,'layout-tests.mjs')],outfile:path.join(browserOut,'packed-layout-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-layout-tests.html'),browserHtml('layout','<select id="pointer-mode"><option value="normal">Normal</option><option value="cancel">Cancel</option><option value="conflict">Conflict</option><option value="independent">Independent</option></select><button id="reset">Reset</button><button id="verify">Verify</button><button id="external">External change</button><button id="independent">Independent change</button><div id="pointer-state"></div>'));

const blockHarness=(await readHarness('opf','scripts/test-block-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'block-tests.mjs'),blockHarness);
await build({entryPoints:[path.join(consumer,'block-tests.mjs')],outfile:path.join(browserOut,'packed-block-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-block-tests.html'),browserHtml('block','<button id="verify">Verify</button><div id="drag-status"></div>'));

const listHarness=(await readHarness('opf','scripts/test-list-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/fonts-browser.js','@openpresentation/opf-render/fonts-browser');
await writeFile(path.join(consumer,'list-tests.mjs'),listHarness);
await build({entryPoints:[path.join(consumer,'list-tests.mjs')],outfile:path.join(browserOut,'packed-list-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-list-tests.html'),browserHtml('list'));

const creationHarness=(await readHarness('opf','scripts/test-create-browser.mjs'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'create-tests.mjs'),creationHarness);
await build({entryPoints:[path.join(consumer,'create-tests.mjs')],outfile:path.join(browserOut,'packed-create-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-create-tests.html'),browserHtml('create'));

if (verifyStyledTables) {
  const styledHarness=(await readHarness('opf-editor','test/styled-table-browser.mjs'))
    .replace('../src/canvas.js','@openpresentation/opf-editor/canvas')
    .replace('../src/index.js','@openpresentation/opf-editor')
    .replace('../src/rich-text.js','@openpresentation/opf-editor/rich-text');
  await writeFile(path.join(consumer,'styled-table-tests.mjs'),styledHarness);
  await build({entryPoints:[path.join(consumer,'styled-table-tests.mjs')],outfile:path.join(browserOut,'packed-styled-table-tests.js'),bundle:true,platform:'browser',format:'esm'});
  await writeFile(path.join(browserOut,'packed-styled-table-tests.html'),browserHtml('styled-table'));
  console.log('Installed styled-table browser harness built: artifacts/editor/packed-styled-table-tests.html. Open it to verify real pointer/keyboard interaction.');
}

console.log(librariesOnly ? 'Registry library consumer passed for four exact versions; CLI and complete release verification remain separate.' : registry ? 'Registry consumer passed for all five exact release-plan versions (no local package overrides).' : 'Local tarball consumer passed; this is not a registry verification.');
