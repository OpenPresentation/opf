// Preserve sealed native inputs and previous gate receipts before any output creation or metric reads.
import fs from 'node:fs';
import path from 'node:path';
const inside=(base,target)=>{const relative=path.relative(base,target);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));};
const existsEntry=file=>{try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
export function gateOutputDirectory(input,output){
 if(typeof input!=='string'||!input||typeof output!=='string'||!output)throw Error('Provide a sealed input and an explicit fresh output directory outside it');
 const source=fs.realpathSync(path.resolve(input)),requested=path.resolve(output);
 if(inside(source,requested))throw Error('Gate output must be outside the sealed input directory');
 if(existsEntry(requested))throw Error('Gate output already exists; preserve the previous receipt and select a fresh directory');
 const parent=path.dirname(requested);if(!fs.existsSync(parent)||!fs.statSync(parent).isDirectory())throw Error('Fresh gate output requires an existing parent directory');
 const canonical=path.join(fs.realpathSync(parent),path.basename(requested));
 if(inside(source,canonical))throw Error('Gate output resolves inside the sealed input; select a fresh outside directory');
 if(existsEntry(canonical))throw Error('Gate output already exists; preserve the previous receipt');
 return canonical;
}
