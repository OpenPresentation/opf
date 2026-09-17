import { createRequire } from 'node:module';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { validatePresentation } from '../packages/javascript/dist/index.js';
const require = createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const root = fileURLToPath(new URL('../../pptx-gallery/',import.meta.url));
const output = await mkdtemp(path.join(tmpdir(),'opf-gallery-test-'));
const bundle=path.join(output,'snippets.mjs');
await build({entryPoints:[path.join(root,'lib/opf-snippets.ts')],outfile:bundle,bundle:true,platform:'node',format:'esm',packages:'external',tsconfig:path.join(root,'tsconfig.json')});
const snippets=await import(pathToFileURL(bundle));
const load=async name=>JSON.parse(await readFile(path.join(root,`data/${name}.json`),'utf8'));
let count=0;
const renderFailures=[];
const renderer=process.argv.includes("--render") ? await import("../../opf-render/dist/index.js") : null;
for(const [name,builder] of [
 ['layouts',item=>snippets.buildOpfSnippet('layouts',item.id)],
 ['color-schemes',item=>snippets.buildOpfSnippet('color-schemes',item.id??item.slug)],
 ['font-schemes',item=>snippets.buildOpfSnippet('font-schemes',item.id??item.slug)],
 ['backgrounds',item=>snippets.buildOpfSnippet('backgrounds',item.slug)],
 ['narratives',item=>snippets.buildOpfSnippet('narratives',item.id??item.slug)],
 ['charts',snippets.buildChartOpfSnippet],['themes',snippets.buildThemeOpfSnippet],
 ['audiences',snippets.buildAudienceOpfSnippet],['tones',snippets.buildToneOpfSnippet],
 ['languages',snippets.buildLanguageOpfSnippet],['socials',snippets.buildSocialPlatformOpfSnippet],
 ['headers-footers',snippets.buildHeaderFooterOpfSnippet],['blocks',snippets.buildContentBlockOpfSnippet],
 ['image-treatments',snippets.buildImageTreatmentOpfSnippet],
]){
 const data=await load(name);
 const records=[...(data.items??data.templates??data.schemes??[]),...(data.legacyItems??[])];
 assert.ok(records.length,`Missing test records for ${name}`);
 for(const record of records){
  try {
   const document=JSON.parse(builder(record));
   const result=validatePresentation(document);
   assert.equal(result.valid,true,JSON.stringify(result.errors));
   assert.ok(document.slides.length>0);
   assert.ok(!document.meta && !document.version);
   assert.ok(document.slides.every(slide=>!slide.elements));
   count++;
   if(renderer) { try { renderer.renderSvgDeck(document); } catch(error) { renderFailures.push({name:`${name}/${record.id??record.slug}`,code:error.code,message:error.message}); } }
  }catch(error){throw new Error(`${name}/${record.id??record.slug}: ${error.message}`,{cause:error});}
 }
 console.log(`${name}: ${records.length} canonical OPF examples`);
}
console.log(`Gallery snippet validation passed: ${count} complete documents.`);

if(renderer) { console.log(JSON.stringify({renderFailures},null,2)); if(renderFailures.length) process.exitCode=1; }
