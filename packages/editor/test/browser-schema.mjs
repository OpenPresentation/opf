import {createSchemaInspector} from '../src/schema-inspector.js';
import {createEditorSession} from '../src/index.js';
const out=document.querySelector('#results'),host=document.querySelector('#inspector');let count=0;
const check=(value,message)=>{if(!value)throw new Error(message);count++;out.textContent+=`PASS ${message}\n`;};
const click=name=>{const node=[...host.querySelectorAll('button')].find(n=>(n.getAttribute('aria-label')??n.textContent)===name);if(!node)throw new Error('Missing control '+name);node.click();};
const fill=(label,value)=>{const node=host.querySelector(`[aria-label="${label}"]`);node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
try{
 const editor=createEditorSession({design:{fontScheme:'roboto'},slides:[{title:'Original',blocks:[{text:'One'},{text:'Two'}]}]});let latest;
 const inspector=createSchemaInspector(host,{editor,path:'/slides/0',onDraft:({document})=>{latest=document;}});
 click('Edit title');fill('Value','Draft title');check(latest.slides[0].title==='Draft title','valid fields update the live draft');check(editor.document.slides[0].title==='Original','draft does not mutate editor');check(inspector.commit(),'valid draft commits');editor.undo();check(editor.document.slides[0].title==='Original','one undo restores source');
 inspector.navigate('/design');click('Add background');let select=host.querySelector('[aria-label="Value form"]');select.value=String([...select.options].findIndex(o=>o.textContent==='gradient'));select.dispatchEvent(new Event('change',{bubbles:true}));check(inspector.document.design.background.type==='gradient','union forms instantiate required fields');click('Edit gradient');click('Add stops');click('Add item');check(inspector.document.design.background.gradient.stops.length===1,'nested arrays can be created');click('Edit position');fill('Value','2');check(!inspector.commit(),'invalid nested values cannot commit');fill('Value','0.4');check(inspector.commit(),'corrected values commit');
 inspector.navigate('/slides/0/blocks');click('Move down');check(inspector.document.slides[0].blocks[0].text==='Two','array reordering preserves values');inspector.reset();
 inspector.navigate('/slides/0/title');fill('Value','Local draft');editor.set('/slides/0/title','External change');check(!inspector.commit(),'concurrent changes reject stale draft');inspector.reset();check(inspector.document.slides[0].title==='External change','discard reloads the latest document');
 inspector.navigate('/catalogs'); // Missing properties return to the nearest available root.
 inspector.navigate('');click('Add assets');fill('New field name','logo/primary');click('Add named field');fill('Value','data:image/png;base64,AA==');check(inspector.document.assets['logo/primary']==='data:image/png;base64,AA==','map keys preserve JSON Pointer escaping');inspector.reset();
 inspector.navigate('/slides/0');click('Add hidden');const box=host.querySelector('input[type=checkbox]');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));check(inspector.document.slides[0].hidden===true,'booleans retain their type');inspector.reset();
 inspector.destroy();check(!host.children.length,'destroy removes owned DOM');out.textContent+=`\n${count} checks passed`;document.title='Schema checks passed';
}catch(error){out.textContent+='FAIL '+error.stack;document.title='Schema checks failed';throw error;}
