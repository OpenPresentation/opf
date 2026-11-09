import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=process.argv[2];assert.ok(out);await fs.mkdir(path.join(out,'inputs'),{recursive:true});const original=JSON.parse(await fs.readFile(new URL('../lh-93-stacked-siblings/witness.opf.json',import.meta.url),'utf8'));
const cases=[
 ['negative-missing',original.slides[4],true],
 ['negative-authored-options',{title:'Authored axes and legend stay authoritative',chart:{type:'bar',axisTitles:{category:'Stage',value:'Requests'},legend:'bottom',dataLabels:false,data:{columns:['Stage','Current','Expansion'],rows:[['Lead',-20,60],['Won',-30,50]]}}},true],
 ['negative-rtl',{...original.slides[4],title:'Negative RTL categories keep their physical gutter'},true,{bcp47:'en-US',direction:'rtl'}],
 ['nonnegative-control',original.slides[0],false],
 ['negative-column-control',{title:'Negative columns keep their category policy',chart:{type:'column',data:{columns:['Stage','Current'],rows:[['Lead',-20],['Won',30]]}}},false],
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),report={baseline:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),route:'maintained CLI convert; date2026-11-08; PNG scale0.5; matching prepared office/visual/scripts:auto fonts',cases:[]};
for(const[id,slide,native,language]of cases){const input=path.join(out,'inputs',id+'.opf.json'),document={name:'Negative category labels: '+id,design:original.design,...(language?{language}:{}),slides:[slide]};await fs.writeFile(input,JSON.stringify(document,null,2)+'\n');const row={id,native,inputSha256:hash(await fs.readFile(input)),before:{}};
 for(const ext of ['pptx','png']){const file=path.join(out,id+'.'+ext),log=execFileSync(process.execPath,[path.join(root,'packages/cli/dist/index.js'),'convert',input,file,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])],{cwd:root,encoding:'utf8'});await fs.writeFile(file+'.log',log);const bytes=await fs.readFile(file);row.before[ext]={file,sha256:hash(bytes),...(ext==='png'?{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}:{})};}
 report.cases.push(row);
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseline:report.baseline,cases:report.cases.length,native:report.cases.filter(c=>c.native).length}));
