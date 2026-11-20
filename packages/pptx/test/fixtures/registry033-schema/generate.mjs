import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {validate} from '@openpresentation/opf';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
const consumer=await realpath(new URL('.',import.meta.url));
const req=createRequire(import.meta.url),identities=JSON.parse(await readFile(new URL('./registry-identities.json',import.meta.url),'utf8'));
for(const expected of identities.packages){
 const path=req.resolve(expected.name+'/package.json'),pkg=JSON.parse(await readFile(path,'utf8'));
 assert.equal(pkg.version,'0.33.0'); if(pkg.gitHead!==undefined)assert.equal(pkg.gitHead,expected.gitHead);
 assert.ok((await readFile(new URL('./pnpm-lock.yaml',import.meta.url),'utf8')).includes(expected.integrity),'Installed lock must match authoritative registry integrity');
 assert.ok((await realpath(path)).startsWith(consumer+'/node_modules/'),'Registry witness cannot use a source worktree');
 expected.installedPackagePath=await realpath(path);
}
const source={name:'Genuine registry 0.33 legacy schema witness',language:'en-US',design:{titleAlignment:'left',footer:{right:{text:'slides.0.left'}}},extensions:{'slides.0.left':'slides.0.left',titleAlignment:'left'},datasets:{'legacy-source':{columns:['Key','Value'],rows:[['slides.0.left',12],['Other',18]]}},slides:[
 {title:'Legacy anchor units',blocks:[{id:'anchor-note',text:'Literal slides.0.left'},{code:{language:'text',source:'slides.0.left'}}],shapes:[{id:'anchor-wide',shape:'rect',at:{block:'anchor-note',edge:'end',width:160,height:64},fill:'accent1',decorative:true},{id:'anchor-cliff',shape:'ellipse',at:{block:'anchor-note',edge:'top',width:1.01,height:0.5},fill:'accent2',decorative:true}]},
 {title:'Legacy rich table',table:{columns:['Field','Value'],rows:[['slides.0.left',{value:[{text:'Bonjour ',lang:'fr-FR',bold:true},{text:'slides.0.left',lang:'fr-FR'}],style:{align:'left',borders:{left:{color:'accent1',width:1}}}}]]}},
 {title:'Legacy shared dataset',chart:{type:'column',data:{dataset:'legacy-source'}}}
]};
const catalogs=[gallery];
const report=validate(source,{catalogs});
assert.equal(report.valid,true,JSON.stringify(report));
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),diagnostics=[];
const bytes=await toPptx(source,{fonts,catalogs,date:'2026-11-10',onDiagnostic:x=>diagnostics.push(x)});
const imported=await fromPptx(bytes,{catalogs});
const output=new URL('./output/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('source.opf.json',output),JSON.stringify(source,null,2)+'\n');
await writeFile(new URL('registry033.pptx',output),bytes);
await writeFile(new URL('registry033-import.opf.json',output),JSON.stringify(imported,null,2)+'\n');
const receipt={purpose:'Actual registry0.33 export, not a PowerPoint native observation',packages:identities.packages,node:process.version,options:{date:'2026-11-10',bodyText:'measured'},pptx:{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},validation:report,diagnostics};
await writeFile(new URL('receipt.json',output),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,sha256:receipt.pptx.sha256,slides:source.slides.length}));
