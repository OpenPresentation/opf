import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  out = path.join(root, "artifacts/npm");
const registry = process.argv.includes('--registry');
const consumer = path.join(out, registry ? "registry-consumer" : "consumer");
const manifest = registry
  ? { artifacts: JSON.parse(await readFile(path.join(root, "release-plan.json"), "utf8")).packages }
  : JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
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
editor.set('slides.0.title','Installed from npm tarballs');
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
assert.match(svg,/Installed from npm tarballs/);
assert.equal(typeof createCanvasEditor,'function');assert.equal(typeof loadBrowserFontRegistry,'function');
const copied=parseOpfTransfer(serializeOpfTransfer(editor.document,{scope:'slide',format:'markdown'}));
assert.equal(prepareOpfImport(editor.document,copied).document.slides.length,2);
const gallery=await loadOpfGallery('https://gallery.example/registry.json',{fetch:async()=>new Response(JSON.stringify({items:[{name:'Example',opf:copied.document}]}))});
assert.equal(gallery.items.length,1);
const pptx=await toPptx(editor.document,{textMeasurement:fonts.textMeasurement});
assert.ok(pptx.length>1000);
console.log('Packed consumer: core, editor, SVG, measured fonts and PPTX passed.');\n`,
);
run(process.execPath, ["check.mjs"]);
if (registry) {
  for (const item of manifest.artifacts) {
    const installed = JSON.parse(await readFile(path.join(consumer, 'node_modules', item.name, 'package.json'), 'utf8'));
    if (installed.version !== item.version) throw new Error(`Expected ${item.name}@${item.version}, installed ${installed.version}`);
  }
  run(path.join(consumer, 'node_modules/.bin/opf'), ['--version']);
  run(path.join(consumer, 'node_modules/.bin/opf'), ['create', 'registry.opf.json', '--title', 'Registry consumer']);
  run(path.join(consumer, 'node_modules/.bin/opf'), ['validate', 'registry.opf.json']);
}

await writeFile(
  path.join(consumer, "browser.ts"),
  `import {presentation} from '@openpresentation/opf/schemas';
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
const harness = (await readFile(path.resolve(root, '../opf-editor/test/browser-canvas.mjs'), 'utf8'))
  .replace('../src/canvas.js', '@openpresentation/opf-editor/canvas')
  .replace('../src/index.js', '@openpresentation/opf-editor');
await writeFile(path.join(consumer, 'canvas-tests.mjs'), harness);
const browserOut=path.join(root,'artifacts/editor');
await mkdir(browserOut,{recursive:true});
await build({entryPoints:[path.join(consumer,'canvas-tests.mjs')],outfile:path.join(browserOut,'packed-canvas-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-canvas-tests.html'),'<!doctype html><title>Packed canvas checks</title><h1>Packed npm canvas checks</h1><pre id="results"></pre><div id="canvas" style="width:1280px"></div><script type="module" src="./packed-canvas-tests.js"></script>');
console.log('Packed browser harness built: artifacts/editor/packed-canvas-tests.html (serve alongside demo fonts.json).');

const richHarness=(await readFile(path.join(root,'scripts/test-rich-text-browser.mjs'),'utf8'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-editor/src/rich-text.js','@openpresentation/opf-editor/rich-text')
 .replace('../../opf-render/src/fonts-browser.js','@openpresentation/opf-render/fonts-browser');
await writeFile(path.join(consumer,'rich-tests.mjs'),richHarness);
await build({entryPoints:[path.join(consumer,'rich-tests.mjs')],outfile:path.join(browserOut,'packed-rich-text-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-rich-text-tests.html'),'<!doctype html><meta charset="utf-8"><title>Packed rich-text checks</title><h1>Packed rich-text checks</h1><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./packed-rich-text-tests.js"></script>');

const layoutHarness=(await readFile(path.join(root,'scripts/test-layout-browser.mjs'),'utf8'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'layout-tests.mjs'),layoutHarness);
await build({entryPoints:[path.join(consumer,'layout-tests.mjs')],outfile:path.join(browserOut,'packed-layout-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-layout-tests.html'),(await readFile(path.join(browserOut,'layout-tests.html'),'utf8')).replace('./layout-tests.js','./packed-layout-tests.js'));

const blockHarness=(await readFile(path.join(root,'scripts/test-block-browser.mjs'),'utf8'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'block-tests.mjs'),blockHarness);
await build({entryPoints:[path.join(consumer,'block-tests.mjs')],outfile:path.join(browserOut,'packed-block-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-block-tests.html'),(await readFile(path.join(browserOut,'block-tests.html'),'utf8')).replace('./block-tests.js','./packed-block-tests.js'));

const listHarness=(await readFile(path.join(root,'scripts/test-list-browser.mjs'),'utf8'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/fonts-browser.js','@openpresentation/opf-render/fonts-browser');
await writeFile(path.join(consumer,'list-tests.mjs'),listHarness);
await build({entryPoints:[path.join(consumer,'list-tests.mjs')],outfile:path.join(browserOut,'packed-list-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-list-tests.html'),(await readFile(path.join(browserOut,'list-tests.html'),'utf8')).replace('./list-tests.js','./packed-list-tests.js'));

const creationHarness=(await readFile(path.join(root,'scripts/test-create-browser.mjs'),'utf8'))
 .replace('../../opf-editor/src/canvas.js','@openpresentation/opf-editor/canvas')
 .replace('../../opf-editor/src/index.js','@openpresentation/opf-editor')
 .replace('../../opf-render/src/svg.js','@openpresentation/opf-render/svg');
await writeFile(path.join(consumer,'create-tests.mjs'),creationHarness);
await build({entryPoints:[path.join(consumer,'create-tests.mjs')],outfile:path.join(browserOut,'packed-create-tests.js'),bundle:true,platform:'browser',format:'esm'});
await writeFile(path.join(browserOut,'packed-create-tests.html'),(await readFile(path.join(browserOut,'create-tests.html'),'utf8')).replace('./create-tests.js','./packed-create-tests.js'));

console.log(registry ? 'Registry consumer passed for exact release-plan versions (no local package overrides).' : 'Local tarball consumer passed; this is not a registry verification.');
