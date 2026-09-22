import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const root=path.resolve(process.argv[2]),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
const monaco=path.resolve(path.dirname(require.resolve('monaco-editor')),'../..');
const pkg=JSON.parse(fs.readFileSync(path.join(monaco,'package.json'),'utf8'));
function inventory(rel){
 const file=path.join(monaco,rel),b=fs.readFileSync(file),text=b.toString(),ast=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),deps=[];
 const calls={fetch:0,importScripts:0,require:0,define:0};
 function visit(n){
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier)deps.push({type:'static',expression:n.moduleSpecifier.getText(ast)});
  if(ts.isCallExpression(n)){
   if(n.expression.kind===ts.SyntaxKind.ImportKeyword)deps.push({type:'dynamic',expression:n.arguments[0]?.getText(ast)});
   else if(ts.isIdentifier(n.expression)&&Object.hasOwn(calls,n.expression.text)){
    calls[n.expression.text]++;
    if(n.expression.text==='define')deps.push({type:'AMD',expression:n.arguments.find(a=>ts.isArrayLiteralExpression(a))?.getText(ast)});
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
 return{path:rel,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),gzipBytes:gzipSync(b).length,brotliBytes:brotliCompressSync(b).length,dependencies:deps,calls,sourceMapReferences:(text.match(/sourceMappingURL/g)||[]).length,hasInlineCopyright:/Copyright|@license/.test(text)};
}
const assets=fs.readdirSync(path.join(monaco,'min/vs/assets'));
const candidates=assets.filter(f=>/^(?:json|editor)\.worker-.*\.js$/.test(f));
const files=[...candidates.map(f=>'min/vs/assets/'+f),'min/vs/language/json/json.worker.js','min/vs/editor/editor.worker.js','esm/vs/languages/features/json/json.worker.js','esm/vs/editor/editor.worker.js'];
const provenance=['package.json','LICENSE','ThirdPartyNotices.txt'].map(file=>{const b=fs.readFileSync(path.join(monaco,file));return{file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}});
const inputs=['scripts/prepare-opf-browser.mjs','next.config.ts','package.json','pnpm-lock.yaml','components/playground/opf-editor.tsx'].map(file=>{const b=fs.readFileSync(path.join(root,file));return{file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}});
let externalDiffInstalled;try{externalDiffInstalled=require.resolve('@vscode/diff')}catch{externalDiffInstalled=false}
console.log(JSON.stringify({node:process.version,scope:'Read-only static source audit; compression sizes are local estimates, not network observations',root,monacoRoot:monaco,monacoVersion:pkg.version,vscodeCommitId:pkg.vscodeCommitId,monacoCommitId:pkg.monacoCommitId,provenance,externalDiffInstalled,files:files.map(inventory),inputs},null,2));
