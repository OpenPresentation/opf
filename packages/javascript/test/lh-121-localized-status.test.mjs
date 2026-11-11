import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LANGUAGES,composeSlide,layoutTimeline,timelineStatusWordsFor} from '../dist/composition.js';
const events=[{when:'1',what:'Design',status:'done'},{when:'2',what:'Build',status:'current'},{when:'3',what:'Launch',status:'planned'}];
const box={x:0,y:0,width:1100,height:320};
test('every advertised localized status vocabulary reaches the shared timeline plan',()=>{
 for(const language of LANGUAGES.filter(row=>row.timelineStatusWords)){
   const plan=layoutTimeline(events,box,{statusWords:true,language:language.tag,direction:language.direction});
   assert.deepEqual(plan.statusLabels.map(label=>label.text),['done','current','planned'].map(status=>language.timelineStatusWords[status]),language.tag);
   assert.ok(plan.statusLabels.every(label=>label.sources.length===0),'generated words are not authored source ranges');
   assert.deepEqual(plan.markers.map(marker=>marker.status),['done','current','planned']);
 }
});
test('regional tags, Chinese scripts and canonical aliases pick the appropriate vocabulary',()=>{
 for(const [tag,base]of [['fr-CA','fr'],['pt-BR','pt'],['zh-CN','zh-Hans'],['zh-TW','zh-Hant'],['zh-Hant-HK','zh-Hant'],['iw-IL','he'],['nb-NO','no'],['vi-VN','vi-Latn']])assert.deepEqual(timelineStatusWordsFor(tag),timelineStatusWordsFor(base),tag);
});
test('unsupported generated words stay absent while explicit text and semantic statuses remain intact',()=>{
 const explicit=events.map(event=>({...event,what:'Explicit: '+event.status}));
 for(const language of ['ay','invalid_!']){
  const plan=layoutTimeline(explicit,box,{statusWords:true,language});
  assert.equal(plan.statusLabels,undefined);
  assert.deepEqual(plan.parts.filter(part=>part.role==='what').map(part=>part.text),explicit.map(event=>event.what));
  assert.deepEqual(plan.markers.map(marker=>marker.status),['done','current','planned']);
  assert.ok(plan.progress);
 }
});
test('composition keeps localized words only when source labels keep their size',()=>{
 const slide={title:'Roadmap',timeline:events};
 const compose=language=>composeSlide(slide,{presentation:{language,slides:[slide]},slideIndex:0}).items.find(item=>item.timelineLayout).timelineLayout;
 const plain=compose('ay'),localized=compose('fr-FR');
 assert.deepEqual(localized.statusLabels.map(label=>label.text),['Terminé','En cours','Prévu']);
 for(const part of localized.parts){const baseline=plain.parts.find(item=>item.path===part.path);assert.ok(part.fit.fontSize>=baseline.fit.fontSize,part.path+' never shrinks for generated words');}
});

test('dense localized timelines preserve every source-label size under the guard',()=>{
 for(const count of [3,6,9]){
  const timeline=Array.from({length:count},(_,i)=>({when:'Stage '+(i+1),what:'A detailed milestone label with many words',description:'An explanation of each milestone.',status:['done','current','planned'][i%3]}));
  const slide={title:'Roadmap',timeline};
  const compose=language=>composeSlide(slide,{presentation:{language,slides:[slide]},slideIndex:0}).items.find(item=>item.timelineLayout).timelineLayout;
  const baseline=compose('ay');
  for(const language of ['de-DE','fr-FR','ja-JP','ar-SA']){
   const plan=compose(language);
   for(const part of plan.parts){const before=baseline.parts.find(item=>item.path===part.path);assert.ok(part.fit.fontSize>=before.fit.fontSize,language+' '+count+' '+part.path);}
  }
 }
});
