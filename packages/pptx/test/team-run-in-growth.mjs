// opf#1470: the PowerPoint export follows the preview: the names of a team's "name, line break, role" cards are bold runs after the body grows.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, resolvePresentation} from './helpers/default-catalog.mjs';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const shapesOf=bytes=>array(parser.parse(decode(unzipSync(bytes)['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree']['p:sp']);
const runsOf=shape=>array(shape['p:txBody']?.['a:p']).flatMap(paragraph=>array(paragraph['a:r']));
const people=[['Dana Levi','Operations lead, North terminal'],['Omar Haddad','Scheduling analyst'],['Lena Park','Gate staff trainer']];
const deck={slides:[{layout:'team',title:'Team',blocks:people.map(([name,role])=>({text:`${name}\n${role}`}))}]};

const items=resolvePresentation(deck,{}).slides[0].geometry.items.filter(item=>item.field==='text');
assert.equal(items.length,3);
assert.ok(items.every(item=>item.runs?.[0]?.bold===true),'the preview draws the names bold');
const shapes=shapesOf(await toPptx(deck,{}));
for(const [name] of people){
  const runs=shapes.flatMap(runsOf),named=runs.filter(run=>run['a:t'].trim()===name);
  assert.equal(named.length,1,`${name}: one run holds the name on one line`);
  assert.equal(named[0]['a:rPr'].b,'1',`${name}: the run is bold`);
  const size=Number(named[0]['a:rPr'].sz),roles=runs.filter(run=>run['a:rPr']?.b!=='1'&&run['a:t'].trim());
  assert.ok(size>0&&roles.every(run=>run['a:rPr'].b!=='1'),'the roles are regular');
}
console.log('team run-in growth: the exported names are bold runs, as the preview draws them');
