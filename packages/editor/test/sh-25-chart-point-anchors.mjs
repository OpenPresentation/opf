import assert from 'node:assert/strict';
import {createEditorSession} from '../src/index.js';
import {setOverlayAnchor,listChartPointTargets,prepareOverlayAnchor} from '../src/shape-overlays.js';
const input={language:'en-US',slides:[{blocks:[{id:'costs',chart:{type:'column',data:{columns:['Country','Cost'],rows:[['US',20],['FR',8]]}}}],shapes:[{shape:'ellipse',x:.1,y:.1,width:.1,height:.1}]}]};
const editor=createEditorSession(input),path='slides.0.shapes.0',anchor={block:'costs',point:'US',series:'Cost',edge:'end',widthPx:80,heightPx:80};
const choices=listChartPointTargets(input,0);assert.deepEqual(choices.map(c=>[c.id,c.points,c.series]),[['costs',[{index:0,name:'US'},{index:1,name:'FR'}],[{index:0,name:'Cost'}]]]);
setOverlayAnchor(editor,path,anchor);assert.deepEqual(editor.presentation.slides[0].shapes[0],{shape:'ellipse',at:anchor});assert.equal(prepareOverlayAnchor(editor.presentation,path,anchor).changed,false);
editor.undo();assert.deepEqual(editor.presentation,input);editor.redo();assert.deepEqual(editor.presentation.slides[0].shapes[0].at,anchor);
for(const bad of [{...anchor,point:'missing'},{...anchor,series:100},{...anchor,point:-1},{...anchor,block:'missing'}]){const before=structuredClone(editor.presentation);assert.throws(()=>setOverlayAnchor(editor,path,bad));assert.deepEqual(editor.presentation,before);}
setOverlayAnchor(editor,path,{block:'costs',edge:'center'});assert.equal(editor.presentation.slides[0].shapes[0].at.point,undefined);editor.undo();assert.deepEqual(editor.presentation.slides[0].shapes[0].at,anchor);
console.log('SH-25 undoable point anchors pass');
