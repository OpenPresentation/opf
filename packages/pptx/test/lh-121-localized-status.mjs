import assert from 'node:assert/strict';
import {strFromU8,unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';
for(const [language,words]of [['fr-FR',['Terminé','En cours','Prévu']],['ar-SA',['مكتمل','حالي','مخطط']],['ja-JP',['完了','現在','予定']],['zh-TW',['已完成','目前','計畫']]]){
 const bytes=await toPptx({language,slides:[{title:'Roadmap',timeline:[{when:'1',what:'Design',status:'done'},{when:'2',what:'Build',status:'current'},{when:'3',what:'Launch',status:'planned'}]}]});
 const xml=strFromU8(unzipSync(new Uint8Array(bytes))['ppt/slides/slide1.xml']);
 for(const word of words)assert.ok(xml.includes('<a:t>'+word+'</a:t>'),language+' native text '+word);
 if(language==='ar-SA')assert.match(xml,/rtl="1"/);
}
console.log('LH-121: localized status words stay native editable PPTX text, including RTL.');
