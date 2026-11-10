// Clearly synthetic consumer modules for route/admission controls. Every draw/export method throws if invoked.
import fs from 'node:fs';import path from 'node:path';
import {packageNames} from '../identity.mjs';
export const json=value=>JSON.stringify(value,null,2)+'\n';
export function write(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
export const engineSource=String.raw`
import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';
const cache=new Map();function locate(specifier){for(const base of [import.meta.url,pathToFileURL(path.join(process.cwd(),'noop.js')).href]){try{return createRequire(base).resolve(specifier);}catch(error){if(!['MODULE_NOT_FOUND','ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code))throw error;}}}
export function locatePackage(name){const manifest=locate(name+'/package.json');return manifest?{manifest,version:'synthetic'}:undefined;}
async function load(name,subpath=''){const key=name+subpath;if(!cache.has(key)){const file=locate(key);if(!file)throw Error('Synthetic missing peer '+key);cache.set(key,{module:await import(pathToFileURL(file).href)});}return cache.get(key);}
export async function loadRenderer(){const render=await load('@openpresentation/opf-render'),fonts=await load('@openpresentation/opf-render','/fonts-node');for(const key of ['toSvg','toPng','toPdf'])if(typeof render.module[key]!=='function')throw Error('Synthetic missing renderer feature');if(typeof fonts.module.loadFonts!=='function')throw Error('Synthetic missing font feature');return{render,fonts:fonts.module};}
export async function loadPptx(){const peer=await load('@openpresentation/opf-pptx');for(const key of ['toPptx','fromPptx','inventoryTypefaces'])if(typeof peer.module[key]!=='function')throw Error('Synthetic missing PPTX feature');return peer;}
`;
export function writePackage(directory,name){
 const exports={'.':'./dist/index.js','./package.json':'./package.json'};
 if(name==='@openpresentation/opf')exports['./internal/engine']='./dist/node-engine.js';
 if(name==='@openpresentation/opf-render')exports['./fonts-node']='./dist/fonts-node.js';
 write(path.join(directory,'package.json'),json({name,version:'0.34.0-synthetic',type:'module',exports}));
 let source='export const synthetic=true;\n';
 for(const key of name==='@openpresentation/opf-render'?['toSvg','toPng','toPdf']:name==='@openpresentation/opf-pptx'?['toPptx','fromPptx','inventoryTypefaces']:[])source+='export function '+key+'(){throw Error("Synthetic test must never render/export");}\n';
 write(path.join(directory,'dist/index.js'),source);
 if(name==='@openpresentation/opf')write(path.join(directory,'dist/node-engine.js'),engineSource);
 if(name==='@openpresentation/opf-render')write(path.join(directory,'dist/fonts-node.js'),'export function loadFonts(){throw Error("Synthetic test must never load fonts");}\n');
}
export function syntheticConsumer(consumer){write(path.join(consumer,'package.json'),json({private:true,type:'module'}));for(const name of packageNames)writePackage(path.join(consumer,'node_modules',name),name);return consumer;}
