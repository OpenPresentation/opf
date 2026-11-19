// An org chart's assistant (`assistant: true`) and a Venn's overlap label (`overlap: true`): schema, shared geometry and refusals.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,nativeTreeGeometry} from '../dist/composition.js';
import {resolveSlideContext,validate} from '../dist/index.js';
import {gallery} from '@openpresentation/gallery';

const compose=(layout,items)=>{const context=resolveSlideContext({language:'en-US',slides:[{layout,title:'Overlapping sets',items}]},0,{catalogs:[gallery]});return composeSlide(context.slide,context.options);};
const adapted=geometry=>geometry.diagnostics.filter(issue=>issue.code==='arrangement-adapted').map(issue=>issue.message);
const intersects=(a,b)=>a.x<b.x+b.width-1e-6&&b.x<a.x+a.width-1e-6&&a.y<b.y+b.height-1e-6&&b.y<a.y+a.height-1e-6;
const frame={x:0,y:0,width:1000,height:500};
const L=(text,level,extra={})=>({text,level,...extra});

test('the schema takes assistant and overlap on a list entry',()=>{
  const deck={slides:[{layout:'org-chart',title:'T',items:[L('Lead',0),L('Chief of staff',1,{assistant:true}),L('Build',1)]},{layout:'venn',title:'V',items:['A','B',{text:'Both',overlap:true}]}]};
  const result=validate(deck,{only:['format'],catalogs:[gallery]});
  assert.equal(result.findings.filter(issue=>issue.severity==='error').length,0,JSON.stringify(result.findings));
});

test('an assistant hangs below its manager, to the right of the line to the reports, which start a row lower',()=>{
  const geometry=nativeTreeGeometry('org-chart',frame,[L('Lead',0),L('Chief of staff',1,{assistant:true}),L('Build',1),L('Ship',1)]);
  assert.ok(geometry.ok);
  const [lead,assistant,build,ship]=geometry.nodes,center=lead.box.x+lead.box.width/2;
  assert.ok(assistant.box.y>=lead.box.y+lead.box.height,'below the manager');
  assert.ok(assistant.box.x>center,'to the right of the manager\'s center line');
  for(const report of[build,ship])assert.ok(report.box.y>=assistant.box.y+assistant.box.height,'the reports start below the assistant');
  assert.ok(Math.abs((build.box.x+ship.box.x+ship.box.width)/2-center)<1e-6,'the manager stays centered over the reports');
  const elbow=geometry.connectors.find(connector=>connector.child===1);
  assert.deepEqual(elbow.points,[[center,lead.box.y+lead.box.height],[center,assistant.box.y+assistant.box.height/2],[assistant.box.x,assistant.box.y+assistant.box.height/2]]);
  for(const connector of geometry.connectors.filter(connector=>connector.child!==1)){
    const bar=connector.points[1][1];
    assert.ok(bar>assistant.box.y+assistant.box.height&&bar<build.box.y,'the reports\' bar runs between the assistant and the reports');
  }
});

test('a tree without an assistant keeps its geometry; a subtree\'s assistant is kept clear of the next subtree',()=>{
  const plain=[L('Lead',0),L('Build',1),L('Web',2),L('App',2),L('Ship',1)];
  assert.deepEqual(nativeTreeGeometry('org-chart',frame,plain),nativeTreeGeometry('org-chart',frame,plain.map(entry=>({...entry,assistant:false}))));
  const geometry=nativeTreeGeometry('org-chart',frame,[L('Lead',0),L('Build',1),L('Coordinator',2,{assistant:true}),L('Web',2),L('App',2),L('Ship',1),L('Mobile',2)]);
  assert.ok(geometry.ok);
  for(const a of geometry.nodes)for(const b of geometry.nodes)if(a!==b)assert.equal(intersects(a.box,b.box),false,`${a.index} and ${b.index} overlap`);
});

test('the root, an assistant with reports and a hierarchy\'s assistant are refused, never reparented',()=>{
  assert.match(nativeTreeGeometry('org-chart',frame,[L('Lead',0,{assistant:true}),L('Build',1)]).reason,/root cannot be an assistant/);
  assert.match(nativeTreeGeometry('org-chart',frame,[L('Lead',0),L('Chief',1,{assistant:true}),L('Aide',2)]).reason,/assistant has no reports/);
  assert.match(nativeTreeGeometry('hierarchy',frame,[L('Lead',0),L('Chief',1,{assistant:true})]).reason,/hierarchy has no assistants/);
  const items=[L('Lead',0),L('Chief',1,{assistant:true}),L('Build',1)],geometry=compose('hierarchy',items);
  assert.equal(geometry.arrangements?.length??0,0);assert.ok(adapted(geometry).some(message=>/org chart only/.test(message)));
  const pyramid=compose('pyramid',['Top',{text:'Middle',assistant:true},'Base']);
  assert.ok(adapted(pyramid).some(message=>/org chart only/.test(message)));
});

test('an org chart draws its assistant at the list size or larger, with every entry',()=>{
  const items=[L('Pilot lead',0),L('Chief of staff',1,{assistant:true}),L('Delivery',1),L('Evidence',1)],geometry=compose('org-chart',items);
  const arrangement=geometry.arrangements[0],item=geometry.items.find(entry=>entry.field==='items');
  assert.equal(arrangement.kind,'org-chart');assert.equal(arrangement.nodes.length,4);assert.deepEqual(adapted(geometry),[]);
  assert.ok(item.listColumns.every(column=>column.text.fontSize===arrangement.fontSize&&!column.text.overflow));
  assert.equal(arrangement.connectors.find(connector=>connector.child===1).points.length,3);
});

const vennCases=[[['Love','Need','Skill'],'Sweet spot'],[['Design','Engineering'],'Product'],[['Speed','Quality','Cost','Scope','Risk'],'Balance'],[['What we love making','What the town needs','What we do well'],'Our sweet spot']];
for(const [sets,label] of vennCases)test(`a Venn of ${sets.length} sets labels the common overlap on a pill over the circles (${label})`,()=>{
  const geometry=compose('venn',[...sets,{text:label,overlap:true}]),arrangement=geometry.arrangements[0],item=geometry.items.find(entry=>entry.field==='items');
  assert.ok(arrangement,adapted(geometry).join('; '));
  const pill=arrangement.nodes.at(-1),circles=arrangement.nodes.slice(0,-1);
  assert.equal(arrangement.nodes.length,sets.length+1);assert.equal(pill.overlap,true);assert.equal(pill.preset,'roundRect');assert.equal(pill.radius,pill.box.height/2);
  assert.ok(circles.every(node=>node.preset==='ellipse'&&!node.overlap));
  // The pill reaches into the overlap: a point of it lies inside every circle.
  const inside=(x,y)=>circles.every(node=>((x-node.box.x-node.box.width/2)/(node.box.width/2))**2+((y-node.box.y-node.box.height/2)/(node.box.height/2))**2<=1);
  const {x,y,width,height}=pill.box,points=[x+width/2,x+height/2,x+width-height/2].flatMap(px=>[y,y+height/2,y+height].map(py=>[px,py]));
  assert.ok(points.some(([px,py])=>inside(px,py)),'the pill touches the common overlap');
  // It covers no set label's text, and every entry is set at one size, the list's own or larger.
  const columns=item.listColumns;assert.equal(columns.length,sets.length+1);
  for(const column of columns.slice(0,-1)){const widest=Math.max(...column.text.listEntries[0].text.richLines.map(line=>line.width));assert.equal(intersects(pill.box,{x:column.box.x+(column.box.width-widest)/2,y:column.box.y,width:widest,height:column.box.height}),false);}
  assert.ok(columns.every(column=>column.text.fontSize===arrangement.fontSize&&!column.text.overflow));
});

test('an overlap label that is not last, a second one, one with a single set or one outside a Venn keeps the list',()=>{
  const cases=[[['A',{text:'Both',overlap:true},'B'],'venn',/not last/],[['A','B',{text:'X',overlap:true},{text:'Y',overlap:true}],'venn',/more than one overlap label/],[['A',{text:'X',overlap:true}],'venn',/fewer than two sets/],[['A','B',{text:'X',overlap:true}],'pyramid',/Venn only/]];
  for(const [items,layout,reason] of cases){const geometry=compose(layout,items);assert.equal(geometry.arrangements?.length??0,0);assert.ok(adapted(geometry).some(message=>reason.test(message)),adapted(geometry).join('; '));assert.deepEqual(geometry.items.find(entry=>entry.field==='items').value,items);}
  // Seven sets and an overlap label are eight entries, which the seven-set limit counts as seven sets.
  const seven=compose('venn',['A','B','C','D','E','F','G',{text:'All',overlap:true}]);
  assert.ok(!adapted(seven).some(message=>/more than 7/.test(message)));
});
