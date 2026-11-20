// Production SH21 acceptance packet: shipping CLI defaults only; new live domains stay OFF.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {fromPptx} from '../../../packages/pptx/dist/index.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=process.argv[2]&&path.resolve(process.argv[2]);
if(!out||fs.existsSync(out))throw Error('Supply a fresh output directory; every earlier packet is preserved.');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
assert.equal(git(['status','--porcelain']),'','Commit the complete producer first; only a clean head may build a production packet.');
const revision=git(['rev-parse','HEAD']);
const fixedInputs='77cbe3b41f2fb647cf014cfd1008d053165f7b3b';
const inputDirectory='docs/programs/shapes/sh21-product-candidate-2026-11-07/';
const ids=['org-chart-3','org-chart-5','hierarchy-3','hierarchy-5',...Array.from({length:7},(_,i)=>'venn-'+(i+1))];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {unzipSync,strFromU8}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const producerFiles=['packages/cli/dist/index.js','packages/javascript/dist/composition.js','packages/pptx/dist/index.js','packages/render/dist/index.js'];
const manifest={revision,opfVersion:'0.34.0-preparation',route:'Unmodified checkout-built shipping CLI convert defaults; --date 2026-11-08; PNG --scale 0.5; CLI office/visual/scripts:auto fonts. Not a registry publication.',newLiveDomainsEnabled:false,diagnosticOverrides:false,inputAuthority:{revision:fixedInputs,path:inputDirectory,onlyJsonInputsRead:true},producerFiles:producerFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),decks:[]};
for(const sub of ['inputs','pptx','preview','logs'])fs.mkdirSync(path.join(out,sub),{recursive:true});
const semantics=items=>items.map(item=>typeof item==='string'?{text:item,level:0}:{text:item.text,level:item.level??0});
for(const id of ids){
  const inputBytes=execFileSync('git',['show',fixedInputs+':'+inputDirectory+id+'.opf.json'],{cwd:root,maxBuffer:1024*1024});
  const input=path.join(out,'inputs',id+'.opf.json');fs.writeFileSync(input,inputBytes);
  const document=JSON.parse(inputBytes);assert.equal(document.slides.length,1);
  const kind=id.startsWith('org-chart')?'org-chart':id.startsWith('hierarchy')?'hierarchy':'venn';
  const count=Number(id.match(/-(\d+)$/)[1]);assert.equal(document.slides[0].layout,kind);assert.equal(document.slides[0].items.length,count);
  const outputs={};
  for(const ext of ['pptx','png']){
    const relative=ext==='pptx'?'pptx/'+id+'.pptx':'preview/'+id+'/slide-1.png';const target=path.join(out,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    const args=[path.join(root,'packages/cli/dist/index.js'),'convert',input,target,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])];
    const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
    fs.writeFileSync(path.join(out,'logs',id+'-'+ext+'.stdout.log'),result.stdout??'');fs.writeFileSync(path.join(out,'logs',id+'-'+ext+'.stderr.log'),result.stderr??'');
    assert.equal(result.error,undefined);assert.equal(result.status,0,id+' '+ext+': preserve failed attempt and inspect logs');
    const bytes=fs.readFileSync(target);assert.ok(bytes.length>0);outputs[ext]={file:relative,sha256:sha(bytes),bytes:bytes.length,args:args.slice(1)};
  }
  const native=fs.readFileSync(path.join(out,outputs.pptx.file)),parts=unzipSync(native);
  assert.ok(!Object.keys(parts).some(file=>file.startsWith('ppt/diagrams/')),id+': production must not write unqualified live SmartArt');
  const xml=strFromU8(parts['ppt/slides/slide1.xml']);assert.ok(xml.includes('OPF arrangement'),id+': actual editable arrangement shapes required');
  assert.ok(!Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).some(([,data])=>/<a:(?:normAutofit|spAutoFit)\b/.test(strFromU8(data))),id+': no shrink autofit');
  const imported=await fromPptx(native),actual=imported.slides[0].items??imported.slides[0].blocks?.find(block=>block.items)?.items;
  assert.deepEqual(semantics(actual),semantics(document.slides[0].items),id+': preserve all authored text, levels and order');
  const png=fs.readFileSync(path.join(out,outputs.png.file));assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(png.readUInt32BE(16),640);assert.equal(png.readUInt32BE(20),360);
  manifest.decks.push({id,kind,count,source:path.join(out,outputs.pptx.file),sourceCommit:revision,input:{file:'inputs/'+id+'.opf.json',sha256:sha(inputBytes),authority:fixedInputs+':'+inputDirectory+id+'.opf.json'},previewOk:true,previewSlides:1,width:1280,height:720,previewDirectory:'preview/'+id,previews:[{slide:1,path:outputs.png.file,sha256:outputs.png.sha256,width:640,height:360}],variants:[{name:'default',pptx:outputs.pptx.file,ok:true,sha256:outputs.pptx.sha256}],productionAssertions:{noLiveSmartArt:true,editableArrangementShapes:true,noShrinkAutofit:true,authoredTextLevelsOrderRoundTrip:true},outputs});
  console.log(id+': default native shapes, matching CLI preview, semantic round trip, no live parts');
}
assert.equal(git(['rev-parse','HEAD']),revision,'Producer moved during export');assert.equal(git(['status','--porcelain']),'','Producer became dirty during export');
fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({revision,decks:manifest.decks.length,manifestSha256:sha(fs.readFileSync(path.join(out,'build.json'))),scope:'Production shape qualification only; no Office or live-domain acceptance.'}));
