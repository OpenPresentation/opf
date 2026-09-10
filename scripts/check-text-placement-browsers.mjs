import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),major=process.versions.node.split('.')[0],output=path.join(root,'text-raster-final-checks',`browser-node${major}`);
mkdirSync(output,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex');
const commands=[
  ['opf-render','test/accepted-text-browser.mjs','accepted-text'],
  ['opf-render','test/rich-spacing-browser.mjs','gallery-spacing'],
  ['opf-render','test/shared-code-browser.mjs','code-render.json'],
  ['opf-render','test/image-placeholders-browser.mjs','images.json'],
  ['opf-editor','test/code-browser.mjs','code-editor.json'],
  ['opf-editor','test/metric-browser.mjs','metric-editor.json'],
  ['opf-editor','test/metric-browser.mjs','card-editor.json','--cards'],
];
const results=[];
for(const [index,[repo,script,report,...extra]]of commands.entries()){
  const result=spawnSync(process.execPath,[script,path.join(output,report),...extra],{cwd:path.join(root,repo),encoding:'utf8',maxBuffer:10*1024*1024});
  const log=`${index}.log`,bytes=(result.stdout??'')+(result.stderr??'');writeFileSync(path.join(output,log),bytes);
  results.push({repo,script,extra,node:process.version,status:result.status,report,log,sha256:hash(bytes),...(result.error?{error:result.error.message}:{})});console.log(JSON.stringify(results.at(-1)));
}
const runtime={};for(const repo of ['opf','opf-render','opf-pptx','opf-editor']){
  const directory=path.join(root,repo,repo==='opf'?'packages/javascript':'');
  for(const file of ['package.json',...readdirSync(path.join(directory,'dist')).filter(file=>file.endsWith('.js')).sort().map(file=>'dist/'+file)])runtime[repo+'/'+file]=hash(readFileSync(path.join(directory,file)));
}
writeFileSync(path.join(output,'checks.json'),JSON.stringify({runtime,results},null,2)+'\n');
process.exitCode=results.some(result=>result.status!==0)?1:0;
