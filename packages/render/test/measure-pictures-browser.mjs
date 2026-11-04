// LH-145: measurePictures in a browser decodes on a canvas (no sharp, no Node module) and agrees with the Node decoder on the same pictures.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {measurePictures as measureInNode} from '../dist/index.js';
const bundle=await build({stdin:{contents:"export {measurePictures} from './dist/svg.js';",resolveDir:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),loader:'js'},bundle:true,platform:'browser',format:'iife',globalName:'opf',write:false,logLevel:'error',metafile:true});
assert.deepEqual(Object.keys(bundle.metafile.inputs).filter(path=>/sharp|converters\.js|raster|measure-pictures-node/.test(path)),[],'the browser bundle holds no Node decoder');
const W=320,H=180;
const raw=paint=>{const b=Buffer.alloc(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++)b.set(paint(x,y),(y*W+x)*3);return sharp(b,{raw:{width:W,height:H,channels:3}});
};
const uri=(type,buffer)=>`data:${type};base64,${buffer.toString('base64')}`;
const pictures={
  png:uri('image/png',await raw(x=>x<W/2?[10,10,10]:[245,245,245]).png().toBuffer()),
  jpeg:uri('image/jpeg',await raw(()=>[200,60,60]).jpeg({quality:95}).toBuffer()),
  svg:uri('image/svg+xml',Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#102030"/><rect width="${W/2}" height="${H}" x="${W/2}" fill="#f0f0f0"/></svg>`)),
};
const deck={slides:Object.entries(pictures).map(([id,src])=>({id,title:id,design:{background:{type:'image',src}}}))};
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[];
try{
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<main></main>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const measured=await page.evaluate(async deck=>{
    const diagnostics=[],sampler=await opf.measurePictures(deck,{onDiagnostic:d=>diagnostics.push(d)});
    return {diagnostics,measured:sampler.measured,grids:sampler.sources.map(src=>{const grid=sampler(src);return grid?{columns:grid.columns,rows:grid.rows,values:[...grid.values],high:[...grid.high]}:null;})};
  },deck);
  assert.deepEqual(measured.diagnostics,[]);assert.equal(measured.measured,3);
  const reference=await measureInNode(deck);
  for(const [index,src] of Object.values(pictures).entries()){
    const browserGrid=measured.grids[index],nodeGrid=reference(src);
    assert.equal(browserGrid.columns,nodeGrid.columns);
    // Two decoders (a canvas and libvips) differ by rounding and color management at the edges of cells, not by a gray.
    const worst=Math.max(...browserGrid.values.map((value,at)=>Math.abs(value-nodeGrid.values[at])),...browserGrid.high.map((value,at)=>Math.abs(value-nodeGrid.high[at])));
    assert.ok(worst<0.12,`picture ${index}: browser and Node grids differ by ${worst}`);
  }
  assert.ok(measured.grids[0].values[0]<0.01&&measured.grids[0].high[31]>0.85,'the half-dark picture keeps both ends in the browser');
  assert.deepEqual(errors,[]);
  console.log('measurePictures browser: PNG, JPEG and SVG decoded on a canvas and matched the Node grids.');
}finally{await browser.close();}
