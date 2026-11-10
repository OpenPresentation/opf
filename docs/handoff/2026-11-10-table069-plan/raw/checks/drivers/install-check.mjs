import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root='C:/opf-work/table069-check01';await mkdir(root);
const node='C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin/node.exe';
const pnpm='C:/Users/micha/AppData/Local/npm-cache/_npx/334030cfead2389c/node_modules/pnpm/bin/pnpm.cjs';
const argv=[pnpm,'--store-dir','C:/opf-work/.pnpm-store','install','--frozen-lockfile','--offline'];
const startedAt=new Date().toISOString();const result=spawnSync(node,argv,{cwd:'C:/opf-work/table069-proof',env:{...process.env,PATH:'C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin;'+process.env.PATH},windowsHide:true,timeout:600000,maxBuffer:32*1024*1024});
for(const [file,bytes] of [['install.stdout.log',result.stdout],['install.stderr.log',result.stderr]])await writeFile(root+'/'+file,bytes??Buffer.alloc(0),{flag:'wx'});
const receipt={executable:node,args:argv,cwd:'C:/opf-work/table069-proof',startedAt,endedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?{name:result.error.name,message:result.error.message,code:result.error.code}:null};await writeFile(root+'/install.exit.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));if(result.status!==0)process.exitCode=1;