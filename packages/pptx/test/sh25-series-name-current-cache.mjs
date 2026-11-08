import assert from 'node:assert/strict';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {toPptx,fromPptx} from './helpers/default-catalog.mjs';
const chart={type:'column',data:{columns:['Country','Current','Expansion'],rows:[['US',20,10],['France',15,8]]}},deck={design:{fontScheme:{major:'Arial',minor:'Arial'}},slides:[{title:'Current native names stay authoritative',blocks:[{id:'chart',chart}],shapes:[{shape:'ellipse',fill:'none',stroke:{color:'accent2',width:3},at:{block:'chart',point:'US',series:0,edge:'end',width:32,height:32}},{shape:'ellipse',fill:'none',stroke:{color:'accent2',width:3},at:{block:'chart',point:'France',series:'Current',edge:'end',width:32,height:32}}]}]};
const bytes=await toPptx(deck);
// Literal c:tx/c:v regression is preserved separately; the next derived product PR must fix it before actual rename qualification.
for(const form of ['cached-name']){
 const parts=unzipSync(bytes),xml=strFromU8(parts['ppt/charts/chart1.xml']),first=/<c:ser>[\s\S]*?<\/c:ser>/.exec(xml)[0],tx=/<c:tx>[\s\S]*?<\/c:tx>/.exec(first)[0],replacement=form==='literal-name'?'<c:tx><c:v>Native renamed<\/c:v><\/c:tx>':tx.replace('Current','Native renamed');assert.notEqual(replacement,tx);
 parts['ppt/charts/chart1.xml']=strToU8(xml.replace(first,first.replace(tx,replacement)));
 const findings=[],current=await fromPptx(zipSync(parts),{onDiagnostic:d=>findings.push(d)}),slide=current.slides[0],actual=slide.blocks.find(b=>b.chart).chart;
 assert.equal(actual.data.columns[1],'Native renamed',form+': current native series name wins over old OPF/workbook cache');assert.deepEqual(actual.data.rows,chart.data.rows,form+': values remain complete');assert.equal(slide.shapes[0].at.series,0,form+': numeric selector remains attached to current series');assert.equal(slide.shapes[1].at,undefined,form+': stale named selector does not resurrect old series name');assert.equal(typeof slide.shapes[1].x,'number',form+': actual native overlay position is preserved');assert.ok(findings.some(d=>d.code==='shape-property-dropped'&&d.property==='chart point anchor'),form+': stale name selector refusal is explicit');
}
console.log('SH25current native series names: cached-name edits override source, values/numeric selector retained, stale named selector explicitly falls back.');
