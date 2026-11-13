// Registry comparison input selection only; no document migration or library alias.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileAtRef,isVersion} from './registry-consumer.mjs';
export const DEVELOPER_QUICKSTART_FILE='docs/quickstart/developer-quickstart.opf.json';
export const QUICKSTART_033=Object.freeze({version:'0.33.0',gitHead:'26fd4de9cee7e57f9e0620eddcad2dcef04e00e3',bytes:5615,sha256:'0e1d13c2fa5de7d9392f4d8748899f00a7ca1273305a0ef5872808799381ba97'});
export function developerQuickstartInput(plan,{cwd,readCurrent=file=>readFileSync(path.join(cwd,file)),readRelease=(ref,file)=>fileAtRef(ref,file,{cwd})}={}){
 const selected=plan?.packages?.filter(item=>item.name==='@openpresentation/opf');assert.ok(selected?.length===1,'Exactly one actual registry core version required');const version=selected[0].version;assert.ok(typeof version==='string'&&isVersion(version),'Exact registry core release version required');const gitHead=plan.verificationRefs?.opf;assert.match(gitHead??'',/^[a-f0-9]{40}$/u,'Actual registry-plan release ref required');
 const [major,minor]=version.split('.').map(Number),historical=major===0&&minor<34;
 if(version===QUICKSTART_033.version)assert.equal(gitHead,QUICKSTART_033.gitHead,'Published033 input must retain the verified release identity');
 const bytes=Buffer.from(historical?readRelease(gitHead,DEVELOPER_QUICKSTART_FILE):readCurrent(DEVELOPER_QUICKSTART_FILE)),sha256=createHash('sha256').update(bytes).digest('hex');
 if(version===QUICKSTART_033.version){assert.equal(bytes.length,QUICKSTART_033.bytes);assert.equal(sha256,QUICKSTART_033.sha256,'Published033 input bytes must remain immutable');}
 return{bytes,provenance:{kind:historical?'registry-release-input':'current-034-input',version,registryGitHead:gitHead,sourceRef:historical?gitHead:null,path:DEVELOPER_QUICKSTART_FILE,bytes:bytes.length,sha256}};
}
