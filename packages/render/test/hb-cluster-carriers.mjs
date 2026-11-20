// Actual pinned HarfBuzz glyph/position and Unicode cluster-ownership regression, not a timing assertion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as hb from 'harfbuzzjs';
import {createShaper} from '../dist/hb-shape.js';
import {BUNDLED_FONT_MANIFEST} from '../dist/font-manifest.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const wasm=fs.readFileSync(require.resolve('harfbuzzjs/dist/harfbuzz.wasm')),shaper=createShaper(wasm),faces=new Map();
function face(family){if(faces.has(family))return faces.get(family);const pkg=BUNDLED_FONT_MANIFEST.packages.find(p=>p.faces.some(f=>f.family===family&&f.weight===400&&!f.italic));assert(pkg);const selected=pkg.faces.find(f=>f.family===family&&f.weight===400&&!f.italic),dir=pkg.vendored?path.join(root,pkg.vendored):path.dirname(require.resolve(pkg.name+'/package.json')),file=path.join(dir,selected.file),data=fs.readFileSync(file);assert.equal(sha(data),selected.sha256);const value={family,data,file,sha256:selected.sha256,font:new hb.Font(new hb.Face(new hb.Blob(data)))};faces.set(family,value);return value;}
const cases=[
 {id:'ascii-long-8100',family:'Intos',text:'lorem ipsum dolor sit amet '.repeat(300),options:{direction:'ltr',language:'en'}},
 {id:'ligatures',family:'Noto Sans',text:'office affine',options:{direction:'ltr',language:'en'}},
 {id:'features-off',family:'Noto Sans',text:'office affine',options:{direction:'ltr',language:'en',features:{liga:false,kern:false}}},
 {id:'combining',family:'Noto Sans',text:'x\u0307\u0323a\u0301',options:{direction:'ltr',language:'en'}},
 {id:'combining-level2',family:'Noto Sans',text:'x\u0307\u0323a\u0301',options:{direction:'ltr',language:'en',clusterLevel:2}},
 {id:'arabic-rtl',family:'Noto Sans Arabic',text:'السَّلَامُ عليكم',options:{direction:'rtl',language:'ar'}},
 {id:'arabic-ltr',family:'Noto Sans Arabic',text:'السَّلَامُ عليكم',options:{direction:'ltr',language:'ar'}},
 {id:'devanagari-multiglyph',family:'Noto Sans Devanagari',text:'कि क्षि ज्ञ',options:{direction:'ltr',language:'hi'}},
 {id:'devanagari-level2',family:'Noto Sans Devanagari',text:'कि क्षि ज्ञ',options:{direction:'ltr',language:'hi',clusterLevel:2}},
 {id:'nonbmp-zwj',family:'Noto Color Emoji',text:'😀👩‍💻😃',options:{direction:'ltr',language:'en'}},
 {id:'nonbmp-level2',family:'Noto Color Emoji',text:'😀👩‍💻😃',options:{direction:'ltr',language:'en',clusterLevel:2}},
 {id:'marks-only',family:'Noto Sans Arabic',text:'\u0651\u064E',options:{direction:'rtl',language:'ar'}},
 {id:'empty',family:'Intos',text:'',options:{direction:'ltr'}},
];
const report={wasmSha256:sha(wasm),wasmBytes:wasm.length,node:process.version,maxTextUtf16:8100,cases:[],fonts:[]};
for(const sample of cases){const f=face(sample.family),actual=shaper.shape(f.sha256,f.data,sample.text,sample.options),buffer=new hb.Buffer();buffer.addText(sample.text);buffer.setDirection(sample.options.direction==='rtl'?hb.Direction.RTL:hb.Direction.LTR);if(sample.options.clusterLevel)buffer.setClusterLevel(sample.options.clusterLevel);if(sample.options.language)buffer.setLanguage(sample.options.language);buffer.guessSegmentProperties();hb.shape(f.font,buffer,Object.entries(sample.options.features??{}).map(([tag,on])=>hb.Feature.fromString((on?'+':'-')+tag)));const infos=buffer.getGlyphInfos(),positions=buffer.getGlyphPositions();assert.equal(actual.length,infos.length,sample.id);
 const expected=infos.map((g,i)=>({gid:g.codepoint,codePoints:[],advance:positions[i].xAdvance,xOffset:positions[i].xOffset,yOffset:positions[i].yOffset}));
 // Independent point-first oracle over the public HarfBuzz API: locate each UTF-16 source character's cluster,
 // then its first advancing glyph in logical order (or its first glyph if none advances).
 const starts=[...new Set(infos.map(g=>g.cluster))].sort((a,b)=>a-b),groups=new Map();for(const[i,g]of infos.entries()){if(!groups.has(g.cluster))groups.set(g.cluster,[]);groups.get(g.cluster).push(i);}const owners=new Map();for(const[start,indices]of groups){const logical=sample.options.direction==='rtl'?[...indices].reverse():indices;owners.set(start,logical.find(i=>positions[i].xAdvance!==0)??logical[0]);}
 let utf16=0;for(const character of sample.text){let lo=0,hi=starts.length;while(lo<hi){const mid=(lo+hi)>>>1;if(starts[mid]<=utf16)lo=mid+1;else hi=mid;}assert(lo>0,sample.id+': source character has a cluster');expected[owners.get(starts[lo-1])].codePoints.push(character.codePointAt(0));utf16+=character.length;}
 assert.deepEqual(actual,expected,sample.id+': all glyph IDs, advances, offsets and complete code points');for(const glyph of actual)assert.deepEqual(Object.keys(glyph),['gid','codePoints','advance','xOffset','yOffset']);assert.equal(new Set(actual.map(g=>g.codePoints)).size,actual.length,sample.id+': each glyph owns its array');
 report.cases.push({...sample,glyphs:actual,clusters:infos.map(g=>g.cluster),multiGlyphClusters:[...groups].filter(([,a])=>a.length>1).length});
}
assert.equal(report.cases[0].text.length,8100);assert(report.cases.find(c=>c.id==='ligatures').glyphs.some(g=>g.codePoints.length>=3),'Actual ffi ligature must be exercised');assert(report.cases.find(c=>c.id==='devanagari-multiglyph').multiGlyphClusters>0,'Actual multiglyph cluster must be exercised');assert(report.cases.find(c=>c.id==='nonbmp-zwj').glyphs.some(g=>g.codePoints.some(cp=>cp>0xffff)),'Actual non-BMP cluster must be exercised');assert(report.cases.find(c=>c.id==='combining').glyphs.some(g=>g.codePoints.length===0),'Actual noncarrier mark must be exercised');report.fonts=[...faces.values()].map(f=>({family:f.family,file:f.file,bytes:f.data.length,sha256:f.sha256}));report.fontBytes=report.fonts.reduce((n,f)=>n+f.bytes,0);report.resourceUsage=process.resourceUsage();
const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report)+'\n',{flag:'wx'});}console.log(JSON.stringify({status:'PASS',cases:cases.length,maxTextUtf16:8100,fonts:faces.size,fontBytes:report.fontBytes,allGlyphFieldsAndCodePoints:true,wasmSha256:report.wasmSha256}));
