import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),beforeRoot=process.argv[2],out=process.argv[3];assert.ok(beforeRoot&&out);await fs.mkdir(out,{recursive:true});const requirePptx=createRequire(path.join(root,'packages/pptx/package.json')),{unzipSync}=requirePptx('fflate');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),report=JSON.parse(await fs.readFile(path.join(beforeRoot,'manifest.json'),'utf8'));report.candidate=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();report.proof=[];
for(const row of report.cases){const input=path.join(beforeRoot,'inputs',row.id+'.opf.json');assert.equal(hash(await fs.readFile(input)),row.inputSha256);row.after={};
 for(const ext of ['pptx','png']){const file=path.join(out,row.id+'.'+ext),log=execFileSync(process.execPath,[path.join(root,'packages/cli/dist/index.js'),'convert',input,file,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])],{cwd:root,encoding:'utf8'});await fs.writeFile(file+'.log',log);const bytes=await fs.readFile(file);row.after[ext]={file,sha256:hash(bytes),...(ext==='png'?{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}:{})};}
 assert.equal(row.after.png.sha256,row.before.png.sha256,row.id+': exact unchanged preview');const a=unzipSync(await fs.readFile(row.before.pptx.file)),b=unzipSync(await fs.readFile(row.after.pptx.file));assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());const changed=[];
 for(const part of Object.keys(a)){if(hash(a[part])===hash(b[part]))continue;assert.match(part,/^ppt\/charts\/chart\d+\.xml$/,'only native chart XML changes');const before=Buffer.from(a[part]).toString('utf8'),after=Buffer.from(b[part]).toString('utf8');const restored=after.replace(/(<c:catAx>[\s\S]*?<c:tickLblPos val=")low("\/>)/u,'$1nextTo$2');assert.equal(restored,before,row.id+': sole negative category label-position change');changed.push(part);}
 if(row.native)assert.ok(changed.length>0,row.id+': affected native policy');else assert.equal(row.after.pptx.sha256,row.before.pptx.sha256,row.id+': whole native archive unchanged');report.proof.push({id:row.id,previewByteIdentical:true,nativeByteIdentical:!row.native,changedParts:changed,onlyCatAxisTickLabelLow:row.native});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseline:report.baseline,candidate:report.candidate,cases:report.cases.length,proof:report.proof}));
