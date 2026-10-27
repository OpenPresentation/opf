// The default measurement classifies each character once (ASCII from a table, the rest from a bounded cache) instead of running a dozen
// `\p{...}` regexes for every character of every measured string: composing with it was most of the editor's 0.28.0 startup regression.
// The widths are those of the per-character regexes, bit for bit, for every code point and for mixed strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureText} from '../dist/composition.js';

const FACTORS=[[/\p{Script=Tamil}/u,1.53],[/\p{Script=Malayalam}/u,1.76],[/\p{Script=Sinhala}/u,1.44],[/\p{Script=Myanmar}/u,1.18],[/\p{Script=Ethiopic}/u,1.13],[/\p{Script=Georgian}/u,1.28]];
// The 0.28.0 implementation, unchanged.
function reference(text,fontSize){
  let units=0;
  for(const character of text){
    if(/\p{Mn}|\p{Me}|‍|️/u.test(character))continue;
    if(/\p{Mc}/u.test(character)&&/\p{Script=Latin}|\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character))continue;
    const base=character===' '?0.32:/[A-Z0-9]/.test(character)?0.62:character.codePointAt(0)>0x2e80?1:0.54;
    const factor=FACTORS.find(([script])=>script.test(character))?.[1]??1;
    units+=base*factor;
  }
  return units*fontSize;
}

test('every code point measures as with the per-character regexes',()=>{
  const differ=[];
  for(let code=0;code<=0x10ffff;code++){
    if(code>=0xd800&&code<=0xdfff)continue;
    const character=String.fromCodePoint(code);
    if(!Object.is(measureText(character,17.3),reference(character,17.3)))differ.push(code.toString(16));
  }
  for(const lone of ['\ud800','\udfff','a\ud83db'])if(!Object.is(measureText(lone,3),reference(lone,3)))differ.push(JSON.stringify(lone));
  assert.deepEqual(differ.slice(0,10),[]);
});

test('mixed strings measure as with the per-character regexes, again and again',()=>{
  const pool=['A','z','9',' ','.','é','́','‍','️','க','்','മ','ാ','ස','မ','ሀ','ა','日','本','ひ','カ','한','〮','ق','ั','\u{1f600}','\u{1d400}',' '];
  let seed=7;
  const next=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
  for(let round=0;round<3;round++)for(let index=0;index<4000;index++){
    let text='';
    const length=1+Math.floor(next()*48);
    for(let at=0;at<length;at++)text+=pool[Math.floor(next()*pool.length)];
    const size=8+next()*40;
    assert.ok(Object.is(measureText(text,size),reference(text,size)),JSON.stringify(text));
  }
});
