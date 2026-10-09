import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('tsup'))('esbuild');

test('SVG font preparation requests script bytes and used/none policies retain their contract',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'opf-font-policy-'));
  try {
    const file=path.join(directory,'fonts.mjs');
    await build({entryPoints:[fileURLToPath(new URL('../src/node/fonts.ts',import.meta.url))],outfile:file,bundle:true,platform:'node',format:'esm',target:'node22'});
    const {prepareFonts,embeddedFor}=await import(pathToFileURL(file).href);
    const latin={family:'Roboto',weight:400,dataUrl:'data:font/ttf;base64,AA=='};
    const script={family:'Noto Sans JP',weight:400,dataUrl:'data:font/ttf;base64,AQ=='};
    const calls=[];
    const renderer={fonts:{loadFonts:async options=>{
      calls.push(options);
      return {embeddedFonts:options.embedScriptFonts?[latin,script]:[latin]};
    }}};
    const deck={language:'ja-JP',slides:[{title:'日本語'}]};
    const reporter={add:()=>{throw new Error('Unexpected diagnostic');}};
    const portable=await prepareFonts(renderer,deck,[],reporter,true);
    assert.equal(calls[0].presentation,deck);
    assert.equal(calls[0].scripts,'auto');
    assert.equal(calls[0].embedScriptFonts,true);
    assert.deepEqual(embeddedFor(portable.handle,'fonts'),[{...latin,embed:'used'},{...script,embed:'used'}]);
    assert.deepEqual(embeddedFor(portable.handle,'system'),[]);
    assert.deepEqual(embeddedFor(portable.handle,'paths'),[],'outlines list no faces');
    const raster=await prepareFonts(renderer,deck,[],reporter);
    assert.equal(calls[1].embedScriptFonts,false,'non-SVG exports need no script data URLs');
    assert.deepEqual(raster.handle.embeddedFonts,[latin]);
  } finally {await rm(directory,{recursive:true,force:true});}
});
