import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {measureText,fitText,composeSlide} from '../dist/composition.js';
const corpus=JSON.parse(readFileSync(new URL('../../../docs/evidence/script-corpora-20261001/script-corpora.json',import.meta.url)));
const browser=JSON.parse(readFileSync(new URL('../../../docs/evidence/script-corpora-20261001/browser.json',import.meta.url)));
const protectedScripts=new Set(['Latn','Jpan','Hans','Hant','Kore']);
const correctedScripts=new Set(['Taml','Mlym','Sinh','Mymr','Ethi','Geor']);
const oldEstimate=text=>[...text].reduce((sum,c)=>sum+(/\p{Mark}|\u200d|\ufe0f/u.test(c)?0:c===' '?.32:/[A-Z0-9]/u.test(c)?.62:c.codePointAt(0)>0x2e80?1:.54),0)*100;
for(const group of corpus.groups){
  test(`fontless ${group.script} estimate improves corpus error or preserves base rules`,()=>{
    const samples=new Map(group.samples.map(sample=>[sample.id,sample]));
    const cases=browser.rows.filter(row=>samples.has(row.id));
    assert.ok(cases.length);
    let beforeError=0,afterError=0;
    for(const row of cases){
      const text=samples.get(row.id).text;
      const actual=measureText(text,100);
      beforeError+=Math.abs(oldEstimate(text)/row.browser-1);
      afterError+=Math.abs(actual/row.browser-1);
      if(protectedScripts.has(group.script))assert.equal(actual,oldEstimate(text));
      else if(!correctedScripts.has(group.script)){
        const spacingMarks=[...text].filter(c=>/\p{Mc}/u.test(c)).length;
        assert.ok(Math.abs(actual-oldEstimate(text)-spacingMarks*54)<1e-8);
      }
    }
    if(correctedScripts.has(group.script))assert.ok(afterError<beforeError*.75,`${group.script} mean absolute relative error did not improve by 25%`);
  });
}
test('spacing marks contribute while nonspacing/enclosing marks and ZWJ add no advance',()=>{
  assert.ok(measureText('का',20)>measureText('क',20));
  assert.equal(measureText('क\u093c\u200d',20),measureText('क',20));
  assert.equal(measureText('a\u0301\u20dd\ufe0f',20),measureText('a',20));
});
test('mixed-script estimates preserve shared Latin and punctuation widths',()=>{
  assert.equal(measureText('தமிழ் A1!',100),measureText('தமிழ்',100)+measureText(' A1!',100));
});
test('provided text measurements determine wrapping regardless of script estimates',()=>{
  const text='தமிழ் தமிழ்';
  const measured=fitText(text,{width:80,height:100},20,20,()=>10);
  assert.deepEqual(measured.lines,[text]);
  assert.ok(fitText(text,{width:80,height:100},20,20).lines.length>1);
});

test('CJK spacing tone and reading marks preserve their previous zero advance',()=>{
  for(const text of ['가\u302e\u302f','漢\u{16ff0}\u{16ff1}'])assert.equal(measureText(text,100),oldEstimate(text));
});

test('composition forwards host measurement for mixed scripts without applying script factors',()=>{
  const seen=[];
  const text='தமிழ் Latin ქართული';
  const result=composeSlide({title:text,blocks:[{text}],composition:{mode:'column'}},{width:640,height:360,textMeasurement:{measure:(value,size)=>{seen.push({value,size});return 10;}}});
  assert.ok(seen.some(call=>call.value===text));
  assert.ok(result.items.filter(item=>item.text).every(item=>item.text.lines.length===1));
});
