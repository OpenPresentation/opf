// Bridge a guarded six-control witness to the existing SH19 gate's input format. No scores or thresholds change.
import fs from 'node:fs';
import path from 'node:path';
const [witnessDir,originalSweep,out]=process.argv.slice(2);
if(!witnessDir||!originalSweep||!out)throw Error('Usage: node witness-gate.mjs <witness-result-dir> <original-sweep> <new-output>');
if(fs.existsSync(out))throw Error('Preserve earlier gate input: output exists');
const report=JSON.parse(fs.readFileSync(path.join(witnessDir,'witness.json'),'utf8').replace(/^\uFEFF/,''));
if(!report.passed||report.inputs.some(i=>!i.unchanged))throw Error('A failed or changed-source witness cannot supply gate inputs');
const sourceMeta=JSON.parse(fs.readFileSync(path.join(originalSweep,'meta.json'))),meta={},probe=[];
for(const sub of ['pptx','pptx-shapes','ppt','ppt-shapes','preview'])fs.mkdirSync(path.join(out,sub),{recursive:true});
for(const [index,control] of report.controls.entries()){
 const name=path.win32.basename(control.source,'.pptx'),live=control.source.replaceAll('\\','/').includes('/pptx/'),kind=live?'pptx':'pptx-shapes';
 const input=report.inputs.find(i=>i.source===control.source);if(!input)throw Error('No sealed input copy for control');
 fs.copyFileSync(path.join(witnessDir,'inputs',path.win32.basename(input.copy)),path.join(out,kind,name+'.pptx'));
 fs.copyFileSync(path.join(witnessDir,`control-${index+1}.png`),path.join(out,live?'ppt':'ppt-shapes',name+'-1.png'));
 if(live){
  const frames=control.shapes.filter(s=>s.layout);
  if(frames.length!==1||!frames[0].items.length)throw Error('Expected one fully materialized live frame');
  const frame=frames[0];
  probe.push({file:name,slides:[{index:1,smartArt:[{layout:frame.layout,nodes:frame.nodes.length,items:frame.items.map(item=>({...item,type:item.preset}))}]}]});
  meta[name+'-1']=sourceMeta[name+'-1'];
  fs.copyFileSync(path.join(originalSweep,'preview',name+'-1.png'),path.join(out,'preview',name+'-1.png'));
 }
}
if(probe.length!==3)throw Error('Expected three live/native pairs');
fs.writeFileSync(path.join(out,'ppt/probe.json'),JSON.stringify(probe,null,2));fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify(meta,null,2));
console.log('Bridged three sealed live/native pairs to the unchanged gate');
