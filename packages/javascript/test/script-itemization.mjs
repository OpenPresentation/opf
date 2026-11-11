import assert from 'node:assert/strict';
import {itemizeScripts, scriptOfCharacter} from '../dist/composition.js';
const arabic={script:'Arab',scriptRole:'complexScript',bcp47:'ar-SA'};
const vectors=[
 ['Bonjour 1',[['Bonjour 1','Latn','latin']]],
 ['العربية 1 Bonjour 2',[['العربية 1 ','Arab','complexScript'],['Bonjour 2','Latn','latin']]],
 ['1 العربية',[['1 العربية','Arab','complexScript']]],
 ['1 Bonjour العربية 2',[['1 Bonjour ','Latn','latin'],['العربية 2','Arab','complexScript']]],
 ['汉字 1 Bonjour',[['汉字','Hans','eastAsian'],[' 1 Bonjour','Latn','latin']]],
 ['😀 العربية 1 A',[['😀 العربية 1 ','Arab','complexScript'],['A','Latn','latin']]],
 ['\u0301A',[['\u0301A','Latn','latin']]],
];
for(const[text,expected]of vectors){const runs=itemizeScripts(text,arabic);assert.deepEqual(runs.map(r=>[r.text,r.script,r.role]),expected,text);assert.equal(runs.map(r=>r.text).join(''),text);let offset=0;for(const run of runs){assert.equal(text.slice(offset,offset+run.text.length),run.text);offset+=run.text.length;}assert.equal(offset,text.length);}
assert.equal(scriptOfCharacter('𞤀'),'Adlm');assert.equal(scriptOfCharacter('😀'),'Zyyy');assert.equal(scriptOfCharacter('\u200f'),'Zinh');assert.deepEqual(arabic,{script:'Arab',scriptRole:'complexScript',bcp47:'ar-SA'});
console.log('Shared itemization: 7 contextual-neutral and UTF-16 vectors PASS.');