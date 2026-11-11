import assert from 'node:assert/strict';
import {test} from 'node:test';
import {arrangementTree} from '../dist/composition.js';
test('SH21: the semantic tree preserves every source index, parent depth and child order',()=>{
 const entries=[{text:'Plan',level:0},{text:'Build',level:1},{text:[{text:'Web',bold:true}],level:2,description:'Website'},{text:'App',level:2},{text:'Test',level:1},{text:'Unit',level:2},{text:'Assertions',level:3}];
 const before=structuredClone(entries),result=arrangementTree(entries);assert.equal(result.ok,true);assert.equal(result.nodes.length,entries.length);
 assert.deepEqual(result.nodes.map(node=>node.parent??null),[null,0,1,1,0,4,5]);assert.deepEqual(result.nodes[0].children,[1,4]);assert.deepEqual(result.nodes[1].children,[2,3]);assert.deepEqual(result.nodes.map(node=>node.index),[0,1,2,3,4,5,6]);assert.deepEqual(entries,before,'all text/runs/descriptions/levels remain authored');
});
test('SH21: missing root, forests, parent jumps and malformed levels are explicit failures without source mutation',()=>{
 const cases=[[],[{text:'Child',level:1}],['Root','Other root'],[{text:'Root'},{text:'Child',level:2}],[{text:'Root'},{text:'Child',level:-1}],[{text:'Root'},{text:'Child',level:1.5}],[{text:'Root'},{text:'Child',level:Infinity}],[{text:'Root'},{text:'Child',level:null}]];
 for(const entries of cases){const before=structuredClone(entries),result=arrangementTree(entries);assert.equal(result.ok,false,JSON.stringify(entries));assert.ok(result.reason);assert.deepEqual(entries,before);}
});
test('SH21: the only implicit level is zero and a deeper subtree may return to an existing parent',()=>{
 assert.deepEqual(arrangementTree(['Root']),{ok:true,nodes:[{index:0,level:0,children:[]}]});
 const result=arrangementTree([{text:'Root'},{text:'A',level:1},{text:'B',level:2},{text:'C',level:1}]);assert.equal(result.ok,true);assert.deepEqual(result.nodes.map(n=>n.parent??null),[null,0,1,0]);
});
