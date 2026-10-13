import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {nativeFontCaptureFlag} from './compare-text.mjs';
import {explicitUniformTextFonts,compareUniformTextFonts} from './compare-text-fonts.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url)),peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json')),dependencies={...peer('fflate'),...peer('fast-xml-parser')};
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
