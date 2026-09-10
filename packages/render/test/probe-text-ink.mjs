import {create} from 'fontkit';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {resolvePresentation} from '../dist/svg.js';
import {acceptedTextFixtures} from './accepted-text-fixtures.mjs';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const registry=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const {deck}=acceptedTextFixtures().find(item=>item.id==='portrait-plain-right-scalar');
// Deliberately inspect the zero-clearance control, independent of the new default.
const title=resolvePresentation(deck,{textMeasurement:registry.textMeasurement,textRasterPadding:0}).slides[0].geometry.items.find(item=>item.field==='title');
const face=registry.embeddedFonts.find(face=>face.family===title.textStyle.fontFamily&&face.weight===title.textStyle.fontWeight&&!face.italic);
const font=create(Buffer.from(face.dataUrl.split(',')[1],'base64')),scale=title.text.fontSize/font.unitsPerEm;
const report={box:title.box,fontSize:title.text.fontSize,style:title.textStyle,lines:title.text.lines.map(text=>{
  const run=font.layout(text),width=run.advanceWidth*scale,b=run.bbox;
  return {text,width,ink:{x:b.minX*scale,y:-b.maxY*scale,width:b.width*scale,height:b.height*scale},rightOverhang:(b.maxX-run.advanceWidth)*scale,
    glyphs:run.glyphs.map((glyph,index)=>({id:glyph.id,codePoints:glyph.codePoints,bbox:glyph.bbox,position:run.positions[index]}))};
})};
const output=process.argv[2];if(output)await mkdir(output,{recursive:true});
const text=title.text.lines.at(-1),run=font.layout(text),x=title.box.x+title.box.width-run.advanceWidth*scale,baseline=title.box.y+title.text.fontSize+(title.text.lines.length-1)*title.text.lineHeight;
let pen=0;const outlines=run.glyphs.map((glyph,index)=>{const position=run.positions[index],svg=`<path transform="translate(${x+(pen+position.xOffset)*scale} ${baseline-position.yOffset*scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;pen+=position.xAdvance;return svg;}).join('');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
try{
 const page=await browser.newPage({viewport:{width:540,height:960}});
 await page.setContent('<style>body{margin:0}</style><main></main>');
 await page.evaluate(async face=>{document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight)}).load());await document.fonts.ready;},face);
 report.browser=browser.version();report.node=process.version;report.verifierSha256=hash(await readFile(new URL(import.meta.url)));report.fontSha256=hash(Buffer.from(face.dataUrl.split(',')[1],'base64'));report.modes=[];
 for(const mode of ['auto','geometricPrecision','optimizeLegibility','outline']){
  const content=mode==='outline'?outlines:`<text x="${title.box.x+title.box.width}" y="${baseline}" text-anchor="end" font-family="${face.family}" font-weight="${face.weight}" font-size="${title.text.fontSize}" text-rendering="${mode}">${text}</text>`;
  await page.locator('main').evaluate((element,content)=>{element.innerHTML=`<svg width="540" height="960" xmlns="http://www.w3.org/2000/svg" fill="white" style="background:black">${content}</svg>`;},content);
  const png=await page.locator('svg').screenshot(),{data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};let pixels=0;const outside=[];
  for(let row=0;row<info.height;row++)for(let column=0;column<info.width;column++){
   const at=(row*info.width+column)*info.channels,coverage=Math.max(data[at],data[at+1],data[at+2]);if(!coverage)continue;pixels++;
   bounds.left=Math.min(bounds.left,column);bounds.top=Math.min(bounds.top,row);bounds.right=Math.max(bounds.right,column);bounds.bottom=Math.max(bounds.bottom,row);
   if(column+.5-(title.box.x+title.box.width)>.1+1e-9)outside.push({x:column,y:row,coverage});
  }
  report.modes.push({mode,pixels,bounds,outside,sha256:hash(png)});if(output)await writeFile(path.join(output,mode+'.png'),png);
 }
 if(output)await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({lines:report.lines.map(({glyphs,...line})=>line),modes:report.modes},null,2));
}finally{await browser.close();}
