// Bundle pptx-gallery lib/opf-snippets.ts (origin/main) with esbuild, aliasing @/ to the gallery and
// @openpresentation/opf/* to the audit-B core dist, then write out/snippets.json.
import {build} from '../../../sources/audit-B-opf-render/node_modules/esbuild/lib/main.js';
import path from 'node:path'; import {fileURLToPath,pathToFileURL} from 'node:url'; import {writeFile} from 'node:fs/promises';
const here=path.dirname(fileURLToPath(import.meta.url));
const GALLERY=process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery';
const CORE=path.resolve(here,'../../../sources/audit-B-opf/packages/javascript');
const plugin={name:'alias',setup(b){
  b.onResolve({filter:/^@\//},a=>{const base=path.join(GALLERY,a.path.slice(2));for(const ext of ['','.ts','.tsx','.json'])try{require_exists(base+ext);return{path:base+ext}}catch{}return{path:base+'.ts'}});
  b.onResolve({filter:/^@openpresentation\/opf(\/.*)?$/},a=>{const sub=a.path.slice('@openpresentation/opf'.length).replace(/^\//,'');
    if(!sub)return{path:path.join(CORE,'dist/index.js')}; if(sub==='package.json')return{path:path.join(CORE,'package.json')};
    return{path:path.join(CORE,'dist',sub.startsWith('spec/')?sub:sub+'.js')};});
}};
import {statSync} from 'node:fs'; function require_exists(p){if(!statSync(p).isFile())throw 0;}
const outfile=path.join(here,'../out/snippet-bundle.mjs');
await build({entryPoints:[path.join(here,'snippet-entry.ts')],bundle:true,format:'esm',platform:'node',outfile,plugins:[plugin],logLevel:'warning',loader:{'.json':'json'}});
const {allSnippets}=await import(pathToFileURL(outfile).href+'?'+Date.now());
const all=allSnippets();
await writeFile(path.join(here,'../out/snippets.json'),JSON.stringify(all,null,1));
const counts={};for(const s of all){counts[s.dimension]??={n:0,err:0};counts[s.dimension].n++;if(s.error)counts[s.dimension].err++;}
console.log(counts);
