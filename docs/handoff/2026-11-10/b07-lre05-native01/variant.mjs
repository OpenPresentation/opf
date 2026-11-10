// One diagnostic-only native-data transform; never a product export policy or Office entry point.
import assert from 'node:assert/strict';
import {readZip,replaceMember,member,sha} from './zip-tools.mjs';
export const BASE_SHA='4bde59d9a5e6e08e365d0a92c111081efea6efb9dfc9e7807ad83f7262166bf7';
export const LRE=String.fromCharCode(0x202a),PDF=String.fromCharCode(0x202c),TOKEN='Bonjour 1',PART='ppt/slides/slide1.xml';
export function wrapSlide(xml){
 assert.equal([...xml.matchAll(/<p:sp>/g)].length,2,'Exactly two original shapes');
 assert.equal(/[\u202a-\u202e\u2066-\u2069]/.test(xml),false,'Baseline contains no explicit bidi formatting codepoint');
 const runs=[...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)],matches=runs.filter(run=>/<a:t>([\s\S]*?)<\/a:t>/.exec(run[1])?.[1]===TOKEN);assert.equal(matches.length,1,'Exactly one complete positive Latin run');const [target]=matches,run=target[0];
 assert.match(run,/ lang="ar-SA" altLang="en-US"/);assert.match(run,/ sz="2775"/);assert.match(run,/<a:latin typeface="Aptos"/);assert.equal([...run.matchAll(/<a:cs\b/g)].length,1);assert.ok(run.includes('<a:cs typeface="Aptos"/>'));
 const replacement=run.replace('<a:t>'+TOKEN+'</a:t>','<a:t>'+LRE+TOKEN+PDF+'</a:t>');assert.notEqual(replacement,run);
 return xml.slice(0,target.index)+replacement+xml.slice(target.index+run.length);
}
export function variant(bytes){assert.equal(sha(bytes),BASE_SHA,'Exact prior CS-only immutable input');assert.equal(bytes.length,100889);const zip=readZip(bytes);assert.equal(zip.entries.length,147);const xml=member(zip,PART).toString('utf8');assert.ok(Buffer.from(xml).equals(member(zip,PART)));return replaceMember(bytes,PART,Buffer.from(wrapSlide(xml)));}
export function assertDelta(before,after){
 assert.equal(sha(before),BASE_SHA);const a=readZip(before),b=readZip(after);assert.deepEqual(a.entries.map(e=>e.name),b.entries.map(e=>e.name));const changes=[];
 for(let i=0;i<a.entries.length;i++){const x=a.entries[i],y=b.entries[i];if(!x.data.equals(y.data))changes.push(x.name);if(x.name!==PART)assert.ok(x.localRecord.equals(y.localRecord),x.name+' untouched complete local ZIP record');}
 assert.deepEqual(changes,[PART]);const old=member(a,PART).toString('utf8'),next=member(b,PART).toString('utf8');assert.ok(Buffer.from(next).equals(member(b,PART)));const wrapped='<a:t>'+LRE+TOKEN+PDF+'</a:t>';assert.equal(next.split(wrapped).length,2);assert.equal(next.replace(wrapped,'<a:t>'+TOKEN+'</a:t>'),old,'Whole slide differs only by this exact bounded pair');assert.equal(Buffer.byteLength(next)-Buffer.byteLength(old),6);assert.equal(next.length-old.length,2);assert.deepEqual([...next].filter(c=>/[\u202a-\u202e\u2066-\u2069]/.test(c)).map(c=>c.charCodeAt(0)),[0x202a,0x202c]);
 return{parts:147,changedParts:changes,untouchedLocalRecords:146,slideUtf8BytesAdded:6,nativeUtf16UnitsAdded:2,onlyChange:{part:PART,runTextBefore:TOKEN,runTextAfter:LRE+TOKEN+PDF,addedCodepoints:['U+202A LEFT-TO-RIGHT EMBEDDING','U+202C POP DIRECTIONAL FORMATTING']},rPrLanguageSizeShapeFramesThemeArabicTextUnchanged:true,oldNativeUtf16EqualitySatisfied:false,currentModifiedInputExactTextRequired:true,notUnicodeNormalization:true};
}