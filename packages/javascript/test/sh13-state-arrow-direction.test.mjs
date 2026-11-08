import assert from 'node:assert/strict';
import {test} from 'node:test';
import {plantumlToMermaid} from '../dist/composition.js';
const source=arrow=>`@startuml\nstate A\nstate B\nA ${arrow} B : next\n@enduml`;
test('SH13: a state transition with two arrowheads is refused at its authored source line',()=>{
 for(const arrow of ['<->','<-->']){const result=plantumlToMermaid(source(arrow),{maxEdges:500});assert.equal(result.ok,false,arrow);assert.equal(result.issue.code,'diagram-syntax');assert.equal(result.issue.line,4);assert.equal(result.issue.column,1);assert.match(result.issue.message,/one arrowhead/);}
});
test('SH13: the supported forward and reverse state transitions preserve their direction',()=>{
 const forward=plantumlToMermaid(source('-->'),{maxEdges:500}),reverse=plantumlToMermaid(source('<--'),{maxEdges:500});
 assert.equal(forward.ok,true);assert.match(forward.translation.mermaid,/A --> B : next/);
 assert.equal(reverse.ok,true);assert.match(reverse.translation.mermaid,/B --> A : next/);
});
