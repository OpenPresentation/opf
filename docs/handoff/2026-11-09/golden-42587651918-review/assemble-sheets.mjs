// Derivative review figures only. Original panels remain at native320x180 with no pixel changes.
// Uses the same SVG-with-PNG contact-sheet pattern as scripts/layout-sampler-sheet.mjs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {sha,zipEntries,pngPixels} from './read-only.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../../../..');
const {toPng}=await import(pathToFileURL(path.join(repo,'packages/render/dist/index.js')));
const manifest=JSON.parse(readFileSync(path.join(root,'pair-manifest.json')));
const archives=new Map(manifest.archives.map(a=>[a.run,zipEntries(readFileSync(path.join(root,a.path)))]));
const rejected=new Set([2,3,6,7,10,11]);const out=path.join(root,'paired-sheets');mkdirSync(out,{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const width=688,top=82,rowHeight=254,sheets=[];
for(let offset=0;offset<manifest.pairs.length;offset+=4){
 const pairs=manifest.pairs.slice(offset,offset+4),height=top+pairs.length*rowHeight+18,number=offset/4+1;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="16" y="25" font-family="Roboto" font-size="19" font-weight="700">Pinned golden review: WAVE HELD</text><text x="16" y="46" font-family="Roboto" font-size="12">Run 42587651918 | sheet ${number}/17 | native 320 x 180 panels, unchanged</text><text x="16" y="65" font-family="Roboto" font-size="12">Root reviewed 67 pairs; 6 raw cases rejected. No chart/native/release acceptance.</text>`;
 const panels=[],rows=[];
 for(const [row,pair]of pairs.entries()){
  const y=top+row*rowHeight,status=rejected.has(pair.index)?'REJECTED: no-shrink requirement; core 21.3 px -> 16 px':'ROOT REVIEWED: reflow/geometry accounted; entire wave remains held';
  const header=`[${String(pair.index).padStart(2,'0')}] ${pair.key}`;
  svg+=`<text x="16" y="${y+16}" font-family="Roboto" font-size="14" font-weight="700">${esc(header)}</text><text x="16" y="${y+33}" font-family="Roboto" font-size="11" fill="${rejected.has(pair.index)?'#b91c1c':'#334155'}">${esc(status)}</text>`;
  rows.push({index:pair.index,key:pair.key,rejected:rejected.has(pair.index),header,status});
  for(const [side,x,run,label]of [['before',16,'42498350968','BEFORE 348fd323b'],['after',352,'42587651918','AFTER f32f7ea98']]){
   const source=pair[side],png=archives.get(run).get(source.archiveMember),decoded=pngPixels(png);assert.equal(decoded.w,320);assert.equal(decoded.h,180);for(let a=3;a<decoded.pixels.length;a+=4)assert.equal(decoded.pixels[a],255,'opaque original panel');
   svg+=`<text x="${x}" y="${y+49}" font-family="Roboto" font-size="11">${label}</text><rect x="${x-1}" y="${y+56}" width="322" height="182" fill="#94a3b8"/><image x="${x}" y="${y+57}" width="320" height="180" href="data:image/png;base64,${png.toString('base64')}"/>`;
   panels.push({index:pair.index,key:pair.key,side,sourceRun:run,sourceMember:source.archiveMember,sourcePngSHA256:sha(png),x,y:y+57,width:320,height:180,sourceRgbaSHA256:sha(decoded.pixels)});
  }
 }
 svg+='</svg>';const base=`sheet-${String(number).padStart(2,'0')}`,png=Buffer.from(await toPng(svg,{scale:1}));const decoded=pngPixels(png);assert.equal(decoded.w,width);assert.equal(decoded.h,height);
 for(const panel of panels){const original=pngPixels(archives.get(panel.sourceRun).get(panel.sourceMember)).pixels,actual=Buffer.alloc(320*180*4);for(let y=0;y<180;y++)decoded.pixels.copy(actual,y*320*4,((panel.y+y)*width+panel.x)*4,((panel.y+y)*width+panel.x+320)*4);assert.deepEqual(actual,original,`EXACT original RGBA${panel.index}/${panel.side}`);panel.embeddedRgbaSHA256=sha(actual);panel.pixelDifferences=0;}
 writeFileSync(path.join(out,base+'.svg'),svg);writeFileSync(path.join(out,base+'.png'),png);sheets.push({number,png:base+'.png',svg:base+'.svg',width,height,pngBytes:png.length,pngSHA256:sha(png),svgSHA256:sha(Buffer.from(svg)),rows,panels});
}
const require=createRequire(path.join(repo,'packages/render/package.json'));const result={version:1,derivativeOnly:true,authoritativeGolden:false,sourceProducer:manifest.producer,afterGolden:manifest.bot,beforeGolden:manifest.beforeRef,originalPanelSize:{width:320,height:180},sheetCount:sheets.length,pairCount:manifest.pairs.length,panelCount:sheets.reduce((n,s)=>n+s.panels.length,0),rejectedIndices:[...rejected],reviewAttribution:'Root coordinator: individually viewed all 67 before/after pairs and 3 removed before-pages; child image interpretations are not visual sign-off',waveAccepted:false,node:process.version,resvgVersion:require('@resvg/resvg-js/package.json').version,rendererDistSHA256:sha(readFileSync(path.join(repo,'packages/render/dist/index.js'))),sheets};
writeFileSync(path.join(out,'sheet-manifest.json'),JSON.stringify(result,null,2)+'\n');
const html=`<!doctype html><meta charset="utf-8"><title>Pinned golden42587651918 paired review</title><style>body{font:16px system-ui;margin:24px;background:#eef2f6;color:#0f172a}article{margin:24px0}img{display:block;max-width:100%;height:auto;background:white}strong{color:#b91c1c}</style><h1>Pinned golden42587651918 paired review</h1><p><strong>WAVE NOT ACCEPTED.</strong> Root reviewed all 67 pairs and all 3 removed before-pages. Six raw cases reject the no-shrink requirement: indices 2,3,6,7,10,11. Chart design/native/release gates remain held.</p><p>Each panel uses the exact original 320 x 180 PNG at integer native size. All 134 embedded RGBA panels verify byte-exact against the original source images. Labels and rejection markers are outside the panels. Open a PNG at original size for inspection.</p><nav>${sheets.map(s=>`<a href="#s${s.number}">Sheet ${s.number}</a>`).join(' | ')}</nav>${sheets.map(s=>`<article id="s${s.number}"><h2>Sheet ${s.number}</h2><a href="${s.png}"><img src="${s.png}" width="${s.width}" height="${s.height}" alt="${esc(s.rows.map(r=>r.header).join('; '))}"></a></article>`).join('')}`;
writeFileSync(path.join(out,'index.html'),html);console.log(JSON.stringify({sheets:sheets.length,pairs:67,panels:134,allEmbeddedPixelsExact:true,out}));