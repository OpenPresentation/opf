import {writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root='C:/opf-work/table069-check01';
const node='C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin/node.exe';
const args=['C:/Users/micha/AppData/Local/npm-cache/_npx/334030cfead2389c/node_modules/pnpm/bin/pnpm.cjs','check:changed','--base','0699820e2f562d94c48b8c44a2d9b72387c0cecb'];
const startedAt=new Date().toISOString(),result=spawnSync(node,args,{cwd:'C:/opf-work/table069-proof',env:{...process.env,PATH:'C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin;'+process.env.PATH},windowsHide:true,timeout:1200000,maxBuffer:64*1024*1024});
await writeFile(root+'/mapped.stdout.log',result.stdout??Buffer.alloc(0),{flag:'wx'});await writeFile(root+'/mapped.stderr.log',result.stderr??Buffer.alloc(0),{flag:'wx'});
const receipt={executable:node,args,cwd:'C:/opf-work/table069-proof',testedEvidenceHead:'69c66894cec53208b28f970d4b4be41f00ac6187',startedAt,endedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?{name:result.error.name,message:result.error.message,code:result.error.code}:null};await writeFile(root+'/mapped.exit.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));if(result.status!==0)process.exitCode=1;