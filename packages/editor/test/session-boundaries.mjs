import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditorSession} from '../dist/index.js';
import {createMemoryStorage,createPersistence} from '../dist/persistence.js';
import {validate} from '@openpresentation/opf';

// Keep the shipped discriminant synchronized with the actual refused-draft status.
const persistenceTypes=readFileSync(new URL('../dist/persistence.d.ts',import.meta.url),'utf8');
const declaredErrors=/export interface AutosaveStatus \{[\s\S]*?error\?:\s*([^;]+);/.exec(persistenceTypes)?.[1];
assert.ok(declaredErrors,'AutosaveStatus.error is declared');
assert.deepEqual([...declaredErrors.matchAll(/"([^"]+)"/g)].map(match=>match[1]).sort(),['draft','quota','write']);

const document = () => ({slides:[{title:'Original',items:['One','Two']}]});
{
  const editor=createEditorSession(document(),{rejectInvalid:true,catalogs:[]});
  const before=editor.snapshot();let events=0;editor.subscribe(()=>events++);
  const slide=editor.get('slides.0');slide.title=123;slide.items.push('Foreign');
  const all=editor.get('');all.slides.length=0;
  assert.deepEqual(editor.presentation,document());assert.strictEqual(editor.snapshot(),before);
  assert.equal(editor.validation.valid,true);assert.equal(editor.canUndo,false);assert.equal(events,0);
  assert.equal(editor.get('slides.0.title'),'Original');
  const fallback={missing:true};assert.strictEqual(editor.get('missing',fallback),fallback);
  assert.equal(editor.get('missing'),undefined);assert.equal(editor.get('missing',0),0);
}
{
  const deck={design:{theme:'minimal'},slides:[{title:'Catalog boundary'}]};
  const expected=validate(deck,{catalogs:[],only:['format','opf/unresolved-reference','opf/undeclared-catalog','opf/catalog-record-not-in-source']});
  const editor=createEditorSession(deck,{catalogs:[]});
  assert.equal(editor.catalogs.length,0);assert.deepEqual(editor.validation.findings,expected.findings);
  assert.ok(expected.findings.some(f=>f.ruleId==='opf/unresolved-reference'));
  editor.setCatalogs([]);assert.deepEqual(editor.validation.findings,expected.findings);
}
const key='opf-editor/v2/review';
const controller=(editor,storage,extra={})=>createPersistence(editor,{key:'review',storage,window:null,debounceMs:10000,...extra});
{
  const editor=createEditorSession(document());const storage=createMemoryStorage();let calls=0;let draft='New active draft';
  const p=controller(editor,storage,{beforeFlush(){calls++;if(draft){editor.set('slides.0.title',draft);draft=undefined;}}});
  await p.ready;assert.equal(editor.canUndo,false);assert.equal(await p.flush(),true);
  assert.equal(calls,1);assert.equal((await storage.get(key)).presentation.slides[0].title,'New active draft');
  assert.equal(p.dirty,true);p.destroy();
}
for (const refusal of [()=>false,()=>{throw new Error('Invalid active draft');}]) {
  const editor=createEditorSession(document());const storage=createMemoryStorage();let refuse=true;
  const p=controller(editor,storage,{beforeFlush(){return refuse?refusal():undefined;}});await p.ready;
  editor.set('slides.0.title','Committed work');assert.equal(await p.flush(),false);
  assert.equal(await storage.get(key),undefined);assert.equal(p.status.error,'draft');assert.equal(p.dirty,true);
  refuse=false;assert.equal(await p.flush(),true);assert.equal((await storage.get(key)).presentation.slides[0].title,'Committed work');p.destroy();
}
{
  const editor=createEditorSession(document());const storage=createMemoryStorage();let calls=0;
  const p=controller(editor,storage,{debounceMs:5,beforeFlush(){calls++;if(editor.get('slides.0.title')!=='Draft after trigger')editor.set('slides.0.title','Draft after trigger');}});await p.ready;
  editor.set('slides.0.title','Trigger');
  for(let i=0;i<50&&!await storage.get(key);i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await storage.get(key)).presentation.slides[0].title,'Draft after trigger');assert.equal(calls,1);p.destroy();
}
{
  const editor=createEditorSession(document());const memory=createMemoryStorage();let release,started;
  const begin=new Promise(resolve=>started=resolve);let active=0,maxActive=0,writes=0,calls=0;
  const storage={get:k=>memory.get(k),delete:k=>memory.delete(k),async set(k,v){active++;maxActive=Math.max(maxActive,active);if(++writes===1){started();await new Promise(resolve=>release=resolve);}await memory.set(k,v);active--;}};
  const p=controller(editor,storage,{beforeFlush(){calls++;}});await p.ready;
  editor.set('slides.0.title','First');const first=p.flush();await begin;
  editor.set('slides.0.title','Second');const second=p.flush();release();
  assert.equal(await first,true);assert.equal(await second,true);assert.equal(maxActive,1);assert.equal(calls,2);
  assert.equal((await memory.get(key)).presentation.slides[0].title,'Second');p.destroy();
}
{
  const win=new EventTarget();const editor=createEditorSession(document());let calls=0;
  const p=controller(editor,createMemoryStorage(),{window:win,beforeFlush(){calls++;return false;}});await p.ready;
  const event=new Event('beforeunload',{cancelable:true});Object.defineProperty(event,'returnValue',{writable:true,value:undefined});win.dispatchEvent(event);
  assert.equal(calls,1);assert.equal(event.defaultPrevented,true);assert.equal(p.status.error,'draft');
  win.dispatchEvent(new Event('pagehide'));assert.equal(calls,2);p.destroy();
}
console.log('Session boundaries passed: isolated reads, explicit empty catalogs, fresh/debounced/refused/serialized flushes and one lifecycle hook.');
