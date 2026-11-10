// A cell border is a Line: 'none' removes the edge, and a line without a color or a width keeps the table rule's own.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg} from './catalog-harness.mjs';
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));
const lines=svg=>[...svg.matchAll(/<line\b([^>]*)>/g)].map(([,a])=>attrs(a));
const deck=borders=>({design:{fontScheme:'roboto',colorScheme:'cool-horizon'},slides:[{title:'Bookings',table:{columns:['Region','Bookings'],rows:[[{value:'North',style:{borders}},42],['South',31]]}}]});
const edge=(svg,name)=>lines(svg).find(a=>a['data-opf-path']===`slides.0.table.rows.0.0.style.borders.${name}`);
test("'none' draws no line and a partial line takes the table rule's color and width",()=>{
 const plain=toSvg(deck(undefined),1,{trace:true}),rule=lines(plain).find(a=>a['data-opf-path']==='slides.0.table.rows.0.0');assert.ok(rule,'the default rule under the cell');
 const svg=toSvg(deck({bottom:'none',top:{dash:'dash'},left:{width:3},right:{color:'#C01234'}}),1,{trace:true});
 assert.equal(edge(svg,'bottom'),undefined,"'none' removes the edge");
 // The cell's default rule is gone too: the explicit edge replaces it.
 assert.ok(!lines(svg).some(a=>a['data-opf-path']==='slides.0.table.rows.0.0'&&a.y1===rule.y1&&a.y2===rule.y2&&a.x1===rule.x1));
 const top=edge(svg,'top'),left=edge(svg,'left'),right=edge(svg,'right');
 assert.equal(top.stroke,rule.stroke);assert.equal(top['stroke-width'],rule['stroke-width']);assert.ok(top['stroke-dasharray']);
 assert.equal(left.stroke,rule.stroke);assert.equal(Number(left['stroke-width']),3);
 assert.equal(right.stroke.toUpperCase(),'#C01234');assert.equal(right['stroke-width'],rule['stroke-width']);
 assert.ok(!svg.includes('undefined')&&!svg.includes('NaN'));
});
