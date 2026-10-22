// A local, canonical OPF snapshot sourced from the sibling gallery's own builders.
// MR-56: `--site <dir>` names the pptx.gallery checkout (default: the sibling ../pptx-gallery); `--registry --consumer <dir>` bundles
// against an installed npm consumer of one published set (scripts/registry-consumer.mjs, the esbuild installed there), without
// release-plan.json. `--registry` alone keeps the release plan's consumer for the scripts that still read it.
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const flag=name=>{const at=process.argv.indexOf(name);if(at===-1)return undefined;if(process.argv[at+1]===undefined||process.argv[at+1].startsWith('--'))throw new Error(`${name} needs a value`);return process.argv[at+1];};
const root=fileURLToPath(new URL('../',import.meta.url)),gallery=path.resolve(flag('--site')??path.join(root,'../pptx-gallery')),out=path.join(root,'artifacts/editor');
const require=createRequire(path.join(root,'packages/javascript/package.json'));
const consumer=flag('--consumer');
const registry = process.argv.includes('--registry') ? (consumer ? await (await import('./registry-consumer.mjs')).consumerToolchain(path.resolve(consumer)) : await (await import('./registry-toolchain.mjs')).registryToolchain()) : null;
const{build}=registry?.esbuild??createRequire(require.resolve('tsup'))('esbuild');await mkdir(out,{recursive:true});
// The open editor demo must also build without the private gallery repository.
if (process.env.OPF_BUNDLED_GALLERY === '1' || !existsSync(path.join(gallery, 'lib/opf-snippets.ts'))) {
 const {examples} = registry ? await registry.import('@openpresentation/opf/examples') : await import('../packages/javascript/dist/examples.js');
 await writeFile(path.join(out,'gallery.json'),JSON.stringify({version:1,name:'OpenPresentation examples',source:'https://openpresentation.org',items:examples.map(entry=>({id:entry.file,name:entry.deck.name??entry.file,category:'examples',opf:entry.deck}))}));
 console.log(`Gallery snapshot: ${examples.length} bundled OPF examples (no sibling gallery).`);
} else {
const bundle=path.join(out,'gallery-builder.cjs');
await build({entryPoints:[path.join(gallery,'lib/opf-snippets.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',mainFields:['module','main'],tsconfig:path.join(gallery,'tsconfig.json'),plugins:registry?[registry.plugin()]:[]});
const snippets=require(bundle),items=[];
await rm(bundle);
// Newer galleries build image-treatment snippets in a server-only module (lib/image-treatment-snippets.ts) so the sample image stays out of client chunks.
if (!snippets.buildImageTreatmentOpfSnippet && existsSync(path.join(gallery,'lib/image-treatment-snippets.ts'))) {
 const treatmentBundle=path.join(out,'gallery-image-treatments.cjs');
 await build({entryPoints:[path.join(gallery,'lib/image-treatment-snippets.ts')],outfile:treatmentBundle,bundle:true,platform:'node',format:'cjs',mainFields:['module','main'],tsconfig:path.join(gallery,'tsconfig.json'),plugins:registry?[registry.plugin()]:[]});
 snippets.buildImageTreatmentOpfSnippet=require(treatmentBundle).buildImageTreatmentOpfSnippet;
 await rm(treatmentBundle);
}
for(const [category,builder]of [
 ['layouts',item=>snippets.buildOpfSnippet('layouts',item.id)],['color-schemes',item=>snippets.buildOpfSnippet('color-schemes',item.id??item.slug)],['font-schemes',item=>snippets.buildOpfSnippet('font-schemes',item.id??item.slug)],['backgrounds',item=>snippets.buildOpfSnippet('backgrounds',item.slug)],['narratives',item=>snippets.buildOpfSnippet('narratives',item.id??item.slug)],['charts',snippets.buildChartOpfSnippet],['themes',snippets.buildThemeOpfSnippet],['audiences',snippets.buildAudienceOpfSnippet],['tones',snippets.buildToneOpfSnippet],['languages',snippets.buildLanguageOpfSnippet],['socials',snippets.buildSocialPlatformOpfSnippet],['headers-footers',snippets.buildHeaderFooterOpfSnippet],['blocks',snippets.buildContentBlockOpfSnippet],['image-treatments',snippets.buildImageTreatmentOpfSnippet]]){
 const data=JSON.parse(await readFile(path.join(gallery,'data',category+'.json'),'utf8'));
 for(const item of [...(data.items??data.templates??data.schemes??[]),...(data.legacyItems??[])])items.push({id:`${category}/${item.id??item.slug}`,name:item.label??item.name??item.id??item.slug,description:item.summary??item.description??'',category,opf:selfContained(JSON.parse(builder(item)),category,item)});
}
await writeFile(path.join(out,'gallery.json'),JSON.stringify({version:1,name:'PPTX.gallery · workspace examples',source:'https://www.pptx.gallery',items}));
console.log(`Gallery snapshot: ${items.length} canonical OPF examples.`);

function selfContained(document, category, item) {
 const kind={languages:'languages',socials:'socialPlatforms'}[category];
 if(kind && document.catalogs?.[kind]?.source) document.catalogs[kind]={records:[item]};
 return document;
}

}
