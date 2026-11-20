import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
const data={columns:['Region','Actual'],rows:[['North',12],['South',18],['East',16]]};
const ref={value:20,label:'Target 20',stroke:{color:'#C44900',width:2,dash:'dash'}};
const deck=options=>({design:{fontScheme:'roboto'},slides:[{chart:{type:'bar',data,legend:'none',dataLabels:false,referenceLines:[ref],...options}}]});
const options={seed:1,timestamp:'2026-01-01T00:00:00Z',provenance:'full'};
test('suite03 bar options export real line/text overlays, pin the reference-aware plot/axis, and import once',async()=>{
 const doc=deck(),diagnostics=[],bytes=await toPptx(doc,{...options,onDiagnostic:d=>diagnostics.push(d)}),zip=unzipSync(bytes),slide=strFromU8(zip['ppt/slides/slide1.xml']),chart=strFromU8(zip['ppt/charts/chart1.xml']);
 assert.equal((slide.match(/name="OPF chart 1:0 line"/g)??[]).length,1);assert.equal((slide.match(/name="OPF chart 1:0 label"/g)??[]).length,1);assert.match(slide,/>Target 20</);assert.match(slide,/<a:prstDash val="dash"/);assert.match(slide,/<a:ln w="19050"/);assert.match(chart,/<c:layoutTarget val="inner"/);assert.match(chart,/<c:max val="25"/);assert.match(chart,/<c:min val="0"/);assert.equal((chart.match(/<c:ser>/g)??[]).length,1);assert.ok(diagnostics.some(d=>d.code==='chart-reference-overlay'));
 const imported=await fromPptx(bytes);assert.deepEqual(imported.slides[0].chart.data,data);assert.deepEqual(imported.slides[0].chart.referenceLines,[{axis:'value',labelPosition:'end',...ref}]);assert.equal(imported.slides[0].shapes?.length??0,0);// Existing native import elides redundant one-series legend/label defaults; check their actual output here.
 assert.ok(!chart.includes('<c:legend>'));assert.ok(!chart.includes('<c:showVal val="1"/>'));
});
test('active bar percentage/zero-width references keep values and labels without helper series or duplicate shapes',async()=>{
 const refs=[{value:.2,label:'Target 20%',labelPosition:'start',stroke:{color:'#123456',width:3,dash:'dot'}},{value:-.1,label:'Floor',stroke:{color:'#456789',width:0,dash:'solid'}}],doc=deck({data:{...data,columns:['Region',{name:'Actual',format:'0%'}],rows:[['North',.12],['South',.18],['East',.16]]},legend:'top',axisTitles:{category:'Region',value:'Rate'},referenceLines:refs}),bytes=await toPptx(doc,options),zip=unzipSync(bytes),chart=strFromU8(zip['ppt/charts/chart1.xml']),slide=strFromU8(zip['ppt/slides/slide1.xml']);assert.equal((chart.match(/<c:ser>/g)??[]).length,1);assert.match(slide,/<a:prstDash val="dot"/);assert.match(slide,/<a:ln w="0"/);const imported=await fromPptx(bytes);assert.deepEqual(imported.slides[0].chart.referenceLines,refs.map(r=>({axis:'value',labelPosition:'end',...r})));assert.deepEqual(imported.slides[0].chart.data,doc.slides[0].chart.data);assert.equal(imported.slides[0].shapes?.length??0,0);
});



