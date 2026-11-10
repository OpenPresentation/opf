#!/usr/bin/env node
// Default mode only inspects. Explicit prepare is the sole output-writing mode.
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {inspect,prepare} from './prepare-core.mjs';
export function parseArgs(argv){
 const args=[...argv],options={mode:'inspect'};
 if(args[0]==='inspect'||args[0]==='prepare')options.mode=args.shift();
 const flags=new Map([['--worker-repo','workerRepo'],['--controller-repo','controllerRepo'],['--generation-repo','generationRepo'],['--generation-packet','generationPacket'],['--expect-driver-head','expectDriverHead'],['--out','out']]);
 for(let i=0;i<args.length;i++){const key=flags.get(args[i]);assert.ok(key,'Unknown preparation argument: '+args[i]);assert.equal(Object.hasOwn(options,key),false,'Duplicate flag: '+args[i]);const value=args[++i];assert.ok(value&&!value.startsWith('--'),'Flag requires a literal value');options[key]=value;}
 for(const key of['workerRepo','controllerRepo','generationRepo','generationPacket'])assert.ok(options[key],'Missing required '+key);
 if(options.mode==='inspect')assert.equal(options.out,undefined,'Inspect never creates an output');
 else{assert.ok(options.out,'Prepare needs a fresh --out');assert.match(options.expectDriverHead??'',/^[a-f0-9]{40}$/,'Prepare requires --expect-driver-head');}
 return options;
}
export function main(argv){const options=parseArgs(argv),driverRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');return(options.mode==='prepare'?prepare:inspect)(options,{driverRoot});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(error){console.error('Preparation refused: '+error.message);process.exitCode=1;}}