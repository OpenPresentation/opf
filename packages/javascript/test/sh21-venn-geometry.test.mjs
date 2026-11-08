import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {vennNodes} from '../dist/composition.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/sh21-venn-native-geometry.json',import.meta.url)));
test('SH21: Basic Venn circle and label geometry matches all 140 independent PowerPoint measurements',()=>{
 assert.equal(fixture.rows.length,140);
 const near=(box,expected,label)=>{for(const [i,key] of ['x','y','width','height'].entries())assert.ok(Math.abs(box[key]-expected[i])<=.1,`${label} ${key}: ${box[key]} vs ${expected[i]}`);};
 for(const row of fixture.rows){const [width,height]=row.frame.split('x').map(Number),nodes=vennNodes({x:0,y:0,width,height},row.count);assert.equal(nodes.length,row.count);assert.equal(row.circles.length,row.count);assert.equal(row.labels.length,row.count);for(const [i,node]of nodes.entries()){near(node.box,row.circles[i],`${row.count} ${row.frame} circle ${i}`);near(node.textBox,row.labels[i],`${row.count} ${row.frame} label ${i}`);}}
});
test('SH21: translation and unsupported counts preserve the geometry boundary',()=>{
 const a=vennNodes({x:0,y:0,width:600,height:400},5),b=vennNodes({x:37,y:19,width:600,height:400},5);for(let i=0;i<a.length;i++){assert.equal(b[i].box.x,a[i].box.x+37);assert.equal(b[i].textBox.y,a[i].textBox.y+19);}
 for(const count of [0,-1,1.5,8,Infinity,NaN])assert.throws(()=>vennNodes({x:0,y:0,width:600,height:400},count),RangeError);
 assert.throws(()=>vennNodes({x:0,y:0,width:0,height:400},3),RangeError);
});
