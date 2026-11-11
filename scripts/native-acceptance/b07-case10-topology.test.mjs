// Actual public current XML/V2 admission plus synthetic phase/refusal records.
// No native observation, process query, worker or observer is invoked here.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readB07Sources,b07CurrentShapeBound,assertB07Case10Topology,B07_CASE10_ID} from './b07-current-source.mjs';
import {b07NativeShapes,b07LimitsForSource,B07_LIMITS,bindB07ObservedPhase,assertB07Case10Phases} from './b07-current-profile.mjs';
import {inspectB07Archive} from './b07-current-generate.mjs';
import {B07_POSTFLIGHT_POLICY} from './b07-postflight.mjs';
const require=createRequire(new URL('../../packages/pptx/package.json',import.meta.url)),fflate=require('fflate'),{XMLParser}=require('fast-xml-parser'),parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false}),source=readB07Sources().find(row=>row.id===B07_CASE10_ID);
let pending;
const fixture=()=>pending??=(async()=>{
 const {toPptx}=await import('@openpresentation/opf-pptx'),{loadFonts}=await import('@openpresentation/opf-render/fonts-node'),{readNativeScalarGroups}=await import('../../packages/pptx/dist/native-scalar-fragments.js'),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source.document});
 try{const bytes=Buffer.from(await toPptx(source.document,{fonts})),entries=fflate.unzipSync(bytes),xml=fflate.strFromU8(entries['ppt/slides/slide1.xml']),shapes=b07NativeShapes(xml,XMLParser,source),groups=readNativeScalarGroups(entries,'ppt/slides/slide1.xml').groups.map(({header,text,exact})=>({header,text,exact}));return{bytes,entries,xml,shapes,groups};}finally{fonts.dispose?.();}
})();
test('only the exact current case10 record derives22; default/all other bounds and budgets stay unchanged',()=>{
 assert.equal(b07CurrentShapeBound(),16);assert.equal(B07_LIMITS.topLevelShapes,16);assert.equal(b07CurrentShapeBound(source),22);assert.deepEqual(b07LimitsForSource(source),{...B07_LIMITS,topLevelShapes:22});
 for(const row of readB07Sources().filter(row=>row.id!==B07_CASE10_ID)){assert.equal(b07CurrentShapeBound(row),16);assert.deepEqual(b07LimitsForSource(row),B07_LIMITS);}
 for(const changed of [{...source,id:'foreign'},{...source,currentBytes:Buffer.concat([source.currentBytes,Buffer.from(' ')])},{...source,topLevelShapes:22},{...source,policy:{topLevelShapes:22}},{id:B07_CASE10_ID},{topLevelShapes:22}])assert.throws(()=>b07CurrentShapeBound(changed));
 for(const cap of [NaN,Infinity,-1,16,22,23,22.5,'22'])assert.throws(()=>b07CurrentShapeBound({...source,topLevelShapes:cap}),'No finite/nonfinite caller cap field is accepted');
 assert.deepEqual([B07_LIMITS.targets,B07_LIMITS.ranges,B07_LIMITS.sampledUtf16,B07_LIMITS.textUtf16,B07_LIMITS.phases,B07_LIMITS.pngs,B07_LIMITS.timeoutSecondsMax],[3,8,32,4096,3,3,60]);assert.deepEqual([B07_POSTFLIGHT_POLICY.budgetMilliseconds,B07_POSTFLIGHT_POLICY.intervalMilliseconds,B07_POSTFLIGHT_POLICY.maximumQueries],[5000,100,51]);
});
test('actual public22shape117unit V2 topology admits; bare/historical and other-case inspectors retain16',async()=>{
 const f=await fixture();assert.deepEqual(assertB07Case10Topology(source,f.shapes,f.groups),{shapes:22,textUtf16:117,groups:4,lines:7,colonOnly:4,spaceOnly:2});assert.equal(inspectB07Archive(f.bytes,{fflate,parser},source).slides[0].topLevelShapes,22);assert.throws(()=>inspectB07Archive(f.bytes,{fflate,parser}),/declared16/);assert.throws(()=>b07NativeShapes(f.xml,XMLParser));
 for(const other of readB07Sources().filter(row=>row.id!==B07_CASE10_ID)){assert.throws(()=>inspectB07Archive(f.bytes,{fflate,parser},other),/declared16/);assert.throws(()=>b07NativeShapes(f.xml,XMLParser,other));}
 const one=/<p:sp>[\s\S]*?<\/p:sp>/.exec(f.xml)[0];for(const count of [21,23]){const changed=count===21?f.xml.replace(one,''):f.xml.replace(one,one+one.replace(/id="\d+"/,'id="99999"').replace(/name="[^"]*"/,'name="Unreviewed extra"'));assert.throws(()=>b07NativeShapes(changed,XMLParser,source));}
});
test('real V2 topology refuses source, text, whitespace, digit/colon, title, identity and ownership drift',async()=>{
 const f=await fixture();const mutations=[
 ['missing member',shapes=>shapes.pop()],['extra member',shapes=>shapes.push(shapes[0])],['lost space',shapes=>{shapes.find(shape=>shape.text===' ').text='';}],['combined digit colon',shapes=>{shapes.find(shape=>/^[\u0660-\u0669]$/u.test(shape.text)).text+=':';shapes.find(shape=>shape.text===':').text='';}],['title',shapes=>{shapes.find(shape=>shape.text===source.document.slides[0].title).text='Changed title';}],['identity',shapes=>{shapes[1].id=shapes[0].id;shapes[1].name=shapes[0].name;}],
 ];for(const [name,change]of mutations){const shapes=structuredClone(f.shapes);change(shapes);assert.throws(()=>assertB07Case10Topology(source,shapes,f.groups),undefined,name);}
 for(const [name,change]of [['missing group',groups=>groups.pop()],['proof',groups=>{groups[0].exact=false;}],['foreign path',groups=>{groups[0].header.group='slides.0.blocks.99.text';}],['current text',groups=>{groups[0].text+=' ';}],['line count',groups=>{groups[0].header.lines.pop();}],['member reuse',groups=>{groups[0].header.members[1]={...groups[0].header.members[0]};}]]){const groups=structuredClone(f.groups);change(groups);assert.throws(()=>assertB07Case10Topology(source,f.shapes,groups),undefined,name);}
});
function syntheticPhases(f){
 const selected=f.shapes.find(shape=>/^[\u0660-\u0669]$/u.test(shape.text)),sample={start1Based:1,length:1,text:selected.text,style:selected.runs[0].style},target={slideIndex:1,shapeId:selected.id,shapeName:selected.name,text:selected.text,ranges:[sample]},plan={schemaVersion:1,archiveSha256:'a'.repeat(64),targets:[target]},descriptor=()=>({languageId:{value:1025,status:'reported'},fontSlots:Object.fromEntries(['Name','NameAscii','NameOther','NameFarEast','NameComplexScript'].map(key=>[key,{value:sample.style.name,status:'reported'}])),sizePoints:sample.style.sizePoints,bold:sample.style.bold,italic:sample.style.italic});
 const shapes=f.shapes.map(shape=>({id:shape.id,name:shape.name,text:shape.text,left:1,top:2,width:3,height:4,rotation:0,textFont:{status:'mixed-or-unavailable'},...(shape===selected?{textProbe:{shapeId:shape.id,shapeName:shape.name,text:shape.text,primary:descriptor(),ranges:[{...sample,expectedStyle:sample.style,observed:descriptor(),styleMismatches:[],bounds:Object.fromEntries(['BoundLeft','BoundTop','BoundWidth','BoundHeight'].map(key=>[key,{value:1,status:'reported',unit:'pt'}])),nativeAcceptance:false}],nativeAcceptance:false}}:{})}));delete shapes.find(shape=>shape.textProbe).textProbe.ranges[0].style;
 const state={slideCount:1,slides:[{index:1,shapeCount:22,shapes}],rasters:[{slideIndex:1,path:'synthetic.png',sha256:'a'.repeat(64)}]};return{report:{phases:Object.fromEntries(['original','edited','reopened'].map(phase=>[phase,structuredClone(state)]))},binding:{source,shapes:f.shapes,probe:{value:plan}}};
}
test('complete22 ID/name/current text checks apply in ALL phases before observer admission',async()=>{
 const f=await fixture(),valid=syntheticPhases(f);assertB07Case10Phases(valid.report,valid.binding);assert.throws(()=>bindB07ObservedPhase(valid.report.phases.original,valid.binding.probe.value),'Bare observation retains16');
 for(const phase of ['original','edited','reopened'])for(const [name,change]of [['missing shape',state=>{state.slides[0].shapes.pop();state.slides[0].shapeCount--;}],['extra shape',state=>{state.slides[0].shapes.push(state.slides[0].shapes[0]);state.slides[0].shapeCount++;}],['nonprobed text',state=>{state.slides[0].shapes.find(shape=>!shape.textProbe).text+=' ';}],['duplicate identity',state=>{state.slides[0].shapes[1].id=state.slides[0].shapes[0].id;}],['name',state=>{state.slides[0].shapes[0].name+=' ';}],['order',state=>state.slides[0].shapes.reverse()]]){const changed=structuredClone(valid.report);change(changed.phases[phase]);assert.throws(()=>assertB07Case10Phases(changed,valid.binding),undefined,phase+'/'+name);}
 assert.throws(()=>assertB07Case10Phases({...valid.report,phases:{...valid.report.phases,unreviewed:valid.report.phases.original}},valid.binding));
});
