// FA-12: quote role and photo are edited through the generic schema form (core's schema supplies the fields), the canvas and the
// find/replace model; the session previews, undoes and validates them like any other field.
import assert from 'node:assert/strict';
import {schemaAtPath,listSchemaFields} from '../src/schema.js';
import {createEditorSession} from '../src/index.js';
import {findMatches,replaceAll} from '../src/find-replace.js';
import {getEditableFields} from '../src/canvas-fields.js';

const deck=()=>({design:{fontScheme:'roboto'},slides:[{title:'Customers',quote:{text:'Exceptions became visible.',attribution:'Priya Raman',role:'Head of Platform, Acme',photo:{src:'./priya.jpg',alt:'Priya Raman, Acme'}}}]});

// The generic schema form knows both fields and their types.
assert.equal(schemaAtPath(deck(),'/slides/0/quote/role').type,'string');
assert.equal(schemaAtPath(deck(),'/slides/0/quote/photo').$ref!==undefined||schemaAtPath(deck(),'/slides/0/quote/photo').oneOf!==undefined,true);
assert.ok(listSchemaFields().some(field=>field.schema==='presentation'&&field.path==='/$defs/Quote/properties/role'));
assert.ok(listSchemaFields().some(field=>field.schema==='presentation'&&field.path==='/$defs/Quote/properties/photo'));

// The session sets, validates and undoes them in one step each.
const editor=createEditorSession(deck(),{rejectInvalid:true});
editor.set('slides.0.quote.role','VP Operations, Acme');
editor.set('slides.0.quote.photo.alt','Priya Raman at Acme');
assert.equal(editor.presentation.slides[0].quote.role,'VP Operations, Acme');
assert.equal(editor.validation.valid,true);
editor.undo();
assert.equal(editor.presentation.slides[0].quote.photo.alt,'Priya Raman, Acme');
assert.throws(()=>editor.set('slides.0.quote.role',42));
const composed=editor.composeSlide(0).items.find(item=>item.field==='quote').quoteLayout;
assert.ok(composed.photo,'the session composes the photo');
assert.equal(composed.parts[1].text,'Priya Raman\nVP Operations, Acme');

// The canvas lists them as editable fields.
const {fields}=getEditableFields(deck().slides[0].quote,'slides.0.quote');
assert.ok(fields.some(field=>field.path.endsWith('/role')&&field.type==='string'));
assert.ok(fields.some(field=>field.path.endsWith('/photo/alt')));

// Find and replace reaches the role and the photo's alt text.
const found=findMatches(deck(),'Acme');
assert.deepEqual(found.matches.map(match=>match.path).sort(),['slides.0.quote.photo.alt','slides.0.quote.role']);
const replaced=createEditorSession(deck(),{rejectInvalid:true});
replaceAll(replaced,'Acme','Globex');
assert.equal(replaced.presentation.slides[0].quote.role,'Head of Platform, Globex');
assert.equal(replaced.presentation.slides[0].quote.photo.alt,'Priya Raman, Globex');
console.log('Quote role and photo: schema form, session edit/undo/validation, canvas fields and find/replace pass.');
