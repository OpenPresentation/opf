// Report-only platform residual probe for opf-render#24 (program font-fidelity-everywhere, FF-21).
// It measures, never gates: the 0.1px threshold is recorded for comparison and is not changed or enforced here.
// Usage: node test/platform-residual-probe.mjs <archived font-formats fixture dir> [output.json]
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {create} from 'fontkit';
import {chromium} from 'playwright';

const GATE=.1,TEXT='  office affine AVATAR  ',SIZE=32;
// The five TrueType rows that separate Linux and macOS Chromium in the retained evidence
// (opf-render 9764ad8, docs/evidence/rejected-truetype-rounding-20260915). Values are px at 32px.
const EVIDENCE='OpenPresentation/opf-render@9764ad8f9a7fd497ca2fcea190669cf74d2e2503:docs/evidence/rejected-truetype-rounding-20260915/rounding-probe.json.gz';
const FILES={
  'source-serif/VAR/SourceSerif4Variable-Roman.ttf':{sha256:'14d360ee1b76655da9276628b229e11671bc1f5d1083636144db6677d452cf55',italic:false},
  'source-serif/VAR/SourceSerif4Variable-Italic.ttf':{sha256:'6a059a64838978d54e8fab71ed86b0d82e948c0e12b2664d0c15166326dcff82',italic:true},
};
const ROWS=[
  {file:'source-serif/VAR/SourceSerif4Variable-Roman.ttf',id:'named:SmText Bold',coordinates:{wght:700,opsz:16},retained:{fontkit:334.06213682353496,linux:334.193115234375,macos:334.06195068359375}},
  {file:'source-serif/VAR/SourceSerif4Variable-Roman.ttf',id:'named:SmText Black',coordinates:{wght:900,opsz:16},retained:{fontkit:335.90322265625,linux:335.77679443359375,macos:335.903076171875}},
  {file:'source-serif/VAR/SourceSerif4Variable-Roman.ttf',id:'named:Subhead Light',coordinates:{wght:300,opsz:32},retained:{fontkit:309.73172168850897,linux:309.6164855957031,macos:309.7315673828125}},
  {file:'source-serif/VAR/SourceSerif4Variable-Italic.ttf',id:'named:SmText Light Italic',coordinates:{wght:300,opsz:16},retained:{fontkit:304.50556914460657,linux:304.3946533203125,macos:304.50537109375}},
  {file:'source-serif/VAR/SourceSerif4Variable-Italic.ttf',id:'named:Light Italic',coordinates:{wght:300,opsz:20},retained:{fontkit:299.388080078125,linux:299.522705078125,macos:299.387939453125}},
];
const fixtureDir=process.argv[2];
if(!fixtureDir)throw new Error('Pass the archived test/fixtures/font-formats directory');
const output=path.resolve(process.argv[3]??'artifacts/platform-residual/issue24-probe.json');
const sha256=data=>createHash('sha256').update(data).digest('hex');
const fonts={};
for(const [file,meta]of Object.entries(FILES)){
  const data=await readFile(path.join(fixtureDir,file));
  if(sha256(data)!==meta.sha256)throw new Error(`Fixture hash mismatch: ${file}`);
  fonts[file]={...meta,data};
}
const rows=ROWS.map(row=>{
  const font=create(fonts[row.file].data).getVariation(row.coordinates);
  return {...row,fontkit:font.layout(TEXT).advanceWidth*SIZE/font.unitsPerEm};
});
const browser=await chromium.launch(),errors=[],requests=[];
let browserVersion;
try{
  browserVersion=browser.version();
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  for(const row of rows){
    const font=fonts[row.file];
    row.native=await page.evaluate(async({bytes,coordinates,italic,text,size})=>{
      const data=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)),settings=Object.entries(coordinates).map(([tag,value])=>`"${tag}" ${value}`).join(', ');
      const face=new FontFace('Probe',data,{weight:'400',style:italic?'italic':'normal',variationSettings:settings});await face.load();document.fonts.add(face);
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=100;const ctx=canvas.getContext('2d');
      ctx.textRendering='geometricPrecision';ctx.fontKerning='normal';ctx.font=`${italic?'italic':'normal'} 400 ${size}px Probe`;ctx.fillText(text,10,80);
      const canvasWidth=ctx.measureText(text).width,ink=ctx.getImageData(0,0,1000,100).data.some((n,i)=>i%4===3&&n!==0);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','1000');svg.setAttribute('height','100');
      const node=document.createElementNS(svg.namespaceURI,'text');node.textContent=text;node.style.whiteSpace='pre';
      for(const [key,value]of Object.entries({x:'10',y:'80','font-family':'Probe','font-size':String(size),'font-weight':'400','font-style':italic?'italic':'normal','text-rendering':'geometricPrecision'}))node.setAttribute(key,value);
      svg.append(node);document.body.replaceChildren(svg);
      const svgWidth=node.getComputedTextLength();
      document.fonts.delete(face);
      return {canvasWidth,svgWidth,ink};
    },{bytes:font.data.toString('base64'),coordinates:row.coordinates,italic:font.italic,text:TEXT,size:SIZE});
  }
}finally{await browser.close();}
const platform=process.platform==='darwin'?'macos':process.platform==='linux'?'linux':process.platform;
const measured=rows.map(row=>{
  // The residual is taken against the archived renderer's Fontkit prediction named in #24. The live plain
  // Fontkit getVariation() width is recorded separately; it omits the archived instance-selection policy.
  const residual=row.native.canvasWidth-row.retained.fontkit;
  return {
    file:row.file,id:row.id,coordinates:row.coordinates,prediction:row.retained.fontkit,liveFontkitGetVariation:row.fontkit,
    native:row.native,residual,withinGate:Math.abs(residual)<GATE,retained:row.retained,
    deltaFromRetainedLinux:row.native.canvasWidth-row.retained.linux,deltaFromRetainedMacos:row.native.canvasWidth-row.retained.macos,
  };
});
const report={
  status:'report-only',issue:'OpenPresentation/opf-render#24',program:'font-fidelity-everywhere FF-21',
  platform,os:`${os.type()} ${os.release()} ${os.arch()}`,node:process.version,browser:browserVersion,
  gatePx:GATE,text:TEXT,fontSizePx:SIZE,evidence:EVIDENCE,
  scope:'Chromium canvas advance of the five retained #24 Source Serif 4 variable TrueType rows versus the archived renderer Fontkit prediction. Report-only; no product gate, golden or tolerance is changed.',
  rows:measured,errors,requests,
  summary:{rows:measured.length,overGate:measured.filter(row=>!row.withinGate).length,maxAbsResidual:Math.max(...measured.map(row=>Math.abs(row.residual)))},
};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({platform,browser:browserVersion,...report.summary},null,2));
