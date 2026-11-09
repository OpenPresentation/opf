#!/usr/bin/env node
// Verify immutable raw records and historical Git-source binding. Future source is reported independently.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:here,encoding:'utf8'}).trim();
const require=createRequire(path.join(root,'packages/pptx/package.json'));
const {unzipSync,strFromU8}=require('fflate');
const digest=data=>createHash('sha256').update(data).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const manifest=JSON.parse(fs.readFileSync(path.join(here,process.argv[2]??'qualification.json')));
const bytes=fs.readFileSync(path.join(here,manifest.archive));
if(digest(bytes)!==manifest.sha256)throw Error('Archive checksum mismatch');
const entries=unzipSync(bytes);let total=0;
for(const item of manifest.records){const data=entries[item.name];if(!data||data.length!==item.bytes||digest(data)!==item.sha256)throw Error('Record mismatch: '+item.name);total+=data.length;}
if(Object.keys(entries).length!==manifest.records.length||total!==manifest.rawBytes)throw Error('Archive census mismatch');
if(git('rev-parse',manifest.source+'^{tree}')!==manifest.sourceTree)throw Error('Historical source tree mismatch');
const summary=JSON.parse(strFromU8(entries['witness/summary.json']));
if(summary.source!==manifest.source||summary.sourceTree!==manifest.sourceTree||summary.pairs.some(pair=>!pair.exact||pair.actual!==pair.expected)||summary.protectedFiles.some(file=>file.sha256!==file.expected))throw Error('Witness mismatch');
let currentSourceMatches=true;
for(const {file,blob} of summary.sourceFiles){if(git('rev-parse',manifest.source+':'+file)!==blob)throw Error('Historical source blob mismatch '+file);if(git('rev-parse','HEAD:'+file)!==blob)currentSourceMatches=false;}
console.log(JSON.stringify({verified:true,source:manifest.source,sourceTree:manifest.sourceTree,records:manifest.records.length,rawBytes:total,exactPairs:summary.pairs.length,protectedFiles:summary.protectedFiles.length,currentSourceMatches},null,2));
