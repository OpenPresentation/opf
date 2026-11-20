import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {loadFonts} from '../dist/fonts-node.js';
import {createScriptFonts} from '../dist/fonts.js';
import {catalogs} from './catalog-harness.mjs';

const title='Seit 2023 lag die Pünktlichkeit über zweiundneunzig Prozent';
const document={language:'de-DE',design:{fontScheme:'arial'},slides:[{title}]};

test('a chosen Arial Black Latin run checks the exact 900 face it measures, without preparing an unrelated 700 face',async()=>{
  const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document,renderOptions:{catalogs}});
  const style={fontFamily:'Arial Black',fontWeight:700,path:'slides.0.title'};
  assert.deepEqual(fonts.registry.describeFaces().filter(face=>face.family==='Montserrat').map(face=>[face.weight,face.italic]),[[900,false]]);
  assert.equal(fonts.textMeasurement.resolveStyle(style).fontWeight,900);
  const notes=[],planner=createScriptFonts(resolveScriptFonts(document,{catalogs}),fonts.textMeasurement,{onFallback:note=>notes.push(note)});
  const planned=planner.textMeasurement.measure(title,36,style);
  assert.equal(planned,fonts.textMeasurement.measure(title,36,style),'an own run uses its original chosen-family resolution, including encoded weight');
  assert.deepEqual(notes,[],'covered Latin characters do not trigger another physical family');
  assert.throws(()=>fonts.textMeasurement.measure(title,36,{...style,fontFamily:'Montserrat'}),{code:'font-unavailable'},'unprepared Montserrat 700 is still refused');
  assert.deepEqual(fonts.pending(document,{catalogs}),[]);
});
