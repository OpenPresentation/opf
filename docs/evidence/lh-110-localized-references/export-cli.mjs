// Export both sides through the maintained CLI, which prepares matching fonts/scripts for its PPTX and PNG paths.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),baseline=process.argv[2],scanRoot=process.argv[3],out=process.argv[4];assert.ok(baseline&&scanRoot&&out);await fs.mkdir(out,{recursive:true});const scan=JSON.parse(await fs.readFile(path.join(scanRoot,'scan.json'),'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),report={baseline:scan.baselineCommit,candidate:scan.sourceCommit,route:'maintained CLI convert; --date2026-11-08; PNG --scale0.5; fonts prepared by CLI office/visual/scripts:auto',cases:[]};
for(const row of scan.witnesses){
 const input=path.join(scanRoot,'cases',row.id+'.opf.json'),entry={id:row.id,inputSha256:hash(await fs.readFile(input)),before:{},after:{}};
 for(const [label,checkout]of [['before',baseline],['after',root]]){
  const target=path.join(out,label);await fs.mkdir(target,{recursive:true});
  for(const ext of ['pptx','png']){
   const file=path.join(target,row.id+'.'+ext),args=[path.join(checkout,'packages/cli/dist/index.js'),'convert',input,file,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])];
   const log=execFileSync(process.execPath,args,{cwd:checkout,encoding:'utf8'});await fs.writeFile(file+'.log',log);const bytes=await fs.readFile(file);entry[label][ext]={sha256:hash(bytes),file};if(ext==='png'){assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));entry[label][ext].width=bytes.readUInt32BE(16);entry[label][ext].height=bytes.readUInt32BE(20);}
  }
 }
 report.cases.push(entry);
}
const control=report.cases.find(row=>row.id.endsWith('en-US'));assert.equal(control.before.png.sha256,control.after.png.sha256,'existing English preview byte-exact');assert.equal(control.before.pptx.sha256,control.after.pptx.sha256,'existing English native archive byte-exact');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:report.cases.length,ids:report.cases.map(row=>row.id)}));
