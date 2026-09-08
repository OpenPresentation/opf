import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {XMLValidator} from 'fast-xml-parser';
const {toPptx, fromPptx} = await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');
const decoder = new TextDecoder(), encoder = new TextEncoder();
const slide = 'ppt/slides/slide1.xml', layout = 'ppt/slideLayouts/slideLayout1.xml', master = 'ppt/slideMasters/slideMaster1.xml', theme = 'ppt/theme/theme1.xml';
const base = unzipSync(await toPptx({slides:[{}]}));
const edit = (parts, path, change) => { parts[path] = encoder.encode(change(decoder.decode(parts[path]))); };
const bg = (parts, path, fill) => edit(parts, path, xml => xml.replace(/<p:bg>.*?<\/p:bg>/s, '').replace(/(<p:cSld\b[^>]*>)/, '$1' + (fill ? '<p:bg>' + fill + '</p:bg>' : '')));
const solid = hex => `<p:bgPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></p:bgPr>`;
const scheme = (slot, alpha='') => `<p:bgPr><a:solidFill><a:schemeClr val="${slot}">${alpha}</a:schemeClr></a:solidFill></p:bgPr>`;
const map = (parts, path, kind, slot) => edit(parts,path,xml => {
  const full = decoder.decode(parts[master]).match(/<p:clrMap ([^>]+)\/>/)[1].replace('bg1="lt1"',`bg1="${slot}"`);
  const override = `<p:clrMapOvr>${kind === 'master' ? '<a:masterClrMapping/>' : '<a:overrideClrMapping '+full+'/>'}</p:clrMapOvr>`;
  return xml.replace(/<p:clrMapOvr>.*?<\/p:clrMapOvr>/s,'').replace(/<\/(p:sld|p:sldLayout)>/,override+'</$1>');
});
let cases=0;
async function check(change, expected, diagnostic) {
  const parts = {...base};for(const path of [slide,layout,master])bg(parts,path,null);
  // Stable colors make expected output independent of the installed generator's theme.
  for(const [slot,hex] of [['accent1','123456'],['accent2','ABCDEF']]) edit(parts,theme,xml => xml.replace(new RegExp(`<a:${slot}>.*?</a:${slot}>`,'s'),`<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`));
  change(parts);
  for(const [path,bytes] of Object.entries(parts)) if(path.endsWith('.xml'))assert.equal(XMLValidator.validate(decoder.decode(bytes)),true,path);
  const bytes=zipSync(parts), original=new Uint8Array(bytes), reports=[];
  const imported=await fromPptx(bytes,{onDiagnostic:d=>reports.push(d)});
  assert.deepEqual(bytes,original,'Native source bytes stay intact');
  assert.equal(validatePresentation(imported).valid,true);
  assert.deepEqual(imported.slides[0].design?.background,expected);
  if(diagnostic) {assert.equal(reports[0]?.code,diagnostic);assert.equal(reports[0]?.path,'slides.0.design.background');}
  else assert.deepEqual(reports,[]);
  if(expected) {
    const again=await fromPptx(await toPptx(imported));
    assert.deepEqual(again.slides[0].design.background,expected,'Resolved colors remain editable through another native round-trip');
  }
  cases++;
}
await check(p=>bg(p,master,solid('123456')),{type:'solid',color:'#123456'});
await check(p=>{bg(p,master,solid('123456'));bg(p,layout,solid('ABCDEF'));},{type:'solid',color:'#ABCDEF'});
await check(p=>{bg(p,master,solid('123456'));bg(p,layout,solid('ABCDEF'));bg(p,slide,solid('010203'));},{type:'solid',color:'#010203'});
await check(p=>{bg(p,master,solid('123456'));bg(p,slide,'<p:bgPr><a:noFill/></p:bgPr>');},{type:'solid',color:'#FFFFFF',opacity:0});
await check(p=>bg(p,slide,scheme('accent1','<a:alpha val="40000"/>')),{type:'solid',color:'#123456',opacity:.4});
for(const explicit of [false,true])await check(p=>{
  edit(p,theme,x=>x.replace('<a:accent1><a:srgbClr val="123456"/></a:accent1>','<a:accent1><a:srgbClr val="123456"><a:alpha val="20000"/></a:srgbClr></a:accent1>'));
  bg(p,slide,scheme('accent1',explicit?'<a:alpha val="50000"/>':''));
},{type:'solid',color:'#123456',opacity:explicit?.5:.2});
await check(p=>bg(p,master,scheme('bg1')),{type:'solid',color:'#FFFFFF'});
await check(p=>{bg(p,master,scheme('bg1'));edit(p,master,x=>x.replace('bg1="lt1"','bg1="accent1"'));},{type:'solid',color:'#123456'});
await check(p=>{bg(p,master,scheme('bg1'));map(p,layout,'override','accent1');edit(p,slide,x=>x.replace(/<p:clrMapOvr>.*?<\/p:clrMapOvr>/s,''));},{type:'solid',color:'#123456'});
await check(p=>{bg(p,master,scheme('bg1'));map(p,layout,'override','accent1');map(p,slide,'override','accent2');},{type:'solid',color:'#ABCDEF'});
await check(p=>{bg(p,master,scheme('bg1'));map(p,layout,'override','accent1');map(p,slide,'master');},{type:'solid',color:'#FFFFFF'});

const fillList = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"/></a:gs><a:gs pos="100000"><a:schemeClr val="accent2"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:srgbClr val="13579B"/></a:solidFill>';
const setStyles = p => edit(p,theme,x=>x.replace(/<a:fillStyleLst>.*?<\/a:fillStyleLst>/s,`<a:fillStyleLst>${fillList}</a:fillStyleLst>`).replace(/<a:bgFillStyleLst>.*?<\/a:bgFillStyleLst>/s,`<a:bgFillStyleLst>${fillList}</a:bgFillStyleLst>`));
await check(p=>{
  setStyles(p);edit(p,theme,x=>x.replaceAll('<a:schemeClr val="phClr"/>','<a:schemeClr val="phClr"><a:alpha val="50000"/></a:schemeClr>'));
  bg(p,layout,'<p:bgRef idx="1001"><a:schemeClr val="accent2"><a:alpha val="40000"/></a:schemeClr></p:bgRef>');
},{type:'solid',color:'#ABCDEF',opacity:.5});
for(const index of [0,1000,1,1001,2,1002,3,1003]) {
  const expected = [0,1000].includes(index) ? {type:'solid',color:'#FFFFFF',opacity:0}
    : index%1000===1 ? {type:'solid',color:'#ABCDEF',opacity:.4}
    : index%1000===3 ? {type:'solid',color:'#13579B'}
    : {type:'gradient',gradient:{angle:90,stops:[{position:0,color:'#123456'},{position:1,color:'#ABCDEF'}]}};
  await check(p=>{setStyles(p);bg(p,layout,`<p:bgRef idx="${index}"><a:schemeClr val="accent2"><a:alpha val="40000"/></a:schemeClr></p:bgRef>`);}, expected);
}
// A layout/slide theme override replaces only the supplied theme component.
for(const owner of [layout,slide]) await check(p=>{
  bg(p,master,scheme('accent1'));
  const rels=owner.replace(/\/([^/]+)$/,'/_rels/$1.rels');
  edit(p,rels,x=>x.replace('</Relationships>','<Relationship Id="rIdThemeOverride" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride" Target="../theme/themeOverride1.xml"/></Relationships>'));
  const colorScheme=decoder.decode(p[theme]).match(/<a:clrScheme.*?<\/a:clrScheme>/s)[0].replace('123456','654321');
  p['ppt/theme/themeOverride1.xml']=encoder.encode(`<a:themeOverride xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${colorScheme}</a:themeOverride>`);
  edit(p,'[Content_Types].xml',x=>x.replace('</Types>','<Override PartName="/ppt/theme/themeOverride1.xml" ContentType="application/vnd.openxmlformats-officedocument.themeOverride+xml"/></Types>'));
},{type:'solid',color:'#654321'});

await check(p=>{
  setStyles(p);
  bg(p,slide,'<p:bgRef idx="1003"><a:schemeClr val="accent1"/></p:bgRef>');
  const format=decoder.decode(p[theme]).match(/<a:fmtScheme.*?<\/a:fmtScheme>/s)[0].replaceAll('13579B','2468AC');
  p['ppt/theme/themeOverride1.xml']=encoder.encode(`<a:themeOverride xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${format}</a:themeOverride>`);
  edit(p,'ppt/slides/_rels/slide1.xml.rels',x=>x.replace('</Relationships>','<Relationship Id="rIdThemeOverride" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride" Target="../theme/themeOverride1.xml"/></Relationships>'));
  edit(p,'[Content_Types].xml',x=>x.replace('</Types>','<Override PartName="/ppt/theme/themeOverride1.xml" ContentType="application/vnd.openxmlformats-officedocument.themeOverride+xml"/></Types>'));
},{type:'solid',color:'#2468AC'});

await check(p=>{
  bg(p,master,scheme('accent1'));
  // Relationships, not standard filenames, identify the effective theme.
  p['ppt/theme/custom-brand.xml']=p[theme];delete p[theme];
  edit(p,'ppt/slideMasters/_rels/slideMaster1.xml.rels',x=>x.replace('../theme/theme1.xml','../theme/custom-brand.xml'));
  edit(p,'[Content_Types].xml',x=>x.replace('/ppt/theme/theme1.xml','/ppt/theme/custom-brand.xml'));
},{type:'solid',color:'#123456'});

for(const [change,code] of [
  [p=>bg(p,slide,scheme('missing')),'unsupported-background-fill'],
  [p=>{bg(p,master,solid('123456'));bg(p,slide,'<p:bgPr><a:pattFill prst="pct5"/></p:bgPr>');},'unsupported-background-fill'],
  [p=>{bg(p,slide,scheme('accent1'));delete p[theme];},'unsupported-background-fill'],
  [p=>bg(p,slide,scheme('accent1','<a:tint val="50000"/>')),'unsupported-background-fill'],
  [p=>{bg(p,slide,scheme('accent1'));edit(p,theme,x=>x.replace('<a:accent1><a:srgbClr val="123456"/></a:accent1>','<a:accent1><a:schemeClr val="accent1"/></a:accent1>'));},'unsupported-background-fill'],
  [p=>bg(p,slide,'<p:bgRef idx="9999"><a:schemeClr val="accent1"/></p:bgRef>'),'unsupported-background-fill'],
  [p=>{setStyles(p);bg(p,slide,'<p:bgRef idx="1"><a:schemeClr val="missing"/></p:bgRef>');},'unsupported-background-fill'],
]) await check(change,undefined,code);

const themed={slides:[{design:{background:{type:'theme',slot:'dark1',opacity:.25}}}]};
const restored=await fromPptx(await toPptx(themed));
assert.equal(restored.slides[0].design.background.opacity,.25,'Theme-slot export retains background opacity');
console.log(`Native background inheritance passed: ${cases} layout/master/theme/map/reference/diagnostic cases and theme-slot opacity.`);
