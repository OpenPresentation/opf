import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {nativeFontCaptureFlag} from './compare-text.mjs';
import {explicitUniformTextFonts,compareUniformTextFonts} from './compare-text-fonts.mjs';
const require=createRequire(new URL('../../package.json',import.meta.url)),peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json')),dependencies={...peer('fflate'),...peer('fast-xml-parser')};
function fixture(overrides={}){
 const shape='<p:sp><p:nvSpPr><p:cNvPr name="Metric"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="127000" cy="127000"/></a:xfrm></p:spPr><p:txBody><a:lstStyle/><a:p><a:r><a:rPr sz="5700"><a:latin typeface="Roboto ExtraBold"/></a:rPr><a:t>52</a:t></a:r></a:p></p:txBody></p:sp>';
 const parts={
  'ppt/presentation.xml':'<p:presentation><p:sldIdLst><p:sldId r:id="r1"/></p:sldIdLst><p:sldSz cx="6858000" cy="12192000"/><p:defaultTextStyle/></p:presentation>',
  'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/></Relationships>',
  'ppt/slides/slide1.xml':`<p:sld><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`,
  'ppt/slides/_rels/slide1.xml.rels':'<Relationships><Relationship Id="layout" Type="test/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
  'ppt/slideLayouts/slideLayout1.xml':'<p:sldLayout><p:cSld><p:spTree/></p:cSld></p:sldLayout>',
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels':'<Relationships><Relationship Id="master" Type="test/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>',
  'ppt/slideMasters/slideMaster1.xml':'<p:sldMaster><p:cSld><p:spTree/></p:cSld><p:txStyles><p:otherStyle/></p:txStyles></p:sldMaster>',
  'ppt/slideMasters/_rels/slideMaster1.xml.rels':'<Relationships><Relationship Id="theme" Type="test/theme" Target="../theme/theme1.xml"/></Relationships>',
  'ppt/theme/theme1.xml':'<a:theme><a:objectDefaults/></a:theme>',
 };
 for(const [file,replace] of Object.entries(overrides))parts[file]=typeof replace==='function'?replace(parts[file]):replace;
 return dependencies.zipSync(Object.fromEntries(Object.entries(parts).map(([file,value])=>[file,Buffer.from(value)])));
}
function observation(){const expected=explicitUniformTextFonts(fixture(),dependencies,1),shape={name:'Metric',text:'52',hasTextFrame:-1,textFont:{status:'uniform',name:'Roboto ExtraBold',sizePoints:57,bold:0,italic:0,unavailableFields:[]}},phase=()=>({slideCount:1,slides:[{index:1,shapeCount:1,shapes:[structuredClone(shape)]}]});return {caseId:'feature-metrics',expected,actions:[],captureTextFonts:true,report:{phases:{original:phase(),edited:phase(),reopened:phase()}}};}
test('capture flags preserve historical absence and fail closed on mismatch/nonboolean',()=>{
 assert.equal(nativeFontCaptureFlag({},{},{}),false);assert.equal(nativeFontCaptureFlag({},{captureTextFonts:false},{}),false);assert.equal(nativeFontCaptureFlag({captureTextFonts:true},{captureTextFonts:true},{captureTextFonts:true}),true);
 for(const values of [[{captureTextFonts:true},{},{}],[{captureTextFonts:true},{captureTextFonts:true},{captureTextFonts:false}],[{captureTextFonts:'false'},{},{}],[{},{captureTextFonts:0},{}],[{},{},{captureTextFonts:null}]])assert.throws(()=>nativeFontCaptureFlag(...values));
});
test('explicit uniform face/size and verified absent false styles retain portrait units',()=>{
 const slides=explicitUniformTextFonts(fixture(),dependencies,1);assert.deepEqual(slides[0].dimensions,{width:540,height:960});assert.deepEqual(slides[0].shapes[0].font,{name:'Roboto ExtraBold',sizePoints:57,bold:false,italic:false});
 const bold=explicitUniformTextFonts(fixture({'ppt/slides/slide1.xml':xml=>xml.replace('sz="5700"','sz="5700" b="1" i="true"')}),dependencies,1);assert.equal(bold[0].shapes[0].font.bold,true);assert.equal(bold[0].shapes[0].font.italic,true);
});
test('missing explicit styles, theme faces and mixed runs are unsupported',()=>{
 for(const change of [xml=>xml.replace('sz="5700"',''),xml=>xml.replace('<a:latin typeface="Roboto ExtraBold"/>',''),xml=>xml.replace('Roboto ExtraBold','+mn-lt'),xml=>xml.replace('</a:p>','<a:r><a:rPr sz="5700"><a:latin typeface="Roboto"/></a:rPr><a:t>other</a:t></a:r></a:p>')])assert.throws(()=>explicitUniformTextFonts(fixture({'ppt/slides/slide1.xml':change}),dependencies,1),/Missing explicit|Unsupported/);
});
test('paragraph, list, presentation, master and layout inherited true styles are unsupported',()=>{
 const inherited='<a:lvl1pPr><a:defRPr b="1"/></a:lvl1pPr>';
 for(const overrides of [
  {'ppt/slides/slide1.xml':xml=>xml.replace('<a:p>','<a:p><a:pPr><a:defRPr b="1"/></a:pPr>')},
  {'ppt/slides/slide1.xml':xml=>xml.replace('<a:lstStyle/>',`<a:lstStyle>${inherited}</a:lstStyle>`)},
  {'ppt/presentation.xml':xml=>xml.replace('<p:defaultTextStyle/>',`<p:defaultTextStyle>${inherited}</p:defaultTextStyle>`)},
  {'ppt/slideMasters/slideMaster1.xml':xml=>xml.replace('<p:otherStyle/>',`<p:otherStyle>${inherited}</p:otherStyle>`)},
  {'ppt/slides/slide1.xml':xml=>xml.replace('<p:nvPr/>','<p:nvPr><p:ph type="title"/></p:nvPr>'),'ppt/slideLayouts/slideLayout1.xml':`<p:sldLayout><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>${inherited}</a:lstStyle></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>`},
 ])assert.throws(()=>explicitUniformTextFonts(fixture(overrides),dependencies,1),/Unsupported inherited b/);
});
test('uniform native descriptors compare all three phases without fidelity acceptance',()=>{const result=compareUniformTextFonts(observation());assert.equal(result.passed,true);assert.equal(result.observations.length,3);assert.equal(result.nativeAcceptance,false);assert.equal(result.tolerancePoints,0.02);});
test('name/style and over .02pt size mutations remain findings',()=>{
 for(const [field,value] of [['name','Arial'],['sizePoints',57.021],['bold',-1],['italic',-1]]){const f=observation();f.report.phases.reopened.slides[0].shapes[0].textFont[field]=value;const result=compareUniformTextFonts(f);assert.equal(result.passed,false);assert.equal(result.findings[0].field,field);}
 const f=observation();f.report.phases.original.slides[0].shapes[0].textFont.sizePoints=57.019;assert.equal(compareUniformTextFonts(f).passed,true);
});
test('missing/mixed descriptors, duplicate names, unrequested capture and edits are unsupported',()=>{
 for(const mutate of [f=>{f.captureTextFonts=false;},f=>{f.actions=[{op:'set-text'}];},f=>{f.caseId='other';},f=>{delete f.report.phases.original.slides[0].shapes[0].textFont;},f=>{f.report.phases.original.slides[0].shapes[0].textFont.status='mixed-or-unavailable';},f=>{const s=f.report.phases.original.slides[0];s.shapes.push(structuredClone(s.shapes[0]));s.shapeCount=2;}]){const f=observation();mutate(f);assert.throws(()=>compareUniformTextFonts(f));}
});
test('title layout/master aliases and ambiguous or missing correspondence are unsupported',()=>{
 const title=xml=>xml.replace('<p:nvPr/>','<p:nvPr><p:ph type="title"/></p:nvPr>');
 const placeholder=type=>`<p:sp><p:nvSpPr><p:nvPr><p:ph type="${type}"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle/></p:txBody></p:sp>`;
 const layout=content=>`<p:sldLayout><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:sldLayout>`;
 const base={'ppt/slides/slide1.xml':title,'ppt/slideLayouts/slideLayout1.xml':layout(placeholder('title'))};
 assert.equal(explicitUniformTextFonts(fixture(base),dependencies,1)[0].shapes[0].font.bold,false);
 for(const change of [{...base,'ppt/slideLayouts/slideLayout1.xml':layout('')},{...base,'ppt/slideLayouts/slideLayout1.xml':layout(placeholder('ctrTitle'))},{...base,'ppt/slideLayouts/slideLayout1.xml':layout(placeholder('title')+placeholder('title'))},{...base,'ppt/slideMasters/slideMaster1.xml':`<p:sldMaster><p:cSld><p:spTree>${placeholder('ctrTitle')}</p:spTree></p:cSld><p:txStyles><p:titleStyle/></p:txStyles></p:sldMaster>`},{...base,'ppt/slideMasters/slideMaster1.xml':'<p:sldMaster><p:cSld><p:spTree/></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr b="1"/></a:lvl1pPr></p:titleStyle></p:txStyles></p:sldMaster>'}])assert.throws(()=>explicitUniformTextFonts(fixture(change),dependencies,1),/inheritance|correspondence|inherited/);
});

test('theme object defaults are verified empty or rejected as unsupported',()=>{
 assert.equal(explicitUniformTextFonts(fixture({'ppt/theme/theme1.xml':'<a:theme name="Theme"><a:themeElements/></a:theme>'}),dependencies,1)[0].shapes[0].font.bold,false);
 for(const source of ['<a:theme><a:objectDefaults><a:spDef><a:lstStyle><a:lvl1pPr><a:defRPr b="1"/></a:lvl1pPr></a:lstStyle></a:spDef></a:objectDefaults></a:theme>','<a:theme><a:objectDefaults><a:spDef><a:lstStyle><a:lvl1pPr><a:defRPr i="1"/></a:lvl1pPr></a:lstStyle></a:spDef></a:objectDefaults></a:theme>'])assert.throws(()=>explicitUniformTextFonts(fixture({'ppt/theme/theme1.xml':source}),dependencies,1),/Unsupported theme object defaults/);
 const missingTheme={'ppt/slideMasters/_rels/slideMaster1.xml.rels':'<Relationships/>'};assert.throws(()=>explicitUniformTextFonts(fixture(missingTheme),dependencies,1),/theme inheritance relationship/);
});


const metricsFixture=new URL('./fixtures/metrics-font-empty-frame/',import.meta.url);
const metricsReceipt=JSON.parse(fs.readFileSync(new URL('receipt.json',metricsFixture)));
const metricsInput=fs.readFileSync(new URL(metricsReceipt.input.file,metricsFixture));
const metricsReportBytes=gunzipSync(fs.readFileSync(new URL(metricsReceipt.nativeReport.file,metricsFixture)));
const metricsReport=JSON.parse(metricsReportBytes.toString().replace(/^\uFEFF/,''));
function actualMetrics(){return{expected:explicitUniformTextFonts(metricsInput,dependencies,1),report:structuredClone(metricsReport),actions:[],captureTextFonts:true,caseId:'feature-metrics'};}

test('retained actual15-frame metrics report compares all14 source text fonts in every phase',()=>{
 const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(metricsInput.length,metricsReceipt.input.bytes);assert.equal(sha(metricsInput),metricsReceipt.input.sha256);
 assert.equal(metricsReportBytes.length,metricsReceipt.nativeReport.decodedBytes);assert.equal(sha(metricsReportBytes),metricsReceipt.nativeReport.sha256);
 const f=actualMetrics();assert.equal(f.expected[0].shapes.length,14);assert.deepEqual(f.expected[0].emptyTextFrameNames,['OPF card slides.0.blocks.3']);
 for(const phase of ['original','edited','reopened']){const slide=f.report.phases[phase].slides[0];assert.equal(slide.shapeCount,15);assert.equal(slide.shapes.filter(s=>s.hasTextFrame!==0&&s.text!==null).length,15);const empty=slide.shapes.find(s=>s.name===f.expected[0].emptyTextFrameNames[0]);assert.equal(empty.text,'');assert.equal(empty.textFont.status,'no-text');}
 const result=compareUniformTextFonts(f);assert.equal(result.passed,true);assert.equal(result.observations.length,42);assert.equal(result.nativeAcceptance,false);
});

test('only exact source-bound empty frames are exempt; unbound, renamed, duplicate and text-bearing frames refuse',()=>{
 for(const phase of ['original','edited','reopened'])for(const mode of ['unbound','renamed','duplicate-native','gained-text','missing-text']){
  const f=actualMetrics(),slide=f.report.phases[phase].slides[0],empty=slide.shapes.find(s=>s.name===f.expected[0].emptyTextFrameNames[0]);
  if(mode==='unbound')slide.shapes.push({...structuredClone(empty),name:'Unbound empty decorative frame'});
  if(mode==='renamed')empty.name+=' renamed';
  if(mode==='duplicate-native')slide.shapes.push(structuredClone(empty));
  if(mode==='gained-text')empty.text='Unexpected native text';
  if(mode==='missing-text')slide.shapes=slide.shapes.filter(s=>s.name!==f.expected[0].shapes[0].name);
  slide.shapeCount=slide.shapes.length;assert.throws(()=>compareUniformTextFonts(f),/Unexpected native text shape count|Duplicate native shape/,phase+' '+mode);
 }
});

test('source empty identities stay unique, disjoint and literal, including a renamed PPTX source',()=>{
 for(const mode of ['duplicate-source','case-duplicate','overlap','invalid']){
  const f=actualMetrics(),empty=f.expected[0].emptyTextFrameNames;
  if(mode==='duplicate-source')empty.push(empty[0]);
  if(mode==='case-duplicate')empty.push(empty[0].toUpperCase());
  if(mode==='overlap')empty.push(f.expected[0].shapes[0].name);
  if(mode==='invalid')empty.push(null);
  assert.throws(()=>compareUniformTextFonts(f),/Duplicate expected nontext shape|overlaps text shape|Invalid expected nontext/,mode);
 }
 const parts=dependencies.unzipSync(metricsInput),file='ppt/slides/slide1.xml',old='name="OPF card slides.0.blocks.3"',xml=dependencies.strFromU8(parts[file]);assert.equal(xml.split(old).length,2);
 parts[file]=dependencies.strToU8(xml.replace(old,'name="Renamed source decorative card"'));
 const f=actualMetrics();f.expected=explicitUniformTextFonts(dependencies.zipSync(parts),dependencies,1);
 assert.throws(()=>compareUniformTextFonts(f),/Unexpected native text shape count/);
});

test('source-bound empty exemption never masks a requested face, size, style or descriptor finding',()=>{
 for(const [field,value]of [['name','Wrong Face'],['sizePoints',99],['bold',-1],['italic',-1]]){
  const f=actualMetrics(),source=f.expected[0].shapes.find(s=>s.font.bold===false&&s.font.italic===false),shape=f.report.phases.reopened.slides[0].shapes.find(s=>s.name===source.name);shape.textFont[field]=value;
  const result=compareUniformTextFonts(f);assert.equal(result.passed,false);assert.ok(result.findings.some(f=>f.field===field));assert.equal(result.observations.length,42);
 }
 for(const mode of ['missing','mixed']){const f=actualMetrics(),shape=f.report.phases.original.slides[0].shapes.find(s=>s.name===f.expected[0].shapes[0].name);if(mode==='missing')delete shape.textFont;else shape.textFont.status='mixed-or-unavailable';assert.throws(()=>compareUniformTextFonts(f),/missing.mixed native font descriptor/);}
});
