import {readdirSync} from "node:fs";
import {spawnSync} from "node:child_process";

// Expand test paths explicitly; Node 20 does not expand quoted glob arguments.
const files=readdirSync("test").filter(name=>name.endsWith(".test.mjs")).sort().map(name=>`test/${name}`);
if(!files.length)throw new Error("No node:test files found.");
const result=spawnSync(process.execPath,["--test",...files],{stdio:"inherit"});
if(result.error)throw result.error;
process.exit(result.status??1);
