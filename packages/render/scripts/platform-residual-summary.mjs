// Report-only summary for the non-blocking platform residual workflow (opf-render#24, FF-21).
// Usage: node scripts/platform-residual-summary.mjs <out.md> <out.json> <report dir>...
// Each report dir may hold issue24-probe.json, font-variants-browser.json,
// font-preparation-browser.json and outcomes.json. Missing files are reported, never fatal.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const [markdownPath,jsonPath,...dirs]=process.argv.slice(2);
if(!markdownPath||!jsonPath||!dirs.length)throw new Error('Usage: platform-residual-summary.mjs <out.md> <out.json> <report dir>...');
const read=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return undefined;}};
const px=value=>value===undefined||Number.isNaN(value)?'n/a':value.toFixed(4);
const signed=value=>value===undefined||Number.isNaN(value)?'n/a':(value>=0?'+':'')+value.toFixed(4);
const GATE=.1;

const platforms=[];
for(const dir of dirs){
  const probe=await read(path.join(dir,'issue24-probe.json'));
  const variants=await read(path.join(dir,'font-variants-browser.json'));
  const preparation=await read(path.join(dir,'font-preparation-browser.json'));
  const outcomes=await read(path.join(dir,'outcomes.json'))??{};
  const bundled=[
    ...(variants?.observed??[]).map(row=>({suite:'font-variants-browser',face:`${row.resolved.fontFamily} ${row.resolved.fontWeight}${row.resolved.italic?' italic':''}`,residual:row.actual-row.expected})),
    ...(preparation?.observations??[]).map(row=>({suite:'font-preparation-browser',face:`${row.family} ${row.weight}${row.italic?' italic':''}`,residual:row.actual-row.expected})),
  ];
  platforms.push({
    dir,platform:probe?.platform??outcomes.platform??path.basename(dir),os:probe?.os,browser:probe?.browser??variants?.browser??preparation?.browser,node:probe?.node??variants?.node,
    outcomes,probe,bundled:{rows:bundled.length,overGate:bundled.filter(row=>Math.abs(row.residual)>=GATE).length,maxAbsResidual:bundled.length?Math.max(...bundled.map(row=>Math.abs(row.residual))):undefined,rowsOverGate:bundled.filter(row=>Math.abs(row.residual)>=GATE)},
  });
}

const lines=['## Platform preview residual (report-only, opf-render#24)','',
  'Non-blocking FF-21 measurement. The 0.1 px gate is shown for reference only; no gate, tolerance or golden is changed by this job.',''];
lines.push('| Platform | Browser | Node | Suite outcomes | Bundled faces over 0.1 px | Bundled max abs residual (px) | #24 rows over 0.1 px | #24 max abs residual (px) |','|---|---|---|---|---:|---:|---:|---:|');
for(const item of platforms){
  const outcomes=Object.entries(item.outcomes).filter(([key])=>key!=='platform').map(([key,value])=>`${key}: ${value}`).join('<br>')||'n/a';
  lines.push(`| ${item.platform}${item.os?`<br>${item.os}`:''} | ${item.browser??'n/a'} | ${item.node??'n/a'} | ${outcomes} | ${item.bundled.overGate}/${item.bundled.rows} | ${px(item.bundled.maxAbsResidual)} | ${item.probe?`${item.probe.summary.overGate}/${item.probe.summary.rows}`:'n/a'} | ${px(item.probe?.summary.maxAbsResidual)} |`);
}
const probed=platforms.filter(item=>item.probe),names=probed.map(item=>item.platform);
const rowIds=[...new Set(probed.flatMap(item=>item.probe.rows.map(row=>`${row.file}#${row.id}`)))];
const comparison=rowIds.map(key=>{
  const [file,id]=key.split('#'),found=Object.fromEntries(probed.map(item=>[item.platform,item.probe.rows.find(row=>row.file===file&&row.id===id)]));
  const any=Object.values(found).find(Boolean),linux=found.linux,macos=found.macos;
  return {file,id,prediction:any?.prediction,retained:any?.retained,
    native:Object.fromEntries(names.map(name=>[name,found[name]?.native.canvasWidth])),residual:Object.fromEntries(names.map(name=>[name,found[name]?.residual])),
    linuxMinusMacos:linux&&macos?linux.native.canvasWidth-macos.native.canvasWidth:undefined};
});
if(comparison.length){
  const both=names.includes('linux')&&names.includes('macos');
  lines.push('','### #24 Source Serif 4 variable rows: live Chromium canvas advance vs archived Fontkit prediction (32 px)','',
    `| Instance | Prediction | ${names.map(name=>`${name} native | ${name} residual`).join(' | ')}${both?' | linux − macos':''} | Retained linux / macos |`,
    `|---|---:|${names.map(()=>'---:|---:').join('|')}|${both?'---:|':''}---|`);
  const mark=value=>value===undefined?'n/a':`${signed(value)}${Math.abs(value)>=GATE?' ⚠':''}`;
  for(const row of comparison){
    lines.push(`| ${path.basename(row.file,'.ttf').replace('SourceSerif4Variable-','')} ${row.id.replace('named:','')} | ${px(row.prediction)} | ${names.map(name=>`${px(row.native[name])} | ${mark(row.residual[name])}`).join(' | ')}${both?` | ${signed(row.linuxMinusMacos)}`:''} | ${px(row.retained?.linux)} / ${px(row.retained?.macos)} |`);
  }
  lines.push('','⚠ marks a residual at or above the 0.1 px reference gate. Residuals are expected until #24 defines a supported geometry contract.');
}
const over=platforms.flatMap(item=>item.bundled.rowsOverGate.map(row=>({platform:item.platform,...row})));
if(over.length){
  lines.push('','### Bundled faces at or above 0.1 px','','| Platform | Suite | Face | Residual (px) |','|---|---|---|---:|');
  for(const row of over)lines.push(`| ${row.platform} | ${row.suite} | ${row.face} | ${signed(row.residual)} |`);
}
const markdown=lines.join('\n')+'\n';
await mkdir(path.dirname(path.resolve(markdownPath)),{recursive:true});
await mkdir(path.dirname(path.resolve(jsonPath)),{recursive:true});
await writeFile(markdownPath,markdown);
await writeFile(jsonPath,JSON.stringify({status:'report-only',issue:'OpenPresentation/opf-render#24',program:'font-fidelity-everywhere FF-21',gatePx:GATE,platforms:platforms.map(({probe,...item})=>({...item,probeSummary:probe?.summary})),comparison},null,2)+'\n');
console.log(markdown);
