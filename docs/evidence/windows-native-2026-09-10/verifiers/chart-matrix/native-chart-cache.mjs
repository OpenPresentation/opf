import assert from 'node:assert/strict';
import path from 'node:path';
import {strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];

// Independent of OPF's importer: inspect the chart selected by the slide's OPC
// relationship, including PowerPoint's package-absolute relationship targets.
export function readChartCache(archive,index) {
 const xml=file=>{assert.ok(archive[file],file);return parser.parse(strFromU8(archive[file]));};
 const slide=`ppt/slides/slide${index+1}.xml`,frames=array(xml(slide)['p:sld']['p:cSld']['p:spTree']['p:graphicFrame']);
 const chart=frames.map(frame=>frame['a:graphic']?.['a:graphicData']?.['c:chart']).filter(Boolean);assert.equal(chart.length,1);
 const rel=array(xml(`ppt/slides/_rels/slide${index+1}.xml.rels`).Relationships.Relationship).find(rel=>rel.Id===chart[0]['r:id']);assert.ok(rel);assert.notEqual(rel.TargetMode,'External');
 const part=path.posix.normalize(rel.Target.startsWith('/')?rel.Target.slice(1):path.posix.join('ppt/slides',rel.Target));
 assert.ok(part.startsWith('ppt/charts/'),'Fixture chart relationship must stay in the chart directory');
 const plot=xml(part)['c:chartSpace']['c:chart']['c:plotArea'];
 const series=array((plot['c:barChart']??plot['c:pieChart'])?.['c:ser']);assert.ok(series.length);
 const points=cache=>{assert.ok(cache);const points=array(cache['c:pt']).sort((a,b)=>Number(a.idx)-Number(b.idx));assert.equal(points.length,Number(cache['c:ptCount'].val));return points.map((point,index)=>{assert.equal(Number(point.idx),index);return point['c:v'];});};
 return series.map(series=>{
  let cache=series['c:cat']['c:strRef']?.['c:strCache'];
  if(!cache){const multi=series['c:cat']['c:multiLvlStrRef']?.['c:multiLvlStrCache'];assert.ok(multi);const levels=array(multi['c:lvl']);assert.equal(levels.length,1,'Fixture categories have one level');cache={...levels[0],'c:ptCount':multi['c:ptCount']};}
  return {name:points(series['c:tx']['c:strRef']['c:strCache'])[0],categories:points(cache),values:points(series['c:val']['c:numRef']['c:numCache']).map(Number)};
 });
}
