import fs from 'node:fs'; import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const sharp=createRequire('C:/opf-work/release-033-final/packages/render/package.json')('sharp');
const base='C:/opf-work/release-033-artifacts',old=base+'/qualification',now=base+'/qualification-final2';
const hash=x=>createHash('sha256').update(x).digest('hex');
const build=JSON.parse(fs.readFileSync(now+'/build.json')), result={revision:build.revision,previewCompared:0,previewChanged:[],nativeCompared:0,nativeChanged:[]};
for(const deck of build.decks){
 for(const imageName of fs.readdirSync(`${now}/preview/${deck.id}`).filter(name=>name.endsWith('.png'))){
  const rel=`preview/${deck.id}/${imageName}`;result.previewCompared++;
  if(hash(fs.readFileSync(old+'/'+rel))!==hash(fs.readFileSync(now+'/'+rel)))result.previewChanged.push(rel);
 }
 for(const variant of deck.variants){
  const name=variant.name==='default'?deck.id:deck.id+'~'+variant.name;
  const probe=JSON.parse(fs.readFileSync(`${now}/powerpoint/${name}.json`,'utf8').replace(/^\uFEFF/,''));
  for(let i=1;i<=probe.slideCount;i++){
   const rel=`powerpoint/${name}/slide-${i}.png`;
   const a=await sharp(old+'/'+rel).ensureAlpha().raw().toBuffer(),b=await sharp(now+'/'+rel).ensureAlpha().raw().toBuffer();result.nativeCompared++;
   if(a.equals(b))continue;
   let channels=0,sum=0;for(let n=0;n<a.length;n++){const d=Math.abs(a[n]-b[n]);if(d)channels++;sum+=d;}
   result.nativeChanged.push({file:name,slide:i,changedChannels:channels,meanChannelDelta:sum/a.length,oldSha256:hash(a),newSha256:hash(b)});
  }
 }
}
fs.writeFileSync(now+'/comparison-original.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
