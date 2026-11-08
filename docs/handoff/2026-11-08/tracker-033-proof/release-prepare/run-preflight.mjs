// Evidence-only transparent recorder: unchanged maintained main/default dependencies, no source modification.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {main,defaultDeps} from '../../../../../scripts/release.mjs';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:'));
const args=['prepare','0.33.0','--dry-run'],started=new Date().toISOString();
delete process.env.OPF_TRACKER_STALE;
const deps=defaultDeps(),normalStability=deps.runStability,normalLog=deps.log,lines=[];
const before=execFileSync('git',['diff','--binary'],{maxBuffer:10e6}),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let stability,status=0,error;
deps.runStability=(...parameters)=>{stability=normalStability(...parameters);fs.writeFileSync(path.join(out,'stability.json'),JSON.stringify(stability,null,2)+'\n');return stability;};
deps.log=line=>{lines.push(line);normalLog(line);};
try{const plan=await main(args,deps);const summary={version:plan.version,previous:plan.previous,bump:plan.bump,reasons:plan.reasons,tag:plan.tag,distTag:plan.distTag,notes:plan.notes,remove:plan.removes,writes:plan.writes.map(e=>({file:e.file,bytes:Buffer.byteLength(e.text),sha256:createHash('sha256').update(e.text).digest('hex')})),releaseDrawing:JSON.parse(plan.writes.find(e=>e.file==='packages/gallery/release-drawing.json').text)};fs.writeFileSync(path.join(out,'prepare-plan.json'),JSON.stringify(summary,null,2)+'\n');}
catch(e){status=1;error=e.stack??String(e);process.stderr.write(error+'\n');}
const after=execFileSync('git',['diff','--binary'],{maxBuffer:10e6}),trackedUnchanged=before.equals(after);if(!trackedUnchanged){status=1;error=(error??'')+'\nTracked diff changed during dry preflight.';}
fs.writeFileSync(path.join(out,'final.stdout.log'),lines.join('\n')+'\n');fs.writeFileSync(path.join(out,'final.stderr.log'),error?error+'\n':'');fs.writeFileSync(path.join(out,'final-receipt.json'),JSON.stringify({head,args,entrypoint:'scripts/release.mjs exported main with unchanged defaultDeps; runStability return recorded without substitution',started,finished:new Date().toISOString(),node:process.version,OPF_TRACKER_STALE:'unset (strict default)',status,trackedUnchanged,stabilityPresent:!!stability,error},null,2)+'\n');process.exitCode=status;
