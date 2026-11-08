import assert from 'node:assert/strict';
import {toSvg} from '../dist/index.js';
const cases=[['fr-FR',['Terminé','En cours','Prévu']],['ar-SA',['مكتمل','حالي','مخطط']],['ja-JP',['完了','現在','予定']],['zh-TW',['已完成','目前','計畫']]];
for(const [language,words]of cases){
 const svg=toSvg({language,slides:[{title:'Roadmap',timeline:[{when:'1',what:'Design',status:'done'},{when:'2',what:'Build',status:'current'},{when:'3',what:'Launch',status:'planned'}]}]})[0];
 for(const word of words)assert.ok(svg.includes(word),language+' '+word);
 assert.ok(!svg.includes('>Done<')&&!svg.includes('>Current<')&&!svg.includes('>Planned<'),language+' has no English generated words');
}
console.log('LH-121: French, Arabic, Japanese and Traditional Chinese SVG status words.');
