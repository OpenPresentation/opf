import { defineConfig } from "tsup";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
function skillFiles(directory:string,prefix=''):Record<string,string>{
  return Object.fromEntries(readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
    const file=path.join(directory,entry.name),relative=prefix+entry.name;
    if(entry.isDirectory())return Object.entries(skillFiles(file,relative+'/'));
    if(!entry.isFile())throw new Error('Bundled skills cannot contain symlinks or special files');
    return [[relative,readFileSync(file,'utf8').replaceAll('\r\n','\n')]];
  }));
}
const skillRoot=fileURLToPath(new URL('../../skills/',import.meta.url));
const skills=Object.fromEntries(['opf-author','opf-layout','opf-presets','opf-edit','opf-export','opf-inspect'].map(name=>[name,skillFiles(path.join(skillRoot,name))]));

// Two entries from one build: `index` is the `opf` command, `api` is `@openpresentation/cli/api` (with its declaration file).
// Core (`@openpresentation/opf`) is a regular dependency and stays external in both, so the command, the API and an
// application that imports core directly all run one copy of it: one set of error classes, no version skew. The code the two
// entries share (the export and import engines) is split into a chunk both import. The `#!` line is in src/index.ts, so only
// the command starts with it.
export default defineConfig({
  entry: { index: "src/index.ts", api: "src/api.ts" },
  format: ["esm"],
  dts: { entry: { api: "src/api.ts" } },
  define: { CLI_VERSION: JSON.stringify(manifest.version), OPF_SKILLS:JSON.stringify(skills) },
  sourcemap: true,
  clean: true,
  target: "node24",
  platform: "node",
});
