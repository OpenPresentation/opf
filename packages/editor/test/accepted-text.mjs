import assert from 'node:assert/strict';
import {createEditorSession} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'}),options={textMeasurement:fonts.textMeasurement,textRasterPadding:1.5};
let cases=0;
for(const dimensions of [{widthInches:40/3,heightInches:7.5},{widthInches:5.625,heightInches:10}])for(const align of ['left','center','right'])for(const contentBox of [false,true]) {
  const original={design:{fontScheme:{id:'roboto',heading:{family:'Aptos Display'},body:{family:'Aptos'}},dimensions,contentBox,titleAlignment:align,contentAlignment:align},slides:[{title:'Complete heading that wraps on a narrow slide',text:[{text:'Negative bearing j and ',italic:true},{text:'mixed styles.',bold:true}]}]};
  const editor=createEditorSession(original,{rejectInvalid:true});
  const verify=()=>assert.deepEqual(editor.composeSlide(0,options).items,resolvePresentation(editor.document,options).slides[0].geometry.items);
  verify();editor.set('slides.0.title','Edited complete heading');verify();editor.undo();verify();assert.deepEqual(editor.document,original);editor.redo();verify();editor.undo();
  editor.paginateSlide(0,options);verify();if(editor.canUndo)editor.undo();assert.deepEqual(editor.document,original);cases++;
}
console.log(`Accepted text editor: ${cases} wide/portrait/alignment/card layouts match rendering across edit, undo/redo and explicit pagination.`);
