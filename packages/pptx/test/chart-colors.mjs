import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx} from '../dist/index.js';
import {colorContrast} from '@openpresentation/opf/composition';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const find=(value,key)=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(item=>find(item,key)):Object.entries(value).flatMap(([name,child])=>name===key?array(child):find(child,key));
const cases=[
 {background:'#FFFFFF',surface:'#F8FAFC',text:'#0F172A',expected:'0F172A'},
 {background:'#000000',surface:'#334155',text:'#FFFFFF',expected:'FFFFFF'},
 {background:'#000000',surface:'#F8FAFC',text:'#FFFFFF',expected:'000000'},
 {background:'#FFFFFF',surface:'#0F172A',text:'#000000',expected:'FFFFFF'},
 {background:'#000000',surface:'#FFFFFF80',text:'#FFFFFF',expected:'FFFFFF'},
];
let checked=0;
for(const fixture of cases)for(const type of ['column','bar','line','area','pie','donut','stacked-column-3x','sparkline-5x']){
 const circular=['pie','donut'].includes(type);
 const data={columns:circular?['Quarter','Current']:['Quarter','Current','Baseline'],rows:circular?[['Q1',2],['Q2',3]]:[['Q1',2,1],['Q2',3,2]]};
 const input={design:{background:fixture.background,colorScheme:{id:'cool-horizon',dark1:fixture.text,light1:fixture.text,text:fixture.text,dark2:fixture.surface,light2:fixture.surface}},slides:[{chart:{type,data}}]},original=structuredClone(input);
 const bytes=await toPptx(input),entries=unzipSync(bytes),xml=new TextDecoder().decode(entries['ppt/charts/chart1.xml']),root=parser.parse(xml)['c:chartSpace'];
 const nativeFill=root['c:spPr']['a:solidFill']['a:srgbClr'];assert.equal(nativeFill.val,fixture.surface.slice(1,7));
 if(fixture.surface.length===9)assert.ok(Math.abs(Number(nativeFill['a:alpha'].val)-128/255*100000)<1);
 assert.ok(Object.hasOwn(root['c:chart']['c:plotArea']['c:spPr'],'a:noFill'),'Plot area must not stack alpha');
 const labelStyles=find(root,'c:txPr');assert.ok(labelStyles.length>0);
 for(const style of labelStyles)for(const color of find(style,'a:srgbClr'))assert.equal(color.val,fixture.expected,`${type} ${fixture.surface}`);
 const series=find(root,'c:ser');assert.ok(series.length);
 let paints=0;
 for(const item of series)for(const style of find(item,'c:spPr')){
  const paint=type.includes('line')?style['a:ln']?.['a:solidFill']:style['a:solidFill'];
  for(const color of find(paint,'a:srgbClr')){paints++;if(fixture.surface.length===7)assert.ok(colorContrast('#'+color.val,fixture.surface)>=3,`${type} series ${color.val} against ${fixture.surface}`);}
 }
 assert.ok(paints>0,`${type}: every fixture must inspect actual native series/point paint`);
 const imported=await fromPptx(bytes);const charts=find(imported,'chart');assert.equal(charts.length,1);assert.deepEqual(charts[0].data,data,'Chart data remains editable/reimportable');
 assert.deepEqual(input,original);checked++;
}
console.log(`Native chart colors passed: ${checked} charts, explicit chart panel, single alpha fill, axis/legend colors and exact data reimport.`);
