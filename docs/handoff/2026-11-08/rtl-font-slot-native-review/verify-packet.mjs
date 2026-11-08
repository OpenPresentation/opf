import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const req=createRequire('C:/opf-work/rr105-sh26-rtl/packages/pptx/package.json');
const {unzipSync}=req('fflate');
const dir=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(dir,'../../../..');
const prefix=path.relative(repo,dir).split(path.sep).join('/');
const ref=process.argv[2];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>ref?execFileSync('git',['-C',repo,'cat-file','blob',ref+':'+p],{maxBuffer:32*1024*1024}):fs.readFile(path.join(repo,p));
const manifest=JSON.parse(await read(prefix+'/publication-manifest.json'));
for(const f of manifest.files){const b=await read(f.path);if(b.length!==f.bytes||sha(b)!==f.sha256)throw Error('Outer bytes mismatch '+f.path);}
const payload=JSON.parse(await read(prefix+'/payload-inventory.json'));
let count=0;
function verifyGroups(m,contents){for(const g of m.groups){const b=contents[g.archive];if(!b||b.length!==g.bytes||sha(b)!==g.sha256)throw Error('Archive mismatch '+g.archive);const zipBytes=g.innerZip?gunzipSync(b):b;if(g.innerZip&&(zipBytes.length!==g.innerZip.bytes||sha(zipBytes)!==g.innerZip.sha256))throw Error('Inner ZIP bytes mismatch '+g.archive);const z=unzipSync(zipBytes);if(Object.keys(z).length!==g.fileCount)throw Error('Archive count mismatch '+g.archive);for(const f of g.files){const v=z[f.path];if(!v||v.length!==f.bytes||sha(v)!==f.sha256)throw Error('Inner bytes mismatch '+g.archive+'!'+f.path);count++;}if(g.name==='initial-seal-retained')verifyGroups(JSON.parse(Buffer.from(z['payload-inventory.json']).toString('utf8')),z);}}
const contents={};for(const g of payload.groups)contents[g.archive]=await read(prefix+'/'+g.archive);
verifyGroups(payload,contents);
console.log(JSON.stringify({ref:ref??'working-tree',outerFiles:manifest.files.length,sealedFilesIncludingRetainedInitial:count,exact:true,nativeAcceptance:false},null,2));
