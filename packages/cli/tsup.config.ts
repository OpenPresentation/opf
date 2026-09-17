import { defineConfig } from "tsup";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const core = JSON.parse(readFileSync(new URL("../javascript/package.json", import.meta.url), "utf8"));
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

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  noExternal: [/.*/],
  define: { CLI_VERSION: JSON.stringify(manifest.version), OPF_VERSION: JSON.stringify(core.version), OPF_SKILLS:JSON.stringify(skills) },
  sourcemap: true,
  clean: true,
  target: "node24",
  platform: "node",
  banner: { js: "#!/usr/bin/env node" },
});
