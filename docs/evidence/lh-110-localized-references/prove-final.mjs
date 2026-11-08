// Requalify unchanged native inputs after the final scale-leading vocabulary correction; keep the genuine earlier baseline export.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),earlier=process.argv[2],output=process.argv[3];assert.ok(earlier&&output);await fs.mkdir(output,{recursive:true});
const report=JSON.parse(await fs.readFile(earlier,'utf8')),prior=report.candidate;report.candidate=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const row of report.cases){const input=path.join(root,'docs/evidence/lh-110-localized-references/inputs',row.id+'.opf.json');assert.equal(hash(await fs.readFile(input)),row.inputSha256);for(const ext of ['pptx','png']){const file=path.join(output,row.id+'.'+ext),args=[path.join(root,'packages/cli/dist/index.js'),'convert',input,file,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])];const log=execFileSync(process.execPath,args,{cwd:root,encoding:'utf8'});await fs.writeFile(file+'.log',log);assert.equal(hash(await fs.readFile(file)),row.after[ext].sha256,row.id+': byte-exact '+ext);row.after[ext].file=file;}}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(output,'identity.json'),JSON.stringify({earlier:prior,final:report.candidate,cases:7,inputsByteIdentical:true,allBeforeAndAfterPngPptxByteIdentical:true},null,2)+'\n');console.log(JSON.stringify({earlier:prior,final:report.candidate,allSevenArchivesAndPreviewsByteIdentical:true}));
